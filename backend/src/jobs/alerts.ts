import { getPrisma, type Prisma } from "../db";
import { bumpDataVersion } from "../lib/cache";
import { assessDiseaseRisk, evaluateWeatherAlerts, fetchForecast } from "../engine";
import { notifyWard } from "../notify";
import { currentFiscalYearBs, currentSeason } from "../scope";

const WARD_CONCURRENCY = Number(process.env.ALERT_WARD_CONCURRENCY ?? 4);

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

  async function processWard(ward: (typeof wards)[number]) {
    try {
      const fc = await fetchForecast(ward.centroidLat!, ward.centroidLng!);
      await prisma.weatherSnapshot.create({ data: { wardId: ward.id, daily: fc.daily as unknown as Prisma.InputJsonValue, hourly: fc.hourly as unknown as Prisma.InputJsonValue } });

      for (const a of evaluateWeatherAlerts(fc.daily)) {
        await store(ward.id, { ...a, cropCodes: [], evidence: a.evidence });
      }

      const [declared, past] = await Promise.all([
        prisma.seasonDeclaration.findMany({
          where: { fiscalYearBs, season, isFallow: false, parcel: { wardId: ward.id } },
          select: { crop: { select: { code: true } } },
          distinct: ["cropId"],
        }),
        prisma.alert.groupBy({ by: ["type"], where: { wardId: ward.id, validFrom: { lt: new Date() } }, _count: { _all: true } }),
      ]);
      const pastCount = new Map(past.map((p) => [p.type, p._count._all]));
      for (const { crop } of declared) {
        const base = assessDiseaseRisk({ crop: crop.code, hourly: fc.hourly, daily: fc.daily });
        for (const r of base) {
          const history = pastCount.get(r.code) ?? 0;
          const withHistory = history ? (assessDiseaseRisk({ crop: crop.code, hourly: fc.hourly, daily: fc.daily, pastAlertsInWard: history }).find((x) => x.code === r.code) ?? r) : r;
          if (withHistory.level === "LOW") continue;
          await store(ward.id, {
            type: withHistory.code,
            date: withHistory.days[0]!,
            severity: withHistory.level === "HIGH" ? "SEVERE" : "WARNING",
            titleNe: `${withHistory.name.ne}को जोखिम`,
            messageNe: `${withHistory.why.ne} ${withHistory.prevent[0]?.ne ?? ""}`.trim(),
            cropCodes: [crop.code],
            evidence: { score: withHistory.score, level: withHistory.level, days: withHistory.days, pastAlertsInWard: history },
            ruleVersion: withHistory.ruleVersion,
          });
        }
      }
    } catch (e) {
      failures.push({ wardId: ward.id, error: e instanceof Error ? e.message : String(e) });
    }
  }

  const queue = [...wards];
  const workers = Array.from({ length: Math.min(WARD_CONCURRENCY, queue.length) }, async () => {
    for (let w = queue.shift(); w; w = queue.shift()) await processWard(w);
  });
  await Promise.all(workers);
  if (created > 0) bumpDataVersion();
  return { wards: wards.length, created, pushed, failures };
}
