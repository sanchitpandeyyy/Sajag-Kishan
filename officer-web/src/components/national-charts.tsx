"use client";

import { useState } from "react";
import { useLang } from "@/lib/i18n";

export interface Slice {
  ne: string;
  en: string;
  value: number;
}

export function BarList({ rows, unit, color = "#4A9F1E", ofTotal = false }: { rows: Slice[]; unit?: string; color?: string; ofTotal?: boolean }) {
  const { tr, num } = useLang();
  if (!rows.length) return <p className="text-small text-muted">{tr("तथ्याङ्क छैन", "No data")}</p>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  const total = rows.reduce((s, r) => s + r.value, 0) || 1;
  return (
    <ul className="space-y-3">
      {rows.map((r) => {
        const width = ofTotal ? (r.value / total) * 100 : (r.value / max) * 100;
        return (
          <li key={r.en}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-semibold text-ink">{tr(r.ne, r.en)}</span>
              <span className="text-body">
                {num(r.value, r.value >= 1000 ? 0 : 2)}
                {unit ? ` ${unit}` : ""}
                {ofTotal ? ` (${num((r.value / total) * 100, 1)}%)` : ""}
              </span>
            </div>
            <div className="mt-1 h-2.5 rounded-full bg-fill">
              <div className="h-2.5 rounded-full" style={{ width: `${Math.max(width, 0.6)}%`, background: color }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function niceStep(raw: number) {
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pow;
}

const DEVANAGARI = "०१२३४५६७८९";

export function TrendLine({ values, labels, title }: { values: number[]; labels: string[]; title: string }) {
  const { tr, num, lang } = useLang();
  const [hover, setHover] = useState<number | null>(null);
  const n = values.length;
  if (n < 2) return <p className="text-small text-muted">{tr("तथ्याङ्क छैन", "No data")}</p>;

  const date = (s: string) => (lang === "ne" ? s.replace(/\d/g, (d) => DEVANAGARI[Number(d)]!) : s);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const step = niceStep(Math.max(hi - lo, 1) / 4);
  const yMin = Math.floor(lo / step) * step;
  const yMax = Math.max(Math.ceil(hi / step) * step, yMin + step);
  const ticks: number[] = [];
  for (let t = yMin; t <= yMax + step / 2; t += step) ticks.push(t);

  const W = 680;
  const H = 260;
  const m = { l: 78, r: 16, t: 14, b: 30 };
  const x = (i: number) => m.l + (i / (n - 1)) * (W - m.l - m.r);
  const y = (v: number) => m.t + (1 - (v - yMin) / (yMax - yMin)) * (H - m.t - m.b);
  const line = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join("");
  const area = `${line}L${x(n - 1).toFixed(1)} ${H - m.b}L${x(0).toFixed(1)} ${H - m.b}Z`;
  const xTicks = [0, Math.round((n - 1) / 3), Math.round(((n - 1) * 2) / 3), n - 1];

  const shown = hover ?? n - 1;
  const change = values[shown]! - values[0]!;

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    setHover(Math.min(n - 1, Math.max(0, Math.round(((px - m.l) / (W - m.l - m.r)) * (n - 1)))));
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-small text-muted">{date(labels[shown] ?? "")}</p>
        <p className="text-small text-body">
          <span className="font-heading text-h3 text-ink">{num(values[shown]!, 0)}</span>{" "}
          {tr("घरधुरी", "households")}, {change >= 0 ? "+" : ""}
          {num(change, 0)} {tr(`${date(labels[0] ?? "")} देखि`, `since ${labels[0] ?? ""}`)}
        </p>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={title} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} stroke="#e1e4ea" strokeDasharray={t === yMin ? undefined : "3 4"} />
            <text x={m.l - 10} y={y(t) + 4} textAnchor="end" fontSize="12" fill="#5c6473">
              {num(t, 0)}
            </text>
          </g>
        ))}
        {xTicks.map((i, k) => (
          <text key={i} x={x(i)} y={H - 8} textAnchor={k === 0 ? "start" : k === xTicks.length - 1 ? "end" : "middle"} fontSize="12" fill="#5c6473">
            {date(labels[i] ?? "")}
          </text>
        ))}
        <path d={area} fill="#075426" opacity="0.08" />
        <path d={line} fill="none" stroke="#075426" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(shown)} cy={y(values[shown]!)} r="5" fill="#ffffff" stroke="#075426" strokeWidth="2.5" />
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={m.t} y2={H - m.b} stroke="#075426" strokeWidth="1" opacity="0.35" />}
      </svg>
      <p className="mt-2 text-caption text-muted">
        {tr(
          `ठाडो अक्ष शून्यबाट सुरु हुँदैन (${num(yMin, 0)} बाट), किनकि संख्या ${num(((hi - lo) / lo) * 100, 2)}% मात्र हेरफेर भएको छ। पालिकाले विवरण स्थानान्तरण गर्दा संख्या घटबढ हुन सक्छ।`,
          `The vertical axis starts at ${num(yMin, 0)}, not zero, because the count moved by only ${num(((hi - lo) / lo) * 100, 2)}%. It can dip when municipalities transfer records.`,
        )}
      </p>
    </div>
  );
}
