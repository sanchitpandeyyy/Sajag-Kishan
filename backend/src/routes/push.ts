import { getPrisma } from "../db";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { requireAuth } from "../auth";
import type { AppEnv } from "../types";

export const pushRoutes = new Hono<AppEnv>().use("*", requireAuth).post(
  "/register",
  zValidator("json", z.object({ token: z.string().regex(/^ExponentPushToken\[.+\]$|^ExpoPushToken\[.+\]$/), platform: z.enum(["android", "ios", "web"]) })),
  async (c) => {
    const { token, platform } = c.req.valid("json");
    const userId = c.get("user").id;
    await getPrisma().pushToken.upsert({ where: { token }, update: { userId, platform }, create: { token, platform, userId } });
    return c.json({ ok: true });
  },
);
