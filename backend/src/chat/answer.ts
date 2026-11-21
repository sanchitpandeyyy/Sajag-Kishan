/**
 * Answer a farmer's question in simple Nepali.
 *
 * Pipeline (docs/10 §9):
 *   1. Nepali question -> English (glossary offline, or the LLM when a key is set)
 *   2. Retrieve passages from the knowledge base (BM25, offline)
 *   3. Add the farmer's own facts (fields, crops, next jobs, forecast, alerts, risk, subsidy)
 *   4. Compose the answer in Nepali:
 *        - "llm" mode: Claude writes it, grounded only in steps 2-3
 *        - "local" mode: templates fill it from steps 2-3 (no key needed, works offline)
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { FarmerChatContext } from "./context";
import { perLocalUnit, retrieve, type KnowledgeDoc } from "./knowledge";
import { cropsMentioned, normalize, roughEnglish } from "./lexicon";
import { FERTILIZER_DOSE_KG_HA } from "../engine";
import { composeEnglish, geminiConfigured, toEnglish, toNepali } from "./gemini";

export type Intent = "weather" | "task" | "subsidy" | "disease" | "fertilizer" | "sowing" | "greeting" | "general";

export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}

export interface ChatAnswer {
  answerNe: string;
  answerEn: string;
  understoodEn: string;
  intent: Intent;
  sources: { id: string; titleNe: string; titleEn: string }[];
  mode: "llm" | "gemini" | "local";
}

const DIGITS = "०१२३४५६७८९";
const ne = (n: number | string) => String(n).replace(/[0-9]/g, (d) => DIGITS[Number(d)]!);
const M2_PER_KATTHA = 338.63;

function has(text: string, words: string[]) {
  return words.some((w) => text.includes(w));
}

export function detectIntent(q: string): Intent {
  const t = normalize(q);
  if (/^(नमस्ते|नमस्कार|hello|hi|namaste)\b/.test(t) && t.length < 25) return "greeting";
  if (has(t, ["अनुदान", "सहुलियत", "subsidy", "पाउने मल", "मल पाउ", "मल कहिले आउ"])) return "subsidy";
  if (has(t, ["कति मल", "मल कति", "युरिया कति", "dap कति", "how much fertilizer", "fertilizer dose", "मात्रा"])) return "fertilizer";
  if (has(t, ["रोग", "कीरा", "किरा", "लाही", "डढुवा", "मरुवा", "सिन्दूरे", "फौजी", "पहेँलो", "पहेलो", "दाग", "ओइल", "कुहि", "disease", "pest", "insect", "blight"])) return "disease";
  if (has(t, ["मौसम", "पानी पर्", "वर्षा", "झरी", "असिना", "हावा", "चिसो", "गर्मी", "weather", "rain", "forecast"])) return "weather";
  if (has(t, ["कहिले रोप", "कहिले लगाउ", "कहिले छर", "रोप्ने समय", "लगाउने समय", "when to sow", "when to plant", "sowing time"])) return "sowing";
  if (has(t, ["के गर्ने", "के काम", "आजको काम", "अर्को काम", "काम के", "पात्रो", "what to do", "next task", "today"])) return "task";
  return "general";
}

function dateNe(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  const months = ["जनवरी", "फेब्रुअरी", "मार्च", "अप्रिल", "मे", "जुन", "जुलाई", "अगस्ट", "सेप्टेम्बर", "अक्टोबर", "नोभेम्बर", "डिसेम्बर"];
  return `${months[d.getUTCMonth()]} ${ne(d.getUTCDate())}`;
}

function weatherNe(ctx: FarmerChatContext | null): string {
  if (!ctx?.forecast.length) return "तपाईंको खेतको स्थान नभएकाले मौसम भन्न सकिएन। 'मेरो खेत' मा गएर स्थान राख्नुहोस्।";
  const days = ["आज", "भोलि", "पर्सि"];
  const lines = ctx.forecast.map((d, i) => `${days[i] ?? dateNe(d.date)}: ${d.rainMm >= 1 ? `पानी करिब ${ne(d.rainMm)} मिमी` : "पानी नपर्ने"}, तापक्रम ${ne(d.tMin)} देखि ${ne(d.tMax)} डिग्री।`);
  const rainy = ctx.forecast.slice(0, 2).some((d) => d.rainMm >= 10);
  const tip = rainy ? " ठूलो पानी पर्ने भएकाले मल, विषादी र सिँचाइ पर्खनुहोस्।" : "";
  const alert = ctx.alerts[0] ? ` चेतावनी: ${ctx.alerts[0].titleNe}।` : "";
  return lines.join(" ") + tip + alert;
}

function taskNe(ctx: FarmerChatContext | null): string {
  if (!ctx?.crops.length) return "यस मौसमको बाली घोषणा भएको छैन। 'मेरो खेत' मा बाली छान्नुहोस्, अनि कामको पात्रो बन्छ।";
  if (!ctx.nextTasks.length) return "अहिले बाँकी काम छैन। नयाँ बालीका लागि 'मेरो खेत' मा बाली छान्नुहोस्।";
  const today = new Date().toISOString().slice(0, 10);
  const [first, second] = ctx.nextTasks;
  const now = first!.startsOn <= today ? `अहिलेको काम: ${first!.crop}मा ${first!.titleNe} (${dateNe(first!.endsOn)} सम्म)।` : `अर्को काम: ${first!.crop}मा ${first!.titleNe}, ${dateNe(first!.startsOn)} देखि।`;
  const next = second ? ` त्यसपछि: ${second.titleNe}, ${dateNe(second.startsOn)} देखि।` : "";
  return now + next;
}

function subsidyNe(ctx: FarmerChatContext | null): string {
  const s = ctx?.subsidy[0];
  if (!s) return "";
  const status = s.status === "DELIVERED" ? "बुझिसक्नुभयो" : s.allocated > 0 ? "छुट्याइएको छ, कृषि शाखाबाट बुझ्न सक्नुहुन्छ" : "यस पटक परेन";
  return `तपाईंको ${s.scheme}: ${ne(s.allocated)} ${s.unit} ${status}।`;
}

function fertilizerNe(ctx: FarmerChatContext | null, crops: string[]): string {
  const crop = crops[0] ?? ctx?.crops[0]?.code;
  if (!crop) return "";
  const dose = FERTILIZER_DOSE_KG_HA[crop];
  const mine = ctx?.crops.find((c) => c.code === crop);
  if (!dose || !mine?.areaM2) return "";
  const kattha = mine.areaM2 / M2_PER_KATTHA;
  const parts = Object.entries(dose).map(([p, kgHa]) => `${p} ${ne(Math.round(perLocalUnit(kgHa).kattha * kattha))} केजी`);
  return `तपाईंको ${mine.nameNe} खेत (करिब ${ne(Math.round(kattha * 10) / 10)} कट्ठा) का लागि जम्मा: ${parts.join(", ")}।`;
}

function riskNe(ctx: FarmerChatContext | null, crops: string[]): string {
  const r = ctx?.risks.find((x) => !crops.length || crops.some((c) => ctx.crops.find((cc) => cc.code === c)?.nameNe === x.crop)) ?? ctx?.risks[0];
  if (!r) return "";
  return `यो हप्ताको मौसमले ${r.crop}मा ${r.name.ne} को जोखिम ${r.level === "HIGH" ? "उच्च" : "मध्यम"} छ। ${r.prevent[0]?.ne ?? ""}`;
}

function firstSentences(text: string, n: number) {
  const parts = text.split(/(?<=[।.])\s+/);
  return parts.slice(0, n).join(" ");
}

/** Template answer from retrieved passages + the farmer's facts. No network, no key. */
export function answerLocal(question: string, ctx: FarmerChatContext | null, hits: KnowledgeDoc[], intent: Intent): string {
  const crops = cropsMentioned(question);
  const top = hits[0];
  const passage = top ? firstSentences(top.textNe, intent === "disease" ? 6 : 4) : "";
  const greeting = ctx?.name ? `${ctx.name.split(" ")[0]} जी, ` : "";

  switch (intent) {
    case "greeting":
      return `नमस्ते ${ctx?.name ?? ""}! म तपाईंको खेतीको सहयोगी। मौसम, आजको काम, मल, रोग वा अनुदानबारे सोध्नुहोस्।`.replace("  ", " ");
    case "weather":
      return greeting + weatherNe(ctx);
    case "task":
      return greeting + taskNe(ctx);
    case "subsidy":
      return [subsidyNe(ctx), passage].filter(Boolean).join(" ");
    case "fertilizer": {
      const mine = fertilizerNe(ctx, crops);
      // With the farmer's own total, only the "how to split it" sentence is needed from the passage.
      const how = top?.textNe.split(/(?<=[।.])\s+/).find((s) => s.includes("टप ड्रेस")) ?? "";
      return mine ? `${mine} ${how}` : passage;
    }
    case "disease":
      return [riskNe(ctx, crops), top?.kind === "disease" ? `${top.titleNe}: ${passage}` : passage, "लक्षण बढे कृषि प्राविधिकलाई देखाउनुहोस् वा एपबाट फोटो पठाउनुहोस्।"].filter(Boolean).join(" ");
    case "sowing":
      return passage || "यो बालीको पात्रो अहिले छैन। कृषि शाखामा सोध्नुहोस्।";
    default:
      return passage || "माफ गर्नुहोस्, यसबारे मसँग पक्का जानकारी छैन। मौसम, काम, मल, रोग वा अनुदानबारे सोध्नुहोस्, वा कृषि शाखामा सम्पर्क गर्नुहोस्।";
  }
}

// ---- LLM mode (optional) ----

const SYSTEM = `You are "Sajag Kishan Sahayak", a farming helper inside a mobile app for smallholder farmers in Nepal.
The farmer writes or speaks in Nepali (sometimes romanised Nepali or English).

How to answer:
- Reply in very simple, polite Nepali (Devanagari), the way a friendly local agriculture technician talks. Use "तपाईं".
- Keep it short: 2 to 4 sentences. Put the action first. No headings, no lists, no markdown, no emoji.
- Use only the FARMER FACTS and KNOWLEDGE passages you are given. Numbers, dates and doses must come from them.
- Use local units (कट्ठा, रोपनी, केजी) and Devanagari digits.
- If the facts do not answer the question, say so honestly and suggest asking the municipality agriculture section. Never guess a pesticide name or dose.
- For disease or pest questions, give prevention first and say to show a technician if signs spread. Do not diagnose from a description.
- Also return the farmer's question translated to plain English, and an English version of your answer for the officer dashboard.`;

const AnswerSchema = z.object({
  understoodEn: z.string().describe("The farmer's question in plain English"),
  answerNe: z.string().describe("The answer in simple Nepali, 2-4 sentences"),
  answerEn: z.string().describe("The same answer in English"),
});

export function llmConfigured(): boolean {
  return geminiConfigured() || Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

let client: Anthropic | null = null;

async function answerWithClaude(question: string, history: ChatTurn[], ctx: FarmerChatContext | null, hits: KnowledgeDoc[]) {
  client ??= new Anthropic();
  const facts = ctx ? JSON.stringify(ctx) : "Not a farmer account: no farm facts.";
  const knowledge = hits.map((h) => `[${h.id}] ${h.titleNe}\n${h.textNe}\n(${h.textEn})`).join("\n\n") || "No passage matched.";
  const res = await client.messages.parse({
    model: process.env.CHAT_MODEL ?? "claude-opus-5-5",
    max_tokens: 4000,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    output_config: { effort: "low", format: zodOutputFormat(AnswerSchema) },
    messages: [
      ...history.slice(-6).map((t) => ({ role: t.role, content: t.text })),
      {
        role: "user" as const,
        content: `FARMER FACTS (today ${new Date().toISOString().slice(0, 10)}):\n${facts}\n\nKNOWLEDGE:\n${knowledge}\n\nQUESTION:\n${question}`,
      },
    ],
  });
  if (res.stop_reason === "refusal" || !res.parsed_output) throw new Error(`llm_no_answer:${res.stop_reason}`);
  return res.parsed_output;
}

/** Gemini pipeline: Nepali -> English -> grounded English answer -> Nepali. */
async function answerWithGemini(question: string, history: ChatTurn[], ctx: FarmerChatContext | null, hits: KnowledgeDoc[]) {
  const understoodEn = await toEnglish(question);
  const facts = ctx ? JSON.stringify(ctx) : "Not a farmer account: no farm facts.";
  const knowledge = hits.map((h) => `[${h.id}] ${h.titleEn}\n${h.textEn}`).join("\n\n") || "No passage matched.";
  const answerEn = await composeEnglish({ questionEn: understoodEn, history, facts, knowledge });
  const answerNe = await toNepali(answerEn);
  return { understoodEn, answerEn, answerNe };
}

export async function answer(question: string, history: ChatTurn[], ctx: FarmerChatContext | null): Promise<ChatAnswer> {
  const intent = detectIntent(question);
  const crops = [...cropsMentioned(question), ...(ctx?.crops.map((c) => c.code) ?? [])];
  const hitsScored = retrieve(question, { k: 3, crops });
  const hits = hitsScored.map((h) => h.doc);
  const sources = hits.map((h) => ({ id: h.id, titleNe: h.titleNe, titleEn: h.titleEn }));

  if (geminiConfigured()) {
    try {
      const r = await answerWithGemini(question, history, ctx, hits);
      return { ...r, intent, sources, mode: "gemini" };
    } catch (e) {
      console.warn("[chat] Gemini failed, falling back:", e instanceof Error ? e.message : e);
    }
  }

  if (llmConfigured()) {
    try {
      const r = await answerWithClaude(question, history, ctx, hits);
      return { ...r, intent, sources, mode: "llm" };
    } catch (e) {
      console.warn("[chat] LLM failed, using local answer:", e instanceof Error ? e.message : e);
    }
  }

  const answerNe = ne(answerLocal(question, ctx, hits, intent)).replace(/\b(Urea|DAP|MOP)\b/g, (p) => ({ Urea: "युरिया", DAP: "डीएपी", MOP: "पोटास" })[p]!);
  const answerEn = hits[0] && ["general", "sowing", "disease", "fertilizer", "subsidy"].includes(intent) ? firstSentences(hits[0].textEn, 3) : `(${intent}) answered from the farmer's own data`;
  return { answerNe, answerEn, understoodEn: roughEnglish(question) || question, intent, sources, mode: "local" };
}
