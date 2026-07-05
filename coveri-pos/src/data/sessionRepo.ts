/*
 * COVERI POS — register session data access.
 */

import { supabase } from '@/lib/supabase';
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
}): Promise<void> {
  const { error } = await supabase.from('pos_session').insert({ ...session, state: 'opened' });
  if (error) throw new Error(`Failed to open register: ${error.message}`);
}

export async function closeSession(id: UUID, closingCash: number): Promise<void> {
  const { error } = await supabase
    .from('pos_session')
    .update({ state: 'closed', closing_cash: closingCash, closed_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(`Failed to close register: ${error.message}`);
}

export async function addCashMove(move: CashMove): Promise<void> {
  const { error } = await supabase.from('pos_cash_move').insert(move);
  if (error) throw new Error(`Failed to record cash move: ${error.message}`);
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
