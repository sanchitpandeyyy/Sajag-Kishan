/**
 * GET /v1/advice?parcelId=…  Disease and pest risk for one field this week:
 * likely problem, why, how to prevent it, what to do if signs appear (Nepali + English).
 * Based on the forecast at the field, the crop declared this season, its growth stage and
 * the ward's alert history. No diagnosis by the farmer.
 */
import { Hono } from "hono";
import { requireAuth } from "../auth";
import { getPrisma } from "../db";
import { assessDiseaseRisk, fetchForecast, generateCalendar, zoneForElevation } from "../engine";
import { currentFiscalYearBs, currentSeason, farmerIdFor, wardScope } from "../scope";
import type { AppEnv } from "../types";

export const adviceRoutes = new Hono<AppEnv>().use("*", requireAuth).get("/", async (c) => {
  const user = c.get("user");
  const parcelId = c.req.query("parcelId");
  if (!parcelId) return c.json({ error: "parcelId_required" }, 400);
  const prisma = getPrisma();

  const parcel = await prisma.parcel.findFirst({
    where: user.role === "FARMER" ? { id: parcelId, farmerId: await farmerIdFor(user) } : { id: parcelId, ward: await wardScope(user) },
    include: {
      ward: true,
      declarations: { where: { fiscalYearBs: currentFiscalYearBs(), season: currentSeason(), isFallow: false }, include: { crop: { select: { code: true, nameNe: true, nameEn: true } } } },
    },
  });
  if (!parcel) return c.json({ error: "not_found" }, 404);

  const lat = parcel.centroidLat ?? parcel.ward.centroidLat;
  const lng = parcel.centroidLng ?? parcel.ward.centroidLng;
  if (lat == null || lng == null) return c.json({ crops: [], advice: [], note: "no_location" });

  const fc = await fetchForecast(lat, lng, { days: 7 });
  const zone = zoneForElevation(parcel.elevationM ?? fc.elevationM);
  const past = await prisma.alert.groupBy({ by: ["type"], where: { wardId: parcel.wardId, validFrom: { lt: new Date() } }, _count: { _all: true } });
  const pastCount = new Map(past.map((p) => [p.type, p._count._all]));
  const today = new Date().toISOString().slice(0, 10);

  const advice = parcel.declarations.flatMap((d) => {
    const events = generateCalendar({ crop: d.crop.code, zone, season: d.season, sowingDate: d.sowingDate?.toISOString().slice(0, 10) });
    const stage = events.find((e) => e.startsOn <= today && e.endsOn >= today)?.task ?? null;
    return assessDiseaseRisk({ crop: d.crop.code, stage, hourly: fc.hourly, daily: fc.daily }).map((r) => {
      const h = assessDiseaseRisk({ crop: d.crop.code, stage, hourly: fc.hourly, daily: fc.daily, pastAlertsInWard: pastCount.get(r.code) ?? 0 }).find((x) => x.code === r.code) ?? r;
      return { ...h, cropName: { ne: d.crop.nameNe, en: d.crop.nameEn }, stage, pastAlertsInWard: pastCount.get(r.code) ?? 0 };
    });
  });

  return c.json({
    crops: parcel.declarations.map((d) => d.crop),
    advice: advice.sort((a, b) => b.score - a.score),
    source: "open-meteo forecast + crop rules + ward history",
  });
});
