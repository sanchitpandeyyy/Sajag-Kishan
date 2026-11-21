/**
 * The farmer's own facts for the chat: fields, crops this season, next calendar jobs,
 * the 3-day forecast at the field, active alerts in the ward, disease risk and subsidy share.
 * Every answer about "my" farm comes from here, never from the model's imagination.
 */
import { getPrisma } from "../db";
import { assessDiseaseRisk, fetchForecast, generateCalendar, zoneForElevation, type DiseaseAdvice } from "../engine";
import { currentFiscalYearBs, currentSeason } from "../scope";

export interface FarmerChatContext {
  name: string;
  wardNumber: number | null;
  totalAreaM2: number;
  zone: string | null;
  crops: { code: string; nameNe: string; nameEn: string; areaM2: number; sowingDate: string | null }[];
  nextTasks: { crop: string; titleNe: string; task: string; startsOn: string; endsOn: string }[];
  forecast: { date: string; rainMm: number; tMax: number; tMin: number }[];
  alerts: { titleNe: string; messageNe: string; severity: string }[];
  risks: (Pick<DiseaseAdvice, "code" | "level" | "name" | "why" | "prevent"> & { crop: string })[];
  subsidy: { scheme: string; unit: string; allocated: number; delivered: number | null; status: string }[];
}

export async function farmerContext(userId: string): Promise<FarmerChatContext | null> {
  const prisma = getPrisma();
  const farmer = await prisma.farmer.findUnique({
    where: { userId },
    select: {
      id: true,
      firstNameNe: true,
      lastNameNe: true,
      farmingWard: { select: { number: true, id: true, centroidLat: true, centroidLng: true } },
      parcels: {
        select: {
          areaM2: true,
          centroidLat: true,
          centroidLng: true,
          elevationM: true,
          declarations: {
            where: { fiscalYearBs: currentFiscalYearBs(), season: currentSeason(), isFallow: false },
            select: { sownAreaM2: true, sowingDate: true, season: true, crop: { select: { code: true, nameNe: true, nameEn: true } } },
          },
        },
      },
      allocations: { orderBy: { createdAt: "desc" }, take: 3, select: { allocatedQty: true, deliveredQty: true, status: true, scheme: { select: { name: true, unit: true } } } },
    },
  });
  if (!farmer) return null;

  const located = farmer.parcels.find((p) => p.centroidLat != null) ?? null;
  const lat = located?.centroidLat ?? farmer.farmingWard.centroidLat;
  const lng = located?.centroidLng ?? farmer.farmingWard.centroidLng;
  const fc = lat != null && lng != null ? await fetchForecast(lat, lng, { days: 7 }).catch(() => null) : null;
  const elevation = located?.elevationM ?? fc?.elevationM ?? null;
  const zone = elevation != null ? zoneForElevation(elevation) : null;
  const today = new Date().toISOString().slice(0, 10);

  const decls = farmer.parcels.flatMap((p) => p.declarations);
  const crops = decls.map((d) => ({ ...d.crop, areaM2: d.sownAreaM2 ?? 0, sowingDate: d.sowingDate?.toISOString().slice(0, 10) ?? null }));

  const nextTasks = zone
    ? decls
        .flatMap((d) =>
          generateCalendar({ crop: d.crop.code, zone, season: d.season, sowingDate: d.sowingDate?.toISOString().slice(0, 10) })
            .filter((e) => e.endsOn >= today)
            .map((e) => ({ crop: d.crop.nameNe, titleNe: e.titleNe, task: e.task, startsOn: e.startsOn, endsOn: e.endsOn })),
        )
        .sort((a, b) => a.startsOn.localeCompare(b.startsOn))
        .slice(0, 4)
    : [];

  const risks = fc
    ? decls.flatMap((d) => {
        const stage = zone ? (generateCalendar({ crop: d.crop.code, zone, season: d.season }).find((e) => e.startsOn <= today && e.endsOn >= today)?.task ?? null) : null;
        return assessDiseaseRisk({ crop: d.crop.code, stage, hourly: fc.hourly, daily: fc.daily })
          .filter((r) => r.level !== "LOW")
          .map((r) => ({ code: r.code, level: r.level, name: r.name, why: r.why, prevent: r.prevent, crop: d.crop.nameNe }));
      })
    : [];

  const alerts = await prisma.alert.findMany({
    where: { wardId: farmer.farmingWard.id, validTo: { gte: new Date() } },
    orderBy: { validFrom: "asc" },
    take: 3,
    select: { titleNe: true, messageNe: true, severity: true },
  });

  return {
    name: [farmer.firstNameNe, farmer.lastNameNe].filter(Boolean).join(" "),
    wardNumber: farmer.farmingWard.number,
    totalAreaM2: farmer.parcels.reduce((s, p) => s + p.areaM2, 0),
    zone,
    crops,
    nextTasks,
    forecast: (fc?.daily ?? []).slice(0, 3).map((d) => ({ date: d.date, rainMm: Math.round(d.precipitationMm), tMax: Math.round(d.tempMaxC), tMin: Math.round(d.tempMinC) })),
    alerts: alerts.map((a) => ({ ...a, severity: String(a.severity) })),
    risks,
    subsidy: farmer.allocations.map((a) => ({ scheme: a.scheme.name, unit: a.scheme.unit, allocated: a.allocatedQty, delivered: a.deliveredQty, status: String(a.status) })),
  };
}
