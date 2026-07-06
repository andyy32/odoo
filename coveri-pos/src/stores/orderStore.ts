/*
 * COVERI POS — current-order state (zustand).
 *
 * Optimistic-first: every edit updates local state immediately, then persists.
 * Totals are always derived through lib/tax's computeOrderTotals — the store
 * never does its own arithmetic.
 */

import { create } from 'zustand';
import { loadCatalog, type Catalog } from '@/data/catalogRepo';
import {
  cacheDraftOrder,
  createDraftOrder,
  deleteLine,
  insertLine,
  loadDraftOrder,
  updateLine,
  updateOrder,
} from '@/data/orderRepo';
import { insertTickets } from '@/data/kitchenRepo';
import { useAuthStore } from '@/stores/authStore';
import { computePrepDelta, nextSnapshot, type FireableLine } from '@/lib/prep';
import { computeOrderTotals, type OrderTotals } from '@/lib/tax';
import type { KitchenTicket, PosOrder, PosOrderLine, Product, UUID } from '@/types/db';

function newId(): UUID {
  return crypto.randomUUID();
}

interface OrderState {
  loading: boolean;
  error: string | null;
  catalog: Catalog | null;
  order: PosOrder | null;
  lines: PosOrderLine[];
  /** Line currently open in the editor panel. */
  editingLineId: UUID | null;

  openForTable: (tableId: UUID, companyId: UUID, defaultGuests: number) => Promise<void>;
  addProduct: (product: Product) => Promise<void>;
  setQty: (lineId: UUID, qty: number) => Promise<void>;
  setNote: (lineId: UUID, note: string) => Promise<void>;
  setDiscount: (lineId: UUID, discount: number) => Promise<void>;
  removeLine: (lineId: UUID) => Promise<void>;
  setGuests: (count: number) => Promise<void>;
  setEditingLine: (lineId: UUID | null) => void;
  totals: () => OrderTotals;
  /** Count of not-yet-fired changes (drives the Fire button badge). */
  pendingFireCount: (tableNumber: string) => number;
  /** Fire pending changes to their prep stations. Returns tickets fired. */
  fireOrder: (tableNumber: string) => Promise<number>;
  reset: () => void;
}

export const useOrderStore = create<OrderState>((set, get) => {
  /** Recompute totals and persist them onto the order row. */
  async function persistTotals(): Promise<void> {
    const { order } = get();
    if (!order) return;
    const t = get().totals();
    set({ order: { ...order, amount_subtotal: t.subtotal, amount_tax: t.taxTotal, amount_total: t.total } });
    await updateOrder(order.id, {
      amount_subtotal: t.subtotal,
      amount_tax: t.taxTotal,
      amount_total: t.total,
    });
  }

  return {
    loading: true,
    error: null,
    catalog: null,
    order: null,
    lines: [],
    editingLineId: null,

    openForTable: async (tableId, companyId, defaultGuests) => {
      set({ loading: true, error: null, order: null, lines: [], editingLineId: null });
      try {
        const catalog = get().catalog ?? (await loadCatalog());
        let data = await loadDraftOrder(tableId);
        if (!data) {
          const waiterId = useAuthStore.getState().staff?.id ?? null;
          const order: PosOrder = {
            id: newId(),
            company_id: companyId,
            session_id: null,
            table_id: tableId,
            waiter_id: waiterId,
            customer_count: Math.max(1, defaultGuests),
            state: 'draft',
            prep_snapshot: [],
            amount_subtotal: 0,
            amount_tax: 0,
            amount_total: 0,
            sequence_number: null,
            pos_reference: null,
          };
          await createDraftOrder({
            id: order.id,
            company_id: companyId,
            table_id: tableId,
            customer_count: order.customer_count,
            waiter_id: waiterId,
          });
          data = { order, lines: [] };
        }
        set({ loading: false, catalog, order: data.order, lines: data.lines });
      } catch (e) {
        console.error('[order] openForTable failed:', e);
        set({ loading: false, error: e instanceof Error ? e.message : String(e) });
      }
    },

    addProduct: async (product) => {
      const { order, lines } = get();
      if (!order) return;
      // Same product, no note, no discount → merge into the existing line.
      const mergeable = lines.find(
        (l) => l.product_id === product.id && !l.note && Number(l.discount) === 0,
      );
      if (mergeable) {
        await get().setQty(mergeable.id, Number(mergeable.qty) + 1);
        return;
      }
      const line: PosOrderLine = {
        id: newId(),
        order_id: order.id,
        product_id: product.id,
        full_product_name: product.name,
        qty: 1,
        price_unit: Number(product.price),
        discount: 0,
        note: null,
      };
      set({ lines: [...lines, line] });
      await insertLine(line);
      await persistTotals();
    },

    setQty: async (lineId, qty) => {
      if (qty <= 0) return get().removeLine(lineId);
      set((s) => ({ lines: s.lines.map((l) => (l.id === lineId ? { ...l, qty } : l)) }));
      await updateLine(lineId, { qty });
      await persistTotals();
    },

    setNote: async (lineId, note) => {
      const clean = note.trim() || null;
      set((s) => ({ lines: s.lines.map((l) => (l.id === lineId ? { ...l, note: clean } : l)) }));
      await updateLine(lineId, { note: clean });
    },

    setDiscount: async (lineId, discount) => {
      const d = Math.min(100, Math.max(0, discount));
      set((s) => ({ lines: s.lines.map((l) => (l.id === lineId ? { ...l, discount: d } : l)) }));
      await updateLine(lineId, { discount: d });
      await persistTotals();
    },

    removeLine: async (lineId) => {
      set((s) => ({
        lines: s.lines.filter((l) => l.id !== lineId),
        editingLineId: s.editingLineId === lineId ? null : s.editingLineId,
      }));
      await deleteLine(lineId);
      await persistTotals();
    },

    setGuests: async (count) => {
      const { order } = get();
      if (!order) return;
      const customer_count = Math.max(1, Math.round(count));
      set({ order: { ...order, customer_count } });
      await updateOrder(order.id, { customer_count });
    },

    setEditingLine: (lineId) => set({ editingLineId: lineId }),

    totals: () => {
      const { lines, catalog } = get();
      return computeOrderTotals(
        lines.map((l) => ({
          id: l.id,
          quantity: Number(l.qty),
          priceUnit: Number(l.price_unit),
          discount: Number(l.discount),
          taxes: (l.product_id && catalog?.taxesByProduct.get(l.product_id)) || [],
        })),
      );
    },

    pendingFireCount: () => {
      const delta = computePrepDelta(fireableLines(get().lines, get().catalog), get().order?.prep_snapshot ?? []);
      return delta.reduce((n, t) => n + t.items.length, 0);
    },

    fireOrder: async (tableNumber) => {
      const { order, lines, catalog } = get();
      if (!order || !catalog) return 0;
      const fireable = fireableLines(lines, catalog);
      const delta = computePrepDelta(fireable, order.prep_snapshot ?? []);
      if (delta.length === 0) return 0;

      const tickets: KitchenTicket[] = delta.map((t) => ({
        id: crypto.randomUUID(),
        company_id: order.company_id,
        order_id: order.id,
        table_number: tableNumber,
        station: t.station,
        items: t.items,
        done: false,
        fired_at: new Date().toISOString(),
      }));
      const snapshot = nextSnapshot(fireable);

      set({ order: { ...order, prep_snapshot: snapshot } });
      await insertTickets(tickets);
      await updateOrder(order.id, { prep_snapshot: snapshot });
      return tickets.length;
    },

    reset: () => set({ order: null, lines: [], editingLineId: null, error: null }),
  };
});

// Keep the per-table draft cache coherent with every optimistic edit, so an
// offline reload restores exactly what the waiter last saw.
useOrderStore.subscribe((s) => {
  if (s.order?.table_id) {
    cacheDraftOrder(s.order.table_id, { order: s.order, lines: s.lines });
  }
});

/** Map order lines to the prep engine's shape (station comes from the product). */
function fireableLines(lines: PosOrderLine[], catalog: Catalog | null): FireableLine[] {
  return lines.map((l) => ({
    id: l.id,
    name: l.full_product_name,
    qty: Number(l.qty),
    note: l.note ?? null,
    station: (l.product_id && catalog?.products.find((p) => p.id === l.product_id)?.prep_station) || null,
  }));
}
