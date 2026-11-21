import { getPrisma } from "../db";
import { Hono } from "hono";
import type { AppEnv } from "../types";

/** Public admin-hierarchy lookups used by address pickers. */
export const geoRoutes = new Hono<AppEnv>()
  .get("/provinces", async (c) => c.json(await getPrisma().province.findMany({ orderBy: { id: "asc" } })))
  .get("/districts", async (c) => {
    const provinceId = Number(c.req.query("provinceId")) || undefined;
    return c.json(await getPrisma().district.findMany({ where: { provinceId }, orderBy: { nameEn: "asc" } }));
  })
  .get("/local-levels", async (c) => {
    const districtId = Number(c.req.query("districtId")) || undefined;
    return c.json(await getPrisma().localLevel.findMany({ where: { districtId }, orderBy: { nameEn: "asc" } }));
  })
  .get("/wards", async (c) => {
    const localLevelId = Number(c.req.query("localLevelId")) || undefined;
    return c.json(
      await getPrisma().ward.findMany({
        where: { localLevelId },
        orderBy: { number: "asc" },
        select: { id: true, number: true, localLevelId: true, centroidLat: true, centroidLng: true, elevationM: true },
      }),
    );
  });
