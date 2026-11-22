import { getPrisma } from "../db";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { requireAuth } from "../auth";
import { refreshFarmerContext } from "../chat/context";
import { currentFiscalYearBs, currentSeason, farmerIdFor, wardScope } from "../scope";
import type { AppEnv } from "../types";

const declarationSchema = z.object({
  parcelId: z.string().min(1),
  cropCode: z.string().min(1),
  season: z.enum(["BARSHE", "HIUDE", "CHAITE"]).optional(),
  fiscalYearBs: z.string().regex(/^20\d{2}\/\d{2}$/).optional(),
  sownAreaM2: z.number().positive().optional(),
  sowingDate: z.string().date().optional(),
  isFallow: z.boolean().default(false),
  inputs: z
    .array(z.object({ kind: z.enum(["FERTILIZER", "PESTICIDE", "SEED", "MACHINERY", "OTHER"]), product: z.string().min(1), quantityKg: z.number().nonnegative() }))
    .default([]),
});

export const declarationRoutes = new Hono<AppEnv>()
  .use("*", requireAuth)
  .use("*", refreshFarmerContext)
  .get("/", async (c) => {
    const user = c.get("user");
    const where = user.role === "FARMER" ? { farmerId: await farmerIdFor(user) } : { parcel: { ward: await wardScope(user) } };
    return c.json(
      await getPrisma().seasonDeclaration.findMany({
        where,
        include: { crop: { select: { code: true, nameNe: true } }, inputs: true },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
    );
  })
  .post("/", zValidator("json", declarationSchema), async (c) => {
    const user = c.get("user");
    const body = c.req.valid("json");
    const prisma = getPrisma();

    const parcel =
      user.role === "FARMER"
        ? await prisma.parcel.findFirst({ where: { id: body.parcelId, farmerId: await farmerIdFor(user) } })
        : await prisma.parcel.findFirst({ where: { id: body.parcelId, ward: await wardScope(user) } });
    if (!parcel) return c.json({ error: "parcel_not_found" }, 404);

    const crop = await prisma.crop.findUnique({ where: { code: body.cropCode } });
    if (!crop) return c.json({ error: "unknown_crop" }, 400);

    const sownAreaM2 = Math.min(body.sownAreaM2 ?? parcel.areaM2, parcel.areaM2);
    const declaration = await prisma.seasonDeclaration.upsert({
      where: {
        parcelId_fiscalYearBs_season_cropId: {
          parcelId: parcel.id,
          fiscalYearBs: body.fiscalYearBs ?? currentFiscalYearBs(),
          season: body.season ?? currentSeason(),
          cropId: crop.id,
        },
      },
      update: { sownAreaM2, sowingDate: body.sowingDate ? new Date(body.sowingDate) : undefined, isFallow: body.isFallow },
      create: {
        parcelId: parcel.id,
        farmerId: parcel.farmerId,
        cropId: crop.id,
        fiscalYearBs: body.fiscalYearBs ?? currentFiscalYearBs(),
        season: body.season ?? currentSeason(),
        sownAreaM2,
        sowingDate: body.sowingDate ? new Date(body.sowingDate) : undefined,
        isFallow: body.isFallow,
        source: user.role === "FARMER" ? "FARMER" : "OFFICER",
        inputs: { create: body.inputs.map((i) => ({ ...i, source: user.role === "FARMER" ? "FARMER" : "OFFICER" })) },
      },
      include: { inputs: true },
    });
    return c.json(declaration, 201);
  });
