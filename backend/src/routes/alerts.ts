import { getPrisma } from "../db";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { OFFICER_ROLES, requireAuth, requireRole } from "../auth";
import { refreshWardAlerts } from "../jobs/alerts";
import { wardScope } from "../scope";
import type { AppEnv } from "../types";

const WARD_LABEL = { number: true, localLevel: { select: { id: true, nameNe: true, nameEn: true } } } as const;

export const alertRoutes = new Hono<AppEnv>()
  .use("*", requireAuth)
  /** Active alerts + advisories for the farmer's wards, or the officer's scope. */
  .get("/", async (c) => {
    const user = c.get("user");
    const prisma = getPrisma();
    let wardIds: number[];
    if (user.role === "FARMER") {
      const farmer = await prisma.farmer.findUnique({ where: { userId: user.id }, include: { parcels: { select: { wardId: true } } } });
      wardIds = [...new Set([farmer?.farmingWardId, ...(farmer?.parcels.map((p) => p.wardId) ?? [])].filter((x): x is number => x != null))];
    } else {
      wardIds = (await prisma.ward.findMany({ where: await wardScope(user), select: { id: true } })).map((w) => w.id);
    }
    const now = new Date();
    const [alerts, advisories] = await Promise.all([
      // Ward number and municipality travel with each alert, so a super admin seeing many
      // municipalities never has to look ward ids up.
      prisma.alert.findMany({ where: { wardId: { in: wardIds }, validTo: { gte: now } }, orderBy: [{ severity: "desc" }, { validFrom: "asc" }], take: 100, include: { ward: { select: WARD_LABEL } } }),
      prisma.advisory.findMany({ where: { wardId: { in: wardIds } }, orderBy: { publishedAt: "desc" }, take: 20, include: { officer: { select: { fullName: true, designation: true } }, ward: { select: WARD_LABEL } } }),
    ]);
    return c.json({ alerts, advisories });
  })
  .post("/refresh", requireRole(...OFFICER_ROLES), async (c) => {
    const wards = await getPrisma().ward.findMany({ where: await wardScope(c.get("user")), select: { id: true } });
    return c.json(await refreshWardAlerts(wards.map((w) => w.id)));
  })
  .post(
    "/advisories",
    requireRole(...OFFICER_ROLES),
    zValidator("json", z.object({ wardId: z.number().int().positive(), titleNe: z.string().min(2).max(120), bodyNe: z.string().min(2).max(2000), cropCodes: z.array(z.string()).default([]) })),
    async (c) => {
      const user = c.get("user");
      const prisma = getPrisma();
      const body = c.req.valid("json");
      const inScope = await prisma.ward.findFirst({ where: { AND: [await wardScope(user), { id: body.wardId }] } });
      if (!inScope) return c.json({ error: "ward_out_of_scope" }, 403);
      const officer = await prisma.officerProfile.findUniqueOrThrow({ where: { userId: user.id } });
      return c.json(await prisma.advisory.create({ data: { ...body, officerId: officer.id } }), 201);
    },
  );
