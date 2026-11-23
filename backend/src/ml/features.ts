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
  "evi_max",
  "savi_max",
  "vh_mean",
  "vh_range",
  "vh_std",
  "vv_mean",
  "vv_std",
  "vh_minus_vv",
  "s1_count",
  "elevation_m",
  "slope_deg",
  "irrigated",
  "rain_365_mm",
  "rain_90_mm",
  "temp_mean_c",
  "hot_days",
  "soil_moisture_mean",
  "water_balance_mm",
] as const;

export type LanduseFeature = (typeof LANDUSE_FEATURES)[number];

export interface ObservationRow {
  sensor: string;
  observedOn: Date;
  ndvi: number | null;
  ndre: number | null;
  ndwi: number | null;
  ndmi: number | null;
  evi?: number | null;
  savi?: number | null;
  vvDb: number | null;
  vhDb: number | null;
}

export interface FieldRow {
  elevationM: number | null;
  slopeDeg: number | null;
  irrigation: string;
}

export interface ClimateRow {
  date: Date;
  precipMm: number | null;
  tempMeanC: number | null;
  tempMaxC: number | null;
  soilMoisture: number | null;
  et0Mm: number | null;
}

export const HOT_DAY_C = 35;

const nums = (xs: (number | null | undefined)[]) => xs.filter((x): x is number => x != null && Number.isFinite(x));
const max = (xs: number[]) => (xs.length ? Math.max(...xs) : Number.NaN);
const min = (xs: number[]) => (xs.length ? Math.min(...xs) : Number.NaN);
const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : Number.NaN);
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const std = (xs: number[]) => {
  if (xs.length < 2) return Number.NaN;
  const m = avg(xs);
  return Math.sqrt(avg(xs.map((x) => (x - m) ** 2)));
};
const r3 = (x: number) => (Number.isFinite(x) ? Math.round(x * 1000) / 1000 : Number.NaN);
const r1 = (x: number) => (Number.isFinite(x) ? Math.round(x * 10) / 10 : Number.NaN);

const MIN_COVERAGE = 0.8;

function climateFeatures(climate: ClimateRow[], now: number, days: number) {
  const since365 = now - days * 86_400_000;
  const since90 = now - 90 * 86_400_000;
  const year = climate.filter((c) => c.date.getTime() > since365 && c.date.getTime() <= now);
  const recent = year.filter((c) => c.date.getTime() > since90);
  const rainYear = nums(year.map((c) => c.precipMm));
  const rainRecent = nums(recent.map((c) => c.precipMm));
  const et0Year = nums(year.map((c) => c.et0Mm));
  const yearOk = (n: number) => n >= MIN_COVERAGE * (days - 5);
  const recentOk = (n: number) => n >= MIN_COVERAGE * (90 - 5);
  const tmax = nums(year.map((c) => c.tempMaxC));
  return {
    rain_365_mm: yearOk(rainYear.length) ? r1(sum(rainYear)) : Number.NaN,
    rain_90_mm: recentOk(rainRecent.length) ? r1(sum(rainRecent)) : Number.NaN,
    temp_mean_c: r1(avg(nums(year.map((c) => c.tempMeanC)))),
    hot_days: yearOk(tmax.length) ? tmax.filter((t) => t >= HOT_DAY_C).length : Number.NaN,
    soil_moisture_mean: r3(avg(nums(year.map((c) => c.soilMoisture)))),
    water_balance_mm: yearOk(rainYear.length) && yearOk(et0Year.length) ? r1(sum(rainYear) - sum(et0Year)) : Number.NaN,
  };
}

export function landuseFeatures(
  obs: ObservationRow[],
  field: FieldRow,
  opts: { now?: Date; days?: number; climate?: ClimateRow[] } = {},
): Record<LanduseFeature, number> {
  const now = (opts.now ?? new Date()).getTime();
  const days = opts.days ?? 365;
  const since = now - days * 86_400_000;
  const inWindow = obs.filter((o) => o.observedOn.getTime() >= since && o.observedOn.getTime() <= now).sort((a, b) => a.observedOn.getTime() - b.observedOn.getTime());
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
    evi_max: r3(max(nums(s2.map((o) => o.evi)))),
    savi_max: r3(max(nums(s2.map((o) => o.savi)))),
    vh_mean: r3(avg(vh)),
    vh_range: r3(max(vh) - min(vh)),
    vh_std: r3(std(vh)),
    vv_mean: r3(avg(vv)),
    vv_std: r3(std(vv)),
    vh_minus_vv: r3(avg(pairs)),
    s1_count: vh.length,
    elevation_m: field.elevationM ?? Number.NaN,
    slope_deg: field.slopeDeg ?? Number.NaN,
    irrigated: field.irrigation === "RAINFED" ? 0 : 1,
    ...climateFeatures(opts.climate ?? [], now, days),
  };
}

export function toVector(f: Record<LanduseFeature, number>): number[] {
  return LANDUSE_FEATURES.map((k) => f[k]);
}
