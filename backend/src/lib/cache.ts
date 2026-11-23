// In-process caches that cut database round trips. Each query costs a full network round trip
// to the database, so repeated reads are the main source of latency.
//
//  - cached():       short-lived response cache. Keys carry a data version, and any successful write
//                    (HTTP or background job) calls bumpDataVersion(), so a cached read never outlives a change.
//  - cachedStatic(): reference data (wards, crops, officer scope) that changes rarely; plain TTL, no version.
//
// Both de-duplicate concurrent loads of the same key and never cache a failed load.

const MAX_ENTRIES = 400;

interface Entry {
  exp: number;
  value: unknown;
}

const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();
let version = 0;

/** Call after anything that writes data, so cached reads are rebuilt on the next request. */
export function bumpDataVersion(): void {
  version++;
}

function run<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.exp > now) {
    store.delete(key); // re-insert so the Map stays in least-recently-used order
    store.set(key, hit);
    return Promise.resolve(hit.value as T);
  }
  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;

  const p = load()
    .then((value) => {
      store.set(key, { exp: Date.now() + ttlMs, value });
      while (store.size > MAX_ENTRIES) store.delete(store.keys().next().value as string);
      return value;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

export const cached = <T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> => run(`v${version}:${key}`, ttlMs, load);

export const cachedStatic = <T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> => run(`s:${key}`, ttlMs, load);

export function clearStatic(prefix: string): void {
  for (const k of store.keys()) if (k.startsWith(`s:${prefix}`)) store.delete(k);
}

export const SECOND = 1_000;
export const MINUTE = 60 * SECOND;
