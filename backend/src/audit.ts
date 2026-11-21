import { getPrisma, type Prisma } from "./db";

/** Append-only audit trail for verification and subsidy changes. */
export async function audit(userId: string | null, action: string, entity: string, entityId: string, before: unknown, after: unknown) {
  await getPrisma().auditLog.create({
    data: {
      userId,
      action,
      entity,
      entityId,
      before: (before ?? undefined) as Prisma.InputJsonValue | undefined,
      after: (after ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}
