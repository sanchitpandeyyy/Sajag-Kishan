"use client";

import { Beef, ChevronRight, HandCoins, LandPlot, Layers, MapPin, Table2, TrendingUp, Users, Wheat } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AreaExplorer, type Area } from "@/components/area-explorer";
import { KpiGrid } from "@/components/kpi-grid";
import { BarList, TrendLine } from "@/components/national-charts";
import { PublicFrame } from "@/components/public-frame";
import { Card } from "@/components/shell";
import { ButtonA } from "@/components/ui";
import { useLang } from "@/lib/i18n";
import { NATIONAL_SOURCE, TREND_DAYS } from "@/lib/national-data";
import { PROVINCE_DETAIL } from "@/lib/national-provinces";
import { DISTRICT_SHAPES } from "@/lib/nepal-districts-map";

function Cell({ v, digits = 0, suffix = "" }: { v: number | null; digits?: number; suffix?: string }) {
  const { tr, num } = useLang();
  return <td className={v == null ? "text-muted" : undefined}>{v == null ? tr("<५", "<5") : `${num(v, digits)}${suffix}`}</td>;
}

export default function ProvincePage() {
  const { tr, num } = useLang();
  const params = useParams<{ code: string }>();
  const province = PROVINCE_DETAIL.find((p) => String(p.code) === params.code);

  const crumbs = (
    <nav aria-label={tr("तपाईं यहाँ हुनुहुन्छ", "Breadcrumb")} className="mb-4 flex flex-wrap items-center gap-1 text-small text-muted">
      <Link href="/national" className="font-semibold text-brand-700 hover:underline">
        {tr("नेपाल", "Nepal")}
      </Link>
      <ChevronRight className="size-4" aria-hidden />
      <span className="font-semibold text-ink">{province ? tr(province.ne, province.en) : params.code}</span>
    </nav>
  );

  if (!province) {
    return (
      <PublicFrame title={tr("प्रदेश भेटिएन", "Province not found")} crumbs={crumbs}>
        <p className="text-body">{tr("यो प्रदेश उपलब्ध छैन।", "That province is not available.")}</p>
        <Link href="/national" className="mt-4 inline-block font-semibold text-brand-700 hover:underline">
          {tr("राष्ट्रिय तथ्याङ्कमा फर्कनुहोस्", "Back to national data")}
        </Link>
      </PublicFrame>
    );
  }

  const shapes = DISTRICT_SHAPES.filter((s) => s.province === province.en);
  const districtAreas: Area[] = province.districts.map((d) => ({
    id: d.code,
    ne: d.ne,
    en: d.en,
    d: shapes.find((s) => s.code === d.code)?.d ?? "",
    figures: {
      households: d.households,
      verified: d.verified,
      classified: d.classified,
      landHa: d.landHa,
      irrigatedPct: d.irrigatedPct,
      productionMt: d.productionMt,
      livestockUnits: d.livestockUnits,
    },
  }));

  return (
    <PublicFrame
      title={tr(province.ne, province.en + " Province")}
      subtitle={tr(`कृषि तथा पशुपन्छी विकास मन्त्रालयको सार्वजनिक तथ्याङ्क, ${NATIONAL_SOURCE.asOfBs}`, `Public data from the Ministry of Agriculture and Livestock Development, ${NATIONAL_SOURCE.asOfEn}`)}
      crumbs={crumbs}
      action={
        <ButtonA variant="secondary" href={`https://farmer.moald.gov.np/public/dashboard/?level=province&geo=${province.code}`} target="_blank" rel="noreferrer">
          {tr("मूल पृष्ठ खोल्नुहोस्", "Open the source page")}
        </ButtonA>
      }
    >
      <KpiGrid kpi={province.kpi} />

      <AreaExplorer
        heading={{ ne: `${province.ne}, जिल्ला अनुसार`, en: `${province.en} Province by district` }}
        listTitleNe="जिल्ला अनुसार"
        listTitleEn="by district"
        viewBox={province.viewBox}
        areas={districtAreas}
      />

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card icon={Users} title={tr("लिङ्ग अनुसार घरमूली किसान", "Household heads by gender")}>
          <BarList rows={province.gender} ofTotal color="#075426" />
        </Card>
        <Card icon={Layers} title={tr("किसान वर्गीकरण", "Farmer classification")}>
          <p className="mb-3 text-small text-muted">{tr("कृषि व्यवसाय प्रवर्द्धन नियमावली, २०८० को अनुसूची ५ अनुसार", "Under Schedule 5 of the Agribusiness Promotion Regulation, 2080")}</p>
          <BarList rows={province.tiers} />
        </Card>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card icon={Wheat} title={tr("बाली समूह अनुसार उत्पादन", "Production by crop group")}>
          <p className="mb-3 text-small text-muted">{tr("मेट्रिक टन", "Metric tonnes")}</p>
          <BarList rows={province.crops} unit={tr("मे.ट.", "MT")} />
        </Card>
        <Card icon={Beef} title={tr("पशुपन्छी संख्या", "Livestock count")}>
          <p className="mb-3 text-small text-muted">{tr("किसिम अनुसार, माछा बाहेक", "By kind, fish excluded")}</p>
          <BarList rows={province.livestock} color="#8a5a3b" />
        </Card>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card icon={LandPlot} title={tr("जग्गाको प्रयोग", "Land use")}>
          <p className="mb-3 text-small text-muted">{tr("हेक्टर", "Hectares")}</p>
          <BarList rows={province.land} unit={tr("हे.", "ha")} ofTotal color="#1d5fa8" />
        </Card>
        <Card icon={HandCoins} title={tr("प्रकार अनुसार अनुदान", "Subsidy by type")}>
          <p className="mb-3 text-small text-muted">{tr("किसानले पाएको भनी अभिलेख गरिएको रकम, रुपैयाँ", "Amount recorded as received by farmers, NPR")}</p>
          <BarList rows={province.subsidy} unit={tr("रु.", "NPR")} ofTotal color="#b26b00" />
        </Card>
      </section>

      <section className="mt-6">
        <Card icon={TrendingUp} title={tr("दर्ता प्रगति", "Registration progress")}>
          <TrendLine values={province.trend} labels={TREND_DAYS} title={tr("दैनिक दर्ता किसान घरधुरी", "Registered households per day")} />
        </Card>
      </section>

      <section className="mt-6">
        <Card icon={Table2} title={tr("जिल्ला अनुसार विवरण", "District detail")} className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="text-left text-muted">
              <tr>
                <th className="py-2">{tr("जिल्ला", "District")}</th>
                <th>{tr("किसान घरधुरी", "Households")}</th>
                <th>{tr("प्रमाणित", "Verified")}</th>
                <th>{tr("वर्गीकृत", "Classified")}</th>
                <th>{tr("जग्गा (हे.)", "Land (ha)")}</th>
                <th>{tr("सिँचित", "Irrigated")}</th>
                <th>{tr("उत्पादन (मे.ट.)", "Production (MT)")}</th>
                <th>{tr("पशुधन एकाइ", "Livestock units")}</th>
              </tr>
            </thead>
            <tbody>
              {province.districts.map((d) => (
                <tr key={d.code} className="border-t border-line">
                  <td className="py-2 font-semibold">{tr(d.ne, d.en)}</td>
                  <Cell v={d.households} />
                  <Cell v={d.verified} />
                  <Cell v={d.classified} />
                  <Cell v={d.landHa} digits={1} />
                  <Cell v={d.irrigatedPct} suffix="%" />
                  <Cell v={d.productionMt} digits={1} />
                  <Cell v={d.livestockUnits} digits={1} />
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      <section className="mt-6">
        <Card icon={MapPin} title={tr("अन्य प्रदेश", "Other provinces")}>
          <ul className="flex flex-wrap gap-2">
            {PROVINCE_DETAIL.filter((p) => p.code !== province.code).map((p) => (
              <li key={p.code}>
                <Link href={`/national/${p.code}`} className="inline-flex min-h-10 items-center rounded-full border border-line bg-fill px-4 text-small font-semibold text-body hover:border-input-border">
                  {tr(p.ne, p.en)}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <p className="mt-8 text-caption text-muted">
        {tr(
          `स्रोत: किसान सूचीकरण प्रणालीको सार्वजनिक तथ्याङ्क। ५ भन्दा कम घरधुरी भएका ठाउँको विवरण स्रोतले लुकाएको छ (<५)। ${num(province.kpi.municipalities)} स्थानीय तहको तथ्याङ्क समावेश छ।`,
          `Source: public data of the Farmer Registry. The source hides figures for areas with fewer than 5 households (<5). Covers ${province.kpi.municipalities} local levels.`,
        )}
      </p>
    </PublicFrame>
  );
}
