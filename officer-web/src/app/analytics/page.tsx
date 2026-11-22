"use client";

/**
 * Advanced analytics: the real satellite pictures behind the dashboard numbers.
 *   1. The whole municipality, or one ward, from space (true colour or NDVI, any recent season),
 *      with every registered field drawn on it in its satellite status colour.
 *   2. Any single field: picture timeline, season-by-season status, what was flagged and why.
 */
import { Filter, Microscope, SatelliteDish, ScanSearch } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AreaImage } from "@/components/area-image";
import { FieldImages } from "@/components/field-images";
import { ha, STATUS, StatusLegend, type FieldStatus } from "@/components/land-charts";
import { Card, Shell, StateMessage } from "@/components/shell";
import { FLAGS, seasonShort, type Dashboard } from "@/lib/dashboard";
import { useLang } from "@/lib/i18n";
import { useApi } from "@/lib/use-api";

type Filter = "check" | "all" | FieldStatus;

export default function AnalyticsPage() {
  const { tr, num } = useLang();
  const [localLevelId, setLocalLevelId] = useState<number | null>(null);
  const { data, error, loading } = useApi<Dashboard>(`/v1/dashboard${localLevelId ? `?localLevelId=${localLevelId}` : ""}`);
  const [ward, setWard] = useState<number | null>(null);
  const [filter, setFilter] = useState<Filter>("check");
  const [fieldId, setFieldId] = useState<string | null>(null);

  const statusById = useMemo(() => new Map((data?.fields ?? []).map((f) => [f.id, f.status])), [data]);
  const fields = useMemo(() => {
    const all = (data?.fields ?? []).filter((f) => f.lat != null && (ward == null || f.ward === ward));
    const list = filter === "check" ? all.filter((f) => f.flags.length) : filter === "all" ? all : all.filter((f) => f.status === filter);
    return list.sort((a, b) => b.flags.length - a.flags.length || a.ward - b.ward);
  }, [data, ward, filter]);
  const field = fieldId ? data?.fields.find((f) => f.id === fieldId) : fields[0];
  const s = data?.scope;
  const wardsWithFields = (data?.wards ?? []).filter((w) => w.fields > 0);

  const chips: { k: Filter; ne: string; en: string }[] = [
    { k: "check", ne: "जाँच गर्नुपर्ने", en: "To check" },
    { k: "all", ne: "सबै", en: "All" },
    { k: "cultivated", ne: STATUS.cultivated.ne, en: STATUS.cultivated.en },
    { k: "weak", ne: STATUS.weak.ne, en: STATUS.weak.en },
    { k: "fallow", ne: STATUS.fallow.ne, en: STATUS.fallow.en },
    { k: "unknown", ne: STATUS.unknown.ne, en: STATUS.unknown.en },
  ];

  return (
    <Shell
      title={tr("उन्नत विश्लेषण", "Advanced analytics")}
      subtitle={s ? tr(`${s.localLevel.nameNe}, भू-उपग्रह तस्बिर र पहिचान`, `${s.localLevel.nameEn}: satellite pictures and detection`) : undefined}
      action={
        s && s.choices.length > 1 ? (
          <select aria-label={tr("नगरपालिका", "Municipality")} value={s.localLevel.id} onChange={(e) => (setLocalLevelId(Number(e.target.value)), setWard(null), setFieldId(null))} className="min-h-11 rounded-control border-[1.5px] border-input-border bg-white px-3 text-small">
            {s.choices.map((c) => (
              <option key={c.id} value={c.id}>
                {tr(c.nameNe, c.nameEn)}
              </option>
            ))}
          </select>
        ) : null
      }
    >
      <StateMessage loading={loading && !data} error={error} />
      {data && s && (
        <>
          <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
            <Card
              icon={SatelliteDish}
              title={ward ? tr(`वडा ${num(ward)}, भू-उपग्रहबाट`, `Ward ${ward} from space`) : tr(`${s.localLevel.nameNe}, भू-उपग्रहबाट`, `${s.localLevel.nameEn} from space`)}
              action={
                <select aria-label={tr("वडा", "Ward")} value={ward ?? ""} onChange={(e) => (setWard(e.target.value ? Number(e.target.value) : null), setFieldId(null))} className="min-h-10 rounded-control border-[1.5px] border-input-border bg-white px-3 text-small">
                  <option value="">{tr("पूरै नगरपालिका", "Whole municipality")}</option>
                  {wardsWithFields.map((w) => (
                    <option key={w.number} value={w.number}>
                      {tr(`वडा ${num(w.number)}`, `Ward ${w.number}`)}
                    </option>
                  ))}
                </select>
              }
            >
              <AreaImage key={`${s.localLevel.id}-${ward ?? "all"}`} localLevelId={s.localLevel.id} ward={ward ?? undefined} statusById={statusById} linkFor={() => null} defaultSeason={s.mainSeason.key} />
              <StatusLegend className="mt-3" />
            </Card>

            <Card icon={ScanSearch} title={tr("खेत छान्नुहोस्", "Pick a field")}>
              <div className="mb-3 flex flex-wrap gap-2" role="tablist" aria-label={tr("छनोट", "Filter")}>
                <Filter className="mt-2 size-4 text-muted" aria-hidden />
                {chips.map((c) => (
                  <button
                    key={c.k}
                    role="tab"
                    aria-selected={filter === c.k}
                    onClick={() => (setFilter(c.k), setFieldId(null))}
                    className={`min-h-9 rounded-full border px-3 text-caption font-semibold ${filter === c.k ? "border-brand-800 bg-brand-800 text-white" : "border-line bg-fill text-body"}`}
                  >
                    {tr(c.ne, c.en)}
                  </button>
                ))}
              </div>
              <ul className="max-h-[560px] overflow-y-auto pr-1">
                {fields.length === 0 && <li className="py-3 text-small text-muted">{tr("यो छनोटमा कुनै खेत छैन।", "No fields match.")}</li>}
                {fields.map((f) => (
                  <li key={f.id}>
                    <button onClick={() => setFieldId(f.id)} aria-current={field?.id === f.id} className={`flex w-full items-start gap-3 border-b border-line py-3 text-left ${field?.id === f.id ? "font-semibold" : ""}`}>
                      <span className="mt-1.5 inline-block size-3 shrink-0 rounded-sm" style={{ background: STATUS[f.status].color }} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block text-small text-ink">
                          {f.farmerNameNe}
                          {f.localName ? `, ${f.localName}` : ""}
                        </span>
                        <span className="block text-caption text-muted">
                          {tr(`वडा ${num(f.ward)}`, `Ward ${f.ward}`)}, {num(ha(f.areaM2), 2)} {tr("हे.", "ha")}, {tr(STATUS[f.status].ne, STATUS[f.status].en)}
                          {f.peakNdvi != null ? `, NDVI ${num(f.peakNdvi)}` : ""}
                        </span>
                      </span>
                      {f.flags.length > 0 && <span className="shrink-0 text-caption font-semibold text-danger">{tr(`${num(f.flags.length)} शंका`, `${f.flags.length} flag${f.flags.length > 1 ? "s" : ""}`)}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          </section>

          {field && (
            <section className="mt-6">
              <Card
                icon={Microscope}
                title={tr(`${field.farmerNameNe}${field.localName ? `, ${field.localName}` : ""}: खेतको विश्लेषण`, `${field.farmerNameNe}${field.localName ? `, ${field.localName}` : ""}: field analysis`)}
                action={
                  <Link href={`/farmers/${field.farmerId}`} className="text-small font-semibold text-brand-700 hover:underline">
                    {tr("कृषकको पृष्ठ", "Farmer page")}
                  </Link>
                }
              >
                <div className="grid gap-4 lg:grid-cols-3">
                  <div>
                    <p className="text-caption text-muted">{tr("दर्ता", "Registered")}</p>
                    <p className="text-small text-ink">
                      {tr(`वडा ${num(field.ward)}, ${num(ha(field.areaM2), 2)} हे.`, `Ward ${field.ward}, ${ha(field.areaM2).toFixed(2)} ha`)}, {field.verification === "VERIFIED" ? tr("प्रमाणित", "verified") : tr("प्रमाणित भएको छैन", "not verified")}
                    </p>
                  </div>
                  <div>
                    <p className="text-caption text-muted">{tr(`घोषणा, ${s.mainSeason.ne}`, `Declared, ${s.mainSeason.en}`)}</p>
                    <p className="text-small text-ink">
                      {field.declaredCrop ? tr(field.declaredCrop.nameNe, field.declaredCrop.nameEn) : field.declaredCultivated === false ? tr("बाँझो", "Fallow") : tr("घोषणा छैन", "Nothing declared")}
                      {field.fertilizerKg > 0 ? tr(`, मल ${num(field.fertilizerKg)} केजी`, `, fertilizer ${field.fertilizerKg} kg`) : ""}
                    </p>
                  </div>
                  <div>
                    <p className="text-caption text-muted">{tr("भू-उपग्रह", "Satellite")}</p>
                    <p className="text-small font-semibold" style={{ color: STATUS[field.status].color }}>
                      {tr(STATUS[field.status].ne, STATUS[field.status].en)}
                      {field.peakNdvi != null ? `, NDVI ${num(field.peakNdvi)}` : ""}
                    </p>
                    {field.prediction && (
                      <p className="text-caption text-muted">
                        {tr("मोडेल", "Model")}: {field.prediction.label === "cultivated" ? tr("खेती", "cultivated") : tr("बाँझो", "fallow")} {num(Math.round(field.prediction.probability * 100))}%{field.prediction.version.includes("synthetic") ? tr(" (डेमो)", " (demo)") : ""}
                      </p>
                    )}
                  </div>
                </div>

                {field.flags.length > 0 && (
                  <ul className="mt-4 space-y-1 border-t border-line pt-3">
                    {field.flags.map((fl) => {
                      const meta = FLAGS[fl];
                      return (
                        <li key={fl} className="flex items-center gap-2 text-small text-body">
                          <meta.icon className="size-4 shrink-0 text-danger" aria-hidden /> {tr(meta.ne, meta.en)}
                        </li>
                      );
                    })}
                  </ul>
                )}

                <div className="mt-4 border-t border-line pt-3">
                  <p className="mb-2 text-small font-semibold text-ink">{tr("मौसम अनुसार भू-उपग्रहको नतिजा", "Satellite result by season")}</p>
                  <ol className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {field.history.map((h) => (
                      <li key={h.key} className="rounded-control border border-line p-2 text-center">
                        <span className="mx-auto mb-1 block h-2 w-full rounded-full" style={{ background: STATUS[h.status].color }} aria-hidden />
                        <span className="block text-caption font-semibold text-ink">{seasonShort(h.key, tr)}</span>
                        <span className="block text-caption text-muted">{tr(STATUS[h.status].ne, STATUS[h.status].en)}</span>
                        <span className="block text-caption text-muted">{h.peakNdvi != null ? `NDVI ${num(h.peakNdvi)}` : tr(`${num(h.readings)} तस्बिर`, `${h.readings} pictures`)}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="mt-5 border-t border-line pt-4">
                  <p className="mb-3 text-small font-semibold text-ink">{tr("भू-उपग्रह तस्बिरहरू (नयाँदेखि पुरानो)", "Satellite pictures (newest first)")}</p>
                  <FieldImages key={field.id} parcelId={field.id} limit={9} />
                </div>
              </Card>
            </section>
          )}
        </>
      )}
    </Shell>
  );
}
