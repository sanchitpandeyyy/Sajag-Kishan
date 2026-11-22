"use client";

import { Bot, Send, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AiSummary } from "@/components/ai-summary";
import { Card, inputClass, PrimaryButton, Shell } from "@/components/shell";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { useApi } from "@/lib/use-api";

interface Answer {
  answerNe: string;
  answerEn: string;
  intent: string;
  mode: string;
  period?: { ne: string; en: string };
}
interface Turn {
  role: "user" | "assistant";
  text: string;
  answer?: Answer;
}

export default function AssistantPage() {
  const { tr, lang } = useLang();
  const suggestions = useApi<{ suggestions: { ne: string; en: string }[] }>("/v1/chat/suggestions");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth", block: "end" }), [turns, busy]);

  async function ask(q: string) {
    const message = q.trim();
    if (!message || busy) return;
    setInput("");
    setError(null);
    const history = turns.slice(-6).map((t) => ({ role: t.role, text: t.text.slice(0, 1500) }));
    setTurns((t) => [...t, { role: "user", text: message }]);
    setBusy(true);
    try {
      const a = await api<Answer>("/v1/chat", { method: "POST", body: JSON.stringify({ message, history }) });
      setTurns((t) => [...t, { role: "assistant", text: lang === "ne" ? a.answerNe : a.answerEn, answer: a }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : tr("उत्तर आउन सकेन", "Could not get an answer"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell title={tr("डेटा सहायक", "Data assistant")} subtitle={tr("आफ्नो पालिकाको डेटाबारे सोध्नुहोस्", "Ask about your municipality's data")}>
      <AiSummary />
      <Card title={tr("प्रश्न सोध्नुहोस्", "Ask a question")} icon={Bot}>
        <div className="flex flex-col gap-4">
          {turns.length === 0 && (
            <div className="flex flex-wrap gap-2">
              {suggestions.data?.suggestions.map((s) => (
                <button
                  key={s.en}
                  onClick={() => void ask(lang === "ne" ? s.ne : s.en)}
                  className="min-h-10 rounded-full border border-line bg-fill px-4 text-small font-semibold text-body hover:border-brand-700"
                >
                  {lang === "ne" ? s.ne : s.en}
                </button>
              ))}
            </div>
          )}

          <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto" aria-live="polite">
            {turns.map((t, i) => (
              <div key={i} className={`flex gap-3 ${t.role === "user" ? "flex-row-reverse" : ""}`}>
                <span className={`grid size-9 shrink-0 place-items-center rounded-full ${t.role === "user" ? "bg-fill" : "bg-brand-800 text-white"}`}>
                  {t.role === "user" ? <UserRound className="size-5" aria-hidden /> : <Bot className="size-5" aria-hidden />}
                </span>
                <div className={`max-w-[80%] rounded-card px-4 py-3 ${t.role === "user" ? "bg-brand-800 text-white" : "border border-line bg-white text-body"}`}>
                  <p className="whitespace-pre-wrap">{t.answer ? (lang === "ne" ? t.answer.answerNe : t.answer.answerEn) : t.text}</p>
                  {t.answer?.period && (
                    <p className="mt-2 text-caption text-muted">
                      {tr(`अवधि: ${t.answer.period.ne}`, `Period: ${t.answer.period.en}`)}
                      {t.answer.mode === "local" ? tr(" · नियममा आधारित", " · rule-based") : ""}
                    </p>
                  )}
                </div>
              </div>
            ))}
            {busy && <p className="text-small text-muted">{tr("डेटा हेर्दैछ…", "Checking your data…")}</p>}
            <div ref={end} />
          </div>

          {error && <p className="text-small font-medium text-danger">{error}</p>}

          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void ask(input);
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={500}
              placeholder={tr("जस्तै: यो महिना कुन वडामा डढुवाको चेतावनी आयो?", "For example: which wards had blight alerts this month?")}
              aria-label={tr("प्रश्न", "Question")}
              className={inputClass}
            />
            <PrimaryButton type="submit" disabled={busy || !input.trim()} aria-label={tr("पठाउनुहोस्", "Send")}>
              <Send className="size-5" aria-hidden />
            </PrimaryButton>
          </form>
        </div>
      </Card>
    </Shell>
  );
}
