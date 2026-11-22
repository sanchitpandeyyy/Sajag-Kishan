/**
 * POST /v1/chat   { message, history? } -> { answerNe, answerEn, understoodEn, intent, sources, mode }
 * GET  /v1/chat/suggestions                 -> starter questions for the app
 *
 * Farmers get answers grounded in their own farm data; officers get knowledge-base answers.
 * Works with no API key ("local" mode). With ANTHROPIC_API_KEY set, Claude writes the reply ("llm" mode).
 */
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { OFFICER_ROLES, requireAuth, requireRole } from "../auth";
import { answer, llmConfigured } from "../chat/answer";
import { farmerContext } from "../chat/context";
import { geminiConfigured, transcribeNepali } from "../chat/gemini";
import { answerOfficer, officerSummary } from "../chat/officer";
import { getPrisma } from "../db";
import { wardScope } from "../scope";
import type { AppEnv } from "../types";

const OFFICER_SUGGESTIONS = [
  { ne: "यो महिना कुन वडामा डढुवाको चेतावनी आयो?", en: "Which wards had blight alerts this month?" },
  { ne: "कति जग्गा बाँझो छ?", en: "How much land is fallow?" },
  { ne: "मल अनुदान कति वितरण भयो?", en: "How much fertilizer subsidy has been delivered?" },
  { ne: "कति कित्ता प्रमाणित हुन बाँकी छ?", en: "How many parcels are still unverified?" },
  { ne: "यो हप्ता किसानले के सोधे?", en: "What did farmers ask this week?" },
];

const body = z.object({
  message: z.string().trim().min(1).max(500),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(1500) }))
    .max(12)
    .default([]),
});

export const chatRoutes = new Hono<AppEnv>()
  .use("*", requireAuth)
  .get("/suggestions", (c) =>
    c.json({
      mode: geminiConfigured() ? "gemini" : llmConfigured() ? "llm" : "local",
      suggestions: c.get("user").role !== "FARMER" ? OFFICER_SUGGESTIONS : [
        { ne: "भोलि पानी पर्छ?", en: "Will it rain tomorrow?" },
        { ne: "आज खेतमा के काम गर्ने?", en: "What should I do in the field today?" },
        { ne: "मेरो खेतमा युरिया कति हाल्ने?", en: "How much urea for my field?" },
        { ne: "आलुमा डढुवा रोग कसरी रोक्ने?", en: "How to prevent potato blight?" },
        { ne: "मल अनुदान कहिले पाइन्छ?", en: "When do I get the fertilizer subsidy?" },
      ],
    }),
  )
  /** Voice input: multipart field "audio" (m4a/aac/wav/...) -> { text } in Nepali, via Gemini. */
  .post("/transcribe", async (c) => {
    if (!geminiConfigured()) return c.json({ error: "voice_not_configured", messageNe: "आवाज पहिचान अहिले चालू छैन।" }, 503);
    const form = await c.req.formData().catch(() => null);
    const file = form?.get("audio");
    if (!(file instanceof File) || file.size === 0) return c.json({ error: "audio_required" }, 400);
    if (file.size > 8 * 1024 * 1024) return c.json({ error: "audio_too_large" }, 413);
    try {
      const text = await transcribeNepali(Buffer.from(await file.arrayBuffer()), file.type || "audio/mp4");
      return c.json({ text });
    } catch (e) {
      console.warn("[chat] transcribe failed:", e instanceof Error ? e.message : e);
      return c.json({ error: "transcribe_failed", messageNe: "आवाज बुझ्न सकिएन। फेरि प्रयास गर्नुहोस्।" }, 502);
    }
  })
  .post("/", zValidator("json", body), async (c) => {
    const user = c.get("user");
    const { message, history } = c.req.valid("json");
    if (user.role !== "FARMER") return c.json(await answerOfficer(user, message, history));
    const ctx = await farmerContext(user.id);
    const result = await answer(message, history, ctx);
    if (user.role === "FARMER") void logQuestion(user.id, message, result);
    return c.json(result);
  })
  .get("/officer-summary", requireRole(...OFFICER_ROLES), async (c) => c.json(await officerSummary(c.get("user"), { fresh: c.req.query("fresh") === "1" })))
  /** Officer: what farmers in their area asked, newest first, with a count per topic. */
  .get("/questions", requireRole(...OFFICER_ROLES), zValidator("query", z.object({ intent: z.string().max(30).optional(), q: z.string().max(100).optional() })), async (c) => {
    const { intent, q } = c.req.valid("query");
    const prisma = getPrisma();
    const ward = await wardScope(c.get("user"));
    const where = { ward, ...(intent ? { intent } : {}), ...(q ? { question: { contains: q } } : {}) };
    const [rows, byIntent] = await Promise.all([
      prisma.chatQuestion.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 200,
        select: { id: true, question: true, understoodEn: true, intent: true, answerNe: true, mode: true, createdAt: true, ward: { select: { number: true } } },
      }),
      prisma.chatQuestion.groupBy({ by: ["intent"], where: { ward }, _count: { _all: true } }),
    ]);
    return c.json({
      questions: rows.map((r) => ({ ...r, ward: r.ward?.number ?? null })),
      byIntent: byIntent.map((b) => ({ intent: b.intent, count: b._count._all })).sort((a, b) => b.count - a.count),
    });
  });

/** Best effort: a failed log must never break the farmer's answer. No phone number or name is stored. */
async function logQuestion(userId: string, question: string, result: Awaited<ReturnType<typeof answer>>) {
  try {
    const prisma = getPrisma();
    const farmer = await prisma.farmer.findUnique({ where: { userId }, select: { farmingWardId: true } });
    await prisma.chatQuestion.create({
      data: { userId, wardId: farmer?.farmingWardId ?? null, question, understoodEn: result.understoodEn ?? null, intent: result.intent, answerNe: result.answerNe, mode: result.mode },
    });
  } catch {
    // ignore
  }
}
