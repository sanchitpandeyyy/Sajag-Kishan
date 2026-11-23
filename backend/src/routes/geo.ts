import { getPrisma } from "../db";
import { Hono } from "hono";
import { cachedStatic, MINUTE } from "../lib/cache";
import type { AppEnv } from "../types";

const TTL = 10 * MINUTE;
// Provinces, districts and wards almost never change: let clients and proxies reuse them too.
const PUBLIC_CACHE = "public, max-age=300, stale-while-revalidate=3600";

export const geoRoutes = new Hono<AppEnv>()
  .use("*", async (c, next) => {
    await next();
    if (c.res.status === 200) c.header("Cache-Control", PUBLIC_CACHE);
  })
  .get("/provinces", async (c) => c.json(await cachedStatic("geo:provinces", TTL, () => getPrisma().province.findMany({ orderBy: { id: "asc" } }))))
  .get("/districts", async (c) => {
    const provinceId = Number(c.req.query("provinceId")) || undefined;
    return c.json(await cachedStatic(`geo:districts:${provinceId ?? ""}`, TTL, () => getPrisma().district.findMany({ where: { provinceId }, orderBy: { nameEn: "asc" } })));
  })
  .get("/local-levels", async (c) => {
    const districtId = Number(c.req.query("districtId")) || undefined;
    return c.json(await cachedStatic(`geo:local-levels:${districtId ?? ""}`, TTL, () => getPrisma().localLevel.findMany({ where: { districtId }, orderBy: { nameEn: "asc" } })));
  })
  .get("/wards", async (c) => {
    const localLevelId = Number(c.req.query("localLevelId")) || undefined;
    return c.json(
      await cachedStatic(`geo:wards:${localLevelId ?? ""}`, TTL, () =>
        getPrisma().ward.findMany({
          where: { localLevelId },
          orderBy: { number: "asc" },
          select: { id: true, number: true, localLevelId: true, centroidLat: true, centroidLng: true, elevationM: true },
        }),
      ),
    );
  });
