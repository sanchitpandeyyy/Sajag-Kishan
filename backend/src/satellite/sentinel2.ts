/**
 * Sentinel-2 L2A optical indices for a point: NDVI, NDRE, NDWI and NDMI (see indices.ts).
 * Read straight from cloud-optimised GeoTIFFs on Microsoft Planetary Computer (free, no account);
 * only the few pixels around the field are downloaded, never whole scenes.
 *
 * 10 m bands (B03, B04, B08) use the 3x3 pixels around the point (30 m); 20 m bands (B05, B8A, B11)
 * use the single pixel under it. Clouds, shadows and snow are dropped with the SCL layer.
 */
import { mean, ndviClass, reflectance, spectralIndices, type Index } from "./indices";
import { epsgOf, readWindow, signHref, stacSearch, toSceneXY } from "./pc";

const COLLECTION = "sentinel-2-l2a";

/** SCL classes kept: 4 vegetation, 5 bare soil, 6 water, 7 unclassified. */
const CLEAR_SCL = new Set([4, 5, 6, 7]);

const BANDS = { green: "B03", red: "B04", redEdge: "B05", nir: "B08", nir8a: "B8A", swir: "B11", scl: "SCL" } as const;
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
}
/** Kept for older callers. */
export type NdviReading = S2Reading;

/** Recent scenes covering the point, newest first. */
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

/** All four indices at a point for one scene, or nulls if the pixel is cloudy. */
export async function indicesAt(scene: Scene, lat: number, lng: number, fetchImpl: typeof fetch = fetch): Promise<S2Reading> {
  const [x, y] = toSceneXY(scene.epsg, lat, lng);
  const read = async (key: BandKey, radius: number) => (scene.hrefs[key] ? (await readWindow(await signHref(COLLECTION, scene.hrefs[key], fetchImpl), x, y, radius)).values : []);

  const scl = (await read("scl", 0))[0] ?? null;
  const base = { sceneId: scene.id, date: scene.datetime.slice(0, 10), cloudPct: scene.cloudPct, scl };
  if (scl == null || !CLEAR_SCL.has(scl)) return { ...base, ndvi: null, ndre: null, ndwi: null, ndmi: null };

  const [green, red, nir, redEdge, nir8a, swir] = await Promise.all([read("green", 1), read("red", 1), read("nir", 1), read("redEdge", 0), read("nir8a", 0), read("swir", 0)]);
  const rf = (values: number[]) => mean(values.map((v) => reflectance(v, scene.baseline)));
  // NDVI per pixel then averaged (the classic field value); the others from mean reflectance.
  const ndviPixels = red.map((r, i) => spectralIndices({ red: reflectance(r, scene.baseline), nir: reflectance(nir[i] ?? 0, scene.baseline) }).ndvi);
  const ndvi = mean(ndviPixels);
  const rest = spectralIndices({ green: rf(green), nir: rf(nir), redEdge: rf(redEdge), nir8a: rf(nir8a), swir: rf(swir) });
  return { ...base, ndvi: ndvi == null ? null : Math.round(ndvi * 1000) / 1000, ndre: rest.ndre, ndwi: rest.ndwi, ndmi: rest.ndmi };
}

/** NDVI only (kept for older callers and the manual try script). */
export const ndviAt = indicesAt;

export interface GreennessVerdict {
  peakNdvi: number | null;
  latestNdvi: number | null;
  validCount: number;
  likelyFallow: boolean | null;
  greenNow: boolean | null;
  /** NDVI change between the two latest clear readings (green-up > 0, harvest or damage < 0). */
  dNdvi: number | null;
  /** NDVI change across the season: peak minus the lowest reading before the peak. */
  seasonAmplitude: number | null;
  latestClass: { key: string; ne: string; en: string } | null;
}

/** Field verdict from a series of readings (docs/10 §5). */
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
    // Needs at least 3 clear readings before calling a field fallow.
    likelyFallow: valid.length >= 3 ? peak < 0.35 : null,
    greenNow: latest.ndvi >= 0.4,
    dNdvi: prev ? Math.round((latest.ndvi - prev.ndvi) * 1000) / 1000 : null,
    seasonAmplitude: Math.round((peak - lowBefore) * 1000) / 1000,
    latestClass: { key: cls.key, ne: cls.ne, en: cls.en },
  };
}
