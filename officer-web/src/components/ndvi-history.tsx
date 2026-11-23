"use client";

import { useMemo, useRef, useState } from "react";
import { useLang } from "@/lib/i18n";

export interface NdviPoint {
  date: string;
  ndvi: number;
}
interface NdviClass {
  key: string;
  min: number;
  ne: string;
  en: string;
  color: string;
}

const W = 720;
const H = 220;
const PAD = { top: 12, right: 12, bottom: 28, left: 34 };
const DAY = 86_400_000;
/** Don't draw a line across gaps longer than this (cloudy monsoon, missing years). */
const GAP_DAYS = 75;
const RANGES = [
  { key: "1y", days: 365, ne: "१ वर्ष", en: "1 yr" },
  { key: "3y", days: 3 * 365, ne: "३ वर्ष", en: "3 yrs" },
  { key: "all", days: Infinity, ne: "सबै", en: "All" },
] as const;

const t = (d: string) => Date.parse(`${d}T00:00:00Z`);
const classFor = (classes: NdviClass[], v: number) => classes.reduce((found, c) => (v >= c.min ? c : found), classes[0]!);

export function NdviHistory({ points, classes }: { points: NdviPoint[]; classes: NdviClass[] }) {
  const { tr, num, lang } = useLang();
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("all");
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const all = useMemo(() => [...points].sort((a, b) => a.date.localeCompare(b.date)), [points]);
  const spanDays = all.length > 1 ? (t(all.at(-1)!.date) - t(all[0]!.date)) / DAY : 0;
  const ranges = RANGES.filter((r) => r.days === Infinity || spanDays > r.days * 0.8);
  const active = ranges.find((r) => r.key === range) ?? ranges.at(-1)!;
  const data = useMemo(() => {
    if (active.days === Infinity || !all.length) return all;
    const cut = t(all.at(-1)!.date) - active.days * DAY;
    return all.filter((p) => t(p.date) >= cut);
  }, [all, active.days]);

  const fmt = (d: string, withYear = true) =>
    new Date(`${d}T00:00:00Z`).toLocaleDateString(lang === "ne" ? "ne-NP" : "en-GB", { day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}), timeZone: "UTC" });

  if (!data.length) return null;

  const x0 = t(data[0]!.date) - 10 * DAY;
  const x1 = t(data.at(-1)!.date) + 10 * DAY;
  const sx = (ms: number) => PAD.left + ((ms - x0) / (x1 - x0)) * (W - PAD.left - PAD.right);
  const sy = (v: number) => PAD.top + (1 - Math.max(0, Math.min(1, v))) * (H - PAD.top - PAD.bottom);

  // Line segments, broken across long gaps.
  const segments: NdviPoint[][] = [];
  for (const p of data) {
    const last = segments.at(-1);
    if (last && (t(p.date) - t(last.at(-1)!.date)) / DAY <= GAP_DAYS) last.push(p);
    else segments.push([p]);
  }

  // Monsoon (Barshe, 15 Jun - 31 Oct) bands and year ticks.
  const startYear = new Date(x0).getUTCFullYear();
  const endYear = new Date(x1).getUTCFullYear();
  const bands: { from: number; to: number }[] = [];
  const years: number[] = [];
  for (let y = startYear; y <= endYear; y++) {
    const from = Math.max(x0, Date.UTC(y, 5, 15));
    const to = Math.min(x1, Date.UTC(y, 9, 31));
    if (to > from) bands.push({ from, to });
    const jan = Date.UTC(y, 0, 1);
    if (jan > x0 && jan < x1) years.push(y);
  }
  const showMonths = years.length === 0 || (x1 - x0) / DAY < 500;
  const monthTicks: number[] = [];
  if (showMonths) {
    const d = new Date(x0);
    for (let m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).getTime(); m < x1; ) {
      monthTicks.push(m);
      const md = new Date(m);
      m = Date.UTC(md.getUTCFullYear(), md.getUTCMonth() + (((x1 - x0) / DAY > 200) ? 2 : 1), 1);
    }
  }

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const box = svg.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    let best = 0;
    for (let i = 1; i < data.length; i++) if (Math.abs(sx(t(data[i]!.date)) - px) < Math.abs(sx(t(data[best]!.date)) - px)) best = i;
    setHover(best);
  }

  const h = hover != null ? data[hover] : null;
  const hc = h && classes.length ? classFor(classes, h.ndvi) : null;
  const hx = h ? sx(t(h.date)) : 0;

  return (
    <div className="mt-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-small font-semibold text-ink">{tr("हरियाली (NDVI) इतिहास", "Greenness (NDVI) history")}</p>
        {ranges.length > 1 && (
          <div className="flex gap-1" role="group" aria-label={tr("समय दायरा", "Time range")}>
            {ranges.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setRange(r.key)}
                aria-pressed={active.key === r.key}
                className={`rounded-control border px-2 py-0.5 text-caption ${active.key === r.key ? "border-brand-700 bg-brand-700 text-white" : "border-line text-body hover:bg-fill"}`}
              >
                {tr(r.ne, r.en)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative">
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={tr(`NDVI चार्ट, ${num(data.length)} पढाइ`, `NDVI chart, ${data.length} readings`)}>
          {bands.map((b) => (
            <rect key={b.from} x={sx(b.from)} y={PAD.top} width={sx(b.to) - sx(b.from)} height={H - PAD.top - PAD.bottom} fill="#4a9f1e" opacity={0.07} />
          ))}
          {[0, 0.2, 0.4, 0.6, 0.8, 1].map((v) => (
            <g key={v}>
              <line x1={PAD.left} x2={W - PAD.right} y1={sy(v)} y2={sy(v)} stroke="currentColor" className="text-line" strokeWidth={v === 0 ? 1 : 0.5} />
              <text x={PAD.left - 6} y={sy(v)} dy="0.32em" textAnchor="end" className="fill-current text-muted" fontSize={11}>
                {num(v)}
              </text>
            </g>
          ))}
          {years.map((y) => (
            <text key={y} x={sx(Date.UTC(y, 0, 1))} y={H - 8} textAnchor="middle" className="fill-current text-muted" fontSize={11}>
              {num(y).replace(/,/g, "")}
            </text>
          ))}
          {showMonths &&
            monthTicks.map((m) => (
              <text key={m} x={sx(m)} y={H - 8} textAnchor="middle" className="fill-current text-muted" fontSize={10}>
                {new Date(m).toLocaleDateString(lang === "ne" ? "ne-NP" : "en-GB", { month: "short", timeZone: "UTC" })}
              </text>
            ))}
          {segments.map((seg) =>
            seg.length > 1 ? (
              <polyline
                key={seg[0]!.date}
                points={seg.map((p) => `${sx(t(p.date))},${sy(p.ndvi)}`).join(" ")}
                fill="none"
                stroke="#1f7a4d"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ) : null,
          )}
          {data.map((p, i) => (
            <circle key={p.date} cx={sx(t(p.date))} cy={sy(p.ndvi)} r={hover === i ? 5.5 : 4} fill={classes.length ? classFor(classes, p.ndvi).color : "#1f7a4d"} stroke="white" strokeWidth={2} />
          ))}
          {h && <line x1={hx} x2={hx} y1={PAD.top} y2={H - PAD.bottom} stroke="currentColor" className="text-muted" strokeWidth={1} strokeDasharray="3 3" pointerEvents="none" />}
          <rect
            x={PAD.left}
            y={PAD.top}
            width={W - PAD.left - PAD.right}
            height={H - PAD.top - PAD.bottom}
            fill="transparent"
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
            tabIndex={0}
            onFocus={() => setHover(data.length - 1)}
            onBlur={() => setHover(null)}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") setHover((v) => Math.max(0, (v ?? data.length) - 1));
              if (e.key === "ArrowRight") setHover((v) => Math.min(data.length - 1, (v ?? -1) + 1));
            }}
            aria-label={tr("बायाँ/दायाँ बटनले पढाइ हेर्नुहोस्", "Use left/right arrows to read values")}
          />
        </svg>
        {h && (
          <div
            className="pointer-events-none absolute top-1 z-10 rounded-control border border-line bg-surface px-2.5 py-1.5 text-caption shadow-sm"
            style={{ left: `${(hx / W) * 100}%`, transform: hx > W * 0.7 ? "translateX(calc(-100% - 8px))" : "translateX(8px)" }}
          >
            <p className="font-semibold text-ink">{fmt(h.date)}</p>
            <p className="text-body">NDVI {num(h.ndvi)}</p>
            {hc && (
              <p className="flex items-center gap-1 text-muted">
                <span className="inline-block size-2 rounded-sm" style={{ background: hc.color }} aria-hidden />
                {tr(hc.ne, hc.en)}
              </p>
            )}
          </div>
        )}
      </div>

      <p className="mt-1 flex flex-wrap items-center gap-x-3 text-caption text-muted">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: "#4a9f1e", opacity: 0.18 }} aria-hidden />
          {tr("बर्खे मौसम", "Monsoon season")}
        </span>
        <span>
          {tr(`${num(data.length)} सफा पढाइ, ${fmt(data[0]!.date)} देखि ${fmt(data.at(-1)!.date)} सम्म`, `${data.length} clear readings, ${fmt(data[0]!.date)} to ${fmt(data.at(-1)!.date)}`)}
        </span>
      </p>

      <details className="mt-2">
        <summary className="cursor-pointer text-caption font-semibold text-brand-700">{tr("तालिकामा हेर्नुहोस्", "View as table")}</summary>
        <div className="mt-2 max-h-56 overflow-auto rounded-control border border-line">
          <table className="w-full text-caption">
            <thead className="sticky top-0 bg-fill text-left text-muted">
              <tr>
                <th className="px-2 py-1 font-semibold">{tr("मिति", "Date")}</th>
                <th className="px-2 py-1 font-semibold">NDVI</th>
                <th className="px-2 py-1 font-semibold">{tr("अवस्था", "Condition")}</th>
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map((p) => (
                <tr key={p.date} className="border-t border-line">
                  <td className="px-2 py-1 text-ink">{fmt(p.date)}</td>
                  <td className="px-2 py-1 text-ink">{num(p.ndvi)}</td>
                  <td className="px-2 py-1 text-body">{classes.length ? tr(classFor(classes, p.ndvi).ne, classFor(classes, p.ndvi).en) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
