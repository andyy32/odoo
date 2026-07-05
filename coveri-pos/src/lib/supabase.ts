// COVERI POS — Supabase client singleton.
// Reads config from Vite env. Safe to import anywhere; if env is missing we
// surface a clear console warning rather than crashing the shell (V1 screens
// can still render the design system without a live backend).

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey);

if (!isSupabaseConfigured && import.meta.env.DEV) {
  // eslint-disable-next-line no-console
  console.warn(
    '[COVERI] Supabase env not set — running UI-only. Add VITE_SUPABASE_URL and ' +
      'VITE_SUPABASE_ANON_KEY to .env.local to connect a backend.',
  );
}

export const supabase: SupabaseClient = createClient(
  url ?? 'http://localhost:54321',
  anonKey ?? 'public-anon-key-placeholder',
  {
    auth: { persistSession: true, autoRefreshToken: true },
  },
);
