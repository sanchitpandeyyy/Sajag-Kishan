"use client";

import { FlaskConical, LandPlot, Sprout, SquareDashed, Table2, Wheat, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Card, PrimaryButton, Shell, StateMessage } from "@/components/shell";
import { StatTile, type Tone } from "@/components/stat-tile";
import { SEASON_LABEL, useLang } from "@/lib/i18n";
import { CROP_COLORS, CROP_EN, type MapSummary } from "@/lib/types";
import { useApi } from "@/lib/use-api";

export default function Dashboard() {
  const { tr, num } = useLang();
  const { data, error, loading } = useApi<MapSummary>("/v1/map/summary");
  const t = data?.totals;
  const ha = (m2: number) => num(m2 / 10_000);
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
  const fallow = t ? t.declaredFallowM2 + t.noDataM2 : 0;

  const kpis: { label: string; value: number | undefined; icon: LucideIcon; tone: Tone; note: string }[] = [
    { label: tr("कुल दर्ता जग्गा", "Registered land"), value: t?.registeredM2, icon: LandPlot, tone: "blue", note: tr(`${num(t?.parcels ?? 0)} कित्ता/खेत`, `${t?.parcels ?? 0} parcels`) },
    { label: tr("खेती गरिएको", "Cultivated"), value: t?.cultivatedM2, icon: Sprout, tone: "green", note: t ? tr(`घोषणा अनुसार ${num(pct(t.cultivatedM2, t.registeredM2))}%`, `${pct(t.cultivatedM2, t.registeredM2)}% as declared`) : "" },
    { label: tr("बाँझो / विवरण नभएको", "Fallow / no data"), value: fallow, icon: SquareDashed, tone: "brown", note: t ? tr(`घोषित बाँझो ${ha(t.declaredFallowM2)} हे.`, `Declared fallow ${ha(t.declaredFallowM2)} ha`) : "" },
    { label: tr("मल प्रयोग भएको", "Fertilized"), value: t?.fertilizedM2, icon: FlaskConical, tone: "teal", note: tr("घोषणा + वितरित अनुदान", "Declared + delivered subsidy") },
  ];

  const season = data ? SEASON_LABEL[data.season] : null;

  return (
    <Shell
      title={tr("कृषि नक्सा ड्यासबोर्ड", "KrishiMap dashboard")}
      subtitle={data && season ? tr(`आ.व. ${data.fiscalYearBs}, ${season[0]} मौसम`, `FY ${data.fiscalYearBs}, ${season[1]} season`) : tr("तपाईंको कार्यक्षेत्र", "Your area")}
      action={
        <Link href="/reports">
          <PrimaryButton>{tr("प्रतिवेदन तयार गर्नुहोस्", "Create report")}</PrimaryButton>
        </Link>
      }
    >
      <StateMessage loading={loading} error={error} />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <StatTile key={k.label} icon={k.icon} tone={k.tone} label={k.label} value={`${k.value != null ? ha(k.value) : num(0)} ${tr("हे.", "ha")}`} note={k.note} />
        ))}
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card icon={Wheat} title={tr("बाली अनुसार क्षेत्रफल", "Area by crop")} className="lg:col-span-2" action={<Link href="/map" className="text-sm font-semibold text-brand-700 hover:underline">{tr("नक्सा हेर्नुहोस् →", "Open map →")}</Link>}>
          {!t?.byCrop.length && <p className="text-sm text-ink-muted">{tr("यस मौसमको बाली घोषणा अझै छैन।", "No crop declarations yet this season.")}</p>}
          <ul className="space-y-3">
            {t?.byCrop.map((c) => {
              const p = pct(c.areaM2, t.cultivatedM2 || 1);
              return (
                <li key={c.crop}>
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold">{tr(c.nameNe, CROP_EN[c.crop] ?? c.crop)}</span>
                    <span>
                      {ha(c.areaM2)} {tr("हे.", "ha")}, {num(c.parcels)} {tr("खेत", "parcels")}
                    </span>
                  </div>
                  <div className="mt-1 h-2.5 rounded-full bg-surface-muted">
                    <div className="h-2.5 rounded-full" style={{ width: `${Math.min(100, p)}%`, background: CROP_COLORS[c.crop] ?? "#4A9F1E" }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card icon={FlaskConical} title={tr("मलको माग (यो मौसम)", "Fertilizer demand (this season)")}>
          <p className="mb-3 text-xs text-ink-muted">{tr("घोषित खेती क्षेत्र × सिफारिस मात्रा (प्रारम्भिक मान)", "Declared cultivated area × recommended dose (initial values)")}</p>
          <ul className="space-y-2">
            {Object.entries(data?.fertilizerDemandKg ?? {}).map(([product, kg]) => (
              <li key={product} className="flex items-center justify-between rounded-lg bg-surface-muted px-3 py-2">
                <span className="font-semibold">{product}</span>
                <span className="font-heading text-lg">
                  {num(Math.round(kg / 50))} {tr("बोरा", "sacks")}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-muted">{tr("१ बोरा = ५० केजी। भण्डारण योजनाका लागि वडागत विवरण तल।", "1 sack = 50 kg. Ward detail below for storage planning.")}</p>
        </Card>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card icon={Table2} title={tr("वडागत जग्गा विवरण", "Land by ward")} className="overflow-x-auto lg:col-span-3">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="text-left text-ink-muted">
              <tr>
                <th className="py-2">{tr("वडा", "Ward")}</th>
                <th>{tr("दर्ता (हे.)", "Registered (ha)")}</th>
                <th>{tr("खेती (हे.)", "Cultivated (ha)")}</th>
                <th>{tr("बाँझो/विवरण नभएको", "Fallow / no data")}</th>
                <th>{tr("मल प्रयोग", "Fertilized")}</th>
                <th>{tr("खेत", "Parcels")}</th>
              </tr>
            </thead>
            <tbody>
              {data?.wards.map((w) => (
                <tr key={w.wardId} className="border-t border-line">
                  <td className="py-2 font-semibold">{num(w.number ?? 0)}</td>
                  <td>{ha(w.registeredM2)}</td>
                  <td className="text-brand-500">{ha(w.cultivatedM2)}</td>
                  <td className="text-soil">{ha(w.fallowM2)}</td>
                  <td className="text-info">{ha(w.fertilizedM2)}</td>
                  <td>{num(w.parcels)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      <p className="mt-8 text-xs text-ink-muted">
        {tr(
          "स्रोत: जग्गा दर्ता र कृषकबाट, खेती कृषक घोषणाबाट। भू-उपग्रह अझै जोडिएको छैन। सबै अनुमान प्रमाणीकरणको आधार मात्र हुन्।",
          "Sources: land from the registry and farmers, cultivation from farmer declarations. Satellite data is not connected yet. All estimates are a basis for verification only.",
        )}
      </p>
    </Shell>
  );
}
