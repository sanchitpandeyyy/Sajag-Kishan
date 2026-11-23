import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { AuthUser } from "../types";
import { geminiConfigured, geminiJson } from "./gemini";
import { officerFacts, type OfficerFacts } from "./officer-facts";

const DIGITS = "०१२३४५६७८९";
const ne = (n: number | string) => String(n).replace(/[0-9]/g, (d) => DIGITS[Number(d)]!);

export const ALERT_LABEL: Record<string, [string, string]> = {
  LATE_BLIGHT: ["डढुवा", "late blight"],
  RICE_BLAST: ["मरुवा", "rice blast"],
  BACTERIAL_LEAF_BLIGHT: ["पात डढुवा", "bacterial leaf blight"],
  YELLOW_RUST: ["पहेँलो सिन्दूरे", "yellow rust"],
  FALL_ARMYWORM: ["फौजी कीरा", "fall armyworm"],
  MUSTARD_APHID: ["तोरीको लाही", "mustard aphid"],
  HEAVY_RAIN: ["भारी वर्षा", "heavy rain"],
  FLOOD_RISK: ["बाढी जोखिम", "flood risk"],
  FROST: ["तुसारो", "frost"],
  HEAT: ["गर्मी", "heat"],
  DRY_SPELL: ["खडेरी", "dry spell"],
  STRONG_WIND: ["हुरी", "strong wind"],
};
const alertNe = (t: string) => ALERT_LABEL[t]?.[0] ?? t;
const alertEn = (t: string) => ALERT_LABEL[t]?.[1] ?? t.toLowerCase().replace(/_/g, " ");
const wardEn = (w: string) => w.replace("वडा", "ward").replace(/[०-९]/g, (d) => String(DIGITS.indexOf(d)));

export interface OfficerAnswer {
  answerNe: string;
  answerEn: string;
  understoodEn: string;
  intent: string;
  sources: { id: string; titleNe: string; titleEn: string }[];
  mode: "llm" | "gemini" | "local";
  period: { ne: string; en: string };
}

const ANSWER_SYSTEM = `You are the data assistant inside "Krishi Dristi", a dashboard for municipal agriculture officers in Nepal.
- Answer the officer's question using ONLY the DATA given. It is already limited to the officer's own wards and period.
- Give exact numbers, ward names and dates from DATA. Never estimate or invent numbers. If DATA does not contain the answer, say what is missing.
- Keep it short: 2 to 5 sentences. Lead with the direct answer, then one practical note for the officer if the data supports it.
- No markdown, headings or emoji. Plain sentences.
- Return answerNe (simple formal Nepali, Devanagari digits) and answerEn (English), with the same content.`;

const SUMMARY_SYSTEM = `You write the briefing at the top of a municipal agriculture officer's dashboard in Nepal ("Krishi Dristi").
- Use ONLY the DATA given (the officer's own wards, last 30 days unless stated). Never invent numbers.
- headline: one sentence on the most important thing right now.
- points: 3 to 5 short findings that explain what the numbers mean (trends, wards that stand out, gaps such as unverified parcels, undelivered subsidy, unread alerts, fallow land).
- actions: 2 or 3 concrete next steps the officer can take in this app (send an advisory to a ward, verify parcels, follow up deliveries, check a disease).
- If a section has no data, do not mention it. Plain sentences, no markdown.
- Give every text in Nepali (ne, Devanagari digits) and English (en).`;

const AnswerSchema = z.object({ answerNe: z.string(), answerEn: z.string() });
const Bi = z.object({ ne: z.string(), en: z.string() });
const SummarySchema = z.object({ headline: Bi, points: z.array(Bi).max(6), actions: z.array(Bi).max(4) });
export type OfficerSummary = z.infer<typeof SummarySchema> & { mode: "llm" | "gemini" | "local"; generatedAt: string; period: { ne: string; en: string } };

export function compactFacts(f: OfficerFacts): string {
  return JSON.stringify(f, (_, v) => (v === null || (Array.isArray(v) && v.length === 0) ? undefined : v));
}

let client: Anthropic | null = null;
const claudeConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

async function llmJson<T extends z.ZodTypeAny>(system: string, prompt: string, schema: T): Promise<{ data: z.infer<T>; mode: "gemini" | "llm" } | null> {
  if (geminiConfigured()) {
    try {
      const raw = await geminiJson(`${system}\nRespond with JSON only.`, prompt);
      return { data: schema.parse(JSON.parse(raw)), mode: "gemini" };
    } catch (e) {
      console.warn("[officer-chat] Gemini failed:", e instanceof Error ? e.message : e);
    }
  }
  if (claudeConfigured()) {
    try {
      client ??= new Anthropic();
      const res = await client.messages.parse({
        model: process.env.CHAT_MODEL ?? "claude-opus-5-5",
        max_tokens: 4000,
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        output_config: { effort: "low", format: zodOutputFormat(schema) },
        messages: [{ role: "user", content: prompt }],
      });
      if (res.parsed_output) return { data: res.parsed_output as z.infer<T>, mode: "llm" };
    } catch (e) {
      console.warn("[officer-chat] LLM failed:", e instanceof Error ? e.message : e);
    }
  }
  return null;
}

export async function answerOfficer(user: AuthUser, question: string, history: { role: "user" | "assistant"; text: string }[] = []): Promise<OfficerAnswer> {
  const facts = await officerFacts(user, question);
  const intent = facts.topics.length > 3 ? "overview" : facts.topics.join("+");
  const sources = facts.topics.map((t) => ({ id: `data.${t}`, titleNe: TOPIC_NE[t] ?? t, titleEn: t }));
  const hist = history
    .slice(-4)
    .map((t) => `${t.role === "user" ? "Officer" : "Assistant"}: ${t.text}`)
    .join("\n");
  const prompt = `DATA (today ${new Date().toISOString().slice(0, 10)}):\n${compactFacts(facts)}\n\n${hist ? `RECENT CONVERSATION:\n${hist}\n\n` : ""}QUESTION:\n${question}`;
  const ai = await llmJson(ANSWER_SYSTEM, prompt, AnswerSchema);
  if (ai) return { ...ai.data, understoodEn: question, intent, sources, mode: ai.mode, period: facts.period };
  const local = localAnswer(facts);
  return { answerNe: ne(local.ne), answerEn: local.en, understoodEn: question, intent, sources, mode: "local", period: facts.period };
}

const TOPIC_NE: Record<string, string> = {
  alerts: "चेतावनी",
  advisories: "सूचना",
  crops: "बाली",
  land: "जग्गा",
  farmers: "किसान",
  subsidy: "अनुदान",
  questions: "किसानका प्रश्न",
};

export function localAnswer(f: OfficerFacts): { ne: string; en: string } {
  const outNe: string[] = [];
  const outEn: string[] = [];
  const p = f.period;
  if (f.alerts) {
    const a = f.alerts;
    if (!a.total) {
      outNe.push(`${p.ne} कुनै चेतावनी जारी भएन।`);
      outEn.push(`No alerts were issued ${p.en}.`);
    } else {
      const wards = a.byWard.slice(0, 5);
      outNe.push(`${p.ne} ${a.total} चेतावनी (${a.severe} गम्भीर): ${wards.map((w) => `${w.ward} ${alertNe(w.type)} ${w.count}`).join(", ")}।`);
      outEn.push(`${a.total} alerts ${p.en} (${a.severe} severe): ${wards.map((w) => `${wardEn(w.ward)} ${alertEn(w.type)} ${w.count}`).join(", ")}.`);
      if (a.reach.farmers) {
        outNe.push(`${a.reach.farmers} किसानमध्ये ${a.reach.pushed} लाई फोनमा पुग्यो, ${a.reach.read} ले पढे।`);
        outEn.push(`Of ${a.reach.farmers} farmers, ${a.reach.pushed} were reached by push and ${a.reach.read} read it.`);
      }
    }
  }
  if (f.advisories) {
    outNe.push(`${p.ne} ${f.advisories.total} सूचना प्रकाशित।`);
    outEn.push(`${f.advisories.total} advisories published ${p.en}.`);
  }
  if (f.crops) {
    const top = f.crops.byCrop.slice(0, 4);
    if (top.length) {
      outNe.push(`यस मौसम: ${top.map((c) => `${c.crop} ${c.areaHa} हेक्टर (${c.farmers} किसान)`).join(", ")}।`);
      outEn.push(`This season: ${top.map((c) => `${c.crop} ${c.areaHa} ha (${c.farmers} farmers)`).join(", ")}.`);
    } else {
      outNe.push("यस मौसमको बाली घोषणा भएको छैन।");
      outEn.push("No crops declared this season yet.");
    }
  }
  if (f.land) {
    const worst = f.land.byWard.filter((w) => w.fallowHa > 0).slice(0, 3);
    outNe.push(`जम्मा ${f.land.parcels} कित्ता, ${f.land.areaHa} हेक्टर; बाँझो ${f.land.fallowHa} हेक्टर${worst.length ? ` (${worst.map((w) => `${w.ward} ${w.fallowHa}`).join(", ")})` : ""}।`);
    outEn.push(`${f.land.parcels} parcels, ${f.land.areaHa} ha in total; ${f.land.fallowHa} ha fallow${worst.length ? ` (${worst.map((w) => `${wardEn(w.ward)} ${w.fallowHa}`).join(", ")})` : ""}.`);
  }
  if (f.farmers) {
    const x = f.farmers;
    outNe.push(`${x.total} किसान दर्ता; ${x.parcelsVerified} कित्ता प्रमाणित, ${x.parcelsUnverified} बाँकी, ${x.parcelsDisputed} विवादित।`);
    outEn.push(`${x.total} farmers registered; ${x.parcelsVerified} parcels verified, ${x.parcelsUnverified} pending, ${x.parcelsDisputed} disputed.`);
  }
  if (f.subsidy) {
    const s = f.subsidy.schemes.slice(0, 3);
    if (s.length) {
      outNe.push(`अनुदान: ${s.map((x) => `${x.scheme} ${x.allocated} ${x.unit} छुट्याइयो, ${x.delivered} वितरण`).join("; ")}।`);
      outEn.push(`Subsidy: ${s.map((x) => `${x.scheme} ${x.allocated} ${x.unit} allocated, ${x.delivered} delivered`).join("; ")}.`);
    }
  }
  if (f.questions) {
    const top = f.questions.byIntent.slice(0, 3);
    outNe.push(`${p.ne} किसानले ${f.questions.total} प्रश्न सोधे${top.length ? ` (धेरै: ${top.map((t) => `${t.intent} ${t.count}`).join(", ")})` : ""}।`);
    outEn.push(`Farmers asked ${f.questions.total} questions ${p.en}${top.length ? ` (most: ${top.map((t) => `${t.intent} ${t.count}`).join(", ")})` : ""}.`);
  }
  return { ne: outNe.join(" "), en: outEn.join(" ") };
}

export function localSummary(f: OfficerFacts): Omit<OfficerSummary, "mode" | "generatedAt" | "period"> {
  const points: { ne: string; en: string }[] = [];
  const actions: { ne: string; en: string }[] = [];
  const a = f.alerts;
  if (a?.total) {
    const top = a.byType[0]!;
    const ward = a.byWard.find((w) => w.type === top.type);
    points.push({
      ne: `पछिल्लो ३० दिनमा ${ne(a.total)} चेतावनी, सबैभन्दा धेरै ${alertNe(top.type)} (${ne(top.count)})${ward ? `, विशेष गरी ${ward.ward}` : ""}।`,
      en: `${a.total} alerts in the last 30 days, mostly ${alertEn(top.type)} (${top.count})${ward ? `, especially ${wardEn(ward.ward)}` : ""}.`,
    });
    if (a.reach.farmers && a.reach.read < a.reach.farmers / 2) {
      points.push({ ne: `चेतावनी पाएका ${ne(a.reach.farmers)} किसानमध्ये ${ne(a.reach.read)} ले मात्र पढे।`, en: `Only ${a.reach.read} of ${a.reach.farmers} farmers who got alerts have read them.` });
      actions.push({ ne: "चेतावनी नपढ्ने वडामा वडा कार्यालयमार्फत खबर गर्नुहोस्।", en: "Follow up through ward offices where alerts go unread." });
    }
    if (ward) actions.push({ ne: `${ward.ward} का लागि ${alertNe(top.type)} रोकथामको सूचना पठाउनुहोस्।`, en: `Send an advisory on preventing ${alertEn(top.type)} to ${wardEn(ward.ward)}.` });
  }
  if (f.farmers?.parcelsUnverified) {
    points.push({ ne: `${ne(f.farmers.parcelsUnverified)} कित्ता प्रमाणित हुन बाँकी।`, en: `${f.farmers.parcelsUnverified} parcels are still unverified.` });
    actions.push({ ne: "नक्सा पृष्ठबाट बाँकी कित्ता प्रमाणित गर्नुहोस्।", en: "Verify pending parcels from the map page." });
  }
  if (f.land?.fallowHa) points.push({ ne: `यस मौसम ${ne(f.land.fallowHa)} हेक्टर बाँझो छ।`, en: `${f.land.fallowHa} ha is fallow this season.` });
  const undelivered = f.subsidy?.schemes.filter((s) => s.allocated > s.delivered) ?? [];
  if (undelivered.length) {
    const s = undelivered[0]!;
    points.push({ ne: `${s.scheme}: ${ne(s.allocated)} मध्ये ${ne(s.delivered)} ${s.unit} मात्र वितरण।`, en: `${s.scheme}: only ${s.delivered} of ${s.allocated} ${s.unit} delivered.` });
    actions.push({ ne: "अनुदान पृष्ठमा बाँकी वितरण फलोअप गर्नुहोस्।", en: "Follow up pending deliveries on the subsidy page." });
  }
  if (f.crops?.byCrop[0]) {
    const c = f.crops.byCrop[0];
    points.push({ ne: `यस मौसम मुख्य बाली ${c.crop} (${ne(c.areaHa)} हेक्टर, ${ne(c.farmers)} किसान)।`, en: `Main crop this season: ${c.crop} (${c.areaHa} ha, ${c.farmers} farmers).` });
  }
  const headline = points[0] ?? { ne: "पछिल्लो ३० दिनमा उल्लेखनीय गतिविधि छैन।", en: "No notable activity in the last 30 days." };
  return { headline, points: points.slice(1, 6), actions: actions.slice(0, 3) };
}

const SUMMARY_TTL_MS = 30 * 60_000;
const summaryCache = new Map<string, { at: number; value: OfficerSummary }>();

export async function officerSummary(user: AuthUser, opts: { fresh?: boolean } = {}): Promise<OfficerSummary> {
  const key = `${user.role}:${user.id}`;
  const hit = summaryCache.get(key);
  if (!opts.fresh && hit && Date.now() - hit.at < SUMMARY_TTL_MS) return hit.value;
  const facts = await officerFacts(user, "", { topics: ["alerts", "advisories", "crops", "land", "farmers", "subsidy", "questions"] });
  const ai = await llmJson(SUMMARY_SYSTEM, `DATA (today ${new Date().toISOString().slice(0, 10)}):\n${compactFacts(facts)}`, SummarySchema);
  const value: OfficerSummary = {
    ...(ai ? ai.data : localSummary(facts)),
    mode: ai ? ai.mode : "local",
    generatedAt: new Date().toISOString(),
    period: { ne: facts.period.ne, en: facts.period.en },
  };
  summaryCache.set(key, { at: Date.now(), value });
  return value;
}
