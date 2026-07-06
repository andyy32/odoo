/*
 * COVERI POS — kitchen ticket data access.
 */

import { supabase } from '@/lib/supabase';
import { cachedRead } from '@/lib/cachedRead';
import { enqueueMutation } from '@/lib/syncQueue';
import type { KitchenTicket, UUID } from '@/types/db';

export async function insertTickets(tickets: KitchenTicket[]): Promise<void> {
  for (const ticket of tickets) {
    await enqueueMutation({ table: 'kitchen_ticket', kind: 'insert', payload: ticket });
  }
}

/** Open (not bumped) tickets, oldest first — the KDS wall. */
export async function loadOpenTickets(): Promise<KitchenTicket[]> {
  return cachedRead('openTickets', async () => {
    const { data, error } = await supabase
      .from('kitchen_ticket')
      .select('*')
      .eq('done', false)
      .order('fired_at');
    if (error) throw new Error(`Failed to load tickets: ${error.message}`);
    return (data ?? []) as KitchenTicket[];
  });
}

export async function bumpTicket(id: UUID): Promise<void> {
  await enqueueMutation({
    table: 'kitchen_ticket',
    kind: 'update',
    payload: { done: true },
    match: { column: 'id', value: id },
  });
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
