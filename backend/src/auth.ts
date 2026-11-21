/**
 * Request guards backed by Better Auth sessions.
 * Jurisdiction scoping (which wards) lives in src/scope.ts.
 */
import { createMiddleware } from "hono/factory";
import { auth } from "./lib/auth";
import { ROLES, type Role } from "./shared";
import type { AppEnv } from "./types";

const isRole = (r: unknown): r is Role => typeof r === "string" && (ROLES as readonly string[]).includes(r);

/** Works for cookie sessions (officer web) and the Expo app (cookie header from SecureStore). */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "unauthorized" }, 401);
  const { user } = session;
  if (user.banned) return c.json({ error: "account_disabled" }, 403);
  const role = isRole(user.role) ? user.role : "FARMER";
  c.set("user", { id: user.id, role, mobile: user.phoneNumber ?? "" });
  c.set("session", session);
  await next();
});

export const requireRole = (...roles: Role[]) =>
  createMiddleware<AppEnv>(async (c, next) => {
    if (!roles.includes(c.get("user").role)) return c.json({ error: "forbidden" }, 403);
    await next();
  });

/** Roles that use the officer web app. */
export const OFFICER_ROLES: Role[] = ["AGRICULTURE_OFFICER", "SUPER_ADMIN"];
