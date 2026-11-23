"use client";

import { Satellite } from "lucide-react";
import { useEffect, useState } from "react";
import { SecondaryButton } from "@/components/shell";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { useApi } from "@/lib/use-api";
import { NdviHistory } from "./ndvi-history";

interface SyncStatus {
  running: boolean;
  trigger: "manual" | "auto" | null;
  phase: string | null;
  lastAutoRunAt: string | null;
  nextAutoRunAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  parcelsTotal: number;
  parcelsDone: number;
  observations: number;
  errors: { parcelId: string; error: string }[];
}

export function SatelliteSync({ onDone }: { onDone?: () => void }) {
  const { tr, num, lang } = useLang();
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<SyncStatus>("/v1/satellite/status").then(setStatus).catch(() => undefined);
  }, []);

  useEffect(() => {
    const t = setInterval(async () => {
      const s = await api<SyncStatus>("/v1/satellite/status").catch(() => null);
      if (!s) return;
      setStatus((prev) => {
        if (prev?.running && !s.running) onDone?.();
        return s;
      });
    }, status?.running ? 4000 : 30000);
    return () => clearInterval(t);
  }, [status?.running, onDone]);

  async function start() {
    setError(null);
    try {
      const r = await api<{ started: boolean; status: SyncStatus }>("/v1/satellite/sync", { method: "POST", body: JSON.stringify({ limit: 25 }) });
      setStatus(r.status);
    } catch (e) {
      setError(e instanceof Error ? e.message : tr("सुरु हुन सकेन", "Could not start"));
    }
  }

  const when = (iso: string) => new Date(iso).toLocaleString(lang === "ne" ? "ne-NP" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const pct = status && status.parcelsTotal ? Math.round((status.parcelsDone / status.parcelsTotal) * 100) : 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <Satellite className="mt-0.5 size-5 shrink-0 text-brand-800" aria-hidden />
        <p className="text-small text-body">
          {tr(
            "Sentinel-2 र Sentinel-1 भू-उपग्रहबाट नक्सामा भएका खेतको हरियाली (NDVI) हरेक ६ घण्टामा आफैँ अद्यावधिक हुन्छ, र २०१९ देखिको इतिहास पनि भरिन्छ। घोषणा गरिएको तर हरियो नभएको खेत प्रमाणीकरणका लागि देखिन्छ।",
            "Field greenness (NDVI) from Sentinel-2 and Sentinel-1 updates automatically every 6 hours, and history back to 2019 is filled in. Fields declared as farmed but never green are flagged for a visit.",
          )}
        </p>
      </div>
      {status?.running ? (
        <div>
          <div className="h-2 overflow-hidden rounded-[4px] bg-fill">
            <div className="h-full bg-brand-700 transition-[width]" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-small text-muted">
            {status.phase === "history" ? tr("पुरानो इतिहास भर्दै: ", "Filling history: ") : status.trigger === "auto" ? tr("स्वचालित अद्यावधिक: ", "Automatic update: ") : ""}
            {tr(`${num(status.parcelsDone)} / ${num(status.parcelsTotal)} खेत जाँचियो, ${num(status.observations)} नयाँ पढाइ`, `${status.parcelsDone} of ${status.parcelsTotal} fields checked, ${status.observations} new readings`)}
          </p>
        </div>
      ) : (
        <SecondaryButton onClick={start} className="self-start">
          {tr("अहिले नै जाँच गर्नुहोस्", "Check now")}
        </SecondaryButton>
      )}
      {status?.finishedAt && !status.running && (
        <p className="text-small text-muted">
          {tr(`अन्तिम जाँच: ${num(status.parcelsDone)} खेत, ${num(status.observations)} नयाँ तस्बिर पढियो`, `Last check: ${status.parcelsDone} fields, ${status.observations} new scenes read`)}
          {status.errors.length ? tr(`, ${num(status.errors.length)} असफल`, `, ${status.errors.length} failed`) : ""}
        </p>
      )}
      {(status?.lastAutoRunAt || status?.nextAutoRunAt) && (
        <p className="text-caption text-muted">
          {status.lastAutoRunAt && tr(`अन्तिम स्वचालित अद्यावधिक: ${when(status.lastAutoRunAt)}`, `Last automatic update: ${when(status.lastAutoRunAt)}`)}
          {status.lastAutoRunAt && status.nextAutoRunAt && " · "}
          {status.nextAutoRunAt && !status.running && tr(`अर्को: ${when(status.nextAutoRunAt)}`, `Next: ${when(status.nextAutoRunAt)}`)}
        </p>
      )}
      {error && <p className="text-small text-danger">{error}</p>}
    </div>
  );
}

interface NdviClass {
  key: string;
  min: number;
  ne: string;
  en: string;
  color: string;
}

interface FieldSatelliteData {
  series: { date: string; ndvi: number | null; ndre: number | null; ndwi: number | null; ndmi: number | null; cloudPct: number | null }[];
  verdict: {
    peakNdvi: number | null;
    latestNdvi: number | null;
    validCount: number;
    likelyFallow: boolean | null;
    greenNow: boolean | null;
    dNdvi: number | null;
    seasonAmplitude: number | null;
    latestClass: { key: string; ne: string; en: string } | null;
  };
  radar: { date: string; vvDb: number | null; vhDb: number | null }[];
  radarVerdict: { validCount: number; vhRangeDb: number | null; latestVhDb: number | null; latestVvDb: number | null; moistureIndex: number | null; cropCycleSeen: boolean | null; paddySignature: boolean | null };
  terrain: { elevationM: number | null; slopeDeg: number | null; aspectDeg: number | null };
  prediction: { label: string; probability: number; version: string; createdAt: string } | null;
  ndviClasses: NdviClass[];
}

const classFor = (classes: NdviClass[], v: number) => classes.reduce((found, c) => (v >= c.min ? c : found), classes[0]!);

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const COMPASS_NE = ["उत्तर", "उत्तर-पूर्व", "पूर्व", "दक्षिण-पूर्व", "दक्षिण", "दक्षिण-पश्चिम", "पश्चिम", "उत्तर-पश्चिम"];

export function FieldGreenness({ parcelId }: { parcelId: string }) {
  const { tr, num } = useLang();
  const { data } = useApi<FieldSatelliteData>(`/v1/satellite/parcels/${parcelId}`);
  if (!data) return null;
  const classes = data.ndviClasses ?? [];
  const valid = data.series.filter((s): s is typeof s & { ndvi: number } => s.ndvi != null).map((s) => ({ date: s.date, ndvi: s.ndvi }));
  const latest = [...data.series].reverse().find((s) => s.ndvi != null);
  const v = data.verdict;
  const r = data.radarVerdict;
  const t = data.terrain;

  const verdict =
    v.validCount === 0 && r.validCount === 0
      ? tr("भू-उपग्रह तथ्याङ्क अझै आएको छैन। अर्को स्वचालित अद्यावधिकपछि देखिनेछ।", "No satellite readings yet. They will appear after the next automatic update.")
      : r.cropCycleSeen
        ? tr("राडारले यस मौसम बाली उम्रेको देखाउँछ (बादलमा पनि)।", "Radar shows a crop growing this season (it sees through cloud).")
        : v.likelyFallow
          ? tr("धेरै समयदेखि हरियो देखिएन: बाँझो हुन सक्छ।", "Not green for a long time: possibly fallow.")
          : v.greenNow
            ? tr("अहिले बाली हरियो देखिन्छ।", "The crop looks green now.")
            : tr("यस मौसम हरियो भएको थियो, अहिले खाली वा काटिएको देखिन्छ।", "Was green this season; looks bare or harvested now.");

  const indices = latest
    ? [
        { key: "NDVI", value: latest.ndvi, ne: "हरियाली", en: "Greenness" },
        { key: "NDRE", value: latest.ndre, ne: "बालीको बल (नाइट्रोजन)", en: "Crop vigour (nitrogen)" },
        { key: "NDWI", value: latest.ndwi, ne: "खुला पानी", en: "Open water" },
        { key: "NDMI", value: latest.ndmi, ne: "पातको चिस्यान", en: "Leaf moisture" },
      ]
    : [];
  const aspectIdx = t.aspectDeg != null ? Math.round(t.aspectDeg / 45) % 8 : null;

  return (
    <div className="mt-4 border-t border-line pt-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="flex items-center gap-2 font-heading text-h4 text-ink">
          <Satellite className="size-5 text-brand-700" strokeWidth={1.75} aria-hidden />
          {tr("भू-उपग्रह जाँच", "Satellite check")}
        </h3>
        {v.peakNdvi != null && <span className="text-caption text-muted">{tr(`उच्चतम NDVI ${num(v.peakNdvi)}`, `Peak NDVI ${v.peakNdvi}`)}</span>}
      </div>

      {valid.length > 0 && <NdviHistory points={valid} classes={classes} />}

      {classes.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-caption text-muted" aria-label={tr("NDVI मापन", "NDVI scale")}>
          {classes.slice(1).map((c) => (
            <li key={c.key} className="flex items-center gap-1">
              <span className="inline-block size-2.5 rounded-sm" style={{ background: c.color }} aria-hidden />
              {num(c.min)}+ {tr(c.ne, c.en)}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-small text-body">{verdict}</p>

      {indices.length > 0 && (
        <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {indices.map((i) => (
            <div key={i.key} className="rounded-control border border-line p-2">
              <dt className="text-caption text-muted">
                {i.key}, {tr(i.ne, i.en)}
              </dt>
              <dd className="font-heading text-h4 text-ink">{i.value == null ? "-" : num(i.value)}</dd>
            </div>
          ))}
        </dl>
      )}
      {v.dNdvi != null && (
        <p className="mt-2 text-caption text-muted">
          {tr(`पछिल्लो फरक (dNDVI): ${v.dNdvi >= 0 ? "+" : ""}${num(v.dNdvi)}`, `Latest change (dNDVI): ${v.dNdvi >= 0 ? "+" : ""}${v.dNdvi}`)}
          {v.dNdvi > 0.05 ? tr(", हरियाली बढ्दै", ", greening up") : v.dNdvi < -0.05 ? tr(", हरियाली घट्दै (कटनी वा क्षति)", ", greenness falling (harvest or damage)") : ""}
        </p>
      )}

      {r.validCount > 0 && (
        <div className="mt-4">
          <p className="text-small font-semibold text-ink">{tr("राडार (Sentinel-1, बादलमा पनि)", "Radar (Sentinel-1, works through cloud)")}</p>
          <p className="mt-1 text-small text-body">
            {tr(`VH ${num(r.latestVhDb ?? 0)} dB, VV ${num(r.latestVvDb ?? 0)} dB, मौसमभरि VH फरक ${num(r.vhRangeDb ?? 0)} dB।`, `VH ${r.latestVhDb} dB, VV ${r.latestVvDb} dB, VH change over the season ${r.vhRangeDb} dB.`)}{" "}
            {r.moistureIndex != null && tr(`माटोको चिस्यान: ${num(Math.round(r.moistureIndex * 100))}% (यो खेतको आफ्नै सुख्खा-भिजेको दायरामा)।`, `Soil wetness: ${Math.round(r.moistureIndex * 100)}% of this field's own dry-to-wet range.`)}{" "}
            {r.paddySignature && tr("धान रोपाइँको संकेत (पानी जमेपछि बाली बढेको)।", "Transplanted paddy signature (flooded, then the crop grew).")}
          </p>
        </div>
      )}

      {(t.elevationM != null || t.slopeDeg != null) && (
        <p className="mt-3 text-small text-body">
          {tr("भू-बनोट: ", "Terrain: ")}
          {t.elevationM != null && tr(`उचाइ ${num(t.elevationM)} मि.`, `${t.elevationM} m above sea level`)}
          {t.slopeDeg != null && tr(`, भिरालो ${num(t.slopeDeg)}°`, `, slope ${t.slopeDeg}°`)}
          {aspectIdx != null && t.slopeDeg != null && t.slopeDeg >= 2 && tr(`, ${COMPASS_NE[aspectIdx]} फर्केको`, `, facing ${COMPASS[aspectIdx]}`)}
        </p>
      )}

      {data.prediction && (
        <p className="mt-3 text-small text-body">
          {tr("मोडेलको अनुमान: ", "Model estimate: ")}
          <span className="font-semibold text-ink">
            {data.prediction.label === "cultivated" ? tr("खेती भएको", "cultivated") : tr("बाँझो", "fallow")} ({num(Math.round(data.prediction.probability * 100))}% {tr("खेती हुने सम्भावना", "chance cultivated")})
          </span>
          {!data.prediction.version.includes("synthetic") && <span className="block text-caption text-muted">{data.prediction.version}</span>}
        </p>
      )}
    </div>
  );
}
