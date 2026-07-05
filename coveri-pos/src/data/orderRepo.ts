/*
 * COVERI POS — order data access.
 * All ids are client-generated UUIDs so writes never wait on the server for
 * identity (the groundwork for the Phase-7 offline queue).
 */

import { supabase } from '@/lib/supabase';
import type { PosOrder, PosOrderLine, UUID } from '@/types/db';

export interface OrderWithLines {
  order: PosOrder;
  lines: PosOrderLine[];
}

/** Load the table's draft order (with lines), or null if the table is free. */
export async function loadDraftOrder(tableId: UUID): Promise<OrderWithLines | null> {
  const orderRes = await supabase
    .from('pos_order')
    .select('*')
    .eq('table_id', tableId)
    .eq('state', 'draft')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (orderRes.error) throw new Error(`Failed to load order: ${orderRes.error.message}`);
  if (!orderRes.data) return null;

  const order = orderRes.data as PosOrder;
  const linesRes = await supabase
    .from('pos_order_line')
    .select('*')
    .eq('order_id', order.id)
    .order('created_at');
  if (linesRes.error) throw new Error(`Failed to load lines: ${linesRes.error.message}`);
  return { order, lines: (linesRes.data ?? []) as PosOrderLine[] };
}

export async function createDraftOrder(order: {
  id: UUID;
  company_id: UUID;
  table_id: UUID;
  customer_count: number;
}): Promise<void> {
  const { error } = await supabase.from('pos_order').insert({ ...order, state: 'draft' });
  if (error) throw new Error(`Failed to create order: ${error.message}`);
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
  const { error } = await supabase.from('pos_order').update(patch).eq('id', id);
  if (error) throw new Error(`Failed to update order: ${error.message}`);
}

export async function insertLine(line: PosOrderLine): Promise<void> {
  const { error } = await supabase.from('pos_order_line').insert(line);
  if (error) throw new Error(`Failed to add line: ${error.message}`);
}

export async function updateLine(
  id: UUID,
  patch: Partial<Pick<PosOrderLine, 'qty' | 'note' | 'discount' | 'price_unit'>>,
): Promise<void> {
  const { error } = await supabase.from('pos_order_line').update(patch).eq('id', id);
  if (error) throw new Error(`Failed to update line: ${error.message}`);
}

export async function deleteLine(id: UUID): Promise<void> {
  const { error } = await supabase.from('pos_order_line').delete().eq('id', id);
  if (error) throw new Error(`Failed to delete line: ${error.message}`);
}
