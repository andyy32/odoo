/*
 * COVERI POS — network error classification (pure, unit-tested).
 */

/**
 * True when an error means "the network is unreachable" — the request never
 * got a server verdict, so the operation should stay queued and be retried.
 * Server-side rejections (RLS, constraint violations, bad requests) return
 * false: retrying them would loop forever.
 */
export function isOfflineError(err: unknown): boolean {
  const message =
    typeof err === 'string'
      ? err
      : err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : '';
  return /failed to fetch|fetch failed|networkerror|network request failed|load failed|network timeout|ERR_INTERNET|ERR_NETWORK|ERR_CONNECTION/i.test(
    message,
  );
}

/**
 * Race a network promise against a timeout. A POS read must ALWAYS settle —
 * if the network layer wedges (flaky Wi-Fi, stalled client internals), we
 * reject with a timeout that isOfflineError() recognizes, so callers fall
 * back to their local cache instead of hanging the screen.
 */
export function raceNetwork<T>(promise: Promise<T>, ms = 4000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('network timeout')), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/** Postgres unique-violation → an insert we already applied once. */
export function isDuplicateKeyError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: unknown; message?: unknown };
  return e.code === '23505' || /duplicate key/i.test(String(e.message ?? ''));
}
