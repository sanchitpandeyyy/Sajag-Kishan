import { getPrisma, type Prisma } from "./db";
import { deadTokens, sendPush, type PushMessage } from "./push";
import { currentFiscalYearBs, currentSeason } from "./scope";

export interface WardAudience {
  wardId: number;
  cropCodes?: string[];
}

export function audienceWhere({ wardId, cropCodes = [] }: WardAudience): Prisma.FarmerWhereInput {
  const inWard: Prisma.FarmerWhereInput = { OR: [{ farmingWardId: wardId }, { parcels: { some: { wardId } } }] };
  if (!cropCodes.length) return inWard;
  return {
    AND: [
      inWard,
      {
        declarations: {
          some: { fiscalYearBs: currentFiscalYearBs(), season: currentSeason(), isFallow: false, crop: { code: { in: cropCodes } } },
        },
      },
    ],
  };
}

export interface NotifyInput extends WardAudience {
  title: string;
  body: string;
  priority?: PushMessage["priority"];
  data?: Record<string, unknown>;
  alertId?: string;
}

export interface NotifyResult {
  farmers: number;
  phones: number;
  pushed: number;
  failed: number;
}

export async function notifyWard(input: NotifyInput): Promise<NotifyResult> {
  const prisma = getPrisma();
  const farmers = await prisma.farmer.findMany({
    where: audienceWhere(input),
    select: { userId: true, user: { select: { pushTokens: { select: { token: true } } } } },
  });

  const messages: PushMessage[] = farmers.flatMap((f) =>
    f.user.pushTokens.map((t) => ({ to: t.token, title: input.title, body: input.body.slice(0, 180), data: input.data, priority: input.priority ?? "default" })),
  );
  const results = messages.length ? await sendPush(messages) : [];
  const okTokens = new Set(results.filter((r) => r.ok).map((r) => r.to));

  const dead = deadTokens(results);
  if (dead.length) await prisma.pushToken.deleteMany({ where: { token: { in: dead } } });

  if (input.alertId) {
    const now = new Date();
    await prisma.alertDelivery.createMany({
      data: farmers.map((f) => {
        const tokens = f.user.pushTokens.map((t) => t.token);
        if (!tokens.length) return { alertId: input.alertId!, userId: f.userId, channel: "in_app" };
        const delivered = tokens.some((t) => okTokens.has(t));
        const error = delivered ? null : (results.find((r) => tokens.includes(r.to))?.error ?? "push_failed");
        return { alertId: input.alertId!, userId: f.userId, channel: "push", sentAt: delivered ? now : null, error };
      }),
      skipDuplicates: true,
    });
  }

  return { farmers: farmers.length, phones: messages.length, pushed: okTokens.size, failed: results.length - okTokens.size };
}
