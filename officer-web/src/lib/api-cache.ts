export type CacheEntry = { data: unknown; at: number };

export const apiCache = new Map<string, CacheEntry>();

/** After any change, mark cached reads stale so the next view refetches (still shown at once). */
export function markApiCacheStale() {
  for (const [k, v] of apiCache) apiCache.set(k, { ...v, at: 0 });
}
