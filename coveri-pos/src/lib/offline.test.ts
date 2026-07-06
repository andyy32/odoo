import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isDuplicateKeyError, isOfflineError } from './net';

const kvStore = new Map<string, unknown>();
vi.mock('@/lib/idb', () => ({
  kv: {
    get: (key: string) => Promise.resolve(kvStore.get(key)),
    set: (key: string, value: unknown) => {
      kvStore.set(key, value);
      return Promise.resolve();
    },
  },
  queue: { add: vi.fn(), all: vi.fn(), remove: vi.fn(), count: vi.fn() },
}));

import { cachedRead } from './cachedRead';

describe('isOfflineError', () => {
  it('matches browser fetch failures', () => {
    expect(isOfflineError(new TypeError('Failed to fetch'))).toBe(true);
    expect(isOfflineError({ message: 'TypeError: fetch failed' })).toBe(true);
    expect(isOfflineError(new Error('NetworkError when attempting to fetch resource'))).toBe(true);
    expect(isOfflineError(new Error('Failed to load order: TypeError: Failed to fetch'))).toBe(true);
  });

  it('does not match server-side rejections', () => {
    expect(isOfflineError({ message: 'duplicate key value violates unique constraint' })).toBe(false);
    expect(isOfflineError({ message: 'new row violates row-level security policy' })).toBe(false);
    expect(isOfflineError(new Error('Order not found'))).toBe(false);
    expect(isOfflineError(undefined)).toBe(false);
  });
});

describe('isDuplicateKeyError', () => {
  it('matches unique violations by code or message', () => {
    expect(isDuplicateKeyError({ code: '23505', message: 'x' })).toBe(true);
    expect(isDuplicateKeyError({ message: 'duplicate key value violates unique constraint "pos_order_pkey"' })).toBe(true);
    expect(isDuplicateKeyError({ code: '42501', message: 'permission denied' })).toBe(false);
  });
});

describe('cachedRead', () => {
  beforeEach(() => kvStore.clear());

  it('returns fresh data and caches it', async () => {
    const result = await cachedRead('k', () => Promise.resolve([1, 2, 3]));
    expect(result).toEqual([1, 2, 3]);
    expect(kvStore.get('read:k')).toEqual([1, 2, 3]);
  });

  it('serves the cache when the network is down', async () => {
    await cachedRead('k', () => Promise.resolve('fresh'));
    const result = await cachedRead('k', () => Promise.reject(new TypeError('Failed to fetch')));
    expect(result).toBe('fresh');
  });

  it('rethrows offline errors when there is no cache', async () => {
    await expect(cachedRead('empty', () => Promise.reject(new TypeError('Failed to fetch')))).rejects.toThrow(
      'Failed to fetch',
    );
  });

  it('rethrows server errors without touching the cache', async () => {
    await cachedRead('k', () => Promise.resolve('fresh'));
    await expect(cachedRead('k', () => Promise.reject(new Error('RLS violation')))).rejects.toThrow('RLS violation');
  });
});
