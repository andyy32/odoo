/*
 * COVERI POS — offline-first write queue.
 *
 * Every repo mutation goes through enqueueMutation(): the op is persisted to
 * IndexedDB first, then a FIFO flusher replays it against Supabase. If the
 * network is down the op simply stays queued — the UI already applied the
 * change optimistically, and all rows carry client-generated UUIDs so replays
 * are idempotent (duplicate-key on insert = already applied).
 */

import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { queue, type QueuedOp } from '@/lib/idb';
import { isDuplicateKeyError, isOfflineError } from '@/lib/net';

interface SyncState {
  online: boolean;
  pending: number;
}

export const useSyncStore = create<SyncState>(() => ({
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  pending: 0,
}));

async function refreshPending(): Promise<void> {
  try {
    useSyncStore.setState({ pending: await queue.count() });
  } catch {
    /* IndexedDB unavailable (private mode) — badge just won't show a count */
  }
}

/** Execute one op against Supabase. Throws on failure. */
async function execute(op: QueuedOp): Promise<void> {
  const table = supabase.from(op.table);
  let error: { code?: string; message: string } | null = null;

  if (op.kind === 'insert') {
    ({ error } = await table.insert(op.payload as Record<string, unknown>));
  } else if (op.kind === 'update' && op.match) {
    ({ error } = await table.update(op.payload as Record<string, unknown>).eq(op.match.column, op.match.value));
  } else if (op.kind === 'delete' && op.match) {
    ({ error } = await table.delete().eq(op.match.column, op.match.value));
  }

  if (error) {
    if (op.kind === 'insert' && isDuplicateKeyError(error)) return; // already applied
    throw error;
  }
}

let flushing = false;

/** Drain the queue in order. Stops at the first offline failure. */
export async function flushQueue(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    const ops = await queue.all();
    for (const op of ops) {
      try {
        await execute(op);
        if (op.seq !== undefined) await queue.remove(op.seq);
        useSyncStore.setState({ online: true });
      } catch (err) {
        if (isOfflineError(err)) {
          useSyncStore.setState({ online: false });
          return; // keep this op and everything after it, retry later
        }
        // Server rejected it — drop the op so the queue can't wedge, and
        // surface the failure in the console for diagnosis.
        console.error('[sync] server rejected queued op, dropping:', op, err);
        if (op.seq !== undefined) await queue.remove(op.seq);
      }
    }
  } finally {
    flushing = false;
    void refreshPending();
  }
}

/**
 * Persist a mutation and kick a flush. Resolves as soon as the op is safely
 * queued locally — callers do NOT wait for the server.
 */
export async function enqueueMutation(op: Omit<QueuedOp, 'ts' | 'seq'>): Promise<void> {
  await queue.add({ ...op, ts: Date.now() });
  await refreshPending();
  void flushQueue();
}

/** Wire connectivity listeners + retry timer. Call once at app start. */
export function initSync(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('online', () => {
    useSyncStore.setState({ online: true });
    void flushQueue();
  });
  window.addEventListener('offline', () => useSyncStore.setState({ online: false }));
  setInterval(() => void flushQueue(), 15_000);
  void refreshPending();
  void flushQueue();
}
