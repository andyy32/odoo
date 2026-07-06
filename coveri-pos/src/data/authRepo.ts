/*
 * COVERI POS — auth data access (Supabase Auth + staff identity).
 */

import { supabase } from '@/lib/supabase';
import type { StaffRole, UUID } from '@/types/db';

export interface StaffPublic {
  id: UUID;
  company_id: UUID;
  user_id: UUID | null;
  name: string;
  role: StaffRole;
  active: boolean;
}

export interface StaffIdentity {
  id: UUID;
  name: string;
  role: StaffRole;
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/** Active staff of the caller's company (no PIN exposed) — the lock-screen list. */
export async function loadStaff(): Promise<StaffPublic[]> {
  const { data, error } = await supabase
    .from('staff_public')
    .select('*')
    .eq('active', true)
    .order('name');
  if (error) throw new Error(`Failed to load staff: ${error.message}`);
  return (data ?? []) as StaffPublic[];
}

/** Verify a 4-digit PIN server-side; returns the identity or null if no match. */
export async function identifyStaff(pin: string): Promise<StaffIdentity | null> {
  const { data, error } = await supabase.rpc('identify_staff', { pin_input: pin });
  if (error) throw new Error(`PIN check failed: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  return (row as StaffIdentity | undefined) ?? null;
}
