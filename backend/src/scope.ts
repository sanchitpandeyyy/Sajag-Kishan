/**
 * Jurisdiction scoping. Every officer query is filtered through `wardScope`.
 * Farmers only ever see their own records (`farmerIdFor`).
 */
import { getPrisma, type Prisma } from "./db";
import { HTTPException } from "hono/http-exception";
import type { AuthUser } from "./types";

export type WardWhere = Prisma.WardWhereInput;

/**
 * Prisma `Ward` filter for what an officer may see:
 * SUPER_ADMIN → everything; AGRICULTURE_OFFICER → the wards of their local level.
 */
export async function wardScope(user: AuthUser): Promise<WardWhere> {
  if (user.role === "SUPER_ADMIN") return {};
  if (user.role !== "AGRICULTURE_OFFICER") throw new HTTPException(403, { message: "forbidden" });
  const officer = await getPrisma().officerProfile.findUnique({ where: { userId: user.id }, select: { localLevelId: true } });
  if (!officer) throw new HTTPException(403, { message: "officer_profile_missing" });
  return { localLevelId: officer.localLevelId };
}

/** The officer's local level id, or null for the super admin (all local levels). */
export async function officerLocalLevelId(user: AuthUser): Promise<number | null> {
  if (user.role === "SUPER_ADMIN") return null;
  const officer = await getPrisma().officerProfile.findUnique({ where: { userId: user.id }, select: { localLevelId: true } });
  if (!officer) throw new HTTPException(403, { message: "officer_profile_missing" });
  return officer.localLevelId;
}

/** Subsidy schemes an officer may see: their local level's plus shared (no local level). */
export async function schemeScope(user: AuthUser): Promise<Prisma.SubsidySchemeWhereInput> {
  const ll = await officerLocalLevelId(user);
  return ll == null ? {} : { OR: [{ localLevelId: ll }, { localLevelId: null }] };
}

export async function farmerIdFor(user: AuthUser): Promise<string> {
  const farmer = await getPrisma().farmer.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!farmer) throw new HTTPException(403, { message: "farmer_profile_missing" });
  return farmer.id;
}

/** Narrow a scope further to one local level / ward if the officer asked for it. */
export function narrow(scope: WardWhere, q: { wardId?: number; localLevelId?: number }): WardWhere {
  const extra: WardWhere = {};
  if (q.wardId) extra.id = q.wardId;
  if (q.localLevelId) extra.localLevelId = q.localLevelId;
  return Object.keys(extra).length ? { AND: [scope, extra] } : scope;
}

/** Current Nepali fiscal year (starts mid-July, Shrawan 1) as "2083/84". */
export function currentFiscalYearBs(now = new Date()): string {
  // AD→BS year offset is +57 before mid-April, +56/57 around; FY starts ~16 July.
  const adYear = now.getUTCFullYear();
  const afterJul16 = now.getUTCMonth() > 6 || (now.getUTCMonth() === 6 && now.getUTCDate() >= 16);
  const startBs = adYear + 56 + (afterJul16 ? 1 : 0);
  return `${startBs}/${String((startBs + 1) % 100).padStart(2, "0")}`;
}

/** Season for a date: Barshe (Jun–Oct), Hiude (Nov–Feb), Chaite (Mar–May). */
export function currentSeason(now = new Date()): "BARSHE" | "HIUDE" | "CHAITE" {
  const m = now.getUTCMonth() + 1;
  if (m >= 6 && m <= 10) return "BARSHE";
  if (m >= 3 && m <= 5) return "CHAITE";
  return "HIUDE";
}

export function maskCitizenship(no: string): string {
  return no.length <= 4 ? "****" : `${"*".repeat(no.length - 4)}${no.slice(-4)}`;
}
