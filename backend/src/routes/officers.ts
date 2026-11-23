import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { audit } from "../audit";
import { requireAuth, requireRole } from "../auth";
import { getPrisma } from "../db";
import { ensurePhoneUser, setAccountDisabled, setPassword, temporaryPassword } from "../lib/accounts";
import { mobileSchema } from "../shared";
import type { AppEnv } from "../types";

const createOfficerSchema = z.object({
  mobile: mobileSchema,
  fullName: z.string().min(2).max(120),
  designation: z.string().max(120).optional(),
  localLevelId: z.number().int().positive(),
});

export const officerRoutes = new Hono<AppEnv>()
  .use("*", requireAuth, requireRole("SUPER_ADMIN"))
  .get("/", async (c) =>
    c.json(
      await getPrisma().officerProfile.findMany({
        include: {
          user: { select: { id: true, phoneNumber: true, role: true, banned: true } },
          localLevel: { select: { id: true, nameNe: true, nameEn: true } },
        },
        orderBy: { fullName: "asc" },
      }),
    ),
  )
  .post("/", zValidator("json", createOfficerSchema), async (c) => {
    const body = c.req.valid("json");
    const prisma = getPrisma();
    const localLevel = await prisma.localLevel.findUnique({ where: { id: body.localLevelId } });
    if (!localLevel) return c.json({ error: "unknown_local_level" }, 400);

    const existing = await prisma.user.findUnique({ where: { phoneNumber: body.mobile }, select: { role: true } });
    if (existing && existing.role !== "AGRICULTURE_OFFICER") return c.json({ error: "mobile_in_use" }, 409);

    const password = temporaryPassword();
    const userId = await ensurePhoneUser(prisma, { mobile: body.mobile, name: body.fullName, role: "AGRICULTURE_OFFICER", phoneVerified: true });
    await setPassword(prisma, userId, password, { temporary: true });
    const profile = await prisma.officerProfile.upsert({
      where: { userId },
      update: { fullName: body.fullName, designation: body.designation, localLevelId: body.localLevelId },
      create: { userId, fullName: body.fullName, designation: body.designation, localLevelId: body.localLevelId },
    });
    await audit(c.get("user").id, "officer.create", "OfficerProfile", profile.id, null, { localLevelId: body.localLevelId });
    return c.json({ officer: profile, mobile: body.mobile, temporaryPassword: password }, 201);
  })
  .post("/:userId/access", zValidator("json", z.object({ disabled: z.boolean(), reason: z.string().trim().max(200).optional() })), async (c) => {
    const me = c.get("user");
    const userId = c.req.param("userId");
    const { disabled, reason } = c.req.valid("json");
    if (userId === me.id) return c.json({ error: "cannot_disable_self", messageNe: "आफ्नै खाता बन्द गर्न मिल्दैन।" }, 400);
    const prisma = getPrisma();
    const profile = await prisma.officerProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!profile) return c.json({ error: "not_found" }, 404);
    await setAccountDisabled(prisma, userId, disabled, reason);
    await audit(me.id, disabled ? "officer.disable" : "officer.enable", "OfficerProfile", profile.id, null, { reason: reason ?? null });
    return c.json({ ok: true, disabled });
  })
  .post("/:userId/password", async (c) => {
    const userId = c.req.param("userId");
    const prisma = getPrisma();
    const profile = await prisma.officerProfile.findUnique({ where: { userId }, select: { id: true, user: { select: { phoneNumber: true } } } });
    if (!profile) return c.json({ error: "not_found" }, 404);
    const password = temporaryPassword();
    await setPassword(prisma, userId, password, { temporary: true });
    await audit(c.get("user").id, "officer.password.issue", "OfficerProfile", profile.id, null, null);
    return c.json({ mobile: profile.user.phoneNumber, temporaryPassword: password });
  });
