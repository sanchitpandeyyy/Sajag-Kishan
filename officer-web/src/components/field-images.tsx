"use client";

/**
 * Satellite picture timeline for one field: for each clear Sentinel-2 date, the true-colour photo and
 * the NDVI map of the ~900 m around the field (the field is the ring in the middle), with what the
 * system read at the field on that date.
 */
import { Image as ImageIcon, Leaf } from "lucide-react";
import { useState } from "react";
import { NdviScale } from "@/components/area-image";
import { useLang } from "@/lib/i18n";
import { useApi } from "@/lib/use-api";

interface FieldImagesResponse {
  parcel: { id: string; localName: string | null; landCover: string | null; croplandShare: number | null };
  images: { sceneId: string; date: string; trueColor: string; ndvi: string; ndviValue: number | null; ndre: number | null; ndwi: number | null; ndmi: number | null; cloudPct: number | null; ndviClass: string }[];
}

const CLASS_LABEL: Record<string, [string, string]> = {
  water: ["पानी/बादल", "Water or cloud"],
  bare: ["खाली माटो", "Bare soil"],
  sparse: ["पातलो बिरुवा", "Sparse plants"],
  moderate: ["मध्यम बाली", "Moderate crop"],
  dense: ["बाक्लो बाली", "Dense crop"],
  very_dense: ["धेरै बाक्लो", "Very dense"],
  peak: ["अधिकतम हरियाली", "Peak greenness"],
};

const LAND_COVER: Record<string, [string, string]> = {
  cropland: ["खेतीयोग्य जमिन", "Cropland"],
  trees: ["रुख/जङ्गल", "Trees or forest"],
  built: ["बस्ती", "Built-up"],
  water: ["पानी", "Water"],
  grass: ["घाँसे मैदान", "Grassland"],
  shrub: ["झाडी", "Shrubland"],
  bare: ["खाली जमिन", "Bare land"],
};

export function FieldImages({ parcelId, limit = 6 }: { parcelId: string; limit?: number }) {
  const { tr, num, lang } = useLang();
  const [view, setView] = useState<"both" | "ndvi" | "trueColor">("both");
  const { data, loading, error } = useApi<FieldImagesResponse>(`/v1/satellite/parcels/${parcelId}/images?limit=${limit}`);
  const date = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(lang === "ne" ? "ne-NP" : "en-GB", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        {data?.parcel.landCover && (
          <p className="text-small text-body">
            {tr("भू-आवरण (ESA WorldCover): ", "Land cover (ESA WorldCover): ")}
            <span className={`font-semibold ${data.parcel.landCover === "cropland" ? "text-brand-700" : "text-danger"}`}>{tr(...(LAND_COVER[data.parcel.landCover] ?? [data.parcel.landCover, data.parcel.landCover]))}</span>
            {data.parcel.croplandShare != null && tr(`, ५० मि. वरिपरि ${num(Math.round(data.parcel.croplandShare * 100))}% खेतीयोग्य`, `, ${Math.round(data.parcel.croplandShare * 100)}% cropland within 50 m`)}
          </p>
        )}
        <div className="flex gap-2" role="tablist" aria-label={tr("तस्बिर", "Pictures")}>
          {(
            [
              ["both", null, tr("दुवै", "Both")],
              ["ndvi", Leaf, "NDVI"],
              ["trueColor", ImageIcon, tr("साँचो रङ", "True colour")],
            ] as const
          ).map(([k, Icon, label]) => (
            <button
              key={k}
              role="tab"
              aria-selected={view === k}
              onClick={() => setView(k)}
              className={`flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-caption font-semibold ${view === k ? "border-brand-800 bg-brand-800 text-white" : "border-line bg-fill text-body"}`}
            >
              {Icon && <Icon className="size-3.5" aria-hidden />} {label}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="text-small text-danger">{error}</p>}
      {loading && !data && <div className="h-40 animate-pulse rounded-card bg-fill" />}
      {data && data.images.length === 0 && <p className="text-small text-muted">{tr("यो खेतको भू-उपग्रह तस्बिर अझै छैन। नक्सा पृष्ठबाट जाँच चलाउनुहोस्।", "No satellite pictures for this field yet. Run a check from the map page.")}</p>}
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {data?.images.map((im) => {
          const cls = CLASS_LABEL[im.ndviClass];
          return (
            <li key={im.sceneId} className="rounded-card border border-line p-3">
              <div className={`grid gap-2 ${view === "both" ? "grid-cols-2" : "grid-cols-1"}`}>
                {(view === "both" ? (["trueColor", "ndvi"] as const) : ([view] as const)).map((k) => (
                  <div key={k} className="relative aspect-square overflow-hidden rounded-control bg-fill">
                    {/* eslint-disable-next-line @next/next/no-img-element -- remote tiles rendered on demand */}
                    <img src={im[k]} alt={`${k === "ndvi" ? "NDVI" : tr("साँचो रङ", "True colour")} ${im.date}`} loading="lazy" className="absolute inset-0 size-full object-cover" />
                    <span className="absolute top-1/2 left-1/2 block size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1.5px_rgba(0,0,0,0.6)]" aria-hidden />
                  </div>
                ))}
              </div>
              <p className="mt-2 flex items-baseline justify-between gap-2">
                <span className="text-small font-semibold text-ink">{date(im.date)}</span>
                <span className="text-caption text-muted">{im.cloudPct != null ? tr(`बादल ${num(Math.round(im.cloudPct))}%`, `cloud ${Math.round(im.cloudPct)}%`) : ""}</span>
              </p>
              <p className="text-small text-body">
                NDVI <span className="font-semibold text-ink">{im.ndviValue != null ? num(im.ndviValue) : "-"}</span>
                {cls ? `, ${tr(cls[0], cls[1])}` : ""}
              </p>
              <p className="text-caption text-muted">
                NDRE {im.ndre != null ? num(im.ndre) : "-"}, NDWI {im.ndwi != null ? num(im.ndwi) : "-"}, NDMI {im.ndmi != null ? num(im.ndmi) : "-"}
              </p>
            </li>
          );
        })}
      </ul>
      {data && data.images.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-caption text-muted">
          <span>{tr("बीचको घेरा = दर्ता खेत। तस्बिर: Sentinel-2, Microsoft Planetary Computer", "Ring in the middle = the registered field. Pictures: Sentinel-2 via Microsoft Planetary Computer")}</span>
          <NdviScale />
        </div>
      )}
    </div>
  );
}
