"use client";

/**
 * Small, dependency-free charts for the land transparency dashboard. Satellite status colours are
 * fixed everywhere: cultivated green, weak amber, fallow brown, not checked grey.
 */
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

/** One horizontal bar split by satellite status, with the hectares of each part underneath. */
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

/** Labelled horizontal bars on one scale (for "registered vs declared vs satellite"). */
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

/**
 * Stacked columns, one per season, split by satellite status. A dark tick marks the area farmers
 * declared cultivated in that season, so the gap between claim and satellite is visible at a glance.
 */
export function SeasonColumns({ seasons }: { seasons: { key: string; label: string; satellite: AreaByStatus; declared: number | null; inProgress: boolean }[] }) {
  const { tr, num } = useLang();
  const max = Math.max(...seasons.map((s) => ORDER.reduce((a, k) => a + s.satellite[k], 0)), 1);
  const H = 180;
  return (
    <div>
      <div className="flex items-end gap-3 sm:gap-5" style={{ height: H + 4 }}>
        {seasons.map((s) => {
          const total = ORDER.reduce((a, k) => a + s.satellite[k], 0);
          return (
            <div key={s.key} className="relative flex h-full flex-1 flex-col justify-end" title={ORDER.map((k) => `${STATUS[k].en} ${ha(s.satellite[k]).toFixed(2)} ha`).join("\n")}>
              <div className={`flex w-full flex-col-reverse overflow-hidden rounded-t-md ${s.inProgress ? "opacity-50" : ""}`} style={{ height: `${(total / max) * H}px` }}>
                {ORDER.map((k) => (s.satellite[k] > 0 ? <div key={k} style={{ height: `${(s.satellite[k] / (total || 1)) * 100}%`, background: STATUS[k].color }} /> : null))}
              </div>
              {s.declared != null && s.declared > 0 && <div className="absolute inset-x-0 h-0.5 bg-ink" style={{ bottom: `${(s.declared / max) * H}px` }} aria-hidden />}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-3 sm:gap-5">
        {seasons.map((s) => (
          <p key={s.key} className="flex-1 text-center text-caption leading-tight text-muted">
            {s.label}
            {s.inProgress && <span className="block">{tr("(चलिरहेको)", "(in progress)")}</span>}
          </p>
        ))}
      </div>
      <p className="mt-3 flex items-center gap-2 text-caption text-muted">
        <span className="inline-block h-0.5 w-5 bg-ink" aria-hidden /> {tr("किसानले घोषणा गरेको खेती क्षेत्र", "Area farmers declared cultivated")}
        <span className="ml-2">{tr(`जम्मा अधिकतम ${num(ha(max), 1)} हे.`, `Scale up to ${ha(max).toFixed(1)} ha`)}</span>
      </p>
    </div>
  );
}
