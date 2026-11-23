import { mean, toDb } from "./indices";
import { epsgOf, readWindow, signHref, stacSearch, toSceneXY } from "./pc";

const COLLECTION = "sentinel-1-rtc";

export interface RadarScene {
  id: string;
  datetime: string;
  epsg: number;
  orbit: string;
  hrefs: { vv: string; vh: string };
}

export interface RadarReading {
  sceneId: string;
  date: string;
  orbit: string;
  vvDb: number | null;
  vhDb: number | null;
}

export async function searchRadarScenes(lat: number, lng: number, opts: { from: Date; to: Date; limit?: number; fetchImpl?: typeof fetch }): Promise<RadarScene[]> {
  const items = await stacSearch(
    {
      collections: [COLLECTION],
      intersects: { type: "Point", coordinates: [lng, lat] },
      datetime: `${opts.from.toISOString()}/${opts.to.toISOString()}`,
      sortby: [{ field: "datetime", direction: "desc" }],
      limit: opts.limit ?? 12,
    },
    opts.fetchImpl,
  );
  return items
    .map((ft) => ({
      id: ft.id,
      datetime: String(ft.properties.datetime),
      epsg: epsgOf(ft.properties),
      orbit: String(ft.properties["sat:orbit_state"] ?? ""),
      hrefs: { vv: ft.assets.vv?.href ?? "", vh: ft.assets.vh?.href ?? "" },
    }))
    .filter((s) => s.epsg >= 32601 && s.epsg <= 32760 && s.hrefs.vv && s.hrefs.vh);
}

export async function backscatterAt(scene: RadarScene, lat: number, lng: number, fetchImpl: typeof fetch = fetch): Promise<RadarReading> {
  const [x, y] = toSceneXY(scene.epsg, lat, lng);
  const [vv, vh] = await Promise.all(
    [scene.hrefs.vv, scene.hrefs.vh].map(async (href) => (await readWindow(await signHref(COLLECTION, href, fetchImpl), x, y, 1)).values.filter((v) => v > 0 && Number.isFinite(v))),
  );
  return { sceneId: scene.id, date: scene.datetime.slice(0, 10), orbit: scene.orbit, vvDb: toDb(mean(vv ?? [])), vhDb: toDb(mean(vh ?? [])) };
}

export interface RadarVerdict {
  validCount: number;
  vhRangeDb: number | null;
  latestVhDb: number | null;
  latestVvDb: number | null;
  moistureIndex: number | null;
  cropCycleSeen: boolean | null;
  paddySignature: boolean | null;
}

export const RADAR_RULES = { minReadings: 4, cropRangeDb: 3, floodedVhDb: -21, rule: "radar-v1" } as const;

export function radarVerdict(readings: { date: string; vvDb: number | null; vhDb: number | null }[]): RadarVerdict {
  const vh = readings.filter((r) => r.vhDb != null).sort((a, b) => a.date.localeCompare(b.date));
  const vv = readings.filter((r) => r.vvDb != null).sort((a, b) => a.date.localeCompare(b.date));
  if (!vh.length) return { validCount: 0, vhRangeDb: null, latestVhDb: null, latestVvDb: null, moistureIndex: null, cropCycleSeen: null, paddySignature: null };
  const vhValues = vh.map((r) => r.vhDb!);
  const range = Math.max(...vhValues) - Math.min(...vhValues);
  const vvValues = vv.map((r) => r.vvDb!);
  const vvMin = Math.min(...vvValues);
  const vvMax = Math.max(...vvValues);
  const latestVv = vv.at(-1)?.vvDb ?? null;
  const darkIdx = vhValues.findIndex((v) => v <= RADAR_RULES.floodedVhDb);
  const enough = vh.length >= RADAR_RULES.minReadings;
  return {
    validCount: vh.length,
    vhRangeDb: Math.round(range * 100) / 100,
    latestVhDb: vh.at(-1)!.vhDb,
    latestVvDb: latestVv,
    moistureIndex: latestVv != null && vvMax - vvMin >= 0.5 ? Math.round(((latestVv - vvMin) / (vvMax - vvMin)) * 100) / 100 : null,
    cropCycleSeen: enough ? range >= RADAR_RULES.cropRangeDb : null,
    paddySignature: enough ? darkIdx >= 0 && Math.max(...vhValues.slice(darkIdx)) - vhValues[darkIdx]! >= RADAR_RULES.cropRangeDb : null,
  };
}
