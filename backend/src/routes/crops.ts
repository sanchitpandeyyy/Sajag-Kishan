import { Hono } from "hono";
import { requireAuth } from "../auth";
import { getPrisma } from "../db";
import type { AppEnv } from "../types";

export const cropRoutes = new Hono<AppEnv>().use("*", requireAuth).get("/", async (c) =>
  c.json(
    await getPrisma().crop.findMany({
      select: { code: true, nameNe: true, nameEn: true, category: true },
      orderBy: { nameEn: "asc" },
    }),
  ),
);
