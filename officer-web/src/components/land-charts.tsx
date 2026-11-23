"use client";

import { useLang } from "@/lib/i18n";

export type FieldStatus = "cultivated" | "weak" | "fallow" | "unknown";
export type AreaByStatus = Record<FieldStatus, number>;

export const STATUS: Record<FieldStatus, { ne: string; en: string; color: string }> = {
  cultivated: { ne: "खेती भएको", en: "Cultivated", color: "#1f7a4d" },
  weak: { ne: "कमजोर हरियाली", en: "Weak green", color: "#d9a93a" },
  fallow: { ne: "बाँझो", en: "Fallow", color: "#a0522d" },
  unknown: { ne: "जाँच हुन बाँकी", en: "Not checked", color: "#c3c8d1" },
};
const ORDER: FieldStatus[] = ["cultivated", "weak", "fallow", "unknown"];

export const ha = (m2: number) => m2 / 10_000;

export function StatusLegend({ className = "" }: { className?: string }) {
  const { tr } = useLang();
  return (
    <ul className={`flex flex-wrap gap-x-4 gap-y-1 text-caption text-body ${className}`}>
      {ORDER.map((k) => (
        <li key={k} className="flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-sm" style={{ background: STATUS[k].color }} aria-hidden />
          {tr(STATUS[k].ne, STATUS[k].en)}
        </li>
      ))}
    </ul>
  );
}

export function StatusBar({ areas, showValues = true }: { areas: AreaByStatus; showValues?: boolean }) {
  const { tr, num } = useLang();
  const total = ORDER.reduce((s, k) => s + areas[k], 0) || 1;
  return (
    <div>
      <div className="flex h-5 w-full overflow-hidden rounded-full bg-fill" role="img" aria-label={ORDER.map((k) => `${STATUS[k].en} ${ha(areas[k]).toFixed(1)} ha`).join(", ")}>
        {ORDER.map((k) => (areas[k] > 0 ? <div key={k} style={{ width: `${(areas[k] / total) * 100}%`, background: STATUS[k].color }} title={`${STATUS[k].en}: ${ha(areas[k]).toFixed(2)} ha`} /> : null))}
      </div>
      {showValues && (
        <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ORDER.map((k) => (
            <div key={k}>
              <dt className="flex items-center gap-1.5 text-caption text-muted">
                <span className="inline-block size-2.5 rounded-sm" style={{ background: STATUS[k].color }} aria-hidden />
                {tr(STATUS[k].ne, STATUS[k].en)}
              </dt>
              <dd className="font-heading text-h4 text-ink">
                {num(ha(areas[k]), 2)} {tr("हे.", "ha")} <span className="text-caption font-normal text-muted">({num(Math.round((areas[k] / total) * 100))}%)</span>
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

export function CompareBars({ rows, unit }: { rows: { label: string; value: number; color: string; note?: string }[]; unit: string }) {
  const { num } = useLang();
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="space-y-4">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-small font-semibold text-ink">{r.label}</span>
            <span className="font-heading text-h4 text-ink">
              {num(r.value, 2)} <span className="text-caption font-normal text-muted">{unit}</span>
            </span>
          </div>
          <div className="mt-1.5 h-3 rounded-full bg-fill">
            <div className="h-3 rounded-full" style={{ width: `${Math.max(1, (r.value / max) * 100)}%`, background: r.color }} />
          </div>
          {r.note && <p className="mt-1 text-caption text-muted">{r.note}</p>}
        </li>
      ))}
    </ul>
  );
}

export interface SeasonWeather {
  rainMm: number;
  normalRainMm: number | null;
  rainVsNormal: number | null;
  tempMeanC: number | null;
  normalTempC: number | null;
  days: number;
  complete: boolean;
}

export interface SeasonColumn {
  key: string;
  label: string;
  satellite: AreaByStatus;
  declared: number | null;
  inProgress: boolean;
  weather: SeasonWeather | null;
}

function splitLabel(label: string): [string, string] {
  const i = label.lastIndexOf(" ");
  return i > 0 ? [label.slice(0, i), label.slice(i + 1)] : [label, ""];
}

function NormalChip({ r }: { r: number | null }) {
  const { tr, num } = useLang();
  if (r == null) return <span className="text-muted">–</span>;
  const diff = Math.round((r - 1) * 100);
  const tone = r < 0.75 ? "bg-[#a0522d]/10 text-[#8a4423]" : r > 1.25 ? "bg-[#1b7a95]/10 text-[#155f74]" : "bg-fill text-body";
  const text = Math.abs(diff) < 5 ? tr("सामान्य", "Normal") : `${diff > 0 ? "+" : "−"}${num(Math.abs(diff))}%`;
  return <span className={`inline-block rounded-full px-2 py-0.5 font-semibold tnum ${tone}`}>{text}</span>;
}

export function SeasonColumns({ seasons }: { seasons: SeasonColumn[] }) {
  const { tr, num } = useLang();
  const max = Math.max(...seasons.map((s) => ORDER.reduce((a, k) => a + s.satellite[k], 0)), 1);
  const H = 168;
  const hasWeather = seasons.some((s) => s.weather);
  const cols = { gridTemplateColumns: `6.5rem repeat(${seasons.length}, minmax(4.5rem, 1fr))` };
  const row = "grid items-center gap-x-3 sm:gap-x-4";
  const head = "text-caption font-medium text-muted";
  const cell = "text-center text-small tnum";

  return (
    <div>
      <div className="scroll-thin -mx-1 overflow-x-auto px-1 pb-1">
        <div className="min-w-[36rem]">
          {/* bars on a shared baseline */}
          <div className={`${row} border-b border-ink/20 pb-px`} style={cols}>
            <div className="flex flex-col justify-between py-0.5 text-right text-caption text-muted tnum" style={{ height: H }} aria-hidden>
              <span>{tr(`${num(ha(max), 1)} हे.`, `${ha(max).toFixed(1)} ha`)}</span>
              <span>0</span>
            </div>
            {seasons.map((s) => {
              const total = ORDER.reduce((a, k) => a + s.satellite[k], 0);
              const empty = s.inProgress && total === s.satellite.unknown;
              const h = `${(total / max) * H}px`;
              return (
                <div key={s.key} className="relative mx-auto w-full max-w-16" style={{ height: H }} title={ORDER.map((k) => `${STATUS[k].en} ${ha(s.satellite[k]).toFixed(2)} ha`).join("\n")}>
                  {empty ? (
                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-center rounded-t-md border border-b-0 border-dashed border-ink/25 bg-page" style={{ height: h }}>
                      <span className="px-1 text-center text-caption font-medium text-muted">{tr("चाँडै", "Too early")}</span>
                    </div>
                  ) : (
                    <div className={`absolute inset-x-0 bottom-0 flex flex-col-reverse overflow-hidden rounded-t-md ${s.inProgress ? "opacity-50" : ""}`} style={{ height: h }}>
                      {ORDER.map((k) => (s.satellite[k] > 0 ? <div key={k} style={{ height: `${(s.satellite[k] / (total || 1)) * 100}%`, background: STATUS[k].color }} /> : null))}
                    </div>
                  )}
                  {s.declared != null && s.declared > 0 && <div className="absolute -inset-x-1.5 h-0.5 rounded-full bg-ink" style={{ bottom: `${(s.declared / max) * H}px` }} aria-hidden />}
                </div>
              );
            })}
          </div>

          {/* season names */}
          <div className={`${row} pt-2.5 pb-3`} style={cols}>
            <span />
            {seasons.map((s) => {
              const [name, year] = splitLabel(s.label);
              return (
                <div key={s.key} className="text-center leading-tight">
                  <p className="text-small font-semibold text-ink">{name}</p>
                  <p className="text-caption text-muted tnum">{year}</p>
                  {s.inProgress && <p className="text-caption text-muted">{tr("चलिरहेको", "in progress")}</p>}
                </div>
              );
            })}
          </div>

          {/* figures, one aligned row each */}
          <div className="divide-y divide-line border-t border-line">
            <div className={`${row} py-2.5`} style={cols}>
              <span className={head}>{tr("खेती देखिएको", "Farmed")}</span>
              {seasons.map((s) => {
                const total = ORDER.reduce((a, k) => a + s.satellite[k], 0);
                const checked = total - s.satellite.unknown;
                const pct = checked > 0 ? Math.round((s.satellite.cultivated / checked) * 100) : null;
                return (
                  <span key={s.key} className={`${cell} ${pct == null ? "text-muted" : "font-semibold text-ink"}`}>
                    {pct == null ? "–" : `${num(pct)}%`}
                  </span>
                );
              })}
            </div>
            {hasWeather && (
              <>
                <div className={`${row} py-2.5`} style={cols}>
                  <span className={head}>{tr("वर्षा", "Rain")}</span>
                  {seasons.map((s) => (
                    <span key={s.key} className={`${cell} text-ink`}>
                      {s.weather ? tr(`${num(s.weather.rainMm, 0)} मि.मि.`, `${s.weather.rainMm.toLocaleString("en")} mm`) : <span className="text-muted">–</span>}
                    </span>
                  ))}
                </div>
                <div className={`${row} py-2`} style={cols}>
                  <span className={head}>{tr("सामान्यको तुलनामा", "vs normal")}</span>
                  {seasons.map((s) => (
                    <span key={s.key} className={`${cell} text-caption`}>
                      <NormalChip r={s.weather?.rainVsNormal ?? null} />
                    </span>
                  ))}
                </div>
                <div className={`${row} py-2.5`} style={cols}>
                  <span className={head}>{tr("औसत तापक्रम", "Avg temp")}</span>
                  {seasons.map((s) => (
                    <span key={s.key} className={`${cell} text-body`}>
                      {s.weather?.tempMeanC != null ? `${num(s.weather.tempMeanC, 1)}°C` : <span className="text-muted">–</span>}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-4">
        <StatusLegend />
        <span className="flex items-center gap-1.5 text-caption text-body">
          <span className="inline-block h-0.5 w-4 rounded-full bg-ink" aria-hidden /> {tr("किसानले घोषणा गरेको", "Declared by farmers")}
        </span>
      </div>
      <p className="mt-2 text-caption leading-relaxed text-muted">
        {tr(
          "खेती देखिएको: जाँच भएका खेतमध्ये बाली देखिएको भाग। मौसमको पहिलो ३० दिन (अघिल्लो बाली बाँकी हुने बेला) गनिँदैन।",
          "Farmed: share of checked fields where a crop was seen. The first 30 days of each season are skipped, when the previous crop is often still standing.",
        )}
        {hasWeather && tr(" वर्षा र तापक्रम: Open-Meteo (ERA5); सामान्य = पछिल्ला १० वर्षको सोही अवधिको औसत।", " Rain and temperature: Open-Meteo (ERA5); normal = average of the same days over the past 10 years.")}
      </p>
    </div>
  );
}
