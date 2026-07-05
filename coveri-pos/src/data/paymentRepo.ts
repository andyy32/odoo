/*
 * COVERI POS — payment data access.
 */

import { supabase } from '@/lib/supabase';
import type { PosOrder, PosOrderLine, PosPayment, PosPaymentMethod, UUID } from '@/types/db';

export async function loadPaymentMethods(): Promise<PosPaymentMethod[]> {
  const { data, error } = await supabase.from('pos_payment_method').select('*').order('sequence');
  if (error) throw new Error(`Failed to load payment methods: ${error.message}`);
  return (data ?? []) as PosPaymentMethod[];
}

export async function insertPayments(payments: PosPayment[]): Promise<void> {
  if (payments.length === 0) return;
  const { error } = await supabase.from('pos_payment').insert(payments);
  if (error) throw new Error(`Failed to record payments: ${error.message}`);
}

/** Load any order (draft or paid) with its lines and payments — receipt/bill data. */
export async function loadOrderDocument(orderId: UUID): Promise<{
  order: PosOrder;
  lines: PosOrderLine[];
  payments: PosPayment[];
}> {
  const [orderRes, linesRes, paysRes] = await Promise.all([
    supabase.from('pos_order').select('*').eq('id', orderId).limit(1).maybeSingle(),
    supabase.from('pos_order_line').select('*').eq('order_id', orderId).order('created_at'),
    supabase.from('pos_payment').select('*').eq('order_id', orderId).order('created_at'),
  ]);
  const firstError = orderRes.error ?? linesRes.error ?? paysRes.error;
  if (firstError) throw new Error(`Failed to load order: ${firstError.message}`);
  if (!orderRes.data) throw new Error('Order not found');
  return {
    order: orderRes.data as PosOrder,
    lines: (linesRes.data ?? []) as PosOrderLine[],
    payments: (paysRes.data ?? []) as PosPayment[],
  };
}
