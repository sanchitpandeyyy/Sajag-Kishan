/**
 * weather:refresh + alerts:evaluate (docs/03-technical-implementation.md §6, docs/10 §3-4).
 * Per ward: fetch the forecast, run weather rules, then run disease/pest risk for the crops
 * actually declared in that ward this season (with the ward's alert history). New alerts are
 * stored and pushed to the farmers they concern.
 */
import { getPrisma, type Prisma } from "../db";
import { assessDiseaseRisk, evaluateWeatherAlerts, fetchForecast } from "../engine";
import { notifyWard } from "../notify";
import { currentFiscalYearBs, currentSeason } from "../scope";

interface AlertLike {
  titleNe: string;
  messageNe: string;
  severity: "INFO" | "WARNING" | "SEVERE";
}

export async function refreshWardAlerts(wardIds: number[]) {
  const prisma = getPrisma();
  const wards = await prisma.ward.findMany({ where: { id: { in: wardIds }, centroidLat: { not: null }, centroidLng: { not: null } } });
  const fiscalYearBs = currentFiscalYearBs();
  const season = currentSeason();
  let created = 0;
  let pushed = 0;
  const failures: { wardId: number; error: string }[] = [];

  async function store(wardId: number, a: AlertLike & { type: string; date: string; cropCodes: string[]; evidence: Prisma.InputJsonValue; ruleVersion: string }) {
    const validFrom = new Date(`${a.date}T00:00:00+05:45`);
    const existing = await prisma.alert.findUnique({ where: { wardId_type_validFrom: { wardId, type: a.type, validFrom } } });
    if (existing) return;
    const alert = await prisma.alert.create({
      data: {
        wardId,
        type: a.type,
        severity: a.severity,
        validFrom,
        validTo: new Date(validFrom.getTime() + 86_400_000),
        titleNe: a.titleNe,
        messageNe: a.messageNe,
        cropCodes: a.cropCodes,
        evidence: a.evidence,
        ruleVersion: a.ruleVersion,
      },
    });
    created++;
    const r = await notifyWard({
      wardId,
      cropCodes: alert.cropCodes,
      title: a.titleNe,
      body: a.messageNe,
      priority: a.severity === "SEVERE" ? "high" : "default",
      data: { alertId: alert.id, screen: "/alerts" },
      alertId: alert.id,
    });
    pushed += r.pushed;
  }

  for (const ward of wards) {
    try {
      const fc = await fetchForecast(ward.centroidLat!, ward.centroidLng!);
      await prisma.weatherSnapshot.create({ data: { wardId: ward.id, daily: fc.daily as unknown as Prisma.InputJsonValue, hourly: fc.hourly as unknown as Prisma.InputJsonValue } });

      // 1. Weather alerts (everyone in the ward).
      for (const a of evaluateWeatherAlerts(fc.daily)) {
        await store(ward.id, { ...a, cropCodes: [], evidence: a.evidence });
      }

      // 2. Disease and pest risk for crops declared in this ward this season.
      const declared = await prisma.seasonDeclaration.findMany({
        where: { fiscalYearBs, season, isFallow: false, parcel: { wardId: ward.id } },
        select: { crop: { select: { code: true } } },
        distinct: ["cropId"],
      });
      for (const { crop } of declared) {
        const past = await prisma.alert.groupBy({ by: ["type"], where: { wardId: ward.id, validFrom: { lt: new Date() } }, _count: { _all: true } });
        const pastCount = new Map(past.map((p) => [p.type, p._count._all]));
        for (const r of assessDiseaseRisk({ crop: crop.code, hourly: fc.hourly, daily: fc.daily })) {
          const withHistory = assessDiseaseRisk({ crop: crop.code, hourly: fc.hourly, daily: fc.daily, pastAlertsInWard: pastCount.get(r.code) ?? 0 }).find((x) => x.code === r.code) ?? r;
          if (withHistory.level === "LOW") continue;
          await store(ward.id, {
            type: withHistory.code,
            date: withHistory.days[0]!,
            severity: withHistory.level === "HIGH" ? "SEVERE" : "WARNING",
            titleNe: `${withHistory.name.ne}को जोखिम`,
            messageNe: `${withHistory.why.ne} ${withHistory.prevent[0]?.ne ?? ""}`.trim(),
            cropCodes: [crop.code],
            evidence: { score: withHistory.score, level: withHistory.level, days: withHistory.days, pastAlertsInWard: pastCount.get(r.code) ?? 0 },
            ruleVersion: withHistory.ruleVersion,
          });
        }
      }
    } catch (e) {
      failures.push({ wardId: ward.id, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return { wards: wards.length, created, pushed, failures };
}
