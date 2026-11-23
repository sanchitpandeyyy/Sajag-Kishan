import { getPrisma } from "../db";
import { fetchForecast, generateCalendar, zoneForElevation, ZONE_LABEL_NE, type GeneratedEvent } from "../engine";
import { Hono } from "hono";
import { requireAuth } from "../auth";
import { cached, MINUTE } from "../lib/cache";
import { farmerIdFor, wardScope } from "../scope";
import type { AppEnv, AuthUser } from "../types";

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

  const year = new Date().getUTCFullYear();
  const events: GeneratedEvent[] = plan.flatMap((p) =>
    generateCalendar({ crop: p.crop, zone, season: p.season, sowingDate: p.sowingDate, year, forecast: forecast?.daily }),
  );
  events.sort((a, b) => a.startsOn.localeCompare(b.startsOn));

  return {
    parcel: { id: parcel.id, localName: parcel.localName, tole: parcel.tole, elevationM: elevation, zone, zoneNe: ZONE_LABEL_NE[zone] },
    basis: declared.length ? "declared" : "suggested",
    events,
    generatedBy: "calendar-v0",
    disclaimerNe: "यो पात्रो प्रारम्भिक सिफारिस हो। स्थानीय कृषि प्राविधिकको सल्लाह अनुसार मिलाउनुहोस्।",
  };
}

export const calendarRoutes = new Hono<AppEnv>().use("*", requireAuth).get("/", async (c) => {
  const user = c.get("user");
  const parcelId = c.req.query("parcelId");
  if (!parcelId) return c.json({ error: "parcelId_required" }, 400);
  const calendar = await cached(`calendar:${user.id}:${parcelId}`, 5 * MINUTE, () => buildCalendar(user, parcelId));
  return calendar ? c.json(calendar) : c.json({ error: "not_found" }, 404);
});
