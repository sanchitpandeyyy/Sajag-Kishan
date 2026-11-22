import type { MiddlewareHandler } from "hono";
import { getPrisma } from "../db";
import type { AppEnv } from "../types";
import { assessDiseaseRisk, fetchForecast, generateCalendar, ZONE_LABEL_NE, zoneForElevation, type AgroZone, type DiseaseAdvice } from "../engine";
import type { LandSystem } from "../shared/land-units";
import { currentFiscalYearBs, currentSeason } from "../scope";
import { areaEn, areaNe, landSystemFor, plantOptions, summarizeAlerts, type AlertFact, type AlertSummary, type PlantOption } from "./facts";

export interface ParcelFact {
  name: string;
  areaM2: number;
  areaNe: string;
  irrigation: string;
  ownership: string;
  elevationM: number | null;
  slopeDeg: number | null;
  soilPh: number | null;
  landCover: string | null;
  cropNow: string | null;
  fallow: boolean;
}

export interface TaskFact {
  crop: string;
  titleNe: string;
  task: string;
  startsOn: string;
  endsOn: string;
  done: boolean;
  overdue: boolean;
}

export interface FarmerChatContext {
  name: string;
  wardNumber: number | null;
  place: string | null;
  zone: AgroZone | null;
  zoneNe: string | null;
  land: { system: LandSystem; totalM2: number; totalNe: string; totalEn: string; cultivatedM2: number; fallowM2: number; parcels: ParcelFact[] };
  crops: { code: string; nameNe: string; nameEn: string; areaM2: number; areaNe: string; sowingDate: string | null }[];
  nextTasks: TaskFact[];
  forecast: { date: string; rainMm: number; tMax: number; tMin: number }[];
  alerts: AlertFact[];
  alertSummary: AlertSummary;
  advisories: { titleNe: string; bodyNe: string; crops: string[]; publishedAt: string }[];
  risks: (Pick<DiseaseAdvice, "code" | "level" | "name" | "why" | "prevent"> & { crop: string })[];
  inputsApplied: { crop: string; product: string; kg: number; appliedAt: string | null }[];
  subsidy: { scheme: string; unit: string; allocated: number; delivered: number | null; status: string }[];
  plantOptions: PlantOption[];
}

const TTL_MS = 3 * 60_000;
const cache = new Map<string, { at: number; ctx: FarmerChatContext | null }>();

export function invalidateFarmerContext(userId: string) {
  cache.delete(userId);
}

export const refreshFarmerContext: MiddlewareHandler<AppEnv> = async (c, next) => {
  await next();
  const user = c.get("user");
  if (c.req.method !== "GET" && user?.role === "FARMER") invalidateFarmerContext(user.id);
};

export async function farmerContext(userId: string): Promise<FarmerChatContext | null> {
  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.ctx;
  const ctx = await buildFarmerContext(userId);
  cache.set(userId, { at: Date.now(), ctx });
  if (cache.size > 5000) cache.delete(cache.keys().next().value!);
  return ctx;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const DAY = 86_400_000;

async function buildFarmerContext(userId: string): Promise<FarmerChatContext | null> {
  const prisma = getPrisma();
  const now = new Date();
  const today = iso(now);
  const fy = currentFiscalYearBs();
  const season = currentSeason();

  const farmer = await prisma.farmer.findUnique({
    where: { userId },
    select: {
      firstNameNe: true,
      lastNameNe: true,
      farmingWard: {
        select: {
          id: true,
          number: true,
          centroidLat: true,
          centroidLng: true,
          elevationM: true,
          localLevelId: true,
          localLevel: { select: { nameNe: true, district: { select: { nameNe: true } } } },
        },
      },
      parcels: {
        select: {
          localName: true,
          kittaNo: true,
          tole: true,
          areaM2: true,
          areaOriginal: true,
          irrigation: true,
          ownershipType: true,
          centroidLat: true,
          centroidLng: true,
          elevationM: true,
          slopeDeg: true,
          soilPh: true,
          landCover: true,
          declarations: {
            where: { fiscalYearBs: fy, season },
            select: {
              isFallow: true,
              sownAreaM2: true,
              sowingDate: true,
              season: true,
              crop: { select: { code: true, nameNe: true, nameEn: true } },
              inputs: { select: { product: true, quantityKg: true, appliedAt: true } },
            },
          },
          calendarEvents: {
            where: { endsOn: { gte: new Date(now.getTime() - 14 * DAY) } },
            orderBy: { startsOn: "asc" },
            take: 12,
            select: { cropCode: true, titleNe: true, task: true, startsOn: true, endsOn: true, done: true },
          },
        },
      },
      allocations: { orderBy: { createdAt: "desc" }, take: 3, select: { allocatedQty: true, deliveredQty: true, status: true, scheme: { select: { name: true, unit: true } } } },
    },
  });
  if (!farmer) return null;

  const ward = farmer.farmingWard;
  const located = farmer.parcels.find((p) => p.centroidLat != null) ?? null;
  const lat = located?.centroidLat ?? ward.centroidLat;
  const lng = located?.centroidLng ?? ward.centroidLng;
  const fc = lat != null && lng != null ? await fetchForecast(lat, lng, { days: 7 }).catch(() => null) : null;
  const elevation = located?.elevationM ?? ward.elevationM ?? fc?.elevationM ?? null;
  const zone = elevation != null ? zoneForElevation(elevation) : null;
  const system = landSystemFor(zone, farmer.parcels.map((p) => p.areaOriginal));

  const decls = farmer.parcels.flatMap((p) => p.declarations);
  const sown = decls.filter((d) => !d.isFallow);
  const cropNames = new Map(sown.map((d) => [d.crop.code, d.crop.nameNe]));

  const parcels: ParcelFact[] = farmer.parcels.map((p, i) => {
    const growing = p.declarations.filter((d) => !d.isFallow);
    return {
      name: p.localName ?? (p.kittaNo ? `कित्ता ${p.kittaNo}` : `${p.tole} खेत ${i + 1}`),
      areaM2: Math.round(p.areaM2),
      areaNe: areaNe(p.areaM2, system),
      irrigation: String(p.irrigation),
      ownership: String(p.ownershipType),
      elevationM: p.elevationM == null ? null : Math.round(p.elevationM),
      slopeDeg: p.slopeDeg == null ? null : Math.round(p.slopeDeg),
      soilPh: p.soilPh,
      landCover: p.landCover,
      cropNow: growing.map((d) => d.crop.nameNe).join(", ") || null,
      fallow: p.declarations.length > 0 && growing.length === 0,
    };
  });

  const totalM2 = farmer.parcels.reduce((s, p) => s + p.areaM2, 0);
  const cultivatedM2 = sown.reduce((s, d) => s + (d.sownAreaM2 ?? 0), 0);
  const fallowM2 = farmer.parcels.filter((_, i) => parcels[i]!.fallow).reduce((s, p) => s + p.areaM2, 0);

  const crops = sown.map((d) => ({
    ...d.crop,
    areaM2: Math.round(d.sownAreaM2 ?? 0),
    areaNe: areaNe(d.sownAreaM2 ?? 0, system),
    sowingDate: d.sowingDate ? iso(d.sowingDate) : null,
  }));

  const saved = farmer.parcels.flatMap((p) => p.calendarEvents);
  const tasks: TaskFact[] = saved.length
    ? saved
        .filter((e) => !e.done)
        .map((e) => ({ crop: cropNames.get(e.cropCode) ?? e.cropCode, titleNe: e.titleNe, task: String(e.task), startsOn: iso(e.startsOn), endsOn: iso(e.endsOn), done: false, overdue: iso(e.endsOn) < today }))
    : zone
      ? sown.flatMap((d) =>
          generateCalendar({ crop: d.crop.code, zone, season: d.season, sowingDate: d.sowingDate ? iso(d.sowingDate) : undefined, forecast: fc?.daily })
            .filter((e) => e.endsOn >= today)
            .map((e) => ({ crop: d.crop.nameNe, titleNe: e.titleNe, task: e.task, startsOn: e.startsOn, endsOn: e.endsOn, done: false, overdue: false })),
        )
      : [];
  const nextTasks = tasks.sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.startsOn.localeCompare(b.startsOn)).slice(0, 6);

  const risks = fc
    ? sown.flatMap((d) => {
        const stage = zone ? (generateCalendar({ crop: d.crop.code, zone, season: d.season }).find((e) => e.startsOn <= today && e.endsOn >= today)?.task ?? null) : null;
        return assessDiseaseRisk({ crop: d.crop.code, stage, hourly: fc.hourly, daily: fc.daily })
          .filter((r) => r.level !== "LOW")
          .map((r) => ({ code: r.code, level: r.level, name: r.name, why: r.why, prevent: r.prevent, crop: d.crop.nameNe }));
      })
    : [];

  const [alertRows, advisoryRows] = await Promise.all([
    prisma.alert.findMany({
      where: { wardId: ward.id, validTo: { gte: new Date(now.getTime() - 14 * DAY) } },
      orderBy: [{ validTo: "desc" }],
      take: 20,
      select: {
        type: true,
        titleNe: true,
        messageNe: true,
        severity: true,
        cropCodes: true,
        validFrom: true,
        validTo: true,
        deliveries: { where: { userId }, select: { readAt: true, sentAt: true } },
      },
    }),
    prisma.advisory.findMany({
      where: { publishedAt: { gte: new Date(now.getTime() - 30 * DAY) }, OR: [{ wardId: ward.id }, { localLevelId: ward.localLevelId, wardId: null }] },
      orderBy: { publishedAt: "desc" },
      take: 5,
      select: { titleNe: true, bodyNe: true, cropCodes: true, publishedAt: true },
    }),
  ]);

  const alerts: AlertFact[] = alertRows
    .map((a) => ({
      type: a.type,
      titleNe: a.titleNe,
      messageNe: a.messageNe,
      severity: String(a.severity),
      crops: a.cropCodes,
      validFrom: iso(a.validFrom),
      validTo: iso(a.validTo),
      active: a.validFrom <= now && a.validTo >= now,
      seen: a.deliveries.some((d) => d.readAt != null),
    }))
    .sort((a, b) => Number(b.active) - Number(a.active) || severityRank(b.severity) - severityRank(a.severity));

  const myCrops = crops.map((c) => c.code);
  const soilPh = farmer.parcels.find((p) => p.soilPh != null)?.soilPh ?? null;

  return {
    name: [farmer.firstNameNe, farmer.lastNameNe].filter(Boolean).join(" "),
    wardNumber: ward.number,
    place: ward.localLevel ? `${ward.localLevel.nameNe}, ${ward.localLevel.district.nameNe}` : null,
    zone,
    zoneNe: zone ? ZONE_LABEL_NE[zone] : null,
    land: {
      system,
      totalM2: Math.round(totalM2),
      totalNe: areaNe(totalM2, system),
      totalEn: areaEn(totalM2, system),
      cultivatedM2: Math.round(cultivatedM2),
      fallowM2: Math.round(fallowM2),
      parcels,
    },
    crops,
    nextTasks,
    forecast: (fc?.daily ?? []).slice(0, 3).map((d) => ({ date: d.date, rainMm: Math.round(d.precipitationMm), tMax: Math.round(d.tempMaxC), tMin: Math.round(d.tempMinC) })),
    alerts: alerts.slice(0, 8),
    alertSummary: summarizeAlerts(alerts, myCrops),
    advisories: advisoryRows.map((a) => ({ titleNe: a.titleNe, bodyNe: a.bodyNe.slice(0, 400), crops: a.cropCodes, publishedAt: iso(a.publishedAt) })),
    risks,
    inputsApplied: sown.flatMap((d) => d.inputs.map((x) => ({ crop: d.crop.nameNe, product: x.product, kg: x.quantityKg, appliedAt: x.appliedAt ? iso(x.appliedAt) : null }))),
    subsidy: farmer.allocations.map((a) => ({ scheme: a.scheme.name, unit: a.scheme.unit, allocated: a.allocatedQty, delivered: a.deliveredQty, status: String(a.status) })),
    plantOptions: plantOptions(zone, today, { soilPh, growing: myCrops }),
  };
}

function severityRank(s: string) {
  return s === "SEVERE" ? 2 : s === "WARNING" ? 1 : 0;
}

type Section = keyof FarmerChatContext;

const SECTIONS: Record<string, Section[]> = {
  greeting: ["name"],
  weather: ["name", "place", "forecast", "alerts", "alertSummary", "crops"],
  task: ["name", "zone", "crops", "nextTasks", "forecast", "alertSummary", "alerts"],
  fertilizer: ["name", "land", "crops", "inputsApplied", "forecast", "alertSummary", "subsidy"],
  disease: ["name", "crops", "risks", "forecast", "alerts", "alertSummary", "advisories"],
  subsidy: ["name", "land", "crops", "subsidy"],
  land: ["name", "land", "crops", "plantOptions"],
  plant: ["name", "place", "zoneNe", "land", "crops", "plantOptions", "forecast", "alertSummary", "alerts", "advisories"],
  sowing: ["name", "zoneNe", "crops", "plantOptions", "forecast", "alertSummary"],
};

export function factsFor(intent: string, ctx: FarmerChatContext): Partial<FarmerChatContext> {
  const keys = SECTIONS[intent];
  if (!keys) return ctx;
  const out: Partial<FarmerChatContext> = {};
  for (const k of keys) (out as Record<string, unknown>)[k] = ctx[k];
  return out;
}

export function compactJson(value: unknown): string {
  return JSON.stringify(value, (_, v) => (v === null || (Array.isArray(v) && v.length === 0) ? undefined : v));
}
