/*
 * COVERI POS — minimal promise-based IndexedDB wrapper.
 * Two stores: 'kv' (read cache) and 'queue' (pending write operations).
 */

const DB_NAME = 'coveri-pos';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      if (!db.objectStoreNames.contains('queue')) {
        db.createObjectStore('queue', { keyPath: 'seq', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
  });
  return dbPromise;
}

function tx<T>(store: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = run(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
      }),
  );
}

export const kv = {
  get: <T>(key: string) => tx<T | undefined>('kv', 'readonly', (s) => s.get(key) as IDBRequest<T | undefined>),
  set: (key: string, value: unknown) => tx('kv', 'readwrite', (s) => s.put(value, key)).then(() => undefined),
};

export interface QueuedOp {
  seq?: number;
  table: string;
  kind: 'insert' | 'update' | 'delete';
  /** Row for insert, patch for update, ignored for delete. */
  payload: unknown;
  /** eq-match for update/delete. */
  match?: { column: string; value: string };
  ts: number;
}

export const queue = {
  add: (op: QueuedOp) => tx('queue', 'readwrite', (s) => s.add(op)).then(() => undefined),
  all: () => tx<QueuedOp[]>('queue', 'readonly', (s) => s.getAll() as IDBRequest<QueuedOp[]>),
  remove: (seq: number) => tx('queue', 'readwrite', (s) => s.delete(seq)).then(() => undefined),
  count: () => tx<number>('queue', 'readonly', (s) => s.count()),
};
