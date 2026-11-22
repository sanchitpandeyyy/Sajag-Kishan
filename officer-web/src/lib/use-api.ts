"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { apiCache as cache, type CacheEntry as Entry } from "./api-cache";

const FRESH_MS = 30_000;
const MAX_ENTRIES = 200;

const inflight = new Map<string, Promise<unknown>>();

function fetchShared<T>(path: string): Promise<T> {
  const pending = inflight.get(path);
  if (pending) return pending as Promise<T>;
  const p = api<T>(path)
    .then((data) => {
      cache.set(path, { data, at: Date.now() });
      if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value!);
      return data;
    })
    .finally(() => inflight.delete(path));
  inflight.set(path, p);
  return p;
}

export function clearApiCache(prefix?: string) {
  for (const k of [...cache.keys()]) if (!prefix || k.startsWith(prefix)) cache.delete(k);
}

/** Data hook with a shared cache: cached data shows at once, then refreshes in the background when older than 30 s. */
export function useApi<T>(path: string | null) {
  const cached = path ? (cache.get(path) as Entry | undefined) : undefined;
  const [data, setData] = useState<T | null>((cached?.data as T) ?? null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(path) && !cached);

  const load = useCallback(
    async (force: boolean) => {
      if (!path) return;
      const hit = cache.get(path);
      if (hit) setData(hit.data as T);
      if (!force && hit && Date.now() - hit.at < FRESH_MS) {
        setLoading(false);
        return;
      }
      if (!hit) setLoading(true);
      setError(null);
      try {
        if (force) cache.delete(path);
        setData(await fetchShared<T>(path));
      } catch (e) {
        setError(e instanceof Error ? e.message : "त्रुटि");
      } finally {
        setLoading(false);
      }
    },
    [path],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  const reload = useCallback(() => load(true), [load]);
  return { data, error, loading, reload };
}
