import { getPrisma } from "../db";
import { fetchForecast, findTemplate, generateCalendar, getCrop, zoneForElevation, ZONE_LABEL_NE, type GeneratedEvent, type SiteContext } from "../engine";
import { Hono } from "hono";
import { requireAuth } from "../auth";
import { cached, MINUTE } from "../lib/cache";
import { farmerIdFor, wardScope } from "../scope";
import type { AppEnv, AuthUser } from "../types";

const DAY = 86_400_000;

/**
 * Mean temperature over the crop's season, read from the ward's recorded daily history.
 * The same calendar window a year earlier is used when this season's days aren't recorded yet.
 */
function seasonTemp(climate: { date: Date; tempMeanC: number | null }[], sowing: Date, durationDays: number): number | null {
  if (!climate.length) return null;
  const byDay = new Map<string, number>();
  for (const c of climate) if (c.tempMeanC != null) byDay.set(c.date.toISOString().slice(5, 10), c.tempMeanC);
  const vals: number[] = [];
  for (let i = 0; i < durationDays; i++) {
    const v = byDay.get(new Date(sowing.getTime() + i * DAY).toISOString().slice(5, 10));
    if (v != null) vals.push(v);
  }
  return vals.length >= Math.min(30, durationDays / 2) ? vals.reduce((s, x) => s + x, 0) / vals.length : null;
}

async function buildCalendar(user: AuthUser, parcelId: string) {
  const prisma = getPrisma();
  const parcel = await prisma.parcel.findFirst({
    where: user.role === "FARMER" ? { id: parcelId, farmerId: await farmerIdFor(user) } : { id: parcelId, ward: await wardScope(user) },
    include: { ward: true, declarations: { include: { crop: true }, orderBy: { createdAt: "desc" }, take: 6 } },
  });
  if (!parcel) return null;

  const lat = parcel.centroidLat ?? parcel.ward.centroidLat;
  const lng = parcel.centroidLng ?? parcel.ward.centroidLng;
  const elevation = parcel.elevationM ?? parcel.ward.elevationM ?? 200;
  const zone = zoneForElevation(elevation);
  const forecast = lat != null && lng != null ? await fetchForecast(lat, lng, { days: 16 }).catch(() => null) : null;

  const declared = parcel.declarations.filter((d) => !d.isFallow);
  const plan = declared.length
    ? declared.map((d) => ({ crop: d.crop.code, season: d.season, sowingDate: d.sowingDate?.toISOString().slice(0, 10) }))
    : [
        { crop: "paddy", season: "BARSHE", sowingDate: undefined },
        { crop: "wheat", season: "HIUDE", sowingDate: undefined },
        { crop: "maize", season: "CHAITE", sowingDate: undefined },
      ];

  const now = new Date();
  const year = now.getUTCFullYear();
  const [climate, ndviRows] = await Promise.all([
    prisma.climateDay.findMany({ where: { wardId: parcel.wardId, date: { gte: new Date(now.getTime() - 400 * DAY) }, tempMeanC: { not: null } }, select: { date: true, tempMeanC: true } }),
    prisma.satelliteObservation.findMany({ where: { parcelId: parcel.id, sensor: "S2", ndvi: { not: null }, observedOn: { gte: new Date(now.getTime() - 240 * DAY) } }, select: { observedOn: true, ndvi: true } }),
  ]);
  const baseSite: SiteContext = {
    elevationM: elevation,
    slopeDeg: parcel.slopeDeg,
    aspectDeg: parcel.aspectDeg,
    soilPh: parcel.soilPh,
    soilPhEstimated: parcel.soilPhSource === "ESTIMATED_SOILGRIDS",
    soilOrganicC: parcel.soilOrganicC,
    clayPct: parcel.clayPct,
    ndvi: ndviRows.map((o) => ({ date: o.observedOn.toISOString().slice(0, 10), ndvi: o.ndvi! })),
  };

  const events: GeneratedEvent[] = plan.flatMap((p) => {
    const tpl = findTemplate(p.crop, zone, p.season);
    const crop = getCrop(p.crop);
    let seasonMeanTempC: number | null = null;
    if (tpl && crop) {
      const sow = p.sowingDate ? new Date(`${p.sowingDate}T00:00:00Z`) : new Date(Date.UTC(year, tpl.sowingStart.month - 1, tpl.sowingStart.day));
      seasonMeanTempC = seasonTemp(climate, sow, crop.durationDays);
    }
    return generateCalendar({ crop: p.crop, zone, season: p.season, sowingDate: p.sowingDate, year, forecast: forecast?.daily, site: { ...baseSite, seasonMeanTempC } });
  });
  events.sort((a, b) => a.startsOn.localeCompare(b.startsOn));

  return {
    parcel: { id: parcel.id, localName: parcel.localName, tole: parcel.tole, elevationM: elevation, zone, zoneNe: ZONE_LABEL_NE[zone] },
    basis: declared.length ? "declared" : "suggested",
    events,
    generatedBy: "calendar-v1",
  };
}

export const calendarRoutes = new Hono<AppEnv>().use("*", requireAuth).get("/", async (c) => {
  const user = c.get("user");
  const parcelId = c.req.query("parcelId");
  if (!parcelId) return c.json({ error: "parcelId_required" }, 400);
  const calendar = await cached(`calendar:${user.id}:${parcelId}`, 5 * MINUTE, () => buildCalendar(user, parcelId));
  return calendar ? c.json(calendar) : c.json({ error: "not_found" }, 404);
});
