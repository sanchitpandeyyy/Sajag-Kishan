import { getPrisma } from "../db";
import { demandByProduct, summarizeLand, type FarmerNeedInput, type ParcelFact } from "../engine";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { cached, MINUTE } from "../lib/cache";
import { OFFICER_ROLES, requireAuth, requireRole } from "../auth";
import { currentFiscalYearBs, currentSeason, narrow, wardScope } from "../scope";
import type { AppEnv } from "../types";

const scopeQuery = z.object({
  wardId: z.coerce.number().int().positive().optional(),
  localLevelId: z.coerce.number().int().positive().optional(),
  fiscalYearBs: z.string().optional(),
  season: z.enum(["BARSHE", "HIUDE", "CHAITE"]).optional(),
});

function satelliteGreen(ndvi: (number | null)[]): boolean | null {
  const v = ndvi.filter((x): x is number => x != null);
  if (v.some((x) => x >= 0.4)) return true;
  return v.length >= 3 ? false : null;
}

async function queryScope(user: Parameters<typeof wardScope>[0], q: z.infer<typeof scopeQuery>) {
  const fiscalYearBs = q.fiscalYearBs ?? currentFiscalYearBs();
  const season = q.season ?? currentSeason();
  const parcels = await getPrisma().parcel.findMany({
    where: { ward: narrow(await wardScope(user), q) },
    include: {
      ward: { select: { id: true, number: true } },
      declarations: { where: { fiscalYearBs, season }, include: { crop: { select: { code: true, nameNe: true } }, inputs: true } },
      observations: { where: { sensor: "S2", observedOn: { gte: new Date(Date.now() - 120 * 86_400_000) } }, select: { ndvi: true } },
      farmer: { select: { id: true, firstNameNe: true, lastNameNe: true, allocations: { where: { status: "DELIVERED", scheme: { kind: "FERTILIZER" } }, select: { id: true } } } },
    },
  });
  return { parcels, fiscalYearBs, season };
}

const loadScope = (user: Parameters<typeof wardScope>[0], q: z.infer<typeof scopeQuery>) => cached(`map:${user.id}:${JSON.stringify(q)}`, 2 * MINUTE, () => queryScope(user, q));

export const mapRoutes = new Hono<AppEnv>()
  .use("*", requireAuth, requireRole(...OFFICER_ROLES))
  .get("/summary", zValidator("query", scopeQuery), async (c) => {
    const { parcels, fiscalYearBs, season } = await loadScope(c.get("user"), c.req.valid("query"));

    const facts: ParcelFact[] = parcels.map((p) => ({
      id: p.id,
      wardId: p.wardId,
      areaM2: p.areaM2,
      verified: p.verification === "VERIFIED",
      declaredCrops: p.declarations.map((d) => ({ crop: d.crop.code, sownAreaM2: d.sownAreaM2, isFallow: d.isFallow })),
      fertilized: p.declarations.some((d) => d.inputs.some((i) => i.kind === "FERTILIZER")) || p.farmer.allocations.length > 0,
      satelliteGreen: satelliteGreen(p.observations.map((o) => o.ndvi)),
    }));
    const summary = summarizeLand(facts);

    const byWard = new Map<number, ParcelFact[]>();
    for (const f of facts) byWard.set(f.wardId, [...(byWard.get(f.wardId) ?? []), f]);
    const wardNumber = new Map(parcels.map((p) => [p.wardId, p.ward.number]));

    const cropNames = new Map(parcels.flatMap((p) => p.declarations.map((d) => [d.crop.code, d.crop.nameNe] as const)));

    const needInputs: FarmerNeedInput[] = parcels.map((p) => ({
      farmerId: p.farmerId,
      registeredAreaM2: p.areaM2,
      crops: p.declarations.filter((d) => !d.isFallow).map((d) => ({ crop: d.crop.code, areaM2: d.sownAreaM2 })),
      alreadyDeliveredKg: 0,
      tenant: p.ownershipType !== "OWNED",
      verified: p.verification === "VERIFIED",
      recentSubsidyKg: 0,
    }));

    return c.json({
      fiscalYearBs,
      season,
      totals: { ...summary, byCrop: summary.byCrop.map((b) => ({ ...b, nameNe: cropNames.get(b.crop) ?? b.crop })) },
      wards: [...byWard].map(([wardId, list]) => {
        const s = summarizeLand(list);
        return { wardId, number: wardNumber.get(wardId), registeredM2: s.registeredM2, cultivatedM2: s.cultivatedM2, fallowM2: s.declaredFallowM2 + s.noDataM2, fertilizedM2: s.fertilizedM2, parcels: s.parcels };
      }).sort((a, b) => (a.number ?? 0) - (b.number ?? 0)),
      fertilizerDemandKg: demandByProduct(needInputs),
      satellite: {
        checkedParcels: facts.filter((f) => f.satelliteGreen != null).length,
        greenParcels: facts.filter((f) => f.satelliteGreen === true).length,
        conflictParcels: summary.conflictParcels.length,
      },
      sources: { land: "registry+farmer", cultivation: "declarations", fertilized: "declared inputs + delivered subsidy", satellite: "Sentinel-2 NDVI (Planetary Computer)" },
    });
  })
  .get("/parcels", zValidator("query", scopeQuery), async (c) => {
    const { parcels } = await loadScope(c.get("user"), c.req.valid("query"));
    return c.json({
      type: "FeatureCollection",
      features: parcels
        .filter((p) => p.geometry)
        .map((p) => ({
          type: "Feature",
          geometry: p.geometry,
          properties: {
            id: p.id,
            ward: p.ward.number,
            areaM2: p.areaM2,
            verification: p.verification,
            farmerNameNe: `${p.farmer.firstNameNe} ${p.farmer.lastNameNe ?? ""}`.trim(),
            tole: p.tole,
            crop: p.declarations.find((d) => !d.isFallow)?.crop.code ?? null,
            cropNe: p.declarations.find((d) => !d.isFallow)?.crop.nameNe ?? null,
          },
        })),
    });
  });
