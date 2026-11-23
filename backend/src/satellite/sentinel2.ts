import { mean, ndviClass, reflectance, spectralIndices, type Index } from "./indices";
import { insideProjected } from "../geo/field";
import { epsgOf, readBox, readWindow, sampleGrid, signHref, stacSearch, toSceneXY, type PixelGrid } from "./pc";

const COLLECTION = "sentinel-2-l2a";

const CLEAR_SCL = new Set([4, 5, 6, 7]);

const BANDS = { blue: "B02", green: "B03", red: "B04", redEdge: "B05", nir: "B08", nir8a: "B8A", swir: "B11", scl: "SCL" } as const;
type BandKey = keyof typeof BANDS;

export interface Scene {
  id: string;
  datetime: string;
  cloudPct: number;
  epsg: number;
  baseline: number;
  hrefs: Record<BandKey, string>;
}

export interface S2Reading extends Record<Index, number | null> {
  sceneId: string;
  date: string;
  cloudPct: number;
  scl: number | null;
  /** "zonal" = averaged over the field outline; "point" = 30 m patch at the centre */
  method?: "zonal" | "point";
  pixels?: number;
  clearPixels?: number;
}
export type NdviReading = S2Reading;

export async function searchScenes(
  lat: number,
  lng: number,
  opts: { from: Date; to: Date; maxCloud?: number; limit?: number; fetchImpl?: typeof fetch },
): Promise<Scene[]> {
  const items = await stacSearch(
    {
      collections: [COLLECTION],
      intersects: { type: "Point", coordinates: [lng, lat] },
      datetime: `${opts.from.toISOString()}/${opts.to.toISOString()}`,
      query: { "eo:cloud_cover": { lt: opts.maxCloud ?? 60 } },
      sortby: [{ field: "datetime", direction: "desc" }],
      limit: opts.limit ?? 10,
    },
    opts.fetchImpl,
  );
  return items
    .map((ft) => {
      const p = ft.properties;
      const hrefs = Object.fromEntries(Object.entries(BANDS).map(([k, band]) => [k, ft.assets[band]?.href ?? ""])) as Record<BandKey, string>;
      return {
        id: ft.id,
        datetime: String(p.datetime),
        cloudPct: Number(p["eo:cloud_cover"] ?? 0),
        epsg: epsgOf(p),
        baseline: Number.parseFloat(String(p["s2:processing_baseline"] ?? "0")),
        hrefs,
      };
    })
    .filter((s) => s.epsg >= 32601 && s.epsg <= 32760 && s.hrefs.red && s.hrefs.nir && s.hrefs.scl);
}

export interface ZonalGrids {
  scl: PixelGrid;
  red: PixelGrid;
  nir: PixelGrid;
  blue: PixelGrid;
  green: PixelGrid;
  redEdge: PixelGrid;
  nir8a: PixelGrid;
  swir: PixelGrid;
}

export interface ZonalResult {
  indices: Record<Index, number | null>;
  /** 10 m pixels whose centre lies inside the field */
  pixels: number;
  /** of those, how many were clear of cloud/shadow */
  clearPixels: number;
}

/** Below this share of clear pixels the scene is treated as cloudy over the field. */
export const MIN_CLEAR_SHARE = 0.5;

/**
 * Average the spectral indices over every 10 m pixel inside the field, skipping cloud/shadow pixels.
 * 20 m bands are sampled under each clear 10 m pixel, which area-weights them. Returns null when no
 * pixel centre falls inside the field (smaller than one pixel), so the caller can fall back to a point read.
 */
export function zonalIndices(ring: [number, number][], g: ZonalGrids, baseline: number): ZonalResult | null {
  const rf = (v: number | null) => (v == null ? null : reflectance(v, baseline));
  const acc: Record<Index, number[]> = { ndvi: [], ndre: [], ndwi: [], ndmi: [], evi: [], savi: [] };
  let pixels = 0;
  let clearPixels = 0;
  for (let j = 0; j < g.red.height; j++) {
    for (let i = 0; i < g.red.width; i++) {
      const x = g.red.originX + (i + 0.5) * g.red.resX;
      const y = g.red.originY - (j + 0.5) * g.red.resY;
      if (!insideProjected(ring, x, y)) continue;
      pixels++;
      const scl = sampleGrid(g.scl, x, y);
      if (scl == null || !CLEAR_SCL.has(scl)) continue;
      clearPixels++;
      const idx = spectralIndices({
        red: rf(g.red.values[j * g.red.width + i] ?? null),
        nir: rf(sampleGrid(g.nir, x, y)),
        blue: rf(sampleGrid(g.blue, x, y)),
        green: rf(sampleGrid(g.green, x, y)),
        redEdge: rf(sampleGrid(g.redEdge, x, y)),
        nir8a: rf(sampleGrid(g.nir8a, x, y)),
        swir: rf(sampleGrid(g.swir, x, y)),
      });
      for (const k of Object.keys(acc) as Index[]) if (idx[k] != null) acc[k].push(idx[k]!);
    }
  }
  if (pixels === 0) return null;
  const r3 = (x: number | null) => (x == null ? null : Math.round(x * 1000) / 1000);
  const cloudy = clearPixels / pixels < MIN_CLEAR_SHARE;
  const indices = Object.fromEntries((Object.keys(acc) as Index[]).map((k) => [k, cloudy ? null : r3(mean(acc[k]))])) as Record<Index, number | null>;
  return { indices, pixels, clearPixels };
}

/** Largest field (bounding box side, m) read pixel by pixel; bigger ones use the point read. */
const MAX_ZONAL_SIDE_M = 3000;

async function zonalAt(scene: Scene, ringLngLat: [number, number][], fetchImpl: typeof fetch): Promise<ZonalResult | null> {
  const ring = ringLngLat.map(([lng, lat]) => toSceneXY(scene.epsg, lat, lng) as [number, number]);
  const xs = ring.map((p) => p[0]);
  const ys = ring.map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs) - 20, Math.max(...xs) + 20, Math.min(...ys) - 20, Math.max(...ys) + 20];
  if (maxX - minX > MAX_ZONAL_SIDE_M || maxY - minY > MAX_ZONAL_SIDE_M) return null;
  const read = async (key: BandKey) => readBox(await signHref(COLLECTION, scene.hrefs[key], fetchImpl), minX, minY, maxX, maxY);
  const scl = await read("scl");
  const [red, nir, blue, green, redEdge, nir8a, swir] = await Promise.all([read("red"), read("nir"), read("blue"), read("green"), read("redEdge"), read("nir8a"), read("swir")]);
  return zonalIndices(ring, { scl, red, nir, blue, green, redEdge, nir8a, swir }, scene.baseline);
}

/**
 * Spectral indices for a field in one scene. With the field's outline, averages every pixel inside it;
 * otherwise (or for fields under one pixel / very large) reads a 30 m patch at the point.
 */
export async function indicesAt(scene: Scene, lat: number, lng: number, fetchImpl: typeof fetch = fetch, ringLngLat?: [number, number][] | null): Promise<S2Reading> {
  if (ringLngLat && ringLngLat.length >= 4 && Object.values(scene.hrefs).every(Boolean)) {
    const z = await zonalAt(scene, ringLngLat, fetchImpl).catch(() => null);
    if (z) return { sceneId: scene.id, date: scene.datetime.slice(0, 10), cloudPct: scene.cloudPct, scl: null, ...z.indices, method: "zonal", pixels: z.pixels, clearPixels: z.clearPixels };
  }
  const [x, y] = toSceneXY(scene.epsg, lat, lng);
  const read = async (key: BandKey, radius: number) => (scene.hrefs[key] ? (await readWindow(await signHref(COLLECTION, scene.hrefs[key], fetchImpl), x, y, radius)).values : []);

  const scl = (await read("scl", 0))[0] ?? null;
  const base = { sceneId: scene.id, date: scene.datetime.slice(0, 10), cloudPct: scene.cloudPct, scl, method: "point" as const };
  if (scl == null || !CLEAR_SCL.has(scl)) return { ...base, ndvi: null, ndre: null, ndwi: null, ndmi: null, evi: null, savi: null };

  const [blue, green, red, nir, redEdge, nir8a, swir] = await Promise.all([read("blue", 1), read("green", 1), read("red", 1), read("nir", 1), read("redEdge", 0), read("nir8a", 0), read("swir", 0)]);
  const rf = (values: number[]) => mean(values.map((v) => reflectance(v, scene.baseline)));
  const pixels = red.map((r, i) =>
    spectralIndices({ red: reflectance(r, scene.baseline), nir: reflectance(nir[i] ?? 0, scene.baseline), blue: blue[i] == null ? null : reflectance(blue[i]!, scene.baseline) }),
  );
  const r3 = (x: number | null) => (x == null ? null : Math.round(x * 1000) / 1000);
  const rest = spectralIndices({ green: rf(green), nir: rf(nir), redEdge: rf(redEdge), nir8a: rf(nir8a), swir: rf(swir) });
  return {
    ...base,
    ndvi: r3(mean(pixels.map((p) => p.ndvi))),
    ndre: rest.ndre,
    ndwi: rest.ndwi,
    ndmi: rest.ndmi,
    evi: r3(mean(pixels.map((p) => p.evi))),
    savi: r3(mean(pixels.map((p) => p.savi))),
  };
}

export const ndviAt = indicesAt;

export interface GreennessVerdict {
  peakNdvi: number | null;
  latestNdvi: number | null;
  validCount: number;
  likelyFallow: boolean | null;
  greenNow: boolean | null;
  dNdvi: number | null;
  seasonAmplitude: number | null;
  latestClass: { key: string; ne: string; en: string } | null;
}

export function greennessVerdict(readings: { date: string; ndvi: number | null }[]): GreennessVerdict {
  const valid = readings.filter((r): r is { date: string; ndvi: number } => r.ndvi != null).sort((a, b) => a.date.localeCompare(b.date));
  if (!valid.length) return { peakNdvi: null, latestNdvi: null, validCount: 0, likelyFallow: null, greenNow: null, dNdvi: null, seasonAmplitude: null, latestClass: null };
  const peakIdx = valid.reduce((best, r, i) => (r.ndvi > valid[best]!.ndvi ? i : best), 0);
  const peak = valid[peakIdx]!.ndvi;
  const latest = valid.at(-1)!;
  const prev = valid.at(-2);
  const lowBefore = Math.min(...valid.slice(0, peakIdx + 1).map((r) => r.ndvi));
  const cls = ndviClass(latest.ndvi);
  return {
    peakNdvi: peak,
    latestNdvi: latest.ndvi,
    validCount: valid.length,
    likelyFallow: valid.length >= 3 ? peak < 0.35 : null,
    greenNow: latest.ndvi >= 0.4,
    dNdvi: prev ? Math.round((latest.ndvi - prev.ndvi) * 1000) / 1000 : null,
    seasonAmplitude: Math.round((peak - lowBefore) * 1000) / 1000,
    latestClass: { key: cls.key, ne: cls.ne, en: cls.en },
  };
}
