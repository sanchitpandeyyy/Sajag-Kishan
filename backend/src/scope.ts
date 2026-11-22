import { getPrisma, type Prisma } from "./db";
import { HTTPException } from "hono/http-exception";
import type { AuthUser } from "./types";

export type WardWhere = Prisma.WardWhereInput;

export async function wardScope(user: AuthUser): Promise<WardWhere> {
  if (user.role === "SUPER_ADMIN") return {};
  if (user.role !== "AGRICULTURE_OFFICER") throw new HTTPException(403, { message: "forbidden" });
  const officer = await getPrisma().officerProfile.findUnique({ where: { userId: user.id }, select: { localLevelId: true } });
  if (!officer) throw new HTTPException(403, { message: "officer_profile_missing" });
  return { localLevelId: officer.localLevelId };
}

export async function officerLocalLevelId(user: AuthUser): Promise<number | null> {
  if (user.role === "SUPER_ADMIN") return null;
  const officer = await getPrisma().officerProfile.findUnique({ where: { userId: user.id }, select: { localLevelId: true } });
  if (!officer) throw new HTTPException(403, { message: "officer_profile_missing" });
  return officer.localLevelId;
}

export async function schemeScope(user: AuthUser): Promise<Prisma.SubsidySchemeWhereInput> {
  const ll = await officerLocalLevelId(user);
  return ll == null ? {} : { OR: [{ localLevelId: ll }, { localLevelId: null }] };
}

export async function farmerIdFor(user: AuthUser): Promise<string> {
  const farmer = await getPrisma().farmer.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!farmer) throw new HTTPException(403, { message: "farmer_profile_missing" });
  return farmer.id;
}

export function narrow(scope: WardWhere, q: { wardId?: number; localLevelId?: number }): WardWhere {
  const extra: WardWhere = {};
  if (q.wardId) extra.id = q.wardId;
  if (q.localLevelId) extra.localLevelId = q.localLevelId;
  return Object.keys(extra).length ? { AND: [scope, extra] } : scope;
}

export function currentFiscalYearBs(now = new Date()): string {
  const adYear = now.getUTCFullYear();
  const afterJul16 = now.getUTCMonth() > 6 || (now.getUTCMonth() === 6 && now.getUTCDate() >= 16);
  const startBs = adYear + 56 + (afterJul16 ? 1 : 0);
  return `${startBs}/${String((startBs + 1) % 100).padStart(2, "0")}`;
}

export function currentSeason(now = new Date()): "BARSHE" | "HIUDE" | "CHAITE" {
  const m = now.getUTCMonth() + 1;
  if (m >= 6 && m <= 10) return "BARSHE";
  if (m >= 3 && m <= 5) return "CHAITE";
  return "HIUDE";
}

export function maskCitizenship(no: string): string {
  return no.length <= 4 ? "****" : `${"*".repeat(no.length - 4)}${no.slice(-4)}`;
}
