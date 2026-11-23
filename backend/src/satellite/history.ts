import { getPrisma, type Prisma } from "../db";
import { asPolygon } from "../geo/field";
import { seasonWindows } from "../engine/land-transparency";
import { landCoverAt } from "./landcover";
import { indicesAt, searchScenes } from "./sentinel2";

/** Sentinel-2 L2A over Nepal on Planetary Computer starts in early 2019. */
export const HISTORY_START = new Date(Date.UTC(2019, 0, 1));

/** Number of season windows (3 a year) from now back to HISTORY_START. */
export function seasonsSinceStart(now = new Date()): number {
  return seasonWindows(now, 40).filter((w) => w.to >= HISTORY_START).length;
}

const MIN_CLEAR = 2;
const PER_WINDOW = 3;
const SPACING_DAYS = 15;

export async function syncParcelHistory(parcelId: string, opts: { seasons?: number } = {}): Promise<number> {
  const prisma = getPrisma();
  const p = await prisma.parcel.findUniqueOrThrow({ where: { id: parcelId }, select: { id: true, wardId: true, centroidLat: true, centroidLng: true, landCover: true, geometry: true } });
  const ring = asPolygon(p.geometry)?.coordinates[0] ?? null;
  if (p.centroidLat == null || p.centroidLng == null) return 0;
  const [lat, lng] = [p.centroidLat, p.centroidLng];

  if (p.landCover == null) {
    const lc = await landCoverAt(lat, lng).catch(() => null);
    if (lc) await prisma.parcel.update({ where: { id: p.id }, data: { landCover: lc.centre, croplandShare: lc.croplandShare } });
  }

  let stored = 0;
  const now = new Date();
  // Newest seasons first, so recent context is filled before older years.
  for (const w of seasonWindows(now, opts.seasons ?? seasonsSinceStart(now)).reverse()) {
    const to = w.to > now ? now : w.to;
    if (to <= w.from) continue;
    const have = await prisma.satelliteObservation.findMany({ where: { parcelId: p.id, sensor: "S2", observedOn: { gte: w.from, lte: to } }, select: { observedOn: true, ndvi: true } });
    if (have.filter((o) => o.ndvi != null).length >= MIN_CLEAR) continue;
    const taken = new Set(have.map((o) => o.observedOn.toISOString().slice(0, 10)));

    const scenes = (await searchScenes(lat, lng, { from: w.from, to, maxCloud: 30, limit: 40 })).sort((a, b) => a.cloudPct - b.cloudPct);
    const picked: typeof scenes = [];
    for (const s of scenes) {
      const t = new Date(s.datetime).getTime();
      if (taken.has(s.datetime.slice(0, 10))) continue;
      if (picked.every((q) => Math.abs(new Date(q.datetime).getTime() - t) >= SPACING_DAYS * 86_400_000)) picked.push(s);
      if (picked.length >= PER_WINDOW) break;
    }
    for (const scene of picked) {
      const r = await indicesAt(scene, lat, lng, fetch, ring);
      await prisma.satelliteObservation.create({
        data: {
          parcelId: p.id,
          wardId: p.wardId,
          observedOn: new Date(`${scene.datetime.slice(0, 10)}T00:00:00Z`),
          sensor: "S2",
          ndvi: r.ndvi,
          ndre: r.ndre,
          ndwi: r.ndwi,
          ndmi: r.ndmi,
          evi: r.evi,
          savi: r.savi,
          cloudPct: r.cloudPct,
          meta: { sceneId: r.sceneId, scl: r.scl, window: w.key, method: r.method ?? "point", pixels: r.pixels ?? null, clearPixels: r.clearPixels ?? null } as Prisma.InputJsonValue,
        },
      });
      stored++;
    }
  }
  return stored;
}
