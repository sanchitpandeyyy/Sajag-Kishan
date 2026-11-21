/**
 * Creating Better Auth users outside an HTTP request (registry import, seeding).
 * Rows are written with Prisma using Better Auth's own field layout and password hasher,
 * so they behave exactly like users created through the auth API.
 */
import { randomInt, randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import type { PrismaClient } from "../db";
import type { Role } from "../shared";

export const placeholderEmail = (mobile: string) => `${mobile}@phone.krishidristi.np`;

export interface PhoneUserInput {
  mobile: string;
  name: string;
  role: Role;
  /** Set for officers/demo users. Registry farmers get none until an officer issues a temporary one. */
  password?: string;
  phoneVerified?: boolean;
}

/** Find-or-create a user by mobile number. Returns the user id. */
export async function ensurePhoneUser(prisma: PrismaClient, input: PhoneUserInput): Promise<string> {
  const existing = await prisma.user.findUnique({ where: { phoneNumber: input.mobile }, select: { id: true } });
  if (existing) return existing.id;

  const id = randomUUID();
  await prisma.user.create({
    data: {
      id,
      name: input.name,
      email: placeholderEmail(input.mobile),
      phoneNumber: input.mobile,
      phoneNumberVerified: input.phoneVerified ?? false,
      role: input.role,
      ...(input.password
        ? {
            accounts: {
              create: { id: randomUUID(), accountId: id, providerId: "credential", password: await hashPassword(input.password) },
            },
          }
        : {}),
    },
  });
  return id;
}

/**
 * Turn an account off or back on (Better Auth admin plugin fields). A disabled user cannot sign in,
 * and every open session is ended at once. Data is kept, so the account can be turned back on.
 */
export async function setAccountDisabled(prisma: PrismaClient, userId: string, disabled: boolean, reason?: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { banned: disabled, banReason: disabled ? (reason ?? null) : null, banExpires: null } });
  if (disabled) await prisma.session.deleteMany({ where: { userId } });
}

/**
 * Create or replace the user's credential (password) account.
 * `temporary: true` makes the apps force a change on next login.
 */
export async function setPassword(prisma: PrismaClient, userId: string, password: string, opts: { temporary?: boolean } = {}): Promise<void> {
  const hash = await hashPassword(password);
  const existing = await prisma.account.findFirst({ where: { userId, providerId: "credential" }, select: { id: true } });
  if (existing) {
    await prisma.account.update({ where: { id: existing.id }, data: { password: hash } });
  } else {
    await prisma.account.create({ data: { id: randomUUID(), userId, accountId: userId, providerId: "credential", password: hash } });
  }
  await prisma.user.update({ where: { id: userId }, data: { mustChangePassword: opts.temporary ?? false } });
  // Force a fresh login everywhere with the new password.
  await prisma.session.deleteMany({ where: { userId } });
}

/** Easy-to-read temporary password (no 0/O/1/l), e.g. "KD-7H3K-9PQ2". */
export function temporaryPassword(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const pick = (n: number) => Array.from({ length: n }, () => alphabet[randomInt(alphabet.length)]).join("");
  return `KD-${pick(4)}-${pick(4)}`;
}
