"use client";

import { Image as ImageIcon, Leaf } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { STATUS, type FieldStatus } from "@/components/land-charts";
import { useLang } from "@/lib/i18n";
import { useApi } from "@/lib/use-api";
import { storedSat } from "@/lib/stored-image";

type BBox = [number, number, number, number];

interface AreaImagesResponse {
  bbox: BBox | null;
  points: { id: string; lat: number; lng: number; ward: number; areaM2: number; farmerNameNe: string }[];
  season: { key: string; ne: string; en: string } | null;
  image: { sceneId: string; date: string; trueColor: string; ndvi: string; cloudPct: number } | null;
  seasons: { key: string; ne: string; en: string }[];
}

export function NdviScale() {
  const { tr } = useLang();
  return (
    <div className="flex items-center gap-2 text-caption text-muted">
      <span>{tr("खाली ०", "Bare 0")}</span>
      <span className="h-2.5 w-36 rounded-full" style={{ background: "linear-gradient(90deg,#a50026,#f46d43,#fee08b,#d9ef8b,#66bd63,#006837)" }} aria-hidden />
      <span>{tr("बाक्लो बाली ०.९+", "Dense crop 0.9+")}</span>
    </div>
  );
}

export function AreaImage({
  localLevelId,
  ward,
  statusById,
  linkFor,
  defaultSeason,
}: {
  localLevelId?: number;
  ward?: number;
  statusById?: Map<string, FieldStatus>;
  linkFor?: (id: string) => string | null;
  defaultSeason?: string;
}) {
  const { tr, num, lang } = useLang();
  const [season, setSeason] = useState<string>(defaultSeason ?? "");
  const [view, setView] = useState<"ndvi" | "trueColor">("ndvi");
  const params = new URLSearchParams();
  if (localLevelId) params.set("localLevelId", String(localLevelId));
  if (ward) params.set("ward", String(ward));
  if (season) params.set("season", season);
  const { data, loading, error } = useApi<AreaImagesResponse>(`/v1/satellite/area-images?${params}`);
  const [loaded, setLoaded] = useState<string | null>(null);

  const src = data?.image ? storedSat(data.image[view]) : null;
  const pos = (lat: number, lng: number, b: BBox) => ({ left: `${((lng - b[0]) / (b[2] - b[0])) * 100}%`, top: `${((b[3] - lat) / (b[3] - b[1])) * 100}%` });
  const date = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(lang === "ne" ? "ne-NP" : "en-GB", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2" role="tablist" aria-label={tr("तस्बिरको प्रकार", "Picture type")}>
          {(
            [
              ["ndvi", Leaf, tr("हरियाली (NDVI)", "Greenness (NDVI)")],
              ["trueColor", ImageIcon, tr("साँचो रङ", "True colour")],
            ] as const
          ).map(([k, Icon, label]) => (
            <button
              key={k}
              role="tab"
              aria-selected={view === k}
              onClick={() => setView(k)}
              className={`flex min-h-10 items-center gap-2 rounded-full border px-4 text-small font-semibold ${view === k ? "border-brand-800 bg-brand-800 text-white" : "border-line bg-fill text-body"}`}
            >
              <Icon className="size-4" aria-hidden /> {label}
            </button>
          ))}
        </div>
        <select aria-label={tr("मौसम", "Season")} value={season} onChange={(e) => setSeason(e.target.value)} className="min-h-10 rounded-control border-[1.5px] border-input-border bg-white px-3 text-small">
          <option value="">{tr("पछिल्लो ६० दिन", "Last 60 days")}</option>
          {data?.seasons.map((s) => (
            <option key={s.key} value={s.key}>
              {tr(s.ne, s.en)}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-small text-danger">{error}</p>}
      {!data && loading && <div className="aspect-square w-full animate-pulse rounded-card bg-fill" />}
      {data && !data.image && <p className="py-8 text-center text-small text-muted">{tr("यो अवधिमा सफा (बादलरहित) तस्बिर भेटिएन।", "No clear (cloud-free) picture in this period.")}</p>}
      {data?.image && data.bbox && src && (
        <figure>
          <div className="relative aspect-square w-full overflow-hidden rounded-card bg-fill">
            {/* eslint-disable-next-line @next/next/no-img-element -- remote tiles rendered on demand */}
            <img src={src} alt={tr(`भू-उपग्रह तस्बिर ${data.image.date}`, `Satellite picture ${data.image.date}`)} className="absolute inset-0 size-full object-cover" onLoad={() => setLoaded(src)} />
            {loaded !== src && <div className="absolute inset-0 animate-pulse bg-fill/60" aria-hidden />}
            {data.points.map((p) => {
              const st = statusById?.get(p.id);
              const href = linkFor?.(p.id);
              const dot = (
                <span
                  className="absolute block size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
                  style={{ ...pos(p.lat, p.lng, data.bbox!), background: st ? STATUS[st].color : "#ffffff" }}
                  title={`${p.farmerNameNe}, ${tr("वडा", "ward")} ${p.ward}, ${num(p.areaM2 / 10_000, 2)} ${tr("हे.", "ha")}${st ? `, ${tr(STATUS[st].ne, STATUS[st].en)}` : ""}`}
                />
              );
              return href ? (
                <Link key={p.id} href={href} aria-label={p.farmerNameNe}>
                  {dot}
                </Link>
              ) : (
                <span key={p.id}>{dot}</span>
              );
            })}
          </div>
          <figcaption className="mt-2 flex flex-wrap items-center justify-between gap-2 text-caption text-muted">
            <span>
              Sentinel-2, {date(data.image.date)}, {tr(`बादल ${num(Math.round(data.image.cloudPct))}%`, `cloud ${Math.round(data.image.cloudPct)}%`)}
              {data.season ? `, ${tr(data.season.ne, data.season.en)}` : ""}
            </span>
            {view === "ndvi" && <NdviScale />}
          </figcaption>
        </figure>
      )}
    </div>
  );
}
