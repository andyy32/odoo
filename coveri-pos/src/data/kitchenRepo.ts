/*
 * COVERI POS — kitchen ticket data access.
 */

import { supabase } from '@/lib/supabase';
import type { KitchenTicket, UUID } from '@/types/db';

export async function insertTickets(tickets: KitchenTicket[]): Promise<void> {
  if (tickets.length === 0) return;
  const { error } = await supabase.from('kitchen_ticket').insert(tickets);
  if (error) throw new Error(`Failed to fire tickets: ${error.message}`);
}

/** Open (not bumped) tickets, oldest first — the KDS wall. */
export async function loadOpenTickets(): Promise<KitchenTicket[]> {
  const { data, error } = await supabase
    .from('kitchen_ticket')
    .select('*')
    .eq('done', false)
    .order('fired_at');
  if (error) throw new Error(`Failed to load tickets: ${error.message}`);
  return (data ?? []) as KitchenTicket[];
}

export async function bumpTicket(id: UUID): Promise<void> {
  const { error } = await supabase.from('kitchen_ticket').update({ done: true }).eq('id', id);
  if (error) throw new Error(`Failed to bump ticket: ${error.message}`);
}

/** Live updates for the ticket wall. Returns an unsubscribe function. */
export function subscribeTickets(onChange: () => void): () => void {
  const channel = supabase
    .channel('kds-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'kitchen_ticket' }, onChange)
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
