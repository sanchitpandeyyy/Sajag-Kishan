import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { landuseFeatures, LANDUSE_FEATURES, toVector, type ClimateRow, type ObservationRow } from "./features";
import { predictProba, type LightGbmDump } from "./gbdt";
import { landuseRules, loadLanduseModel, modelProba } from "./landuse";
import { logisticProba } from "./linear";

const here = dirname(fileURLToPath(import.meta.url));
const day = (s: string) => new Date(`${s}T00:00:00Z`);
const s2 = (date: string, ndvi: number): ObservationRow => ({ sensor: "S2", observedOn: day(date), ndvi, ndre: ndvi * 0.6, ndwi: -0.3, ndmi: 0.2, evi: ndvi * 0.8, savi: ndvi * 0.7, vvDb: null, vhDb: null });
const s1 = (date: string, vh: number, vv = -9): ObservationRow => ({ sensor: "S1", observedOn: day(date), ndvi: null, ndre: null, ndwi: null, ndmi: null, vvDb: vv, vhDb: vh });

describe("land-use features", () => {
  const obs = [s2("2026-07-01", 0.2), s2("2026-08-01", 0.5), s2("2026-09-01", 0.82), s1("2026-07-05", -22), s1("2026-08-05", -18), s1("2026-09-05", -15), s1("2026-10-05", -14)];
  const f = landuseFeatures(obs, { elevationM: 191, slopeDeg: 0.3, irrigation: "CANAL" }, { now: day("2026-11-01") });

  it("builds the vector in the documented order", () => {
    expect(toVector(f)).toHaveLength(LANDUSE_FEATURES.length);
    expect(f.ndvi_max).toBe(0.82);
    expect(f.ndvi_amplitude).toBe(0.62);
    expect(f.ndvi_count).toBe(3);
    expect(f.vh_range).toBe(8);
    expect(f.s1_count).toBe(4);
    expect(f.irrigated).toBe(1);
  });

  it("takes the season peak of EVI and SAVI", () => {
    expect(f.evi_max).toBe(0.656);
    expect(f.savi_max).toBe(0.574);
  });

  it("measures radar spread as a standard deviation", () => {
    expect(f.vh_std).toBe(3.112);
    expect(f.vv_std).toBe(0);
    const one = landuseFeatures([s1("2026-08-05", -18)], { elevationM: 0, slopeDeg: 0, irrigation: "RAINFED" }, { now: day("2026-11-01") });
    expect(Number.isNaN(one.vh_std)).toBe(true);
  });

  it("marks missing sensors as NaN and the rules call it cultivated", () => {
    const radarOnly = landuseFeatures(obs.filter((o) => o.sensor === "S1"), { elevationM: null, slopeDeg: null, irrigation: "RAINFED" }, { now: day("2026-11-01") });
    expect(Number.isNaN(radarOnly.ndvi_max)).toBe(true);
    expect(Number.isNaN(radarOnly.evi_max)).toBe(true);
    expect(landuseRules(radarOnly).label).toBe("cultivated");
  });

  it("drops readings outside the window", () => {
    const g = landuseFeatures([s2("2024-01-01", 0.9)], { elevationM: 0, slopeDeg: 0, irrigation: "RAINFED" }, { now: day("2026-11-01") });
    expect(g.ndvi_count).toBe(0);
  });
});

describe("climate features", () => {
  const now = day("2026-11-01");
  const year = (rain: (i: number) => number, tmax = 30): ClimateRow[] =>
    Array.from({ length: 360 }, (_, i) => ({
      date: new Date(now.getTime() - (5 + i) * 86_400_000),
      precipMm: rain(i),
      tempMeanC: 24,
      tempMaxC: i < 40 ? 36 : tmax,
      soilMoisture: 0.3,
      et0Mm: 3,
    }));
  const field = { elevationM: 190, slopeDeg: 0.5, irrigation: "RAINFED" };

  it("sums rainfall over the year and the last 90 days", () => {
    const f = landuseFeatures([], field, { now, climate: year(() => 4) });
    expect(f.rain_365_mm).toBe(1440);
    expect(f.rain_90_mm).toBe(4 * 85);
    expect(f.temp_mean_c).toBe(24);
    expect(f.soil_moisture_mean).toBe(0.3);
    expect(f.hot_days).toBe(40);
    expect(f.water_balance_mm).toBe(1440 - 360 * 3);
  });

  it("refuses totals when most of the window is missing", () => {
    const half = year(() => 4).slice(0, 150);
    const f = landuseFeatures([], field, { now, climate: half });
    expect(Number.isNaN(f.rain_365_mm)).toBe(true);
    expect(Number.isNaN(f.hot_days)).toBe(true);
    expect(f.rain_90_mm).toBe(340);
  });

  it("is NaN without any climate", () => {
    const f = landuseFeatures([], field, { now });
    expect(Number.isNaN(f.rain_365_mm)).toBe(true);
    expect(Number.isNaN(f.temp_mean_c)).toBe(true);
  });
});

describe("model evaluators", () => {
  const leaf = (v: number) => ({ leaf_value: v });
  const stump = (thr: number, l: number, r: number) => ({
    tree_structure: { split_feature: 0, threshold: thr, decision_type: "<=", default_left: true, missing_type: "NaN" as const, left_child: leaf(l), right_child: leaf(r) },
  });

  it("sums boosted trees and averages random-forest trees", () => {
    const trees = [stump(0.5, -1, 1), stump(0.5, -3, 3)];
    const gbdt: LightGbmDump = { objective: "binary sigmoid:1", feature_names: ["a"], tree_info: trees };
    const rf: LightGbmDump = { ...gbdt, average_output: true };
    expect(predictProba(gbdt, [1])).toBeCloseTo(1 / (1 + Math.exp(-4)), 12);
    expect(predictProba(rf, [1])).toBeCloseTo(1 / (1 + Math.exp(-2)), 12);
    expect(predictProba(rf, [Number.NaN])).toBeCloseTo(1 / (1 + Math.exp(2)), 12);
  });

  it("imputes, scales and applies the logistic weights", () => {
    const m = { impute: [2, 0], mean: [1, 0], scale: [2, 1], coef: [1.5, -1], intercept: 0.25 };
    expect(logisticProba(m, [Number.NaN, 1])).toBeCloseTo(0.5, 12);
  });
});

describe("exported model", () => {
  const fixture = resolve(here, "landuse-parity.json");
  const model = loadLanduseModel();

  it.skipIf(!model)("uses the current feature list", () => {
    expect(model!.features).toEqual([...LANDUSE_FEATURES]);
  });

  it.skipIf(!existsSync(fixture) || !model)("matches the trainer's own probabilities", () => {
    const { cases, version } = JSON.parse(readFileSync(fixture, "utf8")) as { version: string; cases: { x: (number | null)[]; p: number }[] };
    expect(version).toBe(model!.version);
    for (const c of cases) {
      const x = c.x.map((v) => (v == null ? Number.NaN : v));
      expect(modelProba(model!, x)).toBeCloseTo(c.p, 6);
    }
  });
});
