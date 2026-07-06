/*
 * COVERI POS — payment data access.
 */

import { supabase } from '@/lib/supabase';
import { cachedRead } from '@/lib/cachedRead';
import { kv } from '@/lib/idb';
import { enqueueMutation } from '@/lib/syncQueue';
import type { PosOrder, PosOrderLine, PosPayment, PosPaymentMethod, UUID } from '@/types/db';

export async function loadPaymentMethods(): Promise<PosPaymentMethod[]> {
  return cachedRead('paymentMethods', async () => {
    const { data, error } = await supabase.from('pos_payment_method').select('*').order('sequence');
    if (error) throw new Error(`Failed to load payment methods: ${error.message}`);
    return (data ?? []) as PosPaymentMethod[];
  });
}

export async function insertPayments(payments: PosPayment[]): Promise<void> {
  for (const payment of payments) {
    await enqueueMutation({ table: 'pos_payment', kind: 'insert', payload: payment });
  }
}

export interface OrderDocument {
  order: PosOrder;
  lines: PosOrderLine[];
  payments: PosPayment[];
}

/**
 * Cache a just-finalized order document locally so the receipt renders even
 * when the payment happened offline (the rows are still in the sync queue).
 */
export function cacheOrderDocument(doc: OrderDocument): void {
  void kv.set(`read:orderDoc:${doc.order.id}`, doc).catch(() => undefined);
}

/**
 * Load any order (draft or paid) with its lines and payments — receipt/bill
 * data. Falls back to the locally cached document when the network is down
 * OR when the order only exists locally (paid offline, still in the queue).
 */
export async function loadOrderDocument(orderId: UUID): Promise<OrderDocument> {
  const fromCache = () => kv.get<OrderDocument>(`read:orderDoc:${orderId}`);
  try {
    const doc = await cachedRead(`orderDoc:${orderId}`, async () => {
      const [orderRes, linesRes, paysRes] = await Promise.all([
        supabase.from('pos_order').select('*').eq('id', orderId).limit(1).maybeSingle(),
        supabase.from('pos_order_line').select('*').eq('order_id', orderId).order('created_at'),
        supabase.from('pos_payment').select('*').eq('order_id', orderId).order('created_at'),
      ]);
      const firstError = orderRes.error ?? linesRes.error ?? paysRes.error;
      if (firstError) throw new Error(`Failed to load order: ${firstError.message}`);
      if (!orderRes.data) throw new Error('ORDER_NOT_ON_SERVER');
      return {
        order: orderRes.data as PosOrder,
        lines: (linesRes.data ?? []) as PosOrderLine[],
        payments: (paysRes.data ?? []) as PosPayment[],
      };
    });
    return doc;
  } catch (err) {
    if (err instanceof Error && err.message === 'ORDER_NOT_ON_SERVER') {
      const cached = await fromCache();
      if (cached) return cached;
      throw new Error('Order not found');
    }
    throw err;
  }
}
