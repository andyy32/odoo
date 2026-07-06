/*
 * COVERI POS — order data access.
 * All ids are client-generated UUIDs and every write goes through the offline
 * sync queue, so orders can be created, edited, fired, and paid with no
 * network and replayed in order when it returns.
 */

import { supabase } from '@/lib/supabase';
import { kv } from '@/lib/idb';
import { isOfflineError, raceNetwork } from '@/lib/net';
import { enqueueMutation } from '@/lib/syncQueue';
import type { PosOrder, PosOrderLine, UUID } from '@/types/db';

export interface OrderWithLines {
  order: PosOrder;
  lines: PosOrderLine[];
}

/**
 * Load the table's draft order (with lines), or null if the table is free.
 * Offline: serve the last cached copy for this table; with no cache, treat
 * the table as free so service can continue (a fresh local order is created).
 */
export async function loadDraftOrder(tableId: UUID): Promise<OrderWithLines | null> {
  const cacheKey = `read:draft:${tableId}`;
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const cached = await kv.get<OrderWithLines | null>(cacheKey);
    if (cached !== undefined) return cached;
  }
  try {
    return await raceNetwork(loadDraftOrderFromServer(tableId, cacheKey));
  } catch (err) {
    if (!isOfflineError(err)) throw err;
    const cached = await kv.get<OrderWithLines | null>(cacheKey);
    return cached ?? null;
  }
}

async function loadDraftOrderFromServer(tableId: UUID, cacheKey: string): Promise<OrderWithLines | null> {
    const orderRes = await supabase
      .from('pos_order')
      .select('*')
      .eq('table_id', tableId)
      .eq('state', 'draft')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (orderRes.error) throw new Error(`Failed to load order: ${orderRes.error.message}`);
    if (!orderRes.data) {
      void kv.set(cacheKey, null).catch(() => undefined);
      return null;
    }

    const order = orderRes.data as PosOrder;
    const linesRes = await supabase
      .from('pos_order_line')
      .select('*')
      .eq('order_id', order.id)
      .order('created_at');
    if (linesRes.error) throw new Error(`Failed to load lines: ${linesRes.error.message}`);
    const result = { order, lines: (linesRes.data ?? []) as PosOrderLine[] };
    void kv.set(cacheKey, result).catch(() => undefined);
    return result;
}

/** Cache the current order state locally (keeps offline reloads coherent). */
export function cacheDraftOrder(tableId: UUID, data: OrderWithLines | null): void {
  void kv.set(`read:draft:${tableId}`, data).catch(() => undefined);
}

export async function createDraftOrder(order: {
  id: UUID;
  company_id: UUID;
  table_id: UUID;
  customer_count: number;
  waiter_id?: UUID | null;
}): Promise<void> {
  await enqueueMutation({
    table: 'pos_order',
    kind: 'insert',
    payload: { ...order, state: 'draft' },
  });
}

export async function updateOrder(
  id: UUID,
  patch: Partial<
    Pick<
      PosOrder,
      | 'customer_count'
      | 'amount_subtotal'
      | 'amount_tax'
      | 'amount_total'
      | 'state'
      | 'prep_snapshot'
      | 'session_id'
    >
  >,
): Promise<void> {
  await enqueueMutation({
    table: 'pos_order',
    kind: 'update',
    payload: patch as Record<string, unknown>,
    match: { column: 'id', value: id },
  });
}

export async function insertLine(line: PosOrderLine): Promise<void> {
  await enqueueMutation({ table: 'pos_order_line', kind: 'insert', payload: line });
}

export async function updateLine(
  id: UUID,
  patch: Partial<Pick<PosOrderLine, 'qty' | 'note' | 'discount' | 'price_unit'>>,
): Promise<void> {
  await enqueueMutation({
    table: 'pos_order_line',
    kind: 'update',
    payload: patch,
    match: { column: 'id', value: id },
  });
}

export async function deleteLine(id: UUID): Promise<void> {
  await enqueueMutation({
    table: 'pos_order_line',
    kind: 'delete',
    payload: null,
    match: { column: 'id', value: id },
  });
}
