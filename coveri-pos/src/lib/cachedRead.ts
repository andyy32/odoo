/*
 * COVERI POS — network-first reads with a local fallback.
 * On success the result is cached in IndexedDB; when the network is down the
 * last-known-good copy is served so the app still renders after a reload.
 */

import { kv } from '@/lib/idb';
import { isOfflineError, raceNetwork } from '@/lib/net';

export async function cachedRead<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  // Definitely offline: serve the cache immediately instead of burning the
  // network timeout. (A cache miss still falls through to the fetch attempt.)
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const cached = await kv.get<T>(`read:${key}`);
    if (cached !== undefined) {
      console.debug('[cachedRead] offline, cache hit', key);
      return cached;
    }
  }
  try {
    const fresh = await raceNetwork(fetcher());
    console.debug('[cachedRead] network ok', key);
    void kv.set(`read:${key}`, fresh).catch(() => undefined);
    return fresh;
  } catch (err) {
    console.debug('[cachedRead] network failed', key, err instanceof Error ? err.message : err);
    if (!isOfflineError(err)) throw err;
    const cached = await kv.get<T>(`read:${key}`);
    console.debug('[cachedRead] cache', key, cached !== undefined ? 'hit' : 'miss');
    if (cached !== undefined) return cached;
    throw err;
  }
}
