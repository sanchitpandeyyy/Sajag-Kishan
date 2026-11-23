import { getPrisma } from "../db";
import { currentFiscalYearBs, currentSeason, schemeScope, wardScope } from "../scope";
import type { AuthUser } from "../types";
import { cropsMentioned, normalize } from "./lexicon";

export type OfficerTopic = "alerts" | "advisories" | "crops" | "land" | "farmers" | "subsidy" | "questions";

const TOPIC_WORDS: [OfficerTopic, string[]][] = [
  ["alerts", ["चेतावनी", "अलर्ट", "डढुवा", "मरुवा", "रोग", "कीरा", "वर्षा", "बाढी", "तुसारो", "खडेरी", "alert", "warning", "blight", "blast", "rust", "aphid", "armyworm", "rain", "flood", "frost", "drought", "dry spell", "heat", "wind"]],
  ["advisories", ["सूचना", "advisory", "advisories", "notice"]],
  ["crops", ["बाली", "धान", "गहुँ", "मकै", "आलु", "तोरी", "मसुरो", "कोदो", "crop", "paddy", "wheat", "maize", "potato", "mustard", "lentil", "millet", "sown", "planted"]],
  ["land", ["जग्गा", "बाँझो", "क्षेत्रफल", "land", "fallow", "area", "parcel", "field"]],
  ["farmers", ["किसान", "कृषक", "प्रमाणित", "farmer", "verified", "verification", "registered"]],
  ["subsidy", ["अनुदान", "मल वितरण", "subsidy", "allocation", "delivered", "fertilizer distribution"]],
  ["questions", ["प्रश्न", "सोधे", "question", "asked", "chat"]],
];

const ALERT_WORDS: [string, string[]][] = [
  ["LATE_BLIGHT", ["डढुवा", "late blight", "blight"]],
  ["RICE_BLAST", ["मरुवा", "blast"]],
  ["BACTERIAL_LEAF_BLIGHT", ["पात डढुवा", "bacterial"]],
  ["YELLOW_RUST", ["सिन्दूरे", "rust"]],
  ["FALL_ARMYWORM", ["फौजी", "armyworm"]],
  ["MUSTARD_APHID", ["लाही", "aphid"]],
  ["HEAVY_RAIN", ["भारी वर्षा", "heavy rain", "rain"]],
  ["FLOOD_RISK", ["बाढी", "flood"]],
  ["FROST", ["तुसारो", "frost"]],
  ["HEAT", ["गर्मी", "heat"]],
  ["DRY_SPELL", ["खडेरी", "dry spell", "drought"]],
  ["STRONG_WIND", ["हावा", "wind"]],
];

export function detectOfficerTopics(question: string): OfficerTopic[] {
  const q = normalize(question).toLowerCase();
  const hits = TOPIC_WORDS.filter(([, words]) => words.some((w) => q.includes(w))).map(([t]) => t);
  if (hits.includes("alerts") && hits.includes("crops") && !/(बाली|crop|sown|planted|लगाए)/.test(q)) return hits.filter((t) => t !== "crops");
  return hits;
}

export function alertTypesMentioned(question: string): string[] {
  const q = normalize(question).toLowerCase();
  const found = ALERT_WORDS.filter(([, words]) => words.some((w) => q.includes(w))).map(([t]) => t);
  return found.includes("BACTERIAL_LEAF_BLIGHT") ? found.filter((t) => t !== "LATE_BLIGHT") : found;
}

export interface Period {
  from: Date;
  to: Date;
  ne: string;
  en: string;
}

export function periodFor(question: string, now = new Date()): Period {
  const q = normalize(question).toLowerCase();
  const day = 86_400_000;
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (/(आज|today)/.test(q)) return { from: startOfDay, to: now, ne: "आज", en: "today" };
  if (/(हिजो|yesterday)/.test(q)) return { from: new Date(startOfDay.getTime() - day), to: startOfDay, ne: "हिजो", en: "yesterday" };
  if (/(यो हप्ता|यस हप्ता|this week)/.test(q)) return { from: new Date(startOfDay.getTime() - 6 * day), to: now, ne: "यो हप्ता", en: "this week" };
  if (/(गत महिना|अघिल्लो महिना|last month)/.test(q)) {
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    return { from, to: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)), ne: "गत महिना", en: "last month" };
  }
  if (/(यो महिना|यस महिना|this month)/.test(q)) return { from: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)), to: now, ne: "यो महिना", en: "this month" };
  if (/(यो वर्ष|यस वर्ष|this year)/.test(q)) return { from: new Date(Date.UTC(now.getUTCFullYear(), 0, 1)), to: now, ne: "यो वर्ष", en: "this year" };
  return { from: new Date(startOfDay.getTime() - 29 * day), to: now, ne: "पछिल्लो ३० दिन", en: "the last 30 days" };
}

type WardRef = { id: number; number: number; place: string };

export interface OfficerFacts {
  scope: { wards: number; places: string[] };
  period: { ne: string; en: string; from: string; to: string };
  topics: OfficerTopic[];
  filters: { alertTypes: string[]; crops: string[] };
  alerts?: { total: number; severe: number; byType: { type: string; count: number }[]; byWard: { ward: string; type: string; count: number }[]; reach: { farmers: number; pushed: number; read: number } };
  advisories?: { total: number; latest: { ward: string; titleNe: string; date: string }[] };
  crops?: { season: string; byCrop: { crop: string; areaHa: number; farmers: number }[]; byWard: { ward: string; crop: string; areaHa: number }[] };
  land?: { parcels: number; areaHa: number; fallowHa: number; byWard: { ward: string; parcels: number; areaHa: number; fallowHa: number }[] };
  farmers?: { total: number; byWard: { ward: string; farmers: number }[]; parcelsVerified: number; parcelsUnverified: number; parcelsDisputed: number };
  subsidy?: { byStatus: { status: string; count: number; allocated: number; delivered: number }[]; schemes: { scheme: string; unit: string; allocated: number; delivered: number; farmers: number }[] };
  questions?: { total: number; byIntent: { intent: string; count: number }[]; recent: string[] };
}

const ha = (m2: number) => Math.round((m2 / 10_000) * 10) / 10;
const iso = (d: Date) => d.toISOString().slice(0, 10);

export async function officerFacts(user: AuthUser, question: string, opts: { topics?: OfficerTopic[]; now?: Date } = {}): Promise<OfficerFacts> {
  const prisma = getPrisma();
  const now = opts.now ?? new Date();
  const period = periodFor(question, now);
  const detected = opts.topics ?? detectOfficerTopics(question);
  const topics: OfficerTopic[] = detected.length ? detected : ["alerts", "advisories", "crops", "land", "farmers", "subsidy", "questions"];
  const alertTypes = alertTypesMentioned(question);
  const crops = cropsMentioned(question);

  const scope = await wardScope(user);
  const wardRows = await prisma.ward.findMany({ where: scope, select: { id: true, number: true, localLevel: { select: { nameNe: true } } } });
  const wards = new Map<number, WardRef>(wardRows.map((w) => [w.id, { id: w.id, number: w.number, place: w.localLevel.nameNe }]));
  const wardIds = [...wards.keys()];
  const places = [...new Set(wardRows.map((w) => w.localLevel.nameNe))];
  const multi = places.length > 1;
  const label = (id: number | null | undefined) => {
    const w = id == null ? undefined : wards.get(id);
    if (!w) return "?";
    return multi ? `${w.place} वडा ${w.number}` : `वडा ${w.number}`;
  };

  const facts: OfficerFacts = {
    scope: { wards: wardIds.length, places: places.slice(0, 10) },
    period: { ne: period.ne, en: period.en, from: iso(period.from), to: iso(period.to) },
    topics,
    filters: { alertTypes, crops },
  };
  const inPeriod = { gte: period.from, lte: period.to };
  const fy = currentFiscalYearBs();
  const season = currentSeason();
  const tasks: Promise<void>[] = [];

  if (topics.includes("alerts")) {
    tasks.push(
      (async () => {
        const where = {
          wardId: { in: wardIds },
          validFrom: inPeriod,
          ...(alertTypes.length ? { type: { in: alertTypes } } : {}),
          ...(crops.length ? { OR: [{ cropCodes: { hasSome: crops } }, { cropCodes: { isEmpty: true } }] } : {}),
        };
        const [byWardType, severe, deliveries] = await Promise.all([
          prisma.alert.groupBy({ by: ["wardId", "type"], where, _count: { _all: true } }),
          prisma.alert.count({ where: { ...where, severity: "SEVERE" } }),
          prisma.alertDelivery.findMany({ where: { alert: where }, select: { userId: true, sentAt: true, readAt: true } }),
        ]);
        const byType = new Map<string, number>();
        for (const r of byWardType) byType.set(r.type, (byType.get(r.type) ?? 0) + r._count._all);
        facts.alerts = {
          total: byWardType.reduce((s, r) => s + r._count._all, 0),
          severe,
          byType: [...byType].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
          byWard: byWardType
            .map((r) => ({ ward: label(r.wardId), type: r.type, count: r._count._all }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 25),
          reach: {
            farmers: new Set(deliveries.map((d) => d.userId)).size,
            pushed: new Set(deliveries.filter((d) => d.sentAt).map((d) => d.userId)).size,
            read: new Set(deliveries.filter((d) => d.readAt).map((d) => d.userId)).size,
          },
        };
      })(),
    );
  }

  if (topics.includes("advisories")) {
    tasks.push(
      (async () => {
        const where = { wardId: { in: wardIds }, publishedAt: inPeriod };
        const [total, latest] = await Promise.all([
          prisma.advisory.count({ where }),
          prisma.advisory.findMany({ where, orderBy: { publishedAt: "desc" }, take: 5, select: { wardId: true, titleNe: true, publishedAt: true } }),
        ]);
        facts.advisories = { total, latest: latest.map((a) => ({ ward: label(a.wardId), titleNe: a.titleNe, date: iso(a.publishedAt) })) };
      })(),
    );
  }

  if (topics.includes("crops")) {
    tasks.push(
      (async () => {
        const rows = await prisma.seasonDeclaration.findMany({
          where: { fiscalYearBs: fy, season, isFallow: false, parcel: { wardId: { in: wardIds } }, ...(crops.length ? { crop: { code: { in: crops } } } : {}) },
          select: { sownAreaM2: true, farmerId: true, crop: { select: { nameNe: true } }, parcel: { select: { wardId: true } } },
          take: 50_000,
        });
        const byCrop = new Map<string, { m2: number; farmers: Set<string> }>();
        const byWard = new Map<string, number>();
        for (const r of rows) {
          const c = byCrop.get(r.crop.nameNe) ?? { m2: 0, farmers: new Set<string>() };
          c.m2 += r.sownAreaM2;
          c.farmers.add(r.farmerId);
          byCrop.set(r.crop.nameNe, c);
          const k = `${label(r.parcel.wardId)}|${r.crop.nameNe}`;
          byWard.set(k, (byWard.get(k) ?? 0) + r.sownAreaM2);
        }
        facts.crops = {
          season: `${fy} ${season}`,
          byCrop: [...byCrop].map(([crop, v]) => ({ crop, areaHa: ha(v.m2), farmers: v.farmers.size })).sort((a, b) => b.areaHa - a.areaHa),
          byWard: [...byWard]
            .map(([k, m2]) => {
              const [ward, crop] = k.split("|") as [string, string];
              return { ward, crop, areaHa: ha(m2) };
            })
            .sort((a, b) => b.areaHa - a.areaHa)
            .slice(0, 25),
        };
      })(),
    );
  }

  if (topics.includes("land")) {
    tasks.push(
      (async () => {
        const [parcels, fallow] = await Promise.all([
          prisma.parcel.groupBy({ by: ["wardId"], where: { wardId: { in: wardIds } }, _count: { _all: true }, _sum: { areaM2: true } }),
          prisma.seasonDeclaration.findMany({
            where: { fiscalYearBs: fy, season, isFallow: true, parcel: { wardId: { in: wardIds } } },
            select: { parcel: { select: { wardId: true, areaM2: true } } },
            take: 50_000,
          }),
        ]);
        const fallowByWard = new Map<number, number>();
        for (const f of fallow) fallowByWard.set(f.parcel.wardId, (fallowByWard.get(f.parcel.wardId) ?? 0) + f.parcel.areaM2);
        facts.land = {
          parcels: parcels.reduce((s, p) => s + p._count._all, 0),
          areaHa: ha(parcels.reduce((s, p) => s + (p._sum.areaM2 ?? 0), 0)),
          fallowHa: ha([...fallowByWard.values()].reduce((s, v) => s + v, 0)),
          byWard: parcels
            .map((p) => ({ ward: label(p.wardId), parcels: p._count._all, areaHa: ha(p._sum.areaM2 ?? 0), fallowHa: ha(fallowByWard.get(p.wardId) ?? 0) }))
            .sort((a, b) => b.fallowHa - a.fallowHa || b.areaHa - a.areaHa)
            .slice(0, 25),
        };
      })(),
    );
  }

  if (topics.includes("farmers")) {
    tasks.push(
      (async () => {
        const [byWard, verification] = await Promise.all([
          prisma.farmer.groupBy({ by: ["farmingWardId"], where: { farmingWardId: { in: wardIds } }, _count: { _all: true } }),
          prisma.parcel.groupBy({ by: ["verification"], where: { wardId: { in: wardIds } }, _count: { _all: true } }),
        ]);
        const v = (s: string) => verification.find((x) => x.verification === s)?._count._all ?? 0;
        facts.farmers = {
          total: byWard.reduce((s, r) => s + r._count._all, 0),
          byWard: byWard.map((r) => ({ ward: label(r.farmingWardId), farmers: r._count._all })).sort((a, b) => b.farmers - a.farmers).slice(0, 25),
          parcelsVerified: v("VERIFIED"),
          parcelsUnverified: v("UNVERIFIED"),
          parcelsDisputed: v("DISPUTED"),
        };
      })(),
    );
  }

  if (topics.includes("subsidy")) {
    tasks.push(
      (async () => {
        const where = { scheme: { ...(await schemeScope(user)), fiscalYearBs: fy }, farmer: { farmingWardId: { in: wardIds } } };
        const [byStatus, rows] = await Promise.all([
          prisma.subsidyAllocation.groupBy({ by: ["status"], where, _count: { _all: true }, _sum: { allocatedQty: true, deliveredQty: true } }),
          prisma.subsidyAllocation.groupBy({ by: ["schemeId"], where, _count: { _all: true }, _sum: { allocatedQty: true, deliveredQty: true } }),
        ]);
        const schemes = await prisma.subsidyScheme.findMany({ where: { id: { in: rows.map((r) => r.schemeId) } }, select: { id: true, name: true, unit: true } });
        facts.subsidy = {
          byStatus: byStatus.map((s) => ({ status: String(s.status), count: s._count._all, allocated: Math.round(s._sum.allocatedQty ?? 0), delivered: Math.round(s._sum.deliveredQty ?? 0) })),
          schemes: rows.map((r) => {
            const s = schemes.find((x) => x.id === r.schemeId);
            return { scheme: s?.name ?? "?", unit: s?.unit ?? "", allocated: Math.round(r._sum.allocatedQty ?? 0), delivered: Math.round(r._sum.deliveredQty ?? 0), farmers: r._count._all };
          }),
        };
      })(),
    );
  }

  if (topics.includes("questions")) {
    tasks.push(
      (async () => {
        const where = { wardId: { in: wardIds }, createdAt: inPeriod };
        const [byIntent, recent] = await Promise.all([
          prisma.chatQuestion.groupBy({ by: ["intent"], where, _count: { _all: true } }),
          prisma.chatQuestion.findMany({ where, orderBy: { createdAt: "desc" }, take: 5, select: { question: true } }),
        ]);
        facts.questions = {
          total: byIntent.reduce((s, r) => s + r._count._all, 0),
          byIntent: byIntent.map((r) => ({ intent: r.intent, count: r._count._all })).sort((a, b) => b.count - a.count),
          recent: recent.map((r) => r.question.slice(0, 120)),
        };
      })(),
    );
  }

  await Promise.all(tasks);
  return facts;
}
