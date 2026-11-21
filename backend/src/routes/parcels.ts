import { getPrisma } from "../db";
import { fetchElevation } from "../engine";
import { geoPointSchema, toSquareMetres } from "../shared";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { OFFICER_ROLES, requireAuth, requireRole } from "../auth";
import { audit } from "../audit";
import { farmerIdFor, wardScope } from "../scope";
import type { AppEnv } from "../types";

const areaSchema = z.record(z.enum(["bigha", "kattha", "dhur", "ropani", "aana", "paisa", "daam", "sqm", "hectare"]), z.number().nonnegative());

const polygonSchema = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(z.array(z.tuple([z.number(), z.number()])).min(4)).min(1),
});

const createParcelSchema = z.object({
  wardId: z.number().int().positive(),
  tole: z.string().min(1).max(120),
  localName: z.string().max(80).optional(),
  kittaNo: z.string().max(40).optional(),
  area: areaSchema,
  ownershipType: z.enum(["OWNED", "LEASED", "SHARECROPPED", "OTHER"]).default("OWNED"),
  irrigation: z.enum(["RAINFED", "CANAL", "TUBEWELL", "POND", "RIVER_LIFT", "DRIP_SPRINKLER", "OTHER"]).default("RAINFED"),
  point: geoPointSchema.optional(),
  polygon: polygonSchema.optional(),
});

function centroidOf(polygon: z.infer<typeof polygonSchema>) {
  const ring = polygon.coordinates[0]!.slice(0, -1);
  const lng = ring.reduce((s, p) => s + p[0], 0) / ring.length;
  const lat = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  return { lat, lng };
}

export const parcelRoutes = new Hono<AppEnv>()
  .use("*", requireAuth)
  .get("/", async (c) => {
    const user = c.get("user");
    const prisma = getPrisma();
    const where = user.role === "FARMER" ? { farmerId: await farmerIdFor(user) } : { ward: await wardScope(user) };
    const parcels = await prisma.parcel.findMany({
      where,
      include: {
        ward: { select: { number: true, localLevel: { select: { nameNe: true } } } },
        declarations: { orderBy: { createdAt: "desc" }, take: 3, include: { crop: { select: { code: true, nameNe: true } } } },
        farmer: user.role === "FARMER" ? false : { select: { firstNameNe: true, lastNameNe: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    return c.json(parcels);
  })
  .post("/", requireRole("FARMER", ...OFFICER_ROLES), zValidator("json", createParcelSchema), async (c) => {
    const user = c.get("user");
    const body = c.req.valid("json");
    const farmerId = user.role === "FARMER" ? await farmerIdFor(user) : c.req.query("farmerId");
    if (!farmerId) return c.json({ error: "farmerId_required" }, 400);

    const center = body.polygon ? centroidOf(body.polygon) : body.point;
    const elevationM = center ? await fetchElevation(center.lat, center.lng).catch(() => null) : null;

    const parcel = await getPrisma().parcel.create({
      data: {
        farmerId,
        wardId: body.wardId,
        tole: body.tole,
        localName: body.localName,
        kittaNo: body.kittaNo,
        areaM2: toSquareMetres(body.area),
        areaOriginal: body.area,
        ownershipType: body.ownershipType,
        irrigation: body.irrigation,
        geometry: body.polygon ?? (body.point ? { type: "Point", coordinates: [body.point.lng, body.point.lat] } : undefined),
        centroidLat: center?.lat,
        centroidLng: center?.lng,
        elevationM,
        source: user.role === "FARMER" ? "FARMER" : "OFFICER",
      },
    });
    await audit(user.id, "parcel.create", "Parcel", parcel.id, null, parcel);
    return c.json(parcel, 201);
  })
  .post(
    "/:id/verify",
    requireRole(...OFFICER_ROLES),
    zValidator("json", z.object({ status: z.enum(["VERIFIED", "DISPUTED"]), note: z.string().max(500).optional() })),
    async (c) => {
      const user = c.get("user");
      const prisma = getPrisma();
      const parcel = await prisma.parcel.findFirst({ where: { id: c.req.param("id"), ward: await wardScope(user) } });
      if (!parcel) return c.json({ error: "not_found" }, 404);
      const { status, note } = c.req.valid("json");
      const updated = await prisma.parcel.update({
        where: { id: parcel.id },
        data: { verification: status, verifiedById: user.id, verifiedAt: new Date() },
      });
      await audit(user.id, `parcel.${status.toLowerCase()}`, "Parcel", parcel.id, { verification: parcel.verification }, { verification: status, note });
      return c.json(updated);
    },
  )
  /**
   * Set a field's location from the phone's GPS (farmer: own fields; officer: fields in scope).
   * A farmer moving a field resets verification, since the officer verified the old spot.
   */
  .patch(
    "/:id/location",
    zValidator("json", geoPointSchema.extend({ accuracyM: z.number().nonnegative().max(5000).optional() })),
    async (c) => {
      const user = c.get("user");
      const prisma = getPrisma();
      const where =
        user.role === "FARMER" ? { id: c.req.param("id"), farmerId: await farmerIdFor(user) } : { id: c.req.param("id"), ward: await wardScope(user) };
      const parcel = await prisma.parcel.findFirst({ where });
      if (!parcel) return c.json({ error: "not_found" }, 404);

      const { lat, lng, accuracyM } = c.req.valid("json");
      const elevationM = await fetchElevation(lat, lng).catch(() => parcel.elevationM);
      const isFarmer = user.role === "FARMER";
      const updated = await prisma.parcel.update({
        where: { id: parcel.id },
        data: {
          geometry: { type: "Point", coordinates: [lng, lat], accuracyM: accuracyM ?? null },
          centroidLat: lat,
          centroidLng: lng,
          elevationM,
          ...(isFarmer ? { source: "FARMER" as const, verification: "UNVERIFIED" as const, verifiedById: null, verifiedAt: null } : {}),
        },
      });
      await audit(user.id, "parcel.location", "Parcel", parcel.id, { lat: parcel.centroidLat, lng: parcel.centroidLng }, { lat, lng, accuracyM });
      return c.json(updated);
    },
  );
