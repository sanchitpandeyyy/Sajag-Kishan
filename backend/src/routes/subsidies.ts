import { getPrisma } from "../db";
import { allocate, type FarmerNeedInput } from "../engine";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { audit } from "../audit";
import { OFFICER_ROLES, requireAuth, requireRole } from "../auth";
import { currentFiscalYearBs, currentSeason, farmerIdFor, officerLocalLevelId, schemeScope, wardScope } from "../scope";
import type { AppEnv } from "../types";

const schemeSchema = z.object({
  name: z.string().min(2),
  kind: z.enum(["FERTILIZER", "PESTICIDE", "SEED", "MACHINERY", "OTHER"]),
  product: z.string().min(1).default("Urea"),
  unit: z.string().default("kg"),
  totalStock: z.number().positive(),
  localLevelId: z.number().int().positive().optional(),
});

export const subsidyRoutes = new Hono<AppEnv>()
  .use("*", requireAuth)
  .get("/mine", async (c) => {
    const farmerId = await farmerIdFor(c.get("user"));
    return c.json(await getPrisma().subsidyAllocation.findMany({ where: { farmerId }, include: { scheme: true }, orderBy: { createdAt: "desc" } }));
  })
  .get("/open", async (c) => {
    const prisma = getPrisma();
    const farmerId = await farmerIdFor(c.get("user"));
    const farmer = await prisma.farmer.findUnique({ where: { id: farmerId }, select: { farmingWard: { select: { localLevelId: true } } } });
    if (!farmer) return c.json([]);
    const schemes = await prisma.subsidyScheme.findMany({
      where: { fiscalYearBs: currentFiscalYearBs(), OR: [{ localLevelId: farmer.farmingWard.localLevelId }, { localLevelId: null }] },
      orderBy: { createdAt: "desc" },
      include: { allocations: { select: { farmerId: true, allocatedQty: true, status: true } } },
    });
    return c.json(
      schemes.map(({ allocations, criteria, ...s }) => {
        const mine = allocations.find((a) => a.farmerId === farmerId);
        const allocated = allocations.reduce((t, a) => t + a.allocatedQty, 0);
        return {
          id: s.id,
          name: s.name,
          kind: s.kind,
          unit: s.unit,
          product: (criteria as { product?: string } | null)?.product ?? null,
          fiscalYearBs: s.fiscalYearBs,
          totalStock: s.totalStock,
          remaining: s.totalStock == null ? null : Math.max(0, Math.round(s.totalStock - allocated)),
          mine: mine ? { status: String(mine.status), allocatedQty: mine.allocatedQty } : null,
        };
      }),
    );
  })
  .get("/schemes", requireRole(...OFFICER_ROLES), async (c) => {
    const schemes = await getPrisma().subsidyScheme.findMany({
      where: await schemeScope(c.get("user")),
      orderBy: { createdAt: "desc" },
      include: { allocations: { select: { allocatedQty: true, deliveredQty: true, status: true } } },
    });
    return c.json(
      schemes.map(({ allocations, ...s }) => ({
        ...s,
        product: (s.criteria as { product?: string } | null)?.product ?? null,
        allocations: allocations.length,
        allocatedQty: allocations.reduce((t, a) => t + a.allocatedQty, 0),
        deliveredQty: allocations.reduce((t, a) => t + (a.deliveredQty ?? 0), 0),
        deliveredCount: allocations.filter((a) => a.status === "DELIVERED").length,
      })),
    );
  })
  .get("/schemes/:id/allocations", requireRole(...OFFICER_ROLES), async (c) => {
    const user = c.get("user");
    const prisma = getPrisma();
    const scheme = await prisma.subsidyScheme.findFirst({ where: { AND: [{ id: c.req.param("id") }, await schemeScope(user)] } });
    if (!scheme) return c.json({ error: "not_found" }, 404);
    const rows = await prisma.subsidyAllocation.findMany({
      where: { schemeId: scheme.id, farmer: { farmingWard: await wardScope(user) } },
      include: { farmer: { select: { firstNameNe: true, lastNameNe: true, farmingTole: true, farmingWard: { select: { number: true } } } } },
      orderBy: [{ priorityScore: "desc" }],
    });
    return c.json(
      rows.map((r) => ({
        id: r.id,
        farmerId: r.farmerId,
        farmerNameNe: `${r.farmer.firstNameNe} ${r.farmer.lastNameNe ?? ""}`.trim(),
        ward: r.farmer.farmingWard.number,
        tole: r.farmer.farmingTole,
        needQty: r.needQty,
        allocatedQty: r.allocatedQty,
        deliveredQty: r.deliveredQty,
        status: r.status,
        priorityScore: r.priorityScore,
        flags: r.flags,
        deliveredAt: r.deliveredAt,
      })),
    );
  })
  .post("/schemes", requireRole(...OFFICER_ROLES), zValidator("json", schemeSchema), async (c) => {
    const body = c.req.valid("json");
    const ownLocalLevel = await officerLocalLevelId(c.get("user"));
    const scheme = await getPrisma().subsidyScheme.create({
      data: {
        name: body.name,
        kind: body.kind,
        unit: body.unit,
        totalStock: body.totalStock,
        localLevelId: ownLocalLevel ?? body.localLevelId,
        fiscalYearBs: currentFiscalYearBs(),
        criteria: { product: body.product, method: "need×priority-v0" },
      },
    });
    return c.json(scheme, 201);
  })
  .post("/schemes/:id/plan", requireRole(...OFFICER_ROLES), zValidator("json", z.object({ save: z.boolean().default(false) })), async (c) => {
    const user = c.get("user");
    const prisma = getPrisma();
    const scheme = await prisma.subsidyScheme.findFirst({ where: { AND: [{ id: c.req.param("id") }, await schemeScope(user)] } });
    if (!scheme) return c.json({ error: "not_found" }, 404);
    const product = (scheme.criteria as { product?: string } | null)?.product ?? "Urea";
    const fiscalYearBs = currentFiscalYearBs();
    const season = currentSeason();

    const farmers = await prisma.farmer.findMany({
      where: { parcels: { some: { ward: await wardScope(user) } } },
      include: {
        parcels: { include: { declarations: { where: { fiscalYearBs, season }, include: { crop: true } } } },
        allocations: { where: { scheme: { kind: scheme.kind }, status: "DELIVERED" }, select: { deliveredQty: true, schemeId: true } },
      },
    });

    const inputs: FarmerNeedInput[] = farmers.map((f) => ({
      farmerId: f.id,
      registeredAreaM2: f.parcels.reduce((s, p) => s + p.areaM2, 0),
      crops: f.parcels.flatMap((p) => p.declarations.filter((d) => !d.isFallow).map((d) => ({ crop: d.crop.code, areaM2: d.sownAreaM2 }))),
      alreadyDeliveredKg: f.allocations.filter((a) => a.schemeId === scheme.id).reduce((s, a) => s + (a.deliveredQty ?? 0), 0),
      tenant: f.parcels.some((p) => p.ownershipType !== "OWNED"),
      verified: f.parcels.some((p) => p.verification === "VERIFIED"),
      recentSubsidyKg: f.allocations.reduce((s, a) => s + (a.deliveredQty ?? 0), 0),
    }));

    const lines = allocate(inputs, product, scheme.totalStock ?? 0);
    const names = new Map(farmers.map((f) => [f.id, `${f.firstNameNe} ${f.lastNameNe ?? ""}`.trim()]));

    if (c.req.valid("json").save) {
      const officer = await prisma.officerProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
      await prisma.$transaction(
        lines.map((l) =>
          prisma.subsidyAllocation.upsert({
            where: { schemeId_farmerId: { schemeId: scheme.id, farmerId: l.farmerId } },
            update: { needQty: l.needKg, allocatedQty: l.allocatedKg, priorityScore: l.priority, flags: l.flags },
            create: { schemeId: scheme.id, farmerId: l.farmerId, needQty: l.needKg, allocatedQty: l.allocatedKg, priorityScore: l.priority, flags: l.flags, officerId: officer?.id },
          }),
        ),
      );
      await audit(user.id, "subsidy.plan.save", "SubsidyScheme", scheme.id, null, { lines: lines.length });
    }

    return c.json({
      scheme: { id: scheme.id, name: scheme.name, product, stock: scheme.totalStock },
      totals: {
        needKg: lines.reduce((s, l) => s + l.needKg, 0),
        allocatedKg: lines.reduce((s, l) => s + l.allocatedKg, 0),
        flagged: lines.filter((l) => l.flags.length).length,
      },
      lines: lines.map((l) => ({ ...l, farmerNameNe: names.get(l.farmerId) })).sort((a, b) => b.priority - a.priority),
      method: "need × (0.5 + priority), capped at need (docs/05-engine-algorithms.md section 8)",
    });
  })
  .post(
    "/allocations/:id/deliver",
    requireRole(...OFFICER_ROLES),
    zValidator("json", z.object({ deliveredQty: z.number().nonnegative() })),
    async (c) => {
      const user = c.get("user");
      const prisma = getPrisma();
      const before = await prisma.subsidyAllocation.findFirst({
        where: { id: c.req.param("id"), farmer: { parcels: { some: { ward: await wardScope(user) } } } },
      });
      if (!before) return c.json({ error: "not_found" }, 404);
      const { deliveredQty } = c.req.valid("json");
      const flags = deliveredQty > before.needQty * 1.5 ? [...new Set([...before.flags, "DELIVERY_EXCEEDS_NEED"])] : before.flags;
      const after = await prisma.subsidyAllocation.update({
        where: { id: before.id },
        data: { deliveredQty, status: "DELIVERED", deliveredAt: new Date(), flags },
      });
      await audit(user.id, "subsidy.deliver", "SubsidyAllocation", before.id, { deliveredQty: before.deliveredQty }, { deliveredQty });
      return c.json(after);
    },
  );
