import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { audit } from "../audit";
import { OFFICER_ROLES, requireAuth, requireRole } from "../auth";
import { getPrisma } from "../db";
import { setAccountDisabled, setPassword, temporaryPassword } from "../lib/accounts";
import { maskCitizenship, wardScope } from "../scope";
import type { AppEnv } from "../types";

const accessSchema = z.object({ disabled: z.boolean(), reason: z.string().trim().max(200).optional() });

/** Officer: farmers in their local level (super admin: all). Citizenship is masked. */
export const farmerRoutes = new Hono<AppEnv>()
  .use("*", requireAuth, requireRole(...OFFICER_ROLES))
  .get("/", async (c) => {
    const q = c.req.query("q")?.trim();
    const farmers = await getPrisma().farmer.findMany({
      where: {
        farmingWard: await wardScope(c.get("user")),
        ...(q
          ? { OR: [{ firstNameNe: { contains: q } }, { lastNameNe: { contains: q } }, { firstNameEn: { contains: q, mode: "insensitive" } }, { user: { phoneNumber: { contains: q } } }] }
          : {}),
      },
      include: {
        user: { select: { phoneNumber: true, banned: true, accounts: { where: { providerId: "credential" }, select: { id: true } } } },
        farmingWard: { select: { number: true } },
        parcels: { select: { areaM2: true, verification: true, geometry: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return c.json(
      farmers.map((f) => ({
        id: f.id,
        nameNe: [f.firstNameNe, f.middleNameNe, f.lastNameNe].filter(Boolean).join(" "),
        mobile: f.user.phoneNumber,
        hasPassword: f.user.accounts.length > 0,
        disabled: !!f.user.banned,
        ward: f.farmingWard.number,
        tole: f.farmingTole,
        citizenshipNo: maskCitizenship(f.citizenshipNo),
        totalAreaM2: f.parcels.reduce((s, p) => s + p.areaM2, 0),
        parcels: f.parcels.length,
        mappedParcels: f.parcels.filter((p) => p.geometry).length,
        verifiedParcels: f.parcels.filter((p) => p.verification === "VERIFIED").length,
        source: f.source,
      })),
    );
  })
  /** One farmer: profile (citizenship masked), fields with crops by season, subsidy. */
  .get("/:id", async (c) => {
    const f = await getPrisma().farmer.findFirst({
      where: { id: c.req.param("id"), farmingWard: await wardScope(c.get("user")) },
      include: {
        user: { select: { phoneNumber: true, banned: true, mustChangePassword: true, accounts: { where: { providerId: "credential" }, select: { id: true } } } },
        farmingWard: { select: { number: true, localLevel: { select: { nameNe: true, nameEn: true } } } },
        parcels: {
          orderBy: { createdAt: "asc" },
          include: {
            ward: { select: { number: true } },
            declarations: {
              orderBy: { createdAt: "desc" },
              include: { crop: { select: { code: true, nameNe: true, nameEn: true } }, inputs: { select: { kind: true, product: true, quantityKg: true } } },
            },
          },
        },
        allocations: { orderBy: { createdAt: "desc" }, include: { scheme: { select: { name: true, unit: true, fiscalYearBs: true } } } },
      },
    });
    if (!f) return c.json({ error: "not_found" }, 404);
    return c.json({
      id: f.id,
      nameNe: [f.firstNameNe, f.middleNameNe, f.lastNameNe].filter(Boolean).join(" "),
      nameEn: [f.firstNameEn, f.middleNameEn, f.lastNameEn].filter(Boolean).join(" ") || null,
      mobile: f.user.phoneNumber,
      hasPassword: f.user.accounts.length > 0,
      mustChangePassword: f.user.mustChangePassword,
      disabled: !!f.user.banned,
      gender: f.gender,
      dobBs: f.dobBs,
      education: f.education,
      farmingSectors: f.farmingSectors,
      farmingMonthsPerYear: f.farmingMonthsPerYear,
      citizenshipNo: maskCitizenship(f.citizenshipNo),
      ward: f.farmingWard.number,
      tole: f.farmingTole,
      localLevel: f.farmingWard.localLevel,
      source: f.source,
      parcels: f.parcels.map((p) => ({
        id: p.id,
        ward: p.ward.number,
        tole: p.tole,
        kittaNo: p.kittaNo,
        areaM2: p.areaM2,
        areaOriginal: p.areaOriginal,
        ownershipType: p.ownershipType,
        irrigation: p.irrigation,
        verification: p.verification,
        mapped: p.geometry != null,
        lat: p.centroidLat,
        lng: p.centroidLng,
        localName: p.localName,
        elevationM: p.elevationM,
        declarations: p.declarations.map((d) => ({
          id: d.id,
          fiscalYearBs: d.fiscalYearBs,
          season: d.season,
          crop: d.crop,
          sownAreaM2: d.sownAreaM2,
          isFallow: d.isFallow,
          source: d.source,
          inputs: d.inputs,
        })),
      })),
      allocations: f.allocations.map((a) => ({
        id: a.id,
        scheme: a.scheme,
        needQty: a.needQty,
        allocatedQty: a.allocatedQty,
        deliveredQty: a.deliveredQty,
        status: a.status,
        flags: a.flags,
      })),
    });
  })
  /**
   * Issue a one-time temporary password (no OTP/SMS in KrishiDristi).
   * The officer hands it to the farmer in person; the farmer changes it after logging in.
   * Returned once, never stored in plain text, and all the farmer's sessions are ended.
   */
  /** Turn a farmer's app account off (lost phone, misuse, death) or back on. Data is kept. */
  .post("/:id/access", zValidator("json", accessSchema), async (c) => {
    const user = c.get("user");
    const prisma = getPrisma();
    const { disabled, reason } = c.req.valid("json");
    const farmer = await prisma.farmer.findFirst({ where: { id: c.req.param("id"), farmingWard: await wardScope(user) }, select: { id: true, userId: true } });
    if (!farmer) return c.json({ error: "not_found" }, 404);
    await setAccountDisabled(prisma, farmer.userId, disabled, reason);
    await audit(user.id, disabled ? "farmer.disable" : "farmer.enable", "Farmer", farmer.id, null, { reason: reason ?? null });
    return c.json({ ok: true, disabled });
  })
  .post("/:id/password", async (c) => {
    const user = c.get("user");
    const prisma = getPrisma();
    const farmer = await prisma.farmer.findFirst({
      where: { id: c.req.param("id"), farmingWard: await wardScope(user) },
      select: { id: true, userId: true, user: { select: { phoneNumber: true } } },
    });
    if (!farmer) return c.json({ error: "not_found" }, 404);

    const password = temporaryPassword();
    await setPassword(prisma, farmer.userId, password, { temporary: true });
    await audit(user.id, "farmer.password.issue", "Farmer", farmer.id, null, { issuedBy: user.id });
    return c.json({
      mobile: farmer.user.phoneNumber,
      temporaryPassword: password,
      noteNe: "यो अस्थायी पासवर्ड कृषकलाई आफैं दिनुहोस्। पहिलो लगइनपछि कृषकले पासवर्ड बदल्नुपर्छ।",
    });
  });
