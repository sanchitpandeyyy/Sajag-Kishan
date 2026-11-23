import { createMiddleware } from "hono/factory";
import { getPrisma } from "./db";
import { auth } from "./lib/auth";
import { ROLES, type Role } from "./shared";
import type { AppEnv } from "./types";

const isRole = (r: unknown): r is Role => typeof r === "string" && (ROLES as readonly string[]).includes(r);

/** Officer (staff) sessions end after this long without use; farmer sessions never expire. */
export const OFFICER_IDLE_MS = 31 * 86_400_000;

export function officerSessionIdle(role: Role, lastActive: Date | string, now = Date.now()): boolean {
  return role !== "FARMER" && now - new Date(lastActive).getTime() > OFFICER_IDLE_MS;
}

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "unauthorized" }, 401);
  const { user } = session;
  if (user.banned) return c.json({ error: "account_disabled" }, 403);
  const role = isRole(user.role) ? user.role : "FARMER";
  if (officerSessionIdle(role, session.session.updatedAt)) {
    await getPrisma().session.deleteMany({ where: { id: session.session.id } }).catch(() => undefined);
    return c.json({ error: "session_expired" }, 401);
  }
  c.set("user", { id: user.id, role, mobile: user.phoneNumber ?? "" });
  c.set("session", session);
  await next();
});

export const requireRole = (...roles: Role[]) =>
  createMiddleware<AppEnv>(async (c, next) => {
    if (!roles.includes(c.get("user").role)) return c.json({ error: "forbidden" }, 403);
    await next();
  });

export const OFFICER_ROLES: Role[] = ["AGRICULTURE_OFFICER", "SUPER_ADMIN"];
