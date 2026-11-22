"use client";

import { Beef, HandCoins, LandPlot, Layers, Lightbulb, Table2, TrendingUp, Users, Wheat } from "lucide-react";
import Link from "next/link";
import { KpiGrid } from "@/components/kpi-grid";
import { AreaExplorer, type Area } from "@/components/area-explorer";
import { BarList, TrendLine } from "@/components/national-charts";
import { PublicFrame } from "@/components/public-frame";
import { Card } from "@/components/shell";
import { ButtonA } from "@/components/ui";
import { useLang } from "@/lib/i18n";
import {
  CROP_GROUPS,
  GENDER,
  LAND_USE,
  LIVESTOCK,
  NATIONAL_KPIS as K,
  NATIONAL_SOURCE,
  REGISTRATION_TREND,
  SUBSIDY,
  TIERS,
  TREND_DAYS,
} from "@/lib/national-data";
import { PROVINCE_DETAIL } from "@/lib/national-provinces";
import { MAP_VIEWBOX, PROVINCE_SHAPES } from "@/lib/nepal-map";

export default function NationalData() {
  const { tr, num } = useLang();


  const topProvinceRow = PROVINCE_DETAIL.reduce((a, b) => (b.kpi.households > a.kpi.households ? b : a));
  const topProvince = { ne: topProvinceRow.ne, en: topProvinceRow.en, households: topProvinceRow.kpi.households };
  const verifiedOf = (p: (typeof PROVINCE_DETAIL)[number]) => Math.round((p.kpi.verified / p.kpi.households) * 100);

  // One map area per province. Clicking opens that province with its districts.
  const provinceAreas: Area[] = PROVINCE_DETAIL.map((p) => ({
    id: p.en,
    ne: p.ne,
    en: p.en,
    d: PROVINCE_SHAPES.find((s) => s.en === p.en)?.d ?? "",
    outline: PROVINCE_SHAPES.find((s) => s.en === p.en)?.outline,
    href: `/national/${p.code}`,
    figures: {
      households: p.kpi.households,
      verified: p.kpi.verified,
      classified: p.kpi.classified,
      landHa: p.kpi.landHa,
      irrigatedPct: p.kpi.irrigatedPct,
      productionMt: p.kpi.productionMt,
      livestockUnits: p.kpi.livestockUnits,
    },
  }));

  return (
    <PublicFrame
      title={tr("राष्ट्रिय कृषि तथ्याङ्क", "National agriculture data")}
      subtitle={tr(`कृषि तथा पशुपन्छी विकास मन्त्रालयको सार्वजनिक तथ्याङ्क, ${NATIONAL_SOURCE.asOfBs}`, `Public data from the Ministry of Agriculture and Livestock Development, ${NATIONAL_SOURCE.asOfEn}`)}
      action={
        <ButtonA variant="secondary" href={NATIONAL_SOURCE.url} target="_blank" rel="noreferrer">
          {tr("मूल पृष्ठ खोल्नुहोस्", "Open the source page")}
        </ButtonA>
      }
    >
      <p className="mb-6 max-w-[760px] text-body">
        {tr(
          "यो पृष्ठमा किसान सूचीकरण प्रणालीको सार्वजनिक ड्यासबोर्डबाट लिइएको राष्ट्रिय तथ्याङ्क छ। सजग किसानले यही आधार तथ्याङ्कमा उपग्रह र मौसम विश्लेषण थपेर खेत तहको तस्बिर बनाउँछ।",
          "This page holds the national figures from the public dashboard of the Farmer Registry. Sajag Kishan builds on this base and adds satellite and weather analysis to reach field level.",
        )}
      </p>

      <KpiGrid kpi={K} />

      <AreaExplorer heading={{ ne: "नेपाल, प्रदेश अनुसार", en: "Nepal by province" }} listTitleNe="प्रदेश अनुसार" listTitleEn="by province" viewBox={MAP_VIEWBOX} areas={provinceAreas} />

      <section className="mt-6">
        <Card title={tr("दर्ता प्रगति", "Registration progress")} icon={TrendingUp}>
          <TrendLine values={REGISTRATION_TREND.values} labels={TREND_DAYS} title={tr("दैनिक दर्ता किसान घरधुरी", "Registered households per day")} />
        </Card>
      </section>

      <section className="mt-6">
        <Card icon={Table2} title={tr("प्रदेश अनुसार विवरण", "Province detail")} className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="text-left text-muted">
              <tr>
                <th className="py-2">{tr("प्रदेश", "Province")}</th>
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
              {PROVINCE_DETAIL.map((p) => (
                <tr key={p.en} className="border-t border-line">
                  <td className="py-2 font-semibold">
                    <Link href={`/national/${p.code}`} className="text-brand-700 hover:underline">
                      {tr(p.ne, p.en)}
                    </Link>
                  </td>
                  <td>{num(p.kpi.households, 0)}</td>
                  <td>
                    {num(p.kpi.verified, 0)} ({num(verifiedOf(p))}%)
                  </td>
                  <td>{num(p.kpi.classified, 0)}</td>
                  <td>{num(p.kpi.landHa, 1)}</td>
                  <td>{num(p.kpi.irrigatedPct)}%</td>
                  <td>{num(p.kpi.productionMt, 1)}</td>
                  <td>{num(p.kpi.livestockUnits, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card icon={Users} title={tr("लिङ्ग अनुसार घरमूली किसान", "Household heads by gender")}>
          <BarList rows={GENDER} ofTotal color="#075426" />
        </Card>
        <Card icon={Layers} title={tr("किसान वर्गीकरण", "Farmer classification")}>
          <p className="mb-3 text-small text-muted">{tr("कृषि व्यवसाय प्रवर्द्धन नियमावली, २०८० को अनुसूची ५ अनुसार", "Under Schedule 5 of the Agribusiness Promotion Regulation, 2080")}</p>
          <BarList rows={TIERS} />
        </Card>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card icon={Wheat} title={tr("बाली समूह अनुसार उत्पादन", "Production by crop group")}>
          <p className="mb-3 text-small text-muted">{tr("मेट्रिक टन", "Metric tonnes")}</p>
          <BarList rows={CROP_GROUPS} unit={tr("मे.ट.", "MT")} />
        </Card>
        <Card icon={Beef} title={tr("पशुपन्छी संख्या", "Livestock count")}>
          <p className="mb-3 text-small text-muted">{tr("किसिम अनुसार, माछा बाहेक", "By kind, fish excluded")}</p>
          <BarList rows={LIVESTOCK} color="#8a5a3b" />
        </Card>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card icon={LandPlot} title={tr("जग्गाको प्रयोग", "Land use")}>
          <p className="mb-3 text-small text-muted">{tr("हेक्टर", "Hectares")}</p>
          <BarList rows={LAND_USE} unit={tr("हे.", "ha")} ofTotal color="#1d5fa8" />
        </Card>
        <Card icon={HandCoins} title={tr("प्रकार अनुसार अनुदान", "Subsidy by type")}>
          <p className="mb-3 text-small text-muted">{tr("किसानले पाएको भनी अभिलेख गरिएको रकम, रुपैयाँ", "Amount recorded as received by farmers, NPR")}</p>
          <BarList rows={SUBSIDY} unit={tr("रु.", "NPR")} ofTotal color="#b26b00" />
        </Card>
      </section>

      <section className="mt-6">
        <Card icon={Lightbulb} title={tr("सजग किसानका लागि के देखिन्छ", "What this means for Sajag Kishan")}>
          <ul className="grid gap-4 md:grid-cols-3">
            <li>
              <p className="font-semibold text-ink">{tr("प्रमाणीकरणको खाडल", "Verification gap")}</p>
              <p className="mt-1 text-small text-body">
                {tr(
                  `दर्ता भएका ${num(K.households, 0)} घरधुरीमध्ये ${num(K.verifiedPct)}% मात्र प्रमाणित छन्। उपग्रहको हरियाली जाँचले अधिकृतलाई कुन खेत पहिले जाँच्ने भन्ने देखाउँछ।`,
                  `Only ${K.verifiedPct}% of ${num(K.households, 0)} registered households are verified. Our satellite greenness check shows an officer which fields to visit first.`,
                )}
              </p>
            </li>
            <li>
              <p className="font-semibold text-ink">{tr("जग्गाको प्रयोग खुलेको छैन", "Land use is mostly unrecorded")}</p>
              <p className="mt-1 text-small text-body">
                {tr(
                  "दर्ता जग्गाको ९८% को प्रयोग उल्लेख छैन र बाँझो जग्गा लगभग शून्य देखिन्छ। उपग्रहले खेती भएको र बाँझो जग्गा छुट्याउन सक्छ।",
                  "98% of registered land has no recorded use and fallow shows almost zero. Satellite imagery can separate cultivated from fallow land.",
                )}
              </p>
            </li>
            <li>
              <p className="font-semibold text-ink">{tr("प्रदेशगत फरक", "Differences between provinces")}</p>
              <p className="mt-1 text-small text-body">
                {tr(
                  `${topProvince.ne}मा सबैभन्दा बढी ${num(topProvince.households, 0)} घरधुरी छन्, सिँचाइ २८% देखि ४४% सम्म फरक छ। अनुदान र मलको योजना प्रदेश र वडा अनुसार फरक हुनुपर्छ।`,
                  `${topProvince.en} has the most households at ${num(topProvince.households, 0)}, and irrigation ranges from 28% to 44%. Subsidy and fertilizer plans need to differ by province and ward.`,
                )}
              </p>
            </li>
          </ul>
        </Card>
      </section>

      <p className="mt-8 text-caption text-muted">
        {tr(
          "स्रोत: किसान सूचीकरण प्रणालीको सार्वजनिक तथ्याङ्क। सबै पालिकाको विवरण स्थानान्तरण नभएसम्म राष्ट्रिय जोड अपूर्ण हुन्छ। ५ भन्दा कम घरधुरी भएका क्षेत्रको विवरण स्रोतले गोप्य राखेको छ।",
          "Source: public data of the Farmer Registry. National totals stay incomplete until every municipality finishes transferring its records. The source hides figures for areas with fewer than 5 households.",
        )}
      </p>
    </PublicFrame>
  );
}
