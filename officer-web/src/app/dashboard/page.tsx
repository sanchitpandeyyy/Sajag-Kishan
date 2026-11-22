"use client";

import { ArrowRight, ChartColumnStacked, ClipboardCheck, FlaskConical, Gauge, LandPlot, MapPinned, SatelliteDish, ScanSearch, Sprout, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AiSummary } from "@/components/ai-summary";
import { AreaImage } from "@/components/area-image";
import { CompareBars, ha, SeasonColumns, STATUS, StatusBar, StatusLegend, type FieldStatus } from "@/components/land-charts";
import { ParcelMap, type ParcelFeature } from "@/components/parcel-map";
import { Card, Shell, StateMessage } from "@/components/shell";
import { StatTile } from "@/components/stat-tile";
import { FLAGS, PRODUCTIVITY, seasonShort, type Dashboard, type DashboardField, type Productivity } from "@/lib/dashboard";
import { useLang } from "@/lib/i18n";
import { useApi } from "@/lib/use-api";

export default function DashboardPage() {
  const { tr, num } = useLang();
  const [localLevelId, setLocalLevelId] = useState<number | null>(null);
  const { data, error, loading } = useApi<Dashboard>(`/v1/dashboard${localLevelId ? `?localLevelId=${localLevelId}` : ""}`);
  const [selected, setSelected] = useState<string | null>(null);

  const s = data?.scope;
  const land = data?.land;
  const muni = s ? tr(s.localLevel.nameNe, s.localLevel.nameEn) : tr("नगरपालिका", "Municipality");
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

  const features: ParcelFeature[] = useMemo(
    () =>
      (data?.fields ?? [])
        .filter((f) => f.lat != null && f.lng != null)
        .map((f) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [f.lng!, f.lat!] },
          properties: { id: f.id, ward: f.ward, areaM2: f.areaM2, verification: f.verification, farmerNameNe: f.farmerNameNe, tole: f.localName ?? "", crop: f.declaredCrop?.code ?? null, cropNe: f.declaredCrop?.nameNe ?? null, status: f.status },
        })),
    [data],
  );
  const statusById = useMemo(() => new Map((data?.fields ?? []).map((f) => [f.id, f.status])), [data]);
  const byId = useMemo(() => new Map((data?.fields ?? []).map((f) => [f.id, f])), [data]);
  const picked = selected ? byId.get(selected) : null;

  const satCultivated = land ? land.satellite.cultivated : 0;
  const satGreen = land ? land.satellite.cultivated + land.satellite.weak : 0;
  const gap = land ? land.declaredCultivatedM2 - satGreen : 0;

  return (
    <Shell
      title={tr(`${muni} कृषि ड्यासबोर्ड`, `${muni} agriculture dashboard`)}
      subtitle={s ? tr(`${s.district.nameNe}, ${s.province.nameNe}। तुलना: ${s.mainSeason.ne}`, `${s.district.nameEn}, ${s.province.nameEn}. Comparing ${s.mainSeason.en}`) : tr("तपाईंको नगरपालिका", "Your municipality")}
      action={
        s && s.choices.length > 1 ? (
          <label className="flex items-center gap-2 text-small text-body">
            {tr("नगरपालिका", "Municipality")}
            <select value={s.localLevel.id} onChange={(e) => setLocalLevelId(Number(e.target.value))} className="min-h-11 rounded-control border-[1.5px] border-input-border bg-white px-3">
              {s.choices.map((c) => (
                <option key={c.id} value={c.id}>
                  {tr(c.nameNe, c.nameEn)}
                </option>
              ))}
            </select>
          </label>
        ) : null
      }
    >
      <StateMessage loading={loading && !data} error={error} />
      <AiSummary />

      {data && land && s && (
        <>
          {s.inProgress && (
            <p className="mb-6 flex items-start gap-2 text-small text-body">
              <Sprout className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden />
              {tr(
                `${s.inProgress.ne} भर्खर सुरु भएको छ, बाली अझै उम्रँदैछ। त्यसैले सबै तुलना ${s.mainSeason.ne} को हो।`,
                `${s.inProgress.en} has just started and crops are still coming up, so every comparison here is for ${s.mainSeason.en}.`,
              )}
            </p>
          )}

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatTile icon={Users} tone="blue" label={tr("दर्ता कृषक", "Registered farmers")} value={num(data.farmers.total)} note={tr(`${num(data.farmers.withAccount)} जनाको एप खाता`, `${data.farmers.withAccount} with an app account`)} />
            <StatTile icon={LandPlot} tone="brown" label={tr("दर्ता जग्गा", "Registered land")} value={`${num(ha(land.registeredM2), 2)} ${tr("हे.", "ha")}`} note={tr(`${num(data.farmers.fields)} खेत, ${num(data.farmers.mappedFields)} नक्सामा`, `${data.farmers.fields} fields, ${data.farmers.mappedFields} mapped`)} />
            <StatTile icon={SatelliteDish} tone="green" label={tr("भू-उपग्रहमा खेती देखिएको", "Satellite: cultivated")} value={`${num(ha(satCultivated), 2)} ${tr("हे.", "ha")}`} note={tr(`दर्ताको ${num(pct(satCultivated, land.registeredM2))}%, कमजोर हरियाली ${num(ha(land.satellite.weak), 2)} हे.`, `${pct(satCultivated, land.registeredM2)}% of registered, weak green ${ha(land.satellite.weak).toFixed(2)} ha`)} />
            <StatTile icon={Sprout} tone="gold" label={tr("किसानले घोषणा गरेको खेती", "Declared cultivated")} value={`${num(ha(land.declaredCultivatedM2), 2)} ${tr("हे.", "ha")}`} note={tr(`घोषणा नभएको ${num(ha(land.noDeclarationM2), 2)} हे.`, `No declaration: ${ha(land.noDeclarationM2).toFixed(2)} ha`)} />
            <StatTile icon={FlaskConical} tone="teal" label={tr("मल प्रयोग भएको जग्गा", "Fertilized land")} value={`${num(ha(land.fertilizedM2), 2)} ${tr("हे.", "ha")}`} note={tr(`बाँझो जग्गामा ${num(land.fertilizerOnFallowKg)} केजी मल`, `${land.fertilizerOnFallowKg} kg went to fallow land`)} />
            <StatTile icon={ScanSearch} tone="blue" label={tr("जाँच गर्नुपर्ने खेत", "Fields to check")} value={num(data.checks.length)} note={tr("तल सूची हेर्नुहोस्", "See the list below")} />
          </section>

          <section className="mt-6 grid gap-4 lg:grid-cols-2">
            <Card icon={ClipboardCheck} title={tr("घोषणा र भू-उपग्रहको तुलना", "Declared vs satellite")}>
              <CompareBars
                unit={tr("हे.", "ha")}
                rows={[
                  { label: tr("दर्ता जग्गा", "Registered land"), value: ha(land.registeredM2), color: "#8a5a3b" },
                  { label: tr("किसानले घोषणा गरेको खेती", "Declared cultivated by farmers"), value: ha(land.declaredCultivatedM2), color: "#d9a93a" },
                  { label: tr("भू-उपग्रहमा हरियो (खेती + कमजोर)", "Green on satellite (cultivated + weak)"), value: ha(satGreen), color: "#1f7a4d" },
                ]}
              />
              <p className="mt-4 text-small text-body">
                {gap > 100
                  ? tr(`किसानले घोषणा गरेभन्दा ${num(ha(gap), 2)} हे. कम जग्गा भू-उपग्रहमा हरियो देखियो। यी खेत जाँच्नुहोस्।`, `The satellite saw ${ha(gap).toFixed(2)} ha less green land than farmers declared. Check those fields.`)
                  : tr("घोषणा र भू-उपग्रह लगभग मिल्छ।", "Declarations and the satellite roughly agree.")}
              </p>
            </Card>

            <Card icon={SatelliteDish} title={tr(`भू-उपग्रहले देखेको जग्गा, ${s.mainSeason.ne}`, `What the satellite saw, ${s.mainSeason.en}`)}>
              <StatusBar areas={land.satellite} />
              <div className="mt-5 border-t border-line pt-4">
                <p className="mb-2 text-small font-semibold text-ink">{tr("मल प्रयोग", "Fertilizer use")}</p>
                <div className="flex h-4 overflow-hidden rounded-full bg-fill">
                  <div style={{ width: `${pct(land.fertilizedM2, land.registeredM2)}%`, background: "#1b7a95" }} title={tr("मल प्रयोग भएको", "Fertilized")} />
                </div>
                <p className="mt-2 text-caption text-muted">
                  {tr(`दर्ता जग्गाको ${num(pct(land.fertilizedM2, land.registeredM2))}% मा मल अभिलेख छ। खेती देखिएको तर मल अभिलेख नभएको: ${num(ha(land.cultivatedUnfertilizedM2), 2)} हे.`, `${pct(land.fertilizedM2, land.registeredM2)}% of registered land has a fertilizer record. Cultivated without a record: ${ha(land.cultivatedUnfertilizedM2).toFixed(2)} ha.`)}
                </p>
              </div>
            </Card>
          </section>

          <section className="mt-6">
            <Card icon={ChartColumnStacked} title={tr("मौसम अनुसार भू-उपग्रहको हेराइ", "Season by season on the satellite")}>
              <SeasonColumns seasons={data.seasons.map((x) => ({ key: x.key, label: tr(x.labelNe, x.labelEn), satellite: x.satellite, declared: x.hasDeclarations ? x.declaredCultivatedM2 : null, inProgress: x.inProgress }))} />
              <StatusLegend className="mt-3" />
            </Card>
          </section>

          <section className="mt-6 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
            <Card icon={MapPinned} title={tr("खेतहरू नक्सामा", "Fields on the map")}>
              <ParcelMap features={features} colorBy="status" selectedId={selected} onSelect={setSelected} />
              <StatusLegend className="mt-3" />
              {picked ? <FieldSummary f={picked} /> : <p className="mt-3 text-caption text-muted">{tr("विवरण हेर्न खेतमा थिच्नुहोस्।", "Tap a field to see its details.")}</p>}
            </Card>
            <Card icon={SatelliteDish} title={tr(`${muni}, भू-उपग्रह तस्बिर`, `${muni} from space`)} action={<Link href="/analytics" className="flex items-center gap-1 text-small font-semibold text-brand-700 hover:underline">{tr("उन्नत विश्लेषण", "Advanced analytics")} <ArrowRight className="size-4" /></Link>}>
              <AreaImage localLevelId={s.localLevel.id} statusById={statusById} linkFor={(id) => `/farmers/${byId.get(id)?.farmerId ?? ""}`} defaultSeason={s.mainSeason.key} />
            </Card>
          </section>

          <section className="mt-6">
            <Card icon={ChartColumnStacked} title={tr("वडा अनुसार", "Ward by ward")}>
              <ul className="space-y-4">
                {data.wards.filter((w) => w.fields > 0).map((w) => {
                  const total = w.registeredM2 || 1;
                  return (
                    <li key={w.number} className="grid grid-cols-[4.5rem_1fr] items-center gap-3 sm:grid-cols-[5rem_1fr_9rem]">
                      <span className="font-semibold text-ink">{tr(`वडा ${num(w.number)}`, `Ward ${w.number}`)}</span>
                      <div className="relative">
                        <div className="flex h-4 overflow-hidden rounded-full bg-fill">
                          {(["cultivated", "weak", "fallow", "unknown"] as FieldStatus[]).map((k) => (w.satellite[k] > 0 ? <div key={k} style={{ width: `${(w.satellite[k] / total) * 100}%`, background: STATUS[k].color }} /> : null))}
                        </div>
                        {w.declaredCultivatedM2 > 0 && <div className="absolute -top-1 h-6 w-0.5 bg-ink" style={{ left: `${Math.min(100, (w.declaredCultivatedM2 / total) * 100)}%` }} title={tr("घोषित खेती", "Declared cultivated")} />}
                      </div>
                      <span className="col-span-2 text-caption text-muted sm:col-span-1 sm:text-right">
                        {num(ha(w.registeredM2), 2)} {tr("हे.", "ha")}, {num(w.fields)} {tr("खेत", "fields")}
                        {w.flagged > 0 && <span className="font-semibold text-danger">, {tr(`${num(w.flagged)} जाँच`, `${w.flagged} to check`)}</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <StatusLegend />
                <span className="flex items-center gap-1.5 text-caption text-body">
                  <span className="inline-block h-3 w-0.5 bg-ink" aria-hidden /> {tr("घोषित खेती", "Declared cultivated")}
                </span>
              </div>
            </Card>
          </section>

          <section className="mt-6 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
            <Card icon={ScanSearch} title={tr("जाँच गर्नुपर्ने खेत", "Fields to check")}>
              {data.checks.length === 0 && <p className="text-small text-muted">{tr("अहिले कुनै खेतमा शंका छैन।", "Nothing looks wrong right now.")}</p>}
              <ul>
                {data.checks.slice(0, 12).map((f) => (
                  <li key={f.id} className="border-t border-line py-3 first:border-t-0 first:pt-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <Link href={`/farmers/${f.farmerId}`} className="font-semibold text-ink underline decoration-line underline-offset-4 hover:decoration-ink">
                        {f.farmerNameNe}
                      </Link>
                      <span className="text-caption text-muted">
                        {tr(`वडा ${num(f.ward)}`, `Ward ${f.ward}`)}, {num(ha(f.areaM2), 2)} {tr("हे.", "ha")}
                        {f.declaredCrop ? `, ${tr(f.declaredCrop.nameNe, f.declaredCrop.nameEn)}` : ""}
                        {f.fertilizerKg > 0 ? tr(`, मल ${num(f.fertilizerKg)} केजी`, `, fertilizer ${f.fertilizerKg} kg`) : ""}
                        {f.peakNdvi != null ? `, NDVI ${num(f.peakNdvi)}` : ""}
                      </span>
                    </div>
                    <ul className="mt-1.5 space-y-1">
                      {f.flags.map((fl) => {
                        const meta = FLAGS[fl];
                        return (
                          <li key={fl} className="flex items-center gap-2 text-small text-body">
                            <meta.icon className="size-4 shrink-0 text-danger" aria-hidden /> {tr(meta.ne, meta.en)}
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))}
              </ul>
              {data.checks.length > 12 && <p className="mt-2 text-caption text-muted">{tr(`अरू ${num(data.checks.length - 12)} खेत उन्नत विश्लेषणमा`, `${data.checks.length - 12} more in Advanced analytics`)}</p>}
            </Card>

            <Card icon={Gauge} title={tr("जग्गाको उत्पादकत्व (भू-उपग्रह)", "Land productivity (satellite)")}>
              <ProductivityBars p={data.productivity} />
              <p className="mt-3 text-caption text-muted">
                {tr(
                  "हरेक खेतको मौसमी अधिकतम NDVI लाई नगरपालिकाको मध्यमानसँग तुलना। यो माटो परीक्षण होइन, उत्पादन क्षमताको सङ्केत मात्र हो।",
                  "Each field's seasonal NDVI peaks compared with the municipality median. Not a soil test, only a sign of how well the land produces.",
                )}
              </p>
            </Card>
          </section>

          <p className="mt-8 text-caption text-muted">
            {tr(
              `विधि (${data.method.rule}): मौसमभित्र NDVI ${num(data.method.cultivatedPeak)} वा बढी = खेती, ${num(data.method.fallowPeak)} भन्दा कम (२+ सफा तस्बिर) = बाँझो, बीचमा = कमजोर हरियाली। स्रोत: Sentinel-2, ESA WorldCover, किसान घोषणा, वितरित अनुदान। सबै नतिजा क्षेत्र भ्रमणका लागि सङ्केत मात्र हुन्।`,
              `Method (${data.method.rule}): NDVI peak in the season of ${data.method.cultivatedPeak} or more = cultivated, below ${data.method.fallowPeak} (2+ clear pictures) = fallow, in between = weak green. Sources: Sentinel-2, ESA WorldCover, farmer declarations, delivered subsidy. Every result is a pointer for a field visit, not proof.`,
            )}
          </p>
        </>
      )}
    </Shell>
  );
}

function ProductivityBars({ p }: { p: Record<Productivity, { fields: number; areaM2: number }> }) {
  const { tr, num } = useLang();
  const keys: Productivity[] = ["high", "normal", "low", "unknown"];
  const max = Math.max(...keys.map((k) => p[k].fields), 1);
  return (
    <ul className="space-y-3">
      {keys.map((k) => (
        <li key={k}>
          <div className="flex justify-between text-small">
            <span className="font-semibold text-ink">{tr(PRODUCTIVITY[k].ne, PRODUCTIVITY[k].en)}</span>
            <span className="text-body">
              {num(p[k].fields)} {tr("खेत", "fields")}, {num(ha(p[k].areaM2), 2)} {tr("हे.", "ha")}
            </span>
          </div>
          <div className="mt-1 h-2.5 rounded-full bg-fill">
            <div className="h-2.5 rounded-full" style={{ width: `${Math.max(1, (p[k].fields / max) * 100)}%`, background: PRODUCTIVITY[k].color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function FieldSummary({ f }: { f: DashboardField }) {
  const { tr, num } = useLang();
  return (
    <div className="mt-3 border-t border-line pt-3 text-small">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Link href={`/farmers/${f.farmerId}`} className="font-semibold text-ink underline decoration-line underline-offset-4">
          {f.farmerNameNe}
          {f.localName ? `, ${f.localName}` : ""}
        </Link>
        <span className="flex items-center gap-1.5 font-semibold" style={{ color: STATUS[f.status].color }}>
          <span className="inline-block size-2.5 rounded-sm" style={{ background: STATUS[f.status].color }} aria-hidden />
          {tr(STATUS[f.status].ne, STATUS[f.status].en)}
        </span>
      </div>
      <p className="mt-1 text-body">
        {tr(`वडा ${num(f.ward)}, ${num(ha(f.areaM2), 2)} हे.`, `Ward ${f.ward}, ${ha(f.areaM2).toFixed(2)} ha`)}
        {f.declaredCrop ? tr(`, घोषणा: ${f.declaredCrop.nameNe}`, `, declared ${f.declaredCrop.nameEn}`) : tr(", घोषणा छैन", ", nothing declared")}
        {f.peakNdvi != null ? `, NDVI ${num(f.peakNdvi)}` : ""}
      </p>
      <p className="mt-2 text-caption text-muted">{tr("पछिल्ला मौसम (पुरानोदेखि नयाँ):", "Past seasons (oldest to newest):")}</p>
      <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-caption text-body">
        {f.history.map((h) => (
          <li key={h.key} className="inline-flex items-center gap-1" title={`${h.key}: ${STATUS[h.status].en}${h.peakNdvi != null ? `, NDVI ${h.peakNdvi}` : ""}`}>
            <span className="inline-block size-2.5 rounded-sm" style={{ background: STATUS[h.status].color }} aria-hidden />
            {seasonShort(h.key, tr)}
          </li>
        ))}
      </ul>
    </div>
  );
}
