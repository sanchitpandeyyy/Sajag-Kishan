/**
 * satellite:sync. For each mapped field: terrain once, then recent Sentinel-2 scenes (NDVI, NDRE, NDWI,
 * NDMI) and Sentinel-1 radar scenes (VV, VH), one SatelliteObservation row per scene and sensor, and a
 * combined fallow flag on the latest optical reading.
 * Runs in the background; progress is kept in memory for the status endpoint.
 */
import { getPrisma, type Prisma } from "../db";
import { backscatterAt, radarVerdict, searchRadarScenes } from "./sentinel1";
import { greennessVerdict, indicesAt, searchScenes } from "./sentinel2";
import { predictParcel } from "../ml/jobs";
import { terrainAt } from "./terrain";
import { syncWardClimate } from "./climate";

/** Wards whose ERA5 climate was refreshed recently (the archive only gains one day per day). */
const climateFreshUntil = new Map<number, number>();

async function ensureWardClimate(wardId: number) {
  if ((climateFreshUntil.get(wardId) ?? 0) > Date.now()) return;
  await syncWardClimate(wardId);
  climateFreshUntil.set(wardId, Date.now() + 12 * 3_600_000);
}

export interface SyncStatus {
  running: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  parcelsTotal: number;
  parcelsDone: number;
  observations: number;
  errors: { parcelId: string; error: string }[];
}

export const syncStatus: SyncStatus = { running: false, startedAt: null, finishedAt: null, parcelsTotal: 0, parcelsDone: 0, observations: 0, errors: [] };

/**
 * One field: terrain (once), Sentinel-2 indices and Sentinel-1 backscatter for recent scenes,
 * then a combined fallow flag on the latest optical reading. Returns the number of new readings.
 */
export async function syncParcel(parcelId: string, opts: { months?: number; maxScenes?: number } = {}): Promise<number> {
  const prisma = getPrisma();
  const p = await prisma.parcel.findUniqueOrThrow({ where: { id: parcelId }, select: { id: true, wardId: true, centroidLat: true, centroidLng: true, slopeDeg: true } });
  if (p.centroidLat == null || p.centroidLng == null) return 0;
  const [lat, lng] = [p.centroidLat, p.centroidLng];

  // Terrain never changes, so read it once per field.
  if (p.slopeDeg == null) {
    const t = await terrainAt(lat, lng).catch(() => null);
    if (t) await prisma.parcel.update({ where: { id: p.id }, data: { elevationM: t.elevationM, slopeDeg: t.slopeDeg, aspectDeg: t.aspectDeg } });
  }

  const to = new Date();
  const from = new Date(to.getTime() - (opts.months ?? 6) * 30 * 86_400_000);
  let stored = 0;

  for (const scene of await searchScenes(lat, lng, { from, to, maxCloud: 60, limit: opts.maxScenes ?? 8 })) {
    const observedOn = new Date(`${scene.datetime.slice(0, 10)}T00:00:00Z`);
    if (await prisma.satelliteObservation.findFirst({ where: { parcelId: p.id, sensor: "S2", observedOn } })) continue;
    const r = await indicesAt(scene, lat, lng);
    await prisma.satelliteObservation.create({
      data: { parcelId: p.id, wardId: p.wardId, observedOn, sensor: "S2", ndvi: r.ndvi, ndre: r.ndre, ndwi: r.ndwi, ndmi: r.ndmi, evi: r.evi, savi: r.savi, cloudPct: r.cloudPct, meta: { sceneId: r.sceneId, scl: r.scl } as Prisma.InputJsonValue },
    });
    stored++;
  }

  // Radar works through cloud: the monsoon months are covered even when Sentinel-2 sees nothing.
  for (const scene of await searchRadarScenes(lat, lng, { from, to, limit: opts.maxScenes ?? 8 })) {
    const observedOn = new Date(`${scene.datetime.slice(0, 10)}T00:00:00Z`);
    if (await prisma.satelliteObservation.findFirst({ where: { parcelId: p.id, sensor: "S1", observedOn } })) continue;
    const r = await backscatterAt(scene, lat, lng);
    await prisma.satelliteObservation.create({
      data: { parcelId: p.id, wardId: p.wardId, observedOn, sensor: "S1", vvDb: r.vvDb, vhDb: r.vhDb, meta: { sceneId: r.sceneId, orbit: r.orbit } as Prisma.InputJsonValue },
    });
    stored++;
  }

  // Combined fallow verdict over 12 months: optical says no green, and radar shows no crop cycle.
  const since = new Date(to.getTime() - 365 * 86_400_000);
  const year = await prisma.satelliteObservation.findMany({
    where: { parcelId: p.id, observedOn: { gte: since } },
    orderBy: { observedOn: "desc" },
    select: { id: true, sensor: true, observedOn: true, ndvi: true, vvDb: true, vhDb: true },
  });
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const optical = year.filter((o) => o.sensor === "S2");
  const g = greennessVerdict(optical.map((o) => ({ date: day(o.observedOn), ndvi: o.ndvi })));
  const radar = radarVerdict(year.filter((o) => o.sensor === "S1").map((o) => ({ date: day(o.observedOn), vvDb: o.vvDb, vhDb: o.vhDb })));
  const fallow = combinedFallow(g.likelyFallow, radar.cropCycleSeen);
  if (optical[0] && fallow != null) await prisma.satelliteObservation.update({ where: { id: optical[0].id }, data: { fallowFlag: fallow } });
  // Ward climate (ERA5) feeds the model's climate features; a failure here never blocks the sync.
  await ensureWardClimate(p.wardId).catch((e) => console.warn("[climate]", e instanceof Error ? e.message : e));
  // Fresh land-use prediction (trained model, or rules if no model file yet).
  if (stored > 0) await predictParcel(p.id).catch(() => null);
  return stored;
}

/**
 * Optical and radar together. Radar can overrule "no green" (cloud hid the crop), and can call a field
 * fallow on its own only when optical has no say at all. Null means not enough data.
 */
export function combinedFallow(opticalFallow: boolean | null, radarCropCycle: boolean | null): boolean | null {
  if (radarCropCycle === true) return false;
  if (opticalFallow != null) return opticalFallow;
  return radarCropCycle === false ? true : null;
}

/** Last meaningful line of an error (Prisma messages start with a long code frame). */
function shortError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  const lines = msg.split("\n").map((l) => l.trim()).filter(Boolean);
  return (lines.at(-1) ?? msg).slice(0, 200);
}

/** Start a background sync for the given fields (no-op if one is already running). */
export function startSync(parcelIds: string[]): boolean {
  if (syncStatus.running) return false;
  Object.assign(syncStatus, { running: true, startedAt: new Date().toISOString(), finishedAt: null, parcelsTotal: parcelIds.length, parcelsDone: 0, observations: 0, errors: [] });
  void (async () => {
    for (const id of parcelIds) {
      // Retry twice: network blips (database cold start, satellite range reads) are common and short.
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          syncStatus.observations += await syncParcel(id);
          break;
        } catch (e) {
          if (attempt === 3) syncStatus.errors.push({ parcelId: id, error: shortError(e) });
          else await new Promise((r) => setTimeout(r, attempt * 5000));
        }
      }
      syncStatus.parcelsDone++;
    }
    syncStatus.running = false;
    syncStatus.finishedAt = new Date().toISOString();
  })();
  return true;
}
