/**
 * GET /v1/me: the signed-in user with their farmer or officer profile.
 * Sign-in, change-password and sign-out are Better Auth endpoints under /v1/auth/* (no OTP).
 */
import { Hono } from "hono";
import { getPrisma } from "../db";
import { requireAuth } from "../auth";
import type { AppEnv } from "../types";

export const meRoutes = new Hono<AppEnv>().get("/", requireAuth, async (c) => {
  const { id } = c.get("user");
  const user = await getPrisma().user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      phoneNumber: true,
      mustChangePassword: true,
      role: true,
      farmer: { select: { id: true, firstNameNe: true, lastNameNe: true, farmingWardId: true } },
      officer: { select: { id: true, fullName: true, designation: true, localLevelId: true, localLevel: { select: { nameNe: true, nameEn: true } } } },
    },
  });
  if (!user) return c.json({ error: "not_found" }, 404);
  return c.json(user);
});
