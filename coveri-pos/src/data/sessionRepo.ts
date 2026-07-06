/*
 * COVERI POS — register session data access.
 */

import { supabase } from '@/lib/supabase';
import { enqueueMutation } from '@/lib/syncQueue';
import type { PosOrder, PosPayment, PosSession, UUID } from '@/types/db';

export interface CashMove {
  id: UUID;
  company_id: UUID;
  session_id: UUID;
  amount: number; // signed: + in, − out
  reason: string;
  created_at?: string;
}

export async function getOpenSession(): Promise<PosSession | null> {
  const { data, error } = await supabase
    .from('pos_session')
    .select('*')
    .eq('state', 'opened')
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Failed to load session: ${error.message}`);
  return (data as PosSession | null) ?? null;
}

export async function openSession(session: {
  id: UUID;
  company_id: UUID;
  config_id: UUID;
  opening_cash: number;
  opened_by?: UUID | null;
}): Promise<void> {
  await enqueueMutation({
    table: 'pos_session',
    kind: 'insert',
    payload: { ...session, state: 'opened', opened_at: new Date().toISOString() },
  });
}

export async function closeSession(id: UUID, closingCash: number): Promise<void> {
  await enqueueMutation({
    table: 'pos_session',
    kind: 'update',
    payload: { state: 'closed', closing_cash: closingCash, closed_at: new Date().toISOString() },
    match: { column: 'id', value: id },
  });
}

export async function addCashMove(move: CashMove): Promise<void> {
  await enqueueMutation({ table: 'pos_cash_move', kind: 'insert', payload: move });
}

export async function loadCashMoves(sessionId: UUID): Promise<CashMove[]> {
  const { data, error } = await supabase
    .from('pos_cash_move')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at');
  if (error) throw new Error(`Failed to load cash moves: ${error.message}`);
  return (data ?? []) as CashMove[];
}

/** Everything needed to compute an X/Z report for a session. */
export async function loadSessionReportData(sessionId: UUID): Promise<{
  orders: PosOrder[];
  payments: PosPayment[];
  moves: CashMove[];
}> {
  const ordersRes = await supabase
    .from('pos_order')
    .select('*')
    .eq('session_id', sessionId)
    .eq('state', 'paid');
  if (ordersRes.error) throw new Error(`Failed to load session orders: ${ordersRes.error.message}`);
  const orders = (ordersRes.data ?? []) as PosOrder[];

  let payments: PosPayment[] = [];
  if (orders.length > 0) {
    const paysRes = await supabase
      .from('pos_payment')
      .select('*')
      .in('order_id', orders.map((o) => o.id));
    if (paysRes.error) throw new Error(`Failed to load session payments: ${paysRes.error.message}`);
    payments = (paysRes.data ?? []) as PosPayment[];
  }

  const moves = await loadCashMoves(sessionId);
  return { orders, payments, moves };
}
