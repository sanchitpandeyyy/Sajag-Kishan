"use client";

import { Bug, CalendarCheck, CloudRain, FlaskConical, HandCoins, Hand, MessageCircleQuestion, Search, Sprout, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { Card, inputClass, SecondaryButton, Shell, StateMessage } from "@/components/shell";
import { StatTile, type Tone } from "@/components/stat-tile";
import { useLang } from "@/lib/i18n";
import { useApi } from "@/lib/use-api";

interface Question {
  id: string;
  question: string;
  understoodEn: string | null;
  intent: string;
  answerNe: string;
  mode: string;
  createdAt: string;
  ward: number | null;
}

const TOPICS: Record<string, { ne: string; en: string; icon: LucideIcon; tone: Tone }> = {
  weather: { ne: "मौसम", en: "Weather", icon: CloudRain, tone: "blue" },
  disease: { ne: "रोग र कीरा", en: "Disease and pests", icon: Bug, tone: "brown" },
  fertilizer: { ne: "मल", en: "Fertilizer", icon: FlaskConical, tone: "teal" },
  sowing: { ne: "रोपाइँ", en: "Sowing", icon: Sprout, tone: "green" },
  task: { ne: "आजको काम", en: "Today's work", icon: CalendarCheck, tone: "green" },
  subsidy: { ne: "अनुदान", en: "Subsidy", icon: HandCoins, tone: "gold" },
  greeting: { ne: "नमस्कार", en: "Greeting", icon: Hand, tone: "blue" },
  general: { ne: "अन्य", en: "Other", icon: MessageCircleQuestion, tone: "blue" },
};
const topicOf = (k: string) => TOPICS[k] ?? TOPICS.general!;

export default function QuestionsPage() {
  const { tr, num } = useLang();
  const [intent, setIntent] = useState<string>("");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const params = new URLSearchParams();
  if (intent) params.set("intent", intent);
  if (query) params.set("q", query);
  const { data, error, loading } = useApi<{ questions: Question[]; byIntent: { intent: string; count: number }[] }>(`/v1/chat/questions${params.size ? `?${params}` : ""}`);
  const total = data?.byIntent.reduce((s, b) => s + b.count, 0) ?? 0;

  return (
    <Shell title={tr("किसानका प्रश्न", "Farmers' questions")} subtitle={tr("कृषि दृष्टि एपमा किसानले सोधेका प्रश्न", "What farmers asked in the Krishi Dristi app")}>
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile icon={MessageCircleQuestion} tone="blue" label={tr("जम्मा प्रश्न", "Total questions")} value={num(total)} />
        {data?.byIntent.slice(0, 3).map((b) => {
          const t = topicOf(b.intent);
          return <StatTile key={b.intent} icon={t.icon} tone={t.tone} label={tr(t.ne, t.en)} value={num(b.count)} note={total ? tr(`जम्माको ${num(Math.round((b.count / total) * 100))}%`, `${Math.round((b.count / total) * 100)}% of all`) : undefined} />;
        })}
      </section>

      <Card className="mt-6">
        <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label={tr("विषय", "Topic")}>
          <button role="tab" aria-selected={!intent} onClick={() => setIntent("")} className={`min-h-10 rounded-full border px-4 text-small font-semibold ${!intent ? "border-brand-800 bg-brand-800 text-white" : "border-line bg-fill text-body"}`}>
            {tr("सबै", "All")}
          </button>
          {Object.entries(TOPICS).map(([key, t]) => (
            <button
              key={key}
              role="tab"
              aria-selected={intent === key}
              onClick={() => setIntent(key)}
              className={`flex min-h-10 items-center gap-2 rounded-full border px-4 text-small font-semibold ${intent === key ? "border-brand-800 bg-brand-800 text-white" : "border-line bg-fill text-body"}`}
            >
              <t.icon className="size-4" aria-hidden /> {tr(t.ne, t.en)}
            </button>
          ))}
        </div>
        <form
          className="mb-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(q.trim());
          }}
        >
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("प्रश्नमा खोज्नुहोस्", "Search the questions")} className={inputClass} aria-label={tr("खोज्नुहोस्", "Search")} />
          <SecondaryButton type="submit" className="flex items-center gap-1">
            <Search className="size-4" /> {tr("खोज्नुहोस्", "Search")}
          </SecondaryButton>
        </form>
        <StateMessage loading={loading} error={error} />
        <ul>
          {data?.questions.map((r) => {
            const t = topicOf(r.intent);
            return (
              <li key={r.id} className="flex gap-4 border-t border-line py-4">
                <t.icon className="mt-1 size-6 shrink-0 text-brand-700" strokeWidth={1.75} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">{r.question}</p>
                  {r.understoodEn && <p className="text-small text-muted">{r.understoodEn}</p>}
                  <p className="mt-2 text-small text-body">{r.answerNe}</p>
                  <p className="mt-1 text-caption text-muted">
                    {tr(t.ne, t.en)}, {r.ward != null ? tr(`वडा ${num(r.ward)}`, `ward ${r.ward}`) : tr("वडा थाहा छैन", "ward unknown")}, {new Date(r.createdAt).toLocaleString()}
                    {r.mode === "llm" ? tr(", एआई उत्तर", ", AI answer") : ""}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
        {data?.questions.length === 0 && <p className="py-4 text-small text-muted">{tr("अहिलेसम्म कुनै प्रश्न छैन। किसानले एपको सोध्नुहोस् ट्याबबाट सोधेपछि यहाँ देखिन्छ।", "No questions yet. They appear here after farmers use the Ask tab in the app.")}</p>}
        <p className="mt-4 text-caption text-muted">{tr("किसानको नाम र मोबाइल नम्बर राखिँदैन, प्रश्न र वडा मात्र।", "Farmer names and phone numbers are not kept, only the question and ward.")}</p>
      </Card>
    </Shell>
  );
}
