/** Small data hook for API reads with pull-to-refresh: { data, error, loading, refresh }. */
import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

export function useData<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(path));

  const refresh = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    setError(null);
    try {
      setData(await api<T>(path));
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, error, loading, refresh };
}

/** API shapes used by the farmer screens. */
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
