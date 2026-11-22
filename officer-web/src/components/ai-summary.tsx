"use client";

import { ArrowRight, RefreshCw, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Card, StateMessage } from "@/components/shell";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { useApi } from "@/lib/use-api";

type Bi = { ne: string; en: string };

export interface OfficerSummary {
  headline: Bi;
  points: Bi[];
  actions: Bi[];
  mode: "llm" | "gemini" | "local";
  generatedAt: string;
  period: Bi;
}

export function AiSummary() {
  const { tr, lang } = useLang();
  const { data, error, loading } = useApi<OfficerSummary>("/v1/chat/officer-summary");
  const [fresh, setFresh] = useState<OfficerSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const s = fresh ?? data;
  const t = (b: Bi) => (lang === "ne" ? b.ne : b.en);

  async function regenerate() {
    setBusy(true);
    try {
      setFresh(await api<OfficerSummary>("/v1/chat/officer-summary?fresh=1"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title={tr("यो डेटाको अर्थ", "What this data means")}
      icon={Sparkles}
      className="mb-6"
      action={
        <button onClick={regenerate} disabled={busy} className="flex min-h-10 items-center gap-1.5 rounded-control px-3 text-small font-semibold text-brand-700 hover:bg-fill disabled:opacity-50">
          <RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} aria-hidden />
          {tr("फेरि बनाउनुहोस्", "Refresh")}
        </button>
      }
    >
      <StateMessage loading={loading && !s} error={error} />
      {s && (
        <div className="flex flex-col gap-4">
          <p className="font-heading text-h3 text-ink">{t(s.headline)}</p>
          {s.points.length > 0 && (
            <ul className="flex flex-col gap-2">
              {s.points.map((p, i) => (
                <li key={i} className="flex gap-2 text-body">
                  <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-brand-700" aria-hidden />
                  {t(p)}
                </li>
              ))}
            </ul>
          )}
          {s.actions.length > 0 && (
            <div className="rounded-control bg-page p-4">
              <p className="mb-2 text-small font-bold tracking-wide text-brand-700 uppercase">{tr("अब के गर्ने", "Next steps")}</p>
              <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-body">
                {s.actions.map((a, i) => (
                  <li key={i}>{t(a)}</li>
                ))}
              </ol>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 text-caption text-muted">
            <span>
              {tr(`अवधि: ${s.period.ne}।`, `Period: ${s.period.en}.`)} {s.mode === "local" ? tr("नियममा आधारित सारांश।", "Rule-based summary.") : tr("एआईले तपाईंकै डेटाबाट लेखेको।", "Written by AI from your own data.")}
            </span>
            <Link href="/assistant" className="flex items-center gap-1 font-semibold text-brand-700 hover:underline">
              {tr("प्रश्न सोध्नुहोस्", "Ask a question")} <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
      )}
    </Card>
  );
}
