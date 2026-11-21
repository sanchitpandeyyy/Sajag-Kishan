/**
 * GET /v1/dashboard?localLevelId=&seasons=
 *
 * One municipality at a time, for any municipality in Nepal: an agriculture officer always gets their
 * own; the super admin may pick any (default: their own profile's). Answers, from data we already hold:
 *   - how many farmers and fields, how many are mapped
 *   - registered land vs land the farmers declared cultivated vs land the satellite saw cultivated
 *   - the same season by season (previous seasons from Sentinel-2 history)
 *   - fertilized vs unfertilized cultivated land
 *   - per ward, the same comparison
 *   - fields to check: subsidy on fallow land, declared but not seen, abandoned, over-claimed area
 *   - a productivity indicator (field NDVI peaks vs the municipality median)
 * Every satellite figure is an indicator for a field visit, not proof (AGENT.md rule 6).
 */
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { OFFICER_ROLES, requireAuth, requireRole } from "../auth";
import { getPrisma } from "../db";
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
import type { AppEnv } from "../types";

const query = z.object({
  localLevelId: z.coerce.number().int().positive().optional(),
  seasons: z.coerce.number().int().min(2).max(9).default(6),
});

type AreaByStatus = Record<FieldStatus, number>;
const emptyAreas = (): AreaByStatus => ({ cultivated: 0, weak: 0, fallow: 0, unknown: 0 });

async function resolveLocalLevel(user: { id: string; role: string }, requested?: number): Promise<number> {
  const prisma = getPrisma();
  const profile = await prisma.officerProfile.findUnique({ where: { userId: user.id }, select: { localLevelId: true } });
  if (user.role === "SUPER_ADMIN") {
    if (requested) return requested;
    if (profile) return profile.localLevelId;
    const any = await prisma.localLevel.findFirst({ where: { wards: { some: { farmingFarmers: { some: {} } } } }, select: { id: true } });
    if (!any) throw new HTTPException(404, { message: "no_local_level" });
    return any.id;
  }
  if (!profile) throw new HTTPException(403, { message: "officer_profile_missing" });
  return profile.localLevelId; // officers only ever see their own municipality
}

export const dashboardRoutes = new Hono<AppEnv>().use("*", requireAuth, requireRole(...OFFICER_ROLES)).get("/", zValidator("query", query), async (c) => {
  const user = c.get("user");
  const q = c.req.valid("query");
  const prisma = getPrisma();
  const localLevelId = await resolveLocalLevel(user, q.localLevelId);

  const windows = seasonWindows(new Date(), q.seasons);
  const current = windows.at(-1)!;
  // Compare against the latest season whose crops have had time to grow; the current one may be too young.
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

  // Farmer-level fertilizer delivered this fiscal year, shared across their fields by area.
  const farmerArea = new Map<string, number>();
  for (const p of parcels) farmerArea.set(p.farmer.id, (farmerArea.get(p.farmer.id) ?? 0) + p.areaM2);

  // Per field: satellite status in every window.
  const statusOf = (p: (typeof parcels)[number]) =>
    windows.map((w) => seasonStatus(p.observations.filter((o) => o.observedOn >= w.from && o.observedOn <= w.to).map((o) => o.ndvi)));
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
    const flags: CheckFlag[] = fieldFlags({ registeredM2: p.areaM2, declaredCultivated, declaredSownM2, fertilizerKg, status: now.status, history: s.slice(0, mainIdx).map((x) => x.status) });
    // A registered field that is not on farmland at all (forest, river, town) is worth a visit too.
    const offFarmland = p.landCover != null && p.landCover !== "cropland" && (p.croplandShare ?? 0) < 0.5;
    const prod = productivityClass(s.map((x) => x.peakNdvi), muniMedian);
    return {
      id: p.id,
      farmerId: p.farmer.id,
      farmerNameNe: [p.farmer.firstNameNe, p.farmer.lastNameNe].filter(Boolean).join(" "),
      localName: p.localName,
      ward: p.ward.number,
      areaM2: p.areaM2,
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

  // Municipality and season totals.
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

  const seasons = windows.map((w, i) => {
    const areas = emptyAreas();
    for (const f of fields) areas[f.history[i]!.status] += f.areaM2;
    const decl = parcels.flatMap((p) => p.declarations.filter((d) => d.fiscalYearBs === w.fiscalYearBs && d.season === w.season).map((d) => ({ d, p })));
    const declaredArea = sum([...new Map(decl.filter(({ d }) => !d.isFallow).map(({ p }) => [p.id, p.areaM2])).values()]);
    const fertArea = sum([...new Map(decl.filter(({ d }) => d.inputs.length > 0).map(({ p }) => [p.id, p.areaM2])).values()]);
    return { key: w.key, fiscalYearBs: w.fiscalYearBs, season: w.season, labelNe: w.labelNe, labelEn: w.labelEn, from: w.from, to: w.to, inProgress: i > mainIdx, satellite: areas, declaredCultivatedM2: declaredArea, fertilizedM2: fertArea, hasDeclarations: decl.length > 0 };
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
  return c.json({
    scope: {
      localLevel: { id: localLevel.id, nameNe: localLevel.nameNe, nameEn: localLevel.nameEn },
      district: { nameNe: localLevel.district.nameNe, nameEn: localLevel.district.nameEn },
      province: { nameNe: localLevel.district.province.nameNe, nameEn: localLevel.district.province.nameEn },
      wards: wardRows.length,
      fiscalYearBs: current.fiscalYearBs,
      season: current.season,
      seasonLabel: { ne: current.labelNe, en: current.labelEn },
      /** The season every comparison on the dashboard is about. */
      mainSeason: { key: main.key, ne: main.labelNe, en: main.labelEn, fiscalYearBs: main.fiscalYearBs, season: main.season },
      /** The running season, when it is still too young to judge. */
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
    wards,
    checks,
    productivity,
    fields,
    method: {
      rule: SEASON_RULES.rule,
      cultivatedPeak: SEASON_RULES.cultivatedPeak,
      fallowPeak: SEASON_RULES.fallowPeak,
      municipalityMedianPeak: muniMedian,
      sources: { satellite: "Sentinel-2 L2A NDVI via Microsoft Planetary Computer", landCover: "ESA WorldCover 2021", declarations: "farmer app and officer records", subsidy: "delivered fertilizer allocations this fiscal year" },
    },
  });
});
