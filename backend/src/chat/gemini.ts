const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export function geminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

/**
 * Models tried in order. GEMINI_MODEL goes first; if it fails (retired, overloaded, timed out) the next one is
 * used silently, so farmers and officers never see the switch. Override the backups with GEMINI_FALLBACK_MODELS (comma separated).
 */
// Fastest first (flash-lite answers in ~1-7 s; the larger flash models take 10-20 s).
const DEFAULT_FALLBACKS = ["gemini-3.1-flash-lite", "gemini-3.6-flash", "gemini-3.5-flash"];

function modelChain(): string[] {
  const backups = process.env.GEMINI_FALLBACK_MODELS?.split(",").map((m) => m.trim()).filter(Boolean) ?? DEFAULT_FALLBACKS;
  return [...new Set([process.env.GEMINI_MODEL?.trim() || backups[0]!, ...backups])];
}

/** Models to skip until a time: retired ones (404) for hours, busy ones (429/5xx/timeout) for a minute. */
const skipUntil = new Map<string, number>();
const RETIRED_SKIP_MS = 6 * 60 * 60_000;
const BUSY_SKIP_MS = 60_000;

class GeminiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
  }
}

type Part = { text: string } | { inline_data: { mime_type: string; data: string } };
type GenOpts = { system?: string; json?: boolean; temperature?: number };

async function generateWith(model: string, parts: Part[], opts: GenOpts): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY ?? "" },
      body: JSON.stringify({
        ...(opts.system ? { system_instruction: { parts: [{ text: opts.system }] } } : {}),
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: opts.temperature ?? 0.2,
          ...(opts.json ? { responseMimeType: "application/json" } : {}),
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
      signal: AbortSignal.timeout(25_000),
    });
  } catch (e) {
    throw new GeminiError(`gemini_network: ${e instanceof Error ? e.message : e}`, null);
  }
  if (!res.ok) throw new GeminiError(`gemini_http_${res.status}: ${(await res.text()).slice(0, 200)}`, res.status);
  const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
  if (!text) throw new Error("gemini_empty"); // a real answer of "nothing" (e.g. silent audio): not a reason to switch models
  return text;
}

async function generate(parts: Part[], opts: GenOpts = {}): Promise<string> {
  const now = Date.now();
  const chain = modelChain();
  const ready = chain.filter((m) => (skipUntil.get(m) ?? 0) <= now);
  let lastError: unknown = null;
  for (const model of ready.length ? ready : chain) {
    try {
      const text = await generateWith(model, parts, opts);
      skipUntil.delete(model);
      return text;
    } catch (e) {
      if (!(e instanceof GeminiError)) throw e;
      // A bad or blocked key fails the same way on every model: stop here.
      if (e.status === 401 || e.status === 403) throw e;
      lastError = e;
      skipUntil.set(model, Date.now() + (e.status === 404 ? RETIRED_SKIP_MS : BUSY_SKIP_MS));
      console.warn(`[gemini] ${model} failed (${e.status ?? "network"}), trying the next model`);
    }
  }
  throw lastError ?? new Error("gemini_no_model");
}

export function geminiJson(system: string, text: string): Promise<string> {
  return generate([{ text }], { system, json: true, temperature: 0.2 });
}

export async function transcribeNepali(audio: Buffer, mimeType: string): Promise<string> {
  const text = await generate(
    [
      { inline_data: { mime_type: mimeType, data: audio.toString("base64") } },
      { text: "Transcribe this speech exactly as spoken. The speaker is a Nepali farmer; the language is Nepali (it may include a few English or Hindi words). Write it in Devanagari. Output only the transcript, nothing else. If there is no intelligible speech, output an empty string." },
    ],
    { temperature: 0 },
  );
  return text.replace(/^["'`]+|["'`]+$/g, "").trim();
}

export function toEnglish(question: string): Promise<string> {
  return generate([{ text: question }], {
    system: "Translate the farmer's message from Nepali (it may be romanised Nepali or mixed with English) into plain, natural English. Keep crop, pesticide and place names. Output only the translation.",
    temperature: 0,
  });
}

export function toNepali(answerEn: string): Promise<string> {
  return generate([{ text: answerEn }], {
    system:
      "Translate into very simple, polite Nepali in Devanagari, the way a friendly local agriculture technician talks to a farmer. Use 'तपाईं'. Use Devanagari digits and local units (कट्ठा, रोपनी, केजी) where the text uses area or weight units. Keep numbers, dates and doses exactly. Write fertilizer names as युरिया, डीएपी, पोटास. No markdown, no emoji. Output only the Nepali text.",
    temperature: 0.1,
  });
}

export function composeEnglish(input: { questionEn: string; history: { role: "user" | "assistant"; text: string }[]; facts: string; knowledge: string }): Promise<string> {
  const system = `You are "Krishi Dristi Sahayak", a farming helper for smallholder farmers in Nepal.
- Answer in 2 to 4 short, simple English sentences. Put the action first. No headings, lists, markdown or emoji.
- Use ONLY the FARMER FACTS and KNOWLEDGE given. Numbers, dates and doses must come from them.
- FARMER FACTS describe only the farmer who is asking. Never talk about any other farmer, even if asked.
- Before suggesting any field work, check alertSummary, alerts and advisories. If an active alert or advisory affects the work or the farmer's crops, say it first.
- Land area: answer in the unit the farmer used (bigha/kattha/dhur or ropani/aana). Otherwise use land.totalEn.
- What to plant: choose only from plantOptions. Prefer status "open", skip soilFit "poor", and say how much land is free.
- Fertilizer: subtract inputsApplied from the recommended dose.
- If they do not answer the question, say so honestly and suggest asking the municipality agriculture office. Never guess a pesticide name or dose.
- For disease or pest questions, give prevention first and say to show a technician if signs spread. Do not diagnose from a description.`;
  const hist = input.history
    .slice(-6)
    .map((t) => `${t.role === "user" ? "Farmer" : "Helper"}: ${t.text}`)
    .join("\n");
  return generate(
    [{ text: `FARMER FACTS (today ${new Date().toISOString().slice(0, 10)}):\n${input.facts}\n\nKNOWLEDGE:\n${input.knowledge}\n\n${hist ? `RECENT CONVERSATION:\n${hist}\n\n` : ""}QUESTION (English):\n${input.questionEn}` }],
    { system, temperature: 0.2 },
  );
}
