/** DeepSeek chat API (OpenAI-compatible). Main model for text; Gemini is the fallback and handles voice. */
const URL = "https://api.deepseek.com/chat/completions";

export function deepseekConfigured(): boolean {
  return Boolean(process.env.DEEPSEEK_API_KEY);
}

export async function deepseekGenerate(prompt: string, opts: { system?: string; json?: boolean; temperature?: number } = {}): Promise<string> {
  const res = await fetch(URL, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.DEEPSEEK_API_KEY ?? ""}` },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL?.trim() || "deepseek-chat",
      messages: [...(opts.system ? [{ role: "system", content: opts.system }] : []), { role: "user", content: prompt }],
      temperature: opts.temperature ?? 0.2,
      // JSON mode needs the word "json" somewhere in the prompt; callers that ask for JSON already say so.
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      stream: false,
    }),
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new Error(`deepseek_http_${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("deepseek_empty");
  return text;
}
