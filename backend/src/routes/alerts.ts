import { getPrisma } from "../db";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { OFFICER_ROLES, requireAuth, requireRole } from "../auth";
import { invalidateFarmerContext } from "../chat/context";
import { refreshWardAlerts } from "../jobs/alerts";
import { notifyWard } from "../notify";
import { wardScope } from "../scope";
import type { AppEnv } from "../types";

const WARD_LABEL = { number: true, localLevel: { select: { id: true, nameNe: true, nameEn: true } } } as const;

export const alertRoutes = new Hono<AppEnv>()
  .use("*", requireAuth)
  .get("/", async (c) => {
    const user = c.get("user");
    const prisma = getPrisma();
    const isFarmer = user.role === "FARMER";
    let wardIds: number[];
    if (isFarmer) {
      const farmer = await prisma.farmer.findUnique({ where: { userId: user.id }, include: { parcels: { select: { wardId: true } } } });
      wardIds = [...new Set([farmer?.farmingWardId, ...(farmer?.parcels.map((p) => p.wardId) ?? [])].filter((x): x is number => x != null))];
    } else {
      wardIds = (await prisma.ward.findMany({ where: await wardScope(user), select: { id: true } })).map((w) => w.id);
    }
    const now = new Date();
    const [alerts, advisories] = await Promise.all([
      prisma.alert.findMany({
        where: { wardId: { in: wardIds }, validTo: { gte: now } },
        orderBy: [{ severity: "desc" }, { validFrom: "asc" }],
        take: 100,
        include: {
          ward: { select: WARD_LABEL },
          deliveries: isFarmer ? { where: { userId: user.id }, select: { readAt: true } } : { select: { userId: true, readAt: true, sentAt: true } },
        },
      }),
      prisma.advisory.findMany({ where: { wardId: { in: wardIds } }, orderBy: { publishedAt: "desc" }, take: 20, include: { officer: { select: { fullName: true, designation: true } }, ward: { select: WARD_LABEL } } }),
    ]);
    return c.json({
      alerts: alerts.map(({ deliveries, ...a }) =>
        isFarmer
          ? { ...a, read: deliveries.some((d) => d.readAt != null) }
          : {
              ...a,
              reach: {
                farmers: new Set(deliveries.map((d) => ("userId" in d ? d.userId : ""))).size,
                pushed: new Set(deliveries.filter((d) => "sentAt" in d && d.sentAt != null).map((d) => ("userId" in d ? d.userId : ""))).size,
                read: new Set(deliveries.filter((d) => d.readAt != null).map((d) => ("userId" in d ? d.userId : ""))).size,
              },
            },
      ),
      advisories,
    });
  })
  .post("/read", requireRole("FARMER"), zValidator("json", z.object({ alertIds: z.array(z.string().min(1)).min(1).max(100) })), async (c) => {
    const userId = c.get("user").id;
    const prisma = getPrisma();
    const { alertIds } = c.req.valid("json");
    const farmer = await prisma.farmer.findUnique({ where: { userId }, select: { farmingWardId: true, parcels: { select: { wardId: true } } } });
    if (!farmer) return c.json({ error: "not_a_farmer" }, 403);
    const wardIds = [...new Set([farmer.farmingWardId, ...farmer.parcels.map((p) => p.wardId)])];
    const visible = await prisma.alert.findMany({ where: { id: { in: alertIds }, wardId: { in: wardIds } }, select: { id: true } });
    const ids = visible.map((a) => a.id);
    const now = new Date();
    await prisma.alertDelivery.updateMany({ where: { userId, alertId: { in: ids }, readAt: null }, data: { readAt: now } });
    await prisma.alertDelivery.createMany({ data: ids.map((alertId) => ({ alertId, userId, channel: "in_app", readAt: now })), skipDuplicates: true });
    invalidateFarmerContext(userId);
    return c.json({ read: ids.length });
  })
  .post("/refresh", requireRole(...OFFICER_ROLES), async (c) => {
    const wards = await getPrisma().ward.findMany({ where: await wardScope(c.get("user")), select: { id: true } });
    return c.json(await refreshWardAlerts(wards.map((w) => w.id)));
  })
  .post(
    "/advisories",
    requireRole(...OFFICER_ROLES),
    zValidator(
      "json",
      z.object({
        wardId: z.number().int().positive(),
        titleNe: z.string().min(2).max(120),
        bodyNe: z.string().min(2).max(2000),
        cropCodes: z.array(z.string()).default([]),
        notify: z.boolean().default(true),
      }),
    ),
    async (c) => {
      const user = c.get("user");
      const prisma = getPrisma();
      const { notify, ...body } = c.req.valid("json");
      const inScope = await prisma.ward.findFirst({ where: { AND: [await wardScope(user), { id: body.wardId }] } });
      if (!inScope) return c.json({ error: "ward_out_of_scope" }, 403);
      const officer = await prisma.officerProfile.findUniqueOrThrow({ where: { userId: user.id } });
      const advisory = await prisma.advisory.create({ data: { ...body, officerId: officer.id } });
      const reach = notify
        ? await notifyWard({
            wardId: body.wardId,
            cropCodes: body.cropCodes,
            title: body.titleNe,
            body: body.bodyNe,
            data: { advisoryId: advisory.id, screen: "/alerts" },
          }).catch((e) => {
            console.warn("[advisory] push failed:", e instanceof Error ? e.message : e);
            return null;
          })
        : null;
      return c.json({ ...advisory, reach }, 201);
    },
  );
