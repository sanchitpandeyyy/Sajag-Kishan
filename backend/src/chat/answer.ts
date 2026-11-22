import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { compactJson, factsFor, type FarmerChatContext } from "./context";
import { areaNe, smallUnit, unitSystemAsked } from "./facts";
import { perLocalUnit, retrieve, type KnowledgeDoc } from "./knowledge";
import { cropsMentioned, normalize, roughEnglish } from "./lexicon";
import { FERTILIZER_DOSE_KG_HA } from "../engine";
import { composeEnglish, geminiConfigured, toEnglish, toNepali } from "./gemini";

export type Intent = "weather" | "task" | "subsidy" | "disease" | "fertilizer" | "sowing" | "plant" | "land" | "greeting" | "general";

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

function has(text: string, words: string[]) {
  return words.some((w) => text.includes(w));
}

export function detectIntent(q: string): Intent {
  const t = normalize(q);
  if (/^(नमस्ते|नमस्कार|hello|hi|namaste)\b/.test(t) && t.length < 25) return "greeting";
  if (has(t, ["अनुदान", "सहुलियत", "subsidy", "पाउने मल", "मल पाउ", "मल कहिले आउ"])) return "subsidy";
  if (has(t, ["कति मल", "मल कति", "युरिया कति", "dap कति", "how much fertilizer", "fertilizer dose", "मात्रा"])) return "fertilizer";
  if (has(t, ["रोग", "कीरा", "किरा", "लाही", "डढुवा", "मरुवा", "सिन्दूरे", "फौजी", "पहेँलो", "पहेलो", "दाग", "ओइल", "कुहि", "disease", "pest", "insect", "blight"])) return "disease";
  if (has(t, ["के लगाउ", "के रोप", "के छर", "कुन बाली", "के खेती", "के बाली", "what to plant", "what to grow", "what crop", "which crop"])) return "plant";
  if (has(t, ["कति जग्गा", "जग्गा कति", "कति बिघा", "बिघा कति", "कति कट्ठा", "कट्ठा कति", "कति रोपनी", "रोपनी कति", "कति धुर", "कति आना", "मेरो जग्गा", "how much land", "how many bigha", "how many ropani", "how many kattha"])) return "land";
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
  const active = ctx.alerts.find((a) => a.active);
  const alert = active ? ` चेतावनी: ${active.titleNe}।` : "";
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
  if (!crop || !ctx) return "";
  const dose = FERTILIZER_DOSE_KG_HA[crop];
  const mine = ctx.crops.find((c) => c.code === crop);
  if (!dose || !mine?.areaM2) return "";
  const unit = smallUnit(ctx.land.system);
  const units = mine.areaM2 / unit.m2;
  const parts = Object.entries(dose).map(([p, kgHa]) => `${p} ${ne(Math.round(perLocalUnit(kgHa)[unit.unit] * units))} केजी`);
  const used = ctx.inputsApplied.filter((x) => x.crop === mine.nameNe);
  const usedNe = used.length ? ` तपाईंले यसअघि ${used.map((x) => `${x.product} ${ne(Math.round(x.kg))} केजी`).join(", ")} हाल्नुभएको छ, त्यो घटाएर बाँकी मात्र हाल्नुहोस्।` : "";
  return `तपाईंको ${mine.nameNe} खेत (करिब ${ne(Math.round(units * 10) / 10)} ${unit.ne}) का लागि जम्मा: ${parts.join(", ")}।${usedNe}`;
}

function alertHint(ctx: FarmerChatContext | null): string {
  if (!ctx) return "";
  const a = ctx.alerts.find((x) => x.active && (x.severity === "SEVERE" || ctx.alertSummary.forMyCrops.includes(x.titleNe))) ?? ctx.alerts.find((x) => x.active);
  return a ? ` ध्यान दिनुहोस्, तपाईंको क्षेत्रमा चेतावनी छ: ${a.titleNe}।` : "";
}

function landNe(ctx: FarmerChatContext | null, question: string): string {
  if (!ctx?.land.totalM2) return "तपाईंको जग्गाको विवरण दर्ता भएको छैन। 'मेरो खेत' मा खेत थप्नुहोस्।";
  const sys = unitSystemAsked(question) ?? ctx.land.system;
  const parcels = ctx.land.parcels.length > 1 ? ` (${ctx.land.parcels.map((p) => `${p.name}: ${areaNe(p.areaM2, sys)}`).join(", ")})` : "";
  const grow = ctx.crops.length ? ` यस मौसम ${ctx.crops.map((c) => `${c.nameNe} ${areaNe(c.areaM2, sys)}`).join(", ")} मा लगाउनुभएको छ।` : "";
  const fallow = ctx.land.fallowM2 ? ` ${areaNe(ctx.land.fallowM2, sys)} बाँझो छ।` : "";
  return `तपाईंको जम्मा जग्गा ${areaNe(ctx.land.totalM2, sys)} छ${parcels}।${grow}${fallow}`;
}

function plantNe(ctx: FarmerChatContext | null, question: string): string {
  if (!ctx) return "";
  if (!ctx.zone) return "खेतको स्थान नभएकाले के लगाउने भन्न सकिएन। 'मेरो खेत' मा स्थान राख्नुहोस्।";
  const options = ctx.plantOptions.filter((o) => !o.alreadyGrowing && o.soilFit !== "poor");
  const sys = unitSystemAsked(question) ?? ctx.land.system;
  const free = ctx.land.totalM2 - ctx.land.cultivatedM2;
  const land = ctx.land.totalM2
    ? `तपाईंसँग ${areaNe(ctx.land.totalM2, sys)} जग्गा छ${ctx.crops.length && free > 50 ? `, जसमध्ये करिब ${areaNe(free, sys)} खाली छ` : ""}। `
    : "";
  if (!options.length) return `${land}अहिले तपाईंको क्षेत्रमा रोप्ने समय भएको अर्को बाली मसँग छैन। कृषि शाखामा सोध्नुहोस्।`;
  const list = options
    .slice(0, 3)
    .map((o) => (o.status === "open" ? `${o.nameNe} (${dateNe(o.windowEnd)} सम्म रोप्न सकिन्छ)` : `${o.nameNe} (${dateNe(o.windowStart)} देखि रोप्ने)`))
    .join(", ");
  return `${land}${ctx.zoneNe ?? ""} क्षेत्रमा यो समयका लागि उपयुक्त बाली: ${list}।${alertHint(ctx)}`;
}

function sowingNe(ctx: FarmerChatContext | null, crops: string[]): string {
  const o = ctx?.plantOptions.find((x) => crops.includes(x.crop));
  if (!o) return "";
  return o.status === "open" ? `${o.nameNe} रोप्ने समय अहिले नै हो, ${dateNe(o.windowEnd)} सम्म।` : `${o.nameNe} ${dateNe(o.windowStart)} देखि ${dateNe(o.windowEnd)} सम्म रोप्नुहोस्।`;
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
      return greeting + taskNe(ctx) + alertHint(ctx);
    case "land":
      return greeting + landNe(ctx, question);
    case "plant":
      return greeting + plantNe(ctx, question);
    case "subsidy":
      return [subsidyNe(ctx), passage].filter(Boolean).join(" ");
    case "fertilizer": {
      const mine = fertilizerNe(ctx, crops);
      const how = top?.textNe.split(/(?<=[।.])\s+/).find((s) => s.includes("टप ड्रेस")) ?? "";
      return mine ? `${mine} ${how}${alertHint(ctx)}` : passage;
    }
    case "disease":
      return [riskNe(ctx, crops), top?.kind === "disease" ? `${top.titleNe}: ${passage}` : passage, "लक्षण बढे कृषि प्राविधिकलाई देखाउनुहोस् वा एपबाट फोटो पठाउनुहोस्।"].filter(Boolean).join(" ");
    case "sowing":
      return sowingNe(ctx, crops) || passage || "यो बालीको पात्रो अहिले छैन। कृषि शाखामा सोध्नुहोस्।";
    default:
      return passage || "माफ गर्नुहोस्, यसबारे मसँग पक्का जानकारी छैन। मौसम, काम, मल, रोग वा अनुदानबारे सोध्नुहोस्, वा कृषि शाखामा सम्पर्क गर्नुहोस्।";
  }
}

const SYSTEM = `You are "Sajag Kishan Sahayak", a farming helper inside a mobile app for smallholder farmers in Nepal.
The farmer writes or speaks in Nepali (sometimes romanised Nepali or English).

How to answer:
- Reply in very simple, polite Nepali (Devanagari), the way a friendly local agriculture technician talks. Use "तपाईं".
- Keep it short: 2 to 4 sentences. Put the action first. No headings, no lists, no markdown, no emoji.
- Use only the FARMER FACTS and KNOWLEDGE passages you are given. Numbers, dates and doses must come from them.
- FARMER FACTS describe only the farmer who is asking. Never talk about any other farmer, even if asked.
- Before suggesting any field work, check alertSummary, alerts and advisories. If an active alert or advisory affects the work or the farmer's crops, say it first.
- Land area: answer in the unit the farmer used. Otherwise use land.totalNe (बिघा/कट्ठा in the Terai, रोपनी/आना in the hills).
- What to plant: choose only from plantOptions. Prefer status "open", skip soilFit "poor", and say how much land is free.
- Fertilizer: subtract inputsApplied from the recommended dose.
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

async function answerWithClaude(question: string, history: ChatTurn[], ctx: FarmerChatContext | null, hits: KnowledgeDoc[], intent: Intent) {
  client ??= new Anthropic();
  const facts = ctx ? compactJson(factsFor(intent, ctx)) : "Not a farmer account: no farm facts.";
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

async function answerWithGemini(question: string, history: ChatTurn[], ctx: FarmerChatContext | null, hits: KnowledgeDoc[], intent: Intent) {
  const understoodEn = await toEnglish(question);
  const facts = ctx ? compactJson(factsFor(intent, ctx)) : "Not a farmer account: no farm facts.";
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
      const r = await answerWithGemini(question, history, ctx, hits, intent);
      return { ...r, intent, sources, mode: "gemini" };
    } catch (e) {
      console.warn("[chat] Gemini failed, falling back:", e instanceof Error ? e.message : e);
    }
  }

  if (llmConfigured()) {
    try {
      const r = await answerWithClaude(question, history, ctx, hits, intent);
      return { ...r, intent, sources, mode: "llm" };
    } catch (e) {
      console.warn("[chat] LLM failed, using local answer:", e instanceof Error ? e.message : e);
    }
  }

  const answerNe = ne(answerLocal(question, ctx, hits, intent)).replace(/\b(Urea|DAP|MOP)\b/g, (p) => ({ Urea: "युरिया", DAP: "डीएपी", MOP: "पोटास" })[p]!);
  const answerEn = hits[0] && ["general", "sowing", "disease", "fertilizer", "subsidy"].includes(intent) ? firstSentences(hits[0].textEn, 3) : `(${intent}) answered from the farmer's own data`;
  return { answerNe, answerEn, understoodEn: roughEnglish(question) || question, intent, sources, mode: "local" };
}
