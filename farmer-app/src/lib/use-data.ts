import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { diskGet, memoryDelete, memoryGet, memorySet } from "./data-cache";

const FRESH_MS = 30_000;
const inflight = new Map<string, Promise<unknown>>();

function fetchShared<T>(path: string): Promise<T> {
  const pending = inflight.get(path);
  if (pending) return pending as Promise<T>;
  const p = api<T>(path)
    .then((data) => {
      memorySet(path, data);
      return data;
    })
    .finally(() => inflight.delete(path));
  inflight.set(path, p);
  return p;
}

/** Warm the cache for every tab in parallel; the parcel-dependent calls start as soon as parcels arrive. */
export function prefetchTabs(): void {
  const warm = (path: string) => fetchShared<unknown>(path).catch(() => undefined);
  void Promise.all([
    warm("/v1/me"),
    warm("/v1/alerts"),
    warm("/v1/subsidies/mine"),
    warm("/v1/subsidies/open"),
    warm("/v1/crops"), // crop picker works offline too
    fetchShared<Parcel[]>("/v1/parcels")
      .then((parcels) =>
        // Every field's calendar and advice, so each one is available offline.
        Promise.all(parcels.slice(0, 20).flatMap((p) => [warm(`/v1/calendar?parcelId=${p.id}`), warm(`/v1/advice?parcelId=${p.id}`)])),
      )
      .catch(() => undefined),
  ]);
}

export function useData<T>(path: string | null) {
  const cached = path ? memoryGet(path) : undefined;
  const [data, setData] = useState<T | null>((cached?.data as T) ?? null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(path) && !cached);

  const load = useCallback(
    async (force: boolean) => {
      if (!path) return;
      const hit = memoryGet(path) ?? (await diskGet(path));
      if (hit) setData(hit.data as T);
      if (!force && hit && Date.now() - hit.at < FRESH_MS) {
        setLoading(false);
        return;
      }
      setLoading(force || !hit);
      setError(null);
      try {
        if (force) memoryDelete(path);
        setData(await fetchShared<T>(path));
      } catch (e) {
        if (!hit) setError(e instanceof Error ? e.message : "error");
      } finally {
        setLoading(false);
      }
    },
    [path],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  const refresh = useCallback(() => load(true), [load]);
  return { data, error, loading, refresh };
}

export interface Me {
  name: string;
  phoneNumber: string | null;
  farmer: { id: string; firstNameNe: string; lastNameNe: string | null; farmingWardId: number } | null;
}

export interface Parcel {
  id: string;
  tole: string;
  kittaNo: string | null;
  areaM2: number;
  areaOriginal: Record<string, number> | null;
  verification: "UNVERIFIED" | "VERIFIED" | "DISPUTED";
  geometry: unknown;
  ward: { number: number; localLevel: { nameNe: string } };
  declarations: { crop: { code: string; nameNe: string }; season: string; isFallow: boolean }[];
}

export interface CalendarEvent {
  crop: string;
  task: string;
  startsOn: string;
  endsOn: string;
  titleNe: string;
  noteNe?: string;
}

export interface CalendarResponse {
  parcel: { id: string; zoneNe: string; elevationM: number };
  basis: "declared" | "suggested";
  events: CalendarEvent[];
}

export interface Alert {
  id: string;
  type: string;
  severity: "INFO" | "WARNING" | "SEVERE";
  validFrom: string;
  titleNe: string;
  messageNe: string;
  read?: boolean;
}

export interface Advisory {
  id: string;
  titleNe: string;
  bodyNe: string;
  publishedAt: string;
  officer: { fullName: string };
}

export interface Allocation {
  id: string;
  allocatedQty: number;
  deliveredQty: number | null;
  status: string;
  createdAt?: string;
  scheme: { name: string; unit: string };
}

export interface OpenScheme {
  id: string;
  name: string;
  kind: string;
  unit: string;
  product: string | null;
  fiscalYearBs: string;
  totalStock: number | null;
  remaining: number | null;
  mine: { status: string; allocatedQty: number } | null;
}

export interface Bilingual {
  ne: string;
  en: string;
}

export interface DiseaseAdvice {
  code: string;
  crop: string;
  cropName: Bilingual;
  name: Bilingual;
  level: "LOW" | "MEDIUM" | "HIGH";
  score: number;
  why: Bilingual;
  prevent: Bilingual[];
  ifSigns: Bilingual[];
  days: string[];
}
