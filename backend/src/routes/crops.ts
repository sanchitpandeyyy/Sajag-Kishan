import { Hono } from "hono";
import { requireAuth } from "../auth";
import { getPrisma } from "../db";
import { cachedStatic, MINUTE } from "../lib/cache";
import type { AppEnv } from "../types";

export const cropRoutes = new Hono<AppEnv>().use("*", requireAuth).get("/", async (c) => {
  const crops = await cachedStatic("crops:list", 10 * MINUTE, () =>
    getPrisma().crop.findMany({
      select: { code: true, nameNe: true, nameEn: true, category: true },
      orderBy: { nameEn: "asc" },
    }),
  );
  c.header("Cache-Control", "private, max-age=300, stale-while-revalidate=3600");
  return c.json(crops);
});
