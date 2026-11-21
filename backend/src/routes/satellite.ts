/**
 * Satellite (Sentinel-2 NDVI) endpoints.
 * POST /v1/satellite/sync          officer: start a background sync for mapped fields in scope
 * GET  /v1/satellite/status        officer: progress of the running/last sync
 * GET  /v1/satellite/parcels/:id   farmer (own) or officer: NDVI series + verdict for one field
 */
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { OFFICER_ROLES, requireAuth, requireRole } from "../auth";
import { getPrisma } from "../db";
import { predictParcel } from "../ml/jobs";
import { loadLanduseModel } from "../ml/landuse";
import { seasonWindows } from "../engine/land-transparency";
import { boxAround, boxAroundPoints, sceneImages } from "../satellite/images";
import { NDVI_CLASSES, ndviClass } from "../satellite/indices";
import { radarVerdict } from "../satellite/sentinel1";
import { greennessVerdict, searchScenes } from "../satellite/sentinel2";
import { startSync, syncStatus } from "../satellite/sync";
import { farmerIdFor, wardScope } from "../scope";
import type { AppEnv } from "../types";

export const satelliteRoutes = new Hono<AppEnv>()
  .use("*", requireAuth)
  .post("/sync", requireRole(...OFFICER_ROLES), zValidator("json", z.object({ limit: z.number().int().min(1).max(200).default(25) })), async (c) => {
    const parcels = await getPrisma().parcel.findMany({
      where: { ward: await wardScope(c.get("user")), centroidLat: { not: null } },
      select: { id: true },
      orderBy: { updatedAt: "desc" },
      take: c.req.valid("json").limit,
    });
    const started = startSync(parcels.map((p) => p.id));
    return c.json({ started, queued: started ? parcels.length : 0, status: syncStatus }, started ? 202 : 409);
  })
  .get("/status", requireRole(...OFFICER_ROLES), (c) => c.json(syncStatus))
  /** Officer: re-run the land-use model for every field in scope that has satellite readings. */
  .post("/predict", requireRole(...OFFICER_ROLES), async (c) => {
    const parcels = await getPrisma().parcel.findMany({ where: { ward: await wardScope(c.get("user")), observations: { some: {} } }, select: { id: true } });
    const model = loadLanduseModel();
    let done = 0;
    for (const p of parcels) if (await predictParcel(p.id)) done++;
    return c.json({ predicted: done, model: model ? { version: model.version, trainedOn: model.trainedOn, metrics: model.metrics } : { version: "rules-v1" } });
  })
  /** Officer: land-use predictions for the map (latest per field). */
  /**
   * Officer: satellite pictures of one field, newest first. One true-colour photo and one NDVI map per
   * clear Sentinel-2 date, with the indices read at the field and the season status for that date.
   */
  .get("/parcels/:id/images", requireRole(...OFFICER_ROLES), zValidator("query", z.object({ limit: z.coerce.number().int().min(1).max(24).default(8), half: z.coerce.number().min(0.001).max(0.02).default(0.004) })), async (c) => {
    const { limit, half } = c.req.valid("query");
    const prisma = getPrisma();
    const parcel = await prisma.parcel.findFirst({
      where: { id: c.req.param("id"), ward: await wardScope(c.get("user")) },
      select: { id: true, centroidLat: true, centroidLng: true, areaM2: true, localName: true, landCover: true, croplandShare: true },
    });
    if (!parcel) return c.json({ error: "not_found" }, 404);
    if (parcel.centroidLat == null || parcel.centroidLng == null) return c.json({ parcel, images: [] });
    const obs = await prisma.satelliteObservation.findMany({
      where: { parcelId: parcel.id, sensor: "S2", ndvi: { not: null } },
      orderBy: { observedOn: "desc" },
      take: limit,
      select: { observedOn: true, ndvi: true, ndre: true, ndwi: true, ndmi: true, cloudPct: true, meta: true },
    });
    const bbox = boxAround(parcel.centroidLat, parcel.centroidLng, half);
    const images = obs
      .map((o) => ({ o, sceneId: (o.meta as { sceneId?: string } | null)?.sceneId }))
      .filter((x): x is { o: (typeof obs)[number]; sceneId: string } => !!x.sceneId)
      .map(({ o, sceneId }) => {
        const date = o.observedOn.toISOString().slice(0, 10);
        return { ...sceneImages(sceneId, date, bbox), ndviValue: o.ndvi, ndre: o.ndre, ndwi: o.ndwi, ndmi: o.ndmi, cloudPct: o.cloudPct, ndviClass: ndviClass(o.ndvi!).key };
      });
    return c.json({ parcel, bbox, images, source: "Sentinel-2 L2A, rendered by Microsoft Planetary Computer" });
  })
  /**
   * Officer: one picture of a whole municipality or ward for a season (least cloudy scene in the window),
   * plus the field points to draw on it. season = a key like "2083/84-BARSHE"; default the last 60 days.
   */
  .get(
    "/area-images",
    requireRole(...OFFICER_ROLES),
    zValidator("query", z.object({ localLevelId: z.coerce.number().int().positive().optional(), ward: z.coerce.number().int().positive().optional(), season: z.string().max(20).optional(), size: z.coerce.number().int().min(256).max(1200).default(900) })),
    async (c) => {
      const q = c.req.valid("query");
      const user = c.get("user");
      const prisma = getPrisma();
      const own = await prisma.officerProfile.findUnique({ where: { userId: user.id }, select: { localLevelId: true } });
      const localLevelId = user.role === "SUPER_ADMIN" ? (q.localLevelId ?? own?.localLevelId) : own?.localLevelId;
      if (!localLevelId) return c.json({ error: "no_local_level" }, 400);
      const fields = await prisma.parcel.findMany({
        where: { centroidLat: { not: null }, ward: { localLevelId, ...(q.ward ? { number: q.ward } : {}) } },
        select: { id: true, centroidLat: true, centroidLng: true, areaM2: true, ward: { select: { number: true } }, farmer: { select: { firstNameNe: true, lastNameNe: true } } },
      });
      const points = fields.map((f) => ({ id: f.id, lat: f.centroidLat!, lng: f.centroidLng!, ward: f.ward.number, areaM2: f.areaM2, farmerNameNe: [f.farmer.firstNameNe, f.farmer.lastNameNe].filter(Boolean).join(" ") }));
      const bbox = boxAroundPoints(points, q.ward ? 0.006 : 0.012, q.ward ? 0.006 : 0.02);
      if (!bbox) return c.json({ bbox: null, image: null, points });

      const now = new Date();
      const win = q.season ? seasonWindows(now, 9).find((w) => w.key === q.season) : undefined;
      const from = win?.from ?? new Date(now.getTime() - 60 * 86_400_000);
      const to = win ? (win.to > now ? now : win.to) : now;
      const centre = { lat: (bbox[1] + bbox[3]) / 2, lng: (bbox[0] + bbox[2]) / 2 };
      const scenes = (await searchScenes(centre.lat, centre.lng, { from, to, maxCloud: 20, limit: 30 })).sort((a, b) => a.cloudPct - b.cloudPct);
      const best = scenes[0];
      return c.json({
        bbox,
        points,
        season: win ? { key: win.key, ne: win.labelNe, en: win.labelEn } : null,
        image: best ? { ...sceneImages(best.id, best.datetime.slice(0, 10), bbox, q.size), cloudPct: best.cloudPct } : null,
        seasons: seasonWindows(now, 6).map((w) => ({ key: w.key, ne: w.labelNe, en: w.labelEn })),
        source: "Sentinel-2 L2A, rendered by Microsoft Planetary Computer",
      });
    },
  )
  .get("/predictions", requireRole(...OFFICER_ROLES), async (c) => {
    const rows = await getPrisma().modelPrediction.findMany({
      where: { model: "landuse", parcel: { ward: await wardScope(c.get("user")) } },
      orderBy: { createdAt: "desc" },
      distinct: ["parcelId"],
      select: { parcelId: true, label: true, probability: true, version: true, createdAt: true },
    });
    const model = loadLanduseModel();
    return c.json({ predictions: rows, model: model ? { version: model.version, trainedOn: model.trainedOn, metrics: model.metrics, trainedAt: model.trainedAt } : { version: "rules-v1" } });
  })
  .get("/parcels/:id", async (c) => {
    const user = c.get("user");
    const prisma = getPrisma();
    const where = user.role === "FARMER" ? { id: c.req.param("id"), farmerId: await farmerIdFor(user) } : { id: c.req.param("id"), ward: await wardScope(user) };
    const parcel = await prisma.parcel.findFirst({ where, select: { id: true, elevationM: true, slopeDeg: true, aspectDeg: true } });
    if (!parcel) return c.json({ error: "not_found" }, 404);
    const [obs, prediction] = await Promise.all([
      prisma.satelliteObservation.findMany({
        where: { parcelId: parcel.id },
        orderBy: { observedOn: "asc" },
        select: { sensor: true, observedOn: true, ndvi: true, ndre: true, ndwi: true, ndmi: true, vvDb: true, vhDb: true, cloudPct: true },
      }),
      prisma.modelPrediction.findFirst({ where: { parcelId: parcel.id, model: "landuse" }, orderBy: { createdAt: "desc" }, select: { label: true, probability: true, version: true, createdAt: true } }),
    ]);
    const day = (d: Date) => d.toISOString().slice(0, 10);
    const series = obs.filter((o) => o.sensor === "S2").map((o) => ({ date: day(o.observedOn), ndvi: o.ndvi, ndre: o.ndre, ndwi: o.ndwi, ndmi: o.ndmi, cloudPct: o.cloudPct }));
    const radar = obs.filter((o) => o.sensor === "S1").map((o) => ({ date: day(o.observedOn), vvDb: o.vvDb, vhDb: o.vhDb }));
    return c.json({
      series,
      verdict: greennessVerdict(series),
      radar,
      radarVerdict: radarVerdict(radar),
      terrain: { elevationM: parcel.elevationM, slopeDeg: parcel.slopeDeg, aspectDeg: parcel.aspectDeg },
      prediction,
      ndviClasses: NDVI_CLASSES,
      source: "Sentinel-2 L2A, Sentinel-1 RTC and Copernicus DEM via Microsoft Planetary Computer",
    });
  });
