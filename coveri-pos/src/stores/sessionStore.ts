/*
 * COVERI POS — register session state (zustand).
 */

import { create } from 'zustand';
import { loadFloorData } from '@/data/repo';
import { loadPaymentMethods } from '@/data/paymentRepo';
import {
  addCashMove,
  closeSession,
  getOpenSession,
  loadSessionReportData,
  openSession,
  type CashMove,
} from '@/data/sessionRepo';
import { useAuthStore } from '@/stores/authStore';
import type { PosPaymentMethod, PosSession } from '@/types/db';

export interface SessionReport {
  ordersCount: number;
  guests: number;
  gross: number; // tax-included sales
  net: number; // tax-excluded
  taxTotal: number;
  byMethod: { name: string; isCash: boolean; amount: number }[];
  cashIn: number;
  cashOut: number;
  /** opening float + cash payments + moves */
  expectedCash: number;
  moves: CashMove[];
}

interface SessionState {
  loading: boolean;
  session: PosSession | null;

  init: () => Promise<void>;
  open: (openingCash: number) => Promise<void>;
  close: (countedCash: number) => Promise<void>;
  cashMove: (amount: number, reason: string) => Promise<void>;
  buildReport: (session: PosSession) => Promise<SessionReport>;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  loading: true,
  session: null,

  init: async () => {
    try {
      const session = await getOpenSession();
      set({ session, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  open: async (openingCash) => {
    // The register belongs to the (single) pos_config of this company.
    const { config } = await loadFloorData();
    if (!config) throw new Error('No register configured');
    const openedBy = useAuthStore.getState().staff?.id ?? null;
    const session: PosSession = {
      id: crypto.randomUUID(),
      company_id: config.company_id,
      config_id: config.id,
      opened_by: openedBy,
      state: 'opened',
      opening_cash: openingCash,
      closing_cash: null,
      opened_at: new Date().toISOString(),
      closed_at: null,
    };
    await openSession({
      id: session.id,
      company_id: config.company_id,
      config_id: config.id,
      opening_cash: openingCash,
      opened_by: openedBy,
    });
    set({ session });
  },

  close: async (countedCash) => {
    const { session } = get();
    if (!session) return;
    await closeSession(session.id, countedCash);
    set({ session: null });
  },

  cashMove: async (amount, reason) => {
    const { session } = get();
    if (!session || amount === 0) return;
    await addCashMove({
      id: crypto.randomUUID(),
      company_id: session.company_id,
      session_id: session.id,
      amount,
      reason,
    });
  },

  buildReport: async (session) => {
    const [{ orders, payments, moves }, methods] = await Promise.all([
      loadSessionReportData(session.id),
      loadPaymentMethods(),
    ]);
    const methodById = new Map<string, PosPaymentMethod>(methods.map((m) => [m.id, m]));

    const gross = orders.reduce((s, o) => s + Number(o.amount_total), 0);
    const taxTotal = orders.reduce((s, o) => s + Number(o.amount_tax), 0);
    const guests = orders.reduce((s, o) => s + o.customer_count, 0);

    const byMethodMap = new Map<string, { name: string; isCash: boolean; amount: number }>();
    for (const p of payments) {
      const m = p.method_id ? methodById.get(p.method_id) : undefined;
      const key = m?.id ?? 'unknown';
      const entry = byMethodMap.get(key) ?? { name: m?.name ?? 'Other', isCash: m?.is_cash ?? false, amount: 0 };
      entry.amount = +(entry.amount + Number(p.amount)).toFixed(2);
      byMethodMap.set(key, entry);
    }
    const byMethod = [...byMethodMap.values()];

    const cashPayments = byMethod.filter((m) => m.isCash).reduce((s, m) => s + m.amount, 0);
    const cashIn = moves.filter((m) => Number(m.amount) > 0).reduce((s, m) => s + Number(m.amount), 0);
    const cashOut = moves.filter((m) => Number(m.amount) < 0).reduce((s, m) => s + Number(m.amount), 0);

    return {
      ordersCount: orders.length,
      guests,
      gross: +gross.toFixed(2),
      net: +(gross - taxTotal).toFixed(2),
      taxTotal: +taxTotal.toFixed(2),
      byMethod,
      cashIn: +cashIn.toFixed(2),
      cashOut: +cashOut.toFixed(2),
      expectedCash: +(Number(session.opening_cash) + cashPayments + cashIn + cashOut).toFixed(2),
      moves,
    };
  },
}));
