/**
 * Gemini client (REST, no SDK). Used for:
 *   - transcribeNepali: audio -> Nepali text (voice input in the app)
 *   - toEnglish / toNepali: translation steps of the chat pipeline
 *   - composeEnglish: the grounded answer, written in English
 * Set GEMINI_API_KEY (and optionally GEMINI_MODEL) in backend/.env.
 */
const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export function geminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

const model = () => process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

type Part = { text: string } | { inline_data: { mime_type: string; data: string } };

async function generate(parts: Part[], opts: { system?: string; json?: boolean; temperature?: number } = {}): Promise<string> {
  const res = await fetch(`${BASE}/${model()}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY ?? "" },
    body: JSON.stringify({
      ...(opts.system ? { system_instruction: { parts: [{ text: opts.system }] } } : {}),
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature: opts.temperature ?? 0.2,
        ...(opts.json ? { responseMimeType: "application/json" } : {}),
        // Translation and short answers need no hidden reasoning; this keeps latency low.
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`gemini_http_${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
  if (!text) throw new Error("gemini_empty");
  return text;
}

export function geminiJson(system: string, text: string): Promise<string> {
  return generate([{ text }], { system, json: true, temperature: 0.2 });
}

/** Speech to Nepali text. Returns "" when nothing intelligible was said. */
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

/** Nepali (or romanised Nepali / mixed) question -> plain English. */
export function toEnglish(question: string): Promise<string> {
  return generate([{ text: question }], {
    system: "Translate the farmer's message from Nepali (it may be romanised Nepali or mixed with English) into plain, natural English. Keep crop, pesticide and place names. Output only the translation.",
    temperature: 0,
  });
}

/** English answer -> simple spoken Nepali (Devanagari). */
export function toNepali(answerEn: string): Promise<string> {
  return generate([{ text: answerEn }], {
    system:
      "Translate into very simple, polite Nepali in Devanagari, the way a friendly local agriculture technician talks to a farmer. Use 'तपाईं'. Use Devanagari digits and local units (कट्ठा, रोपनी, केजी) where the text uses area or weight units. Keep numbers, dates and doses exactly. Write fertilizer names as युरिया, डीएपी, पोटास. No markdown, no emoji. Output only the Nepali text.",
    temperature: 0.1,
  });
}

/** Grounded English answer. Only the supplied facts and knowledge may be used. */
export function composeEnglish(input: { questionEn: string; history: { role: "user" | "assistant"; text: string }[]; facts: string; knowledge: string }): Promise<string> {
  const system = `You are "Sajag Kishan Sahayak", a farming helper for smallholder farmers in Nepal.
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
