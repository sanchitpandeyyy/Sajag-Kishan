"use client";

import { Map as MapIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/shell";
import { TONES } from "@/components/stat-tile";
import { useLang } from "@/lib/i18n";

export type MetricKey = "households" | "verifiedPct" | "classifiedPct" | "landHa" | "irrigatedPct" | "productionMt" | "livestockUnits";

/** Raw figures for one area. A null means the source hides it (fewer than 5 households). */
export interface AreaFigures {
  households: number | null;
  verified: number | null;
  classified: number | null;
  landHa: number | null;
  irrigatedPct: number | null;
  productionMt: number | null;
  livestockUnits: number | null;
}

export interface Area {
  id: string;
  ne: string;
  en: string;
  d: string;
  /** Border path to stroke, when `d` is made of smaller areas (provinces are unions of districts). */
  outline?: string;
  href?: string;
  figures: AreaFigures;
}

const pctOf = (a: number | null, b: number | null) => (a == null || b == null || b === 0 ? null : (a / b) * 100);

const METRICS: { key: MetricKey; ne: string; en: string; digits: number; pct?: boolean; value: (f: AreaFigures) => number | null }[] = [
  { key: "households", ne: "सूचीकृत किसान घरधुरी", en: "Registered households", digits: 0, value: (f) => f.households },
  { key: "verifiedPct", ne: "प्रमाणित %", en: "Verified %", digits: 0, pct: true, value: (f) => pctOf(f.verified, f.households) },
  { key: "classifiedPct", ne: "वर्गीकृत %", en: "Classified %", digits: 1, pct: true, value: (f) => pctOf(f.classified, f.households) },
  { key: "landHa", ne: "जग्गा (हेक्टर)", en: "Land (ha)", digits: 1, value: (f) => f.landHa },
  { key: "irrigatedPct", ne: "सिँचित %", en: "Irrigated %", digits: 0, pct: true, value: (f) => f.irrigatedPct },
  { key: "productionMt", ne: "उत्पादन (मे.ट.)", en: "Production (MT)", digits: 1, value: (f) => f.productionMt },
  { key: "livestockUnits", ne: "पशुधन एकाइ", en: "Livestock units", digits: 1, value: (f) => f.livestockUnits },
];

/** Five equal groups (quantiles), pale to dark, as on the source dashboard. */
const SHADES = ["#dbe9d6", "#b9d9ad", "#8cc96a", "#4a9f1e", "#075426"];
const NO_DATA = "#e1e4ea";

/**
 * Map, metric pills and a ranked list, in the style of the ministry's public dashboard.
 * Used for the provinces of Nepal and for the districts inside one province.
 */
export function AreaExplorer({ heading, listTitleNe, listTitleEn, areas, viewBox }: { heading: { ne: string; en: string }; listTitleNe: string; listTitleEn: string; areas: Area[]; viewBox: string }) {
  const { tr, num } = useLang();
  const [key, setKey] = useState<MetricKey>("households");
  const [hover, setHover] = useState<string | null>(null);
  const metric = METRICS.find((m) => m.key === key) ?? METRICS[0]!;

  const withValue = areas.map((a) => ({ a, v: metric.value(a.figures) }));
  const ranked = withValue.filter((r): r is { a: Area; v: number } => r.v != null).sort((x, y) => y.v - x.v);
  const hidden = withValue.filter((r) => r.v == null);
  const bucketOf = new Map(ranked.map((r, i) => [r.a.id, Math.min(4, 4 - Math.floor((i * 5) / ranked.length))]));
  const show = (v: number) => `${num(v, metric.digits)}${metric.pct ? "%" : ""}`;

  return (
    <section className="mt-8">
      <h2 className="mb-4 flex items-center gap-3 font-heading text-h2 text-ink">
        <MapIcon className="size-7 text-brand-800" strokeWidth={1.75} aria-hidden />
        {tr(heading.ne, heading.en)}
      </h2>
      <div className="grid gap-4 lg:grid-cols-[1.7fr_1fr]">
        <Card>
          <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label={tr("सूचक छान्नुहोस्", "Choose a measure")}>
            {METRICS.map((m) => (
              <button
                key={m.key}
                role="tab"
                aria-selected={m.key === key}
                onClick={() => setKey(m.key)}
                className={`min-h-10 rounded-full border px-4 text-small font-semibold transition-colors ${m.key === key ? "border-brand-800 bg-brand-800 text-white" : "border-line bg-fill text-body hover:border-input-border"}`}
              >
                {tr(m.ne, m.en)}
              </button>
            ))}
          </div>
          <svg viewBox={viewBox} className="mx-auto h-auto max-h-[440px] w-full" role="img" aria-label={tr(heading.ne, heading.en)}>
            {areas.map((s) => {
              const v = metric.value(s.figures);
              const fill = v == null ? NO_DATA : SHADES[bucketOf.get(s.id) ?? 0];
              const dim = hover && hover !== s.id ? 0.55 : 1;
              // Province shapes are unions of districts, so fill them without inner lines and draw only the border.
              const path = (
                <g opacity={dim} className={s.href ? "cursor-pointer" : undefined} onMouseEnter={() => setHover(s.id)} onMouseLeave={() => setHover(null)}>
                  <path d={s.d} fill={fill} stroke={s.outline ? fill : "#ffffff"} strokeWidth={s.outline ? 0.8 : hover === s.id ? 3 : 1.5} strokeLinejoin="round">
                    <title>
                      {tr(s.ne, s.en)}: {v == null ? tr("५ भन्दा कम", "under 5 households") : show(v)}
                    </title>
                  </path>
                  {s.outline && <path d={s.outline} fill="none" stroke="#ffffff" strokeWidth={hover === s.id ? 3.5 : 2} strokeLinejoin="round" pointerEvents="none" />}
                </g>
              );
              return s.href ? (
                <a key={s.id} href={s.href} aria-label={tr(s.ne, s.en)}>
                  {path}
                </a>
              ) : (
                <g key={s.id}>{path}</g>
              );
            })}
          </svg>
          <div className="mt-4 flex items-center justify-center gap-1 text-caption text-muted">
            <span>{tr("कम", "Lower")}</span>
            {SHADES.map((c) => (
              <span key={c} className="h-3 w-8 rounded-sm" style={{ background: c }} />
            ))}
            <span>{tr("बढी", "Higher")}</span>
          </div>
        </Card>

        <Card title={`${tr(metric.ne, metric.en)}, ${tr(listTitleNe, listTitleEn)}`}>
          <p className="-mt-2 mb-3 text-caption text-muted">{tr("नक्साको रङ पाँच समान भागमा बाँडिएको छ।", "Map colours split the areas into five equal groups.")}</p>
          <ol className="max-h-[520px] overflow-y-auto pr-1">
            {ranked.map(({ a, v }, i) => {
              const row = (
                <>
                  <span className="grid size-8 shrink-0 place-items-center rounded-full text-small font-bold" style={{ background: TONES.blue.bg, color: TONES.blue.fg }}>
                    {num(i + 1)}
                  </span>
                  <span className="flex-1 font-semibold text-ink">{tr(a.ne, a.en)}</span>
                  <span className="tnum font-bold text-ink">{show(v)}</span>
                </>
              );
              return (
                <li key={a.id} onMouseEnter={() => setHover(a.id)} onMouseLeave={() => setHover(null)} className="border-b border-dashed border-line last:border-b-0">
                  {a.href ? (
                    <Link href={a.href} className="flex items-center gap-3 py-3 hover:underline">
                      {row}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 py-3">{row}</div>
                  )}
                </li>
              );
            })}
          </ol>
          {hidden.length > 0 && (
            <p className="mt-3 text-caption text-muted">
              {tr("तथ्याङ्क लुकाइएको (५ भन्दा कम घरधुरी): ", "Hidden by the source (under 5 households): ")}
              {hidden.map((h) => tr(h.a.ne, h.a.en)).join(", ")}
            </p>
          )}
        </Card>
      </div>
    </section>
  );
}
