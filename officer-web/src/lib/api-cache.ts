export type CacheEntry = { data: unknown; at: number };

export const apiCache = new Map<string, CacheEntry>();

export function markApiCacheStale() {
  for (const [k, v] of apiCache) apiCache.set(k, { ...v, at: 0 });
}
