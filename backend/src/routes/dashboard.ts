import { zValidator } from "@hono/zod-validator";
import { measuredAreaM2 } from "../geo/field";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { OFFICER_ROLES, requireAuth, requireRole } from "../auth";
import { getPrisma } from "../db";
import { cached, MINUTE } from "../lib/cache";
import { currentFiscalYearBs, currentSeason, officerProfileLevel } from "../scope";
import {
  fieldFlags,
  FLAG_WEIGHT,
  latestJudgeableIndex,
  median,
  productivityClass,
  SEASON_RULES,
  seasonStatus,
  seasonWindows,
  type CheckFlag,
  type FieldStatus,
  type Productivity,
} from "../engine/land-transparency";
import { seasonWeather } from "../engine/season-weather";
import { FERTILIZER_DOSE_KG_HA } from "../engine/subsidy";
import type { AppEnv, AuthUser } from "../types";

const query = z.object({
  localLevelId: z.coerce.number().int().positive().optional(),
  seasons: z.coerce.number().int().min(2).max(9).default(6),
});

type AreaByStatus = Record<FieldStatus, number>;
const emptyAreas = (): AreaByStatus => ({ cultivated: 0, weak: 0, fallow: 0, unknown: 0 });

async function resolveLocalLevel(user: { id: string; role: string }, requested?: number): Promise<number> {
  const profileLevel = await officerProfileLevel(user.id);
  if (user.role === "SUPER_ADMIN") {
    if (requested) return requested;
    if (profileLevel != null) return profileLevel;
    const any = await getPrisma().localLevel.findFirst({ where: { wards: { some: { farmingFarmers: { some: {} } } } }, select: { id: true } });
    if (!any) throw new HTTPException(404, { message: "no_local_level" });
    return any.id;
  }
  if (profileLevel == null) throw new HTTPException(403, { message: "officer_profile_missing" });
  return profileLevel;
}

export const dashboardRoutes = new Hono<AppEnv>().use("*", requireAuth, requireRole(...OFFICER_ROLES)).get("/", zValidator("query", query), async (c) => {
  const user = c.get("user");
  const q = c.req.valid("query");
  return c.json(await cached(`dashboard:${user.id}:${q.localLevelId ?? ""}:${q.seasons}`, 2 * MINUTE, () => buildDashboard(user, q)));
});

/** Subsidy allocations this fiscal year, shown only for farmers with at least one verified field. Need = declared crop area x recommended dose. */
async function verifiedSubsidy(localLevelId: number) {
  const prisma = getPrisma();
  const fiscalYearBs = currentFiscalYearBs();
  const season = currentSeason();
  const rows = await prisma.subsidyAllocation.findMany({
    where: {
      status: { not: "CANCELLED" },
      scheme: { fiscalYearBs, OR: [{ localLevelId }, { localLevelId: null }] },
      farmer: { parcels: { some: { ward: { localLevelId } } } },
    },
    select: {
      id: true,
      needQty: true,
      allocatedQty: true,
      deliveredQty: true,
      status: true,
      priorityScore: true,
      flags: true,
      scheme: { select: { id: true, name: true, unit: true, criteria: true, totalStock: true } },
      farmer: {
        select: {
          id: true,
          firstNameNe: true,
          lastNameNe: true,
          farmingWard: { select: { number: true } },
          parcels: {
            where: { ward: { localLevelId } },
            select: {
              areaM2: true,
              verification: true,
              declarations: { where: { fiscalYearBs, season, isFallow: false }, select: { sownAreaM2: true, crop: { select: { code: true, nameNe: true, nameEn: true } } } },
            },
          },
        },
      },
    },
    orderBy: [{ priorityScore: "desc" }],
  });

  const verified = rows.filter((r) => r.farmer.parcels.some((p) => p.verification === "VERIFIED"));
  const lines = verified.map((r) => {
    const product = (r.scheme.criteria as { product?: string } | null)?.product ?? "Urea";
    const byCrop = new Map<string, { crop: { code: string; nameNe: string; nameEn: string }; areaM2: number }>();
    for (const p of r.farmer.parcels) for (const d of p.declarations) {
      const cur = byCrop.get(d.crop.code) ?? { crop: d.crop, areaM2: 0 };
      cur.areaM2 += d.sownAreaM2;
      byCrop.set(d.crop.code, cur);
    }
    const calc = [...byCrop.values()].map(({ crop, areaM2 }) => {
      const doseKgHa = FERTILIZER_DOSE_KG_HA[crop.code]?.[product] ?? 0;
      return { cropNe: crop.nameNe, cropEn: crop.nameEn, areaM2, doseKgHa, kg: Math.round((areaM2 / 10_000) * doseKgHa) };
    });
    return {
      id: r.id,
      farmerId: r.farmer.id,
      farmerNameNe: [r.farmer.firstNameNe, r.farmer.lastNameNe].filter(Boolean).join(" "),
      ward: r.farmer.farmingWard.number,
      verifiedAreaM2: r.farmer.parcels.filter((p) => p.verification === "VERIFIED").reduce((a, p) => a + p.areaM2, 0),
      scheme: r.scheme.name,
      product,
      unit: r.scheme.unit,
      calc,
      needQty: r.needQty,
      allocatedQty: r.allocatedQty,
      deliveredQty: r.deliveredQty,
      status: r.status,
      priority: r.priorityScore,
      flags: r.flags,
    };
  });
  lines.sort((a, b) => b.allocatedQty - a.allocatedQty || b.needQty - a.needQty);
  const total = (k: "needQty" | "allocatedQty") => lines.reduce((a, l) => a + l[k], 0);
  return {
    fiscalYearBs,
    farmers: new Set(lines.map((l) => l.farmerId)).size,
    needQty: total("needQty"),
    allocatedQty: total("allocatedQty"),
    deliveredQty: lines.reduce((a, l) => a + (l.deliveredQty ?? 0), 0),
    hiddenUnverified: new Set(rows.filter((r) => !verified.includes(r)).map((r) => r.farmer.id)).size,
    lines,
  };
}

async function buildDashboard(user: AuthUser, q: z.infer<typeof query>) {
  const prisma = getPrisma();
  const localLevelId = await resolveLocalLevel(user, q.localLevelId);

  const windows = seasonWindows(new Date(), q.seasons);
  const current = windows.at(-1)!;
  const mainIdx = latestJudgeableIndex(windows, new Date());
  const main = windows[mainIdx]!;
  const since = windows[0]!.from;

  const [localLevel, wardRows, parcels, choices] = await Promise.all([
    prisma.localLevel.findUniqueOrThrow({ where: { id: localLevelId }, select: { id: true, nameNe: true, nameEn: true, district: { select: { nameNe: true, nameEn: true, province: { select: { nameNe: true, nameEn: true } } } } } }),
    prisma.ward.findMany({ where: { localLevelId }, select: { id: true, number: true }, orderBy: { number: "asc" } }),
    prisma.parcel.findMany({
      where: { ward: { localLevelId } },
      select: {
        id: true,
        areaM2: true,
        localName: true,
        tole: true,
        centroidLat: true,
        centroidLng: true,
        verification: true,
        landCover: true,
        geometry: true,
        croplandShare: true,
        ward: { select: { id: true, number: true } },
        farmer: {
          select: {
            id: true,
            firstNameNe: true,
            lastNameNe: true,
            user: { select: { banned: true, accounts: { where: { providerId: "credential" }, select: { id: true } } } },
            allocations: { where: { status: "DELIVERED", scheme: { kind: "FERTILIZER", fiscalYearBs: main.fiscalYearBs } }, select: { deliveredQty: true, allocatedQty: true } },
          },
        },
        declarations: { select: { fiscalYearBs: true, season: true, isFallow: true, sownAreaM2: true, crop: { select: { code: true, nameNe: true, nameEn: true } }, inputs: { where: { kind: "FERTILIZER" }, select: { quantityKg: true } } } },
        observations: { where: { sensor: "S2", observedOn: { gte: since } }, select: { observedOn: true, ndvi: true } },
        predictions: { where: { model: "landuse" }, orderBy: { createdAt: "desc" }, take: 1, select: { label: true, probability: true, version: true } },
      },
    }),
    user.role === "SUPER_ADMIN"
      ? prisma.localLevel.findMany({ where: { wards: { some: { farmingFarmers: { some: {} } } } }, select: { id: true, nameNe: true, nameEn: true }, orderBy: { nameEn: "asc" } })
      : Promise.resolve([]),
  ]);

  const located = parcels.filter((p) => p.centroidLat != null && p.centroidLng != null);
  const weatherP = located.length
    ? seasonWeather(located.reduce((a, p) => a + p.centroidLat!, 0) / located.length, located.reduce((a, p) => a + p.centroidLng!, 0) / located.length, windows)
    : Promise.resolve(windows.map(() => null));

  const farmerArea = new Map<string, number>();
  for (const p of parcels) farmerArea.set(p.farmer.id, (farmerArea.get(p.farmer.id) ?? 0) + p.areaM2);

  const statusOf = (p: (typeof parcels)[number]) =>
    windows.map((w) => seasonStatus(p.observations.filter((o) => o.observedOn >= w.judgeFrom && o.observedOn <= w.to).map((o) => o.ndvi)));
  const perField = parcels.map((p) => ({ p, s: statusOf(p) }));

  const allPeaks = perField.flatMap(({ s }) => s.map((x) => x.peakNdvi).filter((v): v is number => v != null));
  const muniMedian = median(allPeaks);

  const fields = perField.map(({ p, s }) => {
    const now = s[mainIdx]!;
    const decl = p.declarations.filter((d) => d.fiscalYearBs === main.fiscalYearBs && d.season === main.season);
    const declaredCultivated = decl.length ? decl.some((d) => !d.isFallow) : null;
    const declaredSownM2 = decl.filter((d) => !d.isFallow).reduce((sum, d) => sum + d.sownAreaM2, 0);
    const deliveredKg = p.farmer.allocations.reduce((sum, a) => sum + (a.deliveredQty ?? a.allocatedQty), 0);
    const share = (farmerArea.get(p.farmer.id) ?? 0) > 0 ? p.areaM2 / farmerArea.get(p.farmer.id)! : 0;
    const fertilizerKg = Math.round(decl.flatMap((d) => d.inputs).reduce((sum, i) => sum + i.quantityKg, 0) + deliveredKg * share);
    const measuredM2 = measuredAreaM2(p.geometry);
    const flags: CheckFlag[] = fieldFlags({ registeredM2: p.areaM2, declaredCultivated, declaredSownM2, fertilizerKg, status: now.status, history: s.slice(0, mainIdx).map((x) => x.status), measuredM2 });
    const offFarmland = p.landCover != null && p.landCover !== "cropland" && (p.croplandShare ?? 0) < 0.5;
    const prod = productivityClass(s.map((x) => x.peakNdvi), muniMedian);
    return {
      id: p.id,
      farmerId: p.farmer.id,
      farmerNameNe: [p.farmer.firstNameNe, p.farmer.lastNameNe].filter(Boolean).join(" "),
      localName: p.localName,
      ward: p.ward.number,
      areaM2: p.areaM2,
      measuredM2,
      lat: p.centroidLat,
      lng: p.centroidLng,
      verification: p.verification,
      landCover: p.landCover,
      croplandShare: p.croplandShare,
      declaredCrop: decl.find((d) => !d.isFallow)?.crop ?? null,
      declaredCultivated,
      declaredSownM2,
      fertilizerKg,
      status: now.status,
      peakNdvi: now.peakNdvi,
      history: s.map((x, i) => ({ key: windows[i]!.key, status: x.status, peakNdvi: x.peakNdvi, readings: x.readings })),
      productivity: prod.cls as Productivity,
      productivityRatio: prod.ratio,
      prediction: p.predictions[0] ?? null,
      flags: offFarmland ? (["not_farmland", ...flags] as (CheckFlag | "not_farmland")[]) : flags,
    };
  });

  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const registeredM2 = sum(fields.map((f) => f.areaM2));
  const satNow = emptyAreas();
  for (const f of fields) satNow[f.status] += f.areaM2;
  const declaredCultivatedM2 = sum(fields.filter((f) => f.declaredCultivated).map((f) => Math.min(f.declaredSownM2 || f.areaM2, f.areaM2)));
  const declaredFallowM2 = sum(fields.filter((f) => f.declaredCultivated === false).map((f) => f.areaM2));
  const noDeclarationM2 = sum(fields.filter((f) => f.declaredCultivated == null).map((f) => f.areaM2));
  const fertilizedM2 = sum(fields.filter((f) => f.fertilizerKg > 0).map((f) => f.areaM2));
  const cultivatedUnfertilizedM2 = sum(fields.filter((f) => f.status === "cultivated" && f.fertilizerKg === 0).map((f) => f.areaM2));
  const fertilizerOnFallowKg = sum(fields.filter((f) => f.status === "fallow").map((f) => f.fertilizerKg));

  const [weather, subsidy] = await Promise.all([weatherP, verifiedSubsidy(localLevelId)]);
  const seasons = windows.map((w, i) => {
    const areas = emptyAreas();
    for (const f of fields) areas[f.history[i]!.status] += f.areaM2;
    const decl = parcels.flatMap((p) => p.declarations.filter((d) => d.fiscalYearBs === w.fiscalYearBs && d.season === w.season).map((d) => ({ d, p })));
    const declaredArea = sum([...new Map(decl.filter(({ d }) => !d.isFallow).map(({ p }) => [p.id, p.areaM2])).values()]);
    const fertArea = sum([...new Map(decl.filter(({ d }) => d.inputs.length > 0).map(({ p }) => [p.id, p.areaM2])).values()]);
    return { key: w.key, fiscalYearBs: w.fiscalYearBs, season: w.season, labelNe: w.labelNe, labelEn: w.labelEn, from: w.from, to: w.to, inProgress: i > mainIdx, satellite: areas, declaredCultivatedM2: declaredArea, fertilizedM2: fertArea, hasDeclarations: decl.length > 0, weather: weather[i] ?? null };
  });

  const wards = wardRows.map((w) => {
    const list = fields.filter((f) => f.ward === w.number);
    const areas = emptyAreas();
    for (const f of list) areas[f.status] += f.areaM2;
    return {
      number: w.number,
      fields: list.length,
      registeredM2: sum(list.map((f) => f.areaM2)),
      declaredCultivatedM2: sum(list.filter((f) => f.declaredCultivated).map((f) => Math.min(f.declaredSownM2 || f.areaM2, f.areaM2))),
      satellite: areas,
      fertilizedM2: sum(list.filter((f) => f.fertilizerKg > 0).map((f) => f.areaM2)),
      flagged: list.filter((f) => f.flags.length).length,
    };
  });

  const weight = (f: (typeof fields)[number]) => sum(f.flags.map((x) => (x === "not_farmland" ? 4 : FLAG_WEIGHT[x as CheckFlag])));
  const checks = fields.filter((f) => f.flags.length).sort((a, b) => weight(b) - weight(a) || b.areaM2 - a.areaM2);

  const productivity: Record<Productivity, { fields: number; areaM2: number }> = { high: { fields: 0, areaM2: 0 }, normal: { fields: 0, areaM2: 0 }, low: { fields: 0, areaM2: 0 }, unknown: { fields: 0, areaM2: 0 } };
  for (const f of fields) {
    productivity[f.productivity].fields++;
    productivity[f.productivity].areaM2 += f.areaM2;
  }

  const farmers = new Map(parcels.map((p) => [p.farmer.id, p.farmer]));
  return {
    scope: {
      localLevel: { id: localLevel.id, nameNe: localLevel.nameNe, nameEn: localLevel.nameEn },
      district: { nameNe: localLevel.district.nameNe, nameEn: localLevel.district.nameEn },
      province: { nameNe: localLevel.district.province.nameNe, nameEn: localLevel.district.province.nameEn },
      wards: wardRows.length,
      fiscalYearBs: current.fiscalYearBs,
      season: current.season,
      seasonLabel: { ne: current.labelNe, en: current.labelEn },
      mainSeason: { key: main.key, ne: main.labelNe, en: main.labelEn, fiscalYearBs: main.fiscalYearBs, season: main.season },
      inProgress: mainIdx < windows.length - 1 ? { key: current.key, ne: current.labelNe, en: current.labelEn } : null,
      choices,
    },
    farmers: {
      total: farmers.size,
      withAccount: [...farmers.values()].filter((f) => f.user.accounts.length > 0).length,
      disabled: [...farmers.values()].filter((f) => f.user.banned).length,
      fields: fields.length,
      mappedFields: fields.filter((f) => f.lat != null).length,
      verifiedFields: fields.filter((f) => f.verification === "VERIFIED").length,
    },
    land: { registeredM2, declaredCultivatedM2, declaredFallowM2, noDeclarationM2, satellite: satNow, fertilizedM2, cultivatedUnfertilizedM2, fertilizerOnFallowKg },
    seasons,
    subsidy,
    wards,
    checks,
    productivity,
    fields,
    method: {
      rule: SEASON_RULES.rule,
      cultivatedPeak: SEASON_RULES.cultivatedPeak,
      fallowPeak: SEASON_RULES.fallowPeak,
      municipalityMedianPeak: muniMedian,
      sources: { satellite: "Sentinel-2 L2A NDVI via Microsoft Planetary Computer", landCover: "ESA WorldCover 2021", declarations: "farmer app and officer records", subsidy: "delivered fertilizer allocations this fiscal year", weather: "Open-Meteo historical archive (ERA5)" },
    },
  };
}
