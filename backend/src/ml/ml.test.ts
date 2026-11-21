import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { landuseFeatures, LANDUSE_FEATURES, toVector, type ObservationRow } from "./features";
import { predictProba } from "./gbdt";
import { landuseRules, loadLanduseModel } from "./landuse";

const here = dirname(fileURLToPath(import.meta.url));
const day = (s: string) => new Date(`${s}T00:00:00Z`);
const s2 = (date: string, ndvi: number): ObservationRow => ({ sensor: "S2", observedOn: day(date), ndvi, ndre: ndvi * 0.6, ndwi: -0.3, ndmi: 0.2, vvDb: null, vhDb: null });
const s1 = (date: string, vh: number): ObservationRow => ({ sensor: "S1", observedOn: day(date), ndvi: null, ndre: null, ndwi: null, ndmi: null, vvDb: -9, vhDb: vh });

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

  it("marks missing sensors as NaN and the rules call it cultivated", () => {
    const radarOnly = landuseFeatures(obs.filter((o) => o.sensor === "S1"), { elevationM: null, slopeDeg: null, irrigation: "RAINFED" }, { now: day("2026-11-01") });
    expect(Number.isNaN(radarOnly.ndvi_max)).toBe(true);
    expect(landuseRules(radarOnly).label).toBe("cultivated");
  });

  it("drops readings outside the window", () => {
    const g = landuseFeatures([s2("2024-01-01", 0.9)], { elevationM: 0, slopeDeg: 0, irrigation: "RAINFED" }, { now: day("2026-11-01") });
    expect(g.ndvi_count).toBe(0);
  });
});

describe("LightGBM evaluator", () => {
  const fixture = resolve(here, "landuse-parity.json");
  const model = loadLanduseModel();
  it.skipIf(!existsSync(fixture) || !model)("matches LightGBM's own probabilities", () => {
    const { cases } = JSON.parse(readFileSync(fixture, "utf8")) as { cases: { x: (number | null)[]; p: number }[] };
    for (const c of cases) {
      const x = c.x.map((v) => (v == null ? Number.NaN : v));
      expect(predictProba(model!.model, x)).toBeCloseTo(c.p, 6);
    }
  });
});
