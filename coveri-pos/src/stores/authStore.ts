/*
 * COVERI POS — auth + staff-identity state (zustand).
 *
 * Two layers:
 *  - `session`: the Supabase Auth session (the owner logs in once on the shared
 *    terminal; this is what RLS authenticates).
 *  - `staff`: the current app-level identity (who's on shift), set by PIN. This
 *    is what stamps `waiter_id` on orders. Switching staff never re-auths.
 */

import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import {
  identifyStaff as rpcIdentify,
  loadStaff,
  signInWithPassword,
  signOut as repoSignOut,
  type StaffIdentity,
  type StaffPublic,
} from '@/data/authRepo';

interface AuthState {
  ready: boolean;
  session: Session | null;
  staff: StaffIdentity | null;
  staffList: StaffPublic[];
  signInError: string | null;

  init: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<boolean>;
  refreshStaffList: () => Promise<void>;
  identifyStaff: (pin: string) => Promise<boolean>;
  lock: () => void;
  signOut: () => Promise<void>;
}

const STAFF_KEY = 'coveri.currentStaff';

function persistStaff(staff: StaffIdentity | null) {
  try {
    if (staff) localStorage.setItem(STAFF_KEY, JSON.stringify(staff));
    else localStorage.removeItem(STAFF_KEY);
  } catch {
    /* private mode — identity just won't survive reload */
  }
}

function restoreStaff(): StaffIdentity | null {
  try {
    const raw = localStorage.getItem(STAFF_KEY);
    return raw ? (JSON.parse(raw) as StaffIdentity) : null;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  ready: false,
  session: null,
  staff: null,
  staffList: [],
  signInError: null,

  init: async () => {
    const { data } = await supabase.auth.getSession();
    set({ session: data.session, staff: data.session ? restoreStaff() : null, ready: true });
    if (data.session) void get().refreshStaffList();

    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session });
      if (!session) {
        persistStaff(null);
        set({ staff: null, staffList: [] });
      }
    });
  },

  signIn: async (email, password) => {
    set({ signInError: null });
    try {
      await signInWithPassword(email.trim(), password);
      await get().refreshStaffList();
      // If exactly one staff row is linked to this login, adopt it automatically
      // (owner needn't PIN themselves); otherwise the lock screen asks.
      const uid = get().session?.user.id;
      const mine = get().staffList.find((s) => s.user_id === uid);
      if (mine) {
        const identity: StaffIdentity = { id: mine.id, name: mine.name, role: mine.role };
        persistStaff(identity);
        set({ staff: identity });
      }
      return true;
    } catch (e) {
      set({ signInError: e instanceof Error ? e.message : String(e) });
      return false;
    }
  },

  refreshStaffList: async () => {
    try {
      set({ staffList: await loadStaff() });
    } catch {
      /* offline / not yet authed — lock screen will show what it can */
    }
  },

  identifyStaff: async (pin) => {
    const identity = await rpcIdentify(pin);
    if (!identity) return false;
    persistStaff(identity);
    set({ staff: identity });
    return true;
  },

  lock: () => {
    persistStaff(null);
    set({ staff: null });
  },

  signOut: async () => {
    await repoSignOut();
    persistStaff(null);
    set({ session: null, staff: null, staffList: [] });
  },
}));
