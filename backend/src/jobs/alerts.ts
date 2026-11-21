/**
 * weather:refresh + alerts:evaluate (docs/03-technical-implementation.md §6, docs/10 §3-4).
 * Per ward: fetch the forecast, run weather rules, then run disease/pest risk for the crops
 * actually declared in that ward this season (with the ward's alert history). New alerts are
 * stored and pushed to the farmers they concern.
 */
import { getPrisma, type Prisma } from "../db";
import { assessDiseaseRisk, evaluateWeatherAlerts, fetchForecast } from "../engine";
import { sendPush } from "../push";
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
    pushed += await pushAlertToWard(alert.id, wardId, alert.cropCodes, a);
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

/** Push only to farmers in the ward, and for crop-specific alerts only to growers of that crop. */
async function pushAlertToWard(alertId: string, wardId: number, cropCodes: string[], a: AlertLike): Promise<number> {
  const prisma = getPrisma();
  const farmers = await prisma.farmer.findMany({
    where: {
      parcels: { some: { wardId, ...(cropCodes.length ? { declarations: { some: { crop: { code: { in: cropCodes } } } } } : {}) } },
    },
    select: { userId: true, user: { select: { pushTokens: { select: { token: true } } } } },
  });
  const messages = farmers.flatMap((f) =>
    f.user.pushTokens.map((t) => ({ to: t.token, title: a.titleNe, body: a.messageNe, data: { alertId, screen: "/alerts" }, priority: a.severity === "SEVERE" ? ("high" as const) : ("default" as const) })),
  );
  if (!messages.length) return 0;
  const ok = await sendPush(messages);
  await prisma.alertDelivery.createMany({
    data: farmers.map((f) => ({ alertId, userId: f.userId, channel: "push", sentAt: ok ? new Date() : null, error: ok ? null : "push_failed" })),
    skipDuplicates: true,
  });
  return ok ? messages.length : 0;
}
