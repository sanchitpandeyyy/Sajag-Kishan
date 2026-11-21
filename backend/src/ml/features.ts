/**
 * Land-use model features, one fixed-order vector per field. Pure (no database), so the training
 * export (ml/export) and live prediction use exactly the same maths.
 *
 * Sources: Sentinel-2 indices (NDVI, NDRE, NDWI, NDMI), Sentinel-1 backscatter (VV, VH), terrain
 * (Copernicus DEM) and the field record (irrigation). Missing values are NaN; the model handles them.
 */

export const LANDUSE_FEATURES = [
  "ndvi_max",
  "ndvi_mean",
  "ndvi_min",
  "ndvi_latest",
  "ndvi_amplitude",
  "ndvi_count",
  "ndre_max",
  "ndwi_max",
  "ndmi_mean",
  "vh_mean",
  "vh_range",
  "vv_mean",
  "vh_minus_vv",
  "s1_count",
  "elevation_m",
  "slope_deg",
  "irrigated",
] as const;

export type LanduseFeature = (typeof LANDUSE_FEATURES)[number];

export interface ObservationRow {
  sensor: string;
  observedOn: Date;
  ndvi: number | null;
  ndre: number | null;
  ndwi: number | null;
  ndmi: number | null;
  vvDb: number | null;
  vhDb: number | null;
}

export interface FieldRow {
  elevationM: number | null;
  slopeDeg: number | null;
  irrigation: string;
}

const nums = (xs: (number | null)[]) => xs.filter((x): x is number => x != null && Number.isFinite(x));
const max = (xs: number[]) => (xs.length ? Math.max(...xs) : Number.NaN);
const min = (xs: number[]) => (xs.length ? Math.min(...xs) : Number.NaN);
const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : Number.NaN);
const r3 = (x: number) => (Number.isFinite(x) ? Math.round(x * 1000) / 1000 : Number.NaN);

/** Feature vector for one field from its observations within the window (default: last 365 days). */
export function landuseFeatures(obs: ObservationRow[], field: FieldRow, opts: { now?: Date; days?: number } = {}): Record<LanduseFeature, number> {
  const now = opts.now ?? new Date();
  const since = now.getTime() - (opts.days ?? 365) * 86_400_000;
  const inWindow = obs.filter((o) => o.observedOn.getTime() >= since && o.observedOn.getTime() <= now.getTime()).sort((a, b) => a.observedOn.getTime() - b.observedOn.getTime());
  const s2 = inWindow.filter((o) => o.sensor === "S2");
  const s1 = inWindow.filter((o) => o.sensor === "S1");
  const ndvi = nums(s2.map((o) => o.ndvi));
  const vh = nums(s1.map((o) => o.vhDb));
  const vv = nums(s1.map((o) => o.vvDb));
  const pairs = s1.filter((o) => o.vhDb != null && o.vvDb != null).map((o) => o.vhDb! - o.vvDb!);
  return {
    ndvi_max: r3(max(ndvi)),
    ndvi_mean: r3(avg(ndvi)),
    ndvi_min: r3(min(ndvi)),
    ndvi_latest: r3(ndvi.at(-1) ?? Number.NaN),
    ndvi_amplitude: r3(max(ndvi) - min(ndvi)),
    ndvi_count: ndvi.length,
    ndre_max: r3(max(nums(s2.map((o) => o.ndre)))),
    ndwi_max: r3(max(nums(s2.map((o) => o.ndwi)))),
    ndmi_mean: r3(avg(nums(s2.map((o) => o.ndmi)))),
    vh_mean: r3(avg(vh)),
    vh_range: r3(max(vh) - min(vh)),
    vv_mean: r3(avg(vv)),
    vh_minus_vv: r3(avg(pairs)),
    s1_count: vh.length,
    elevation_m: field.elevationM ?? Number.NaN,
    slope_deg: field.slopeDeg ?? Number.NaN,
    irrigated: field.irrigation === "RAINFED" ? 0 : 1,
  };
}

export function toVector(f: Record<LanduseFeature, number>): number[] {
  return LANDUSE_FEATURES.map((k) => f[k]);
}
