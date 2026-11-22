"use client";

import { BadgeCheck, Beef, Droplets, HandCoins, Landmark, Layers, Map, Users, Wheat } from "lucide-react";
import { StatTile } from "@/components/stat-tile";
import { useLang } from "@/lib/i18n";

export interface Kpi {
  households: number;
  verified: number;
  classified: number;
  landHa: number;
  irrigatedPct: number;
  irrigatedHa: number;
  productionMt: number;
  livestock: number;
  livestockUnits: number;
  subsidyNpr: number;
  subsidyRecords: number;
  municipalities: number;
}

/** The nine headline figures of the ministry dashboard, one tile each with its own icon. */
export function KpiGrid({ kpi }: { kpi: Kpi }) {
  const { tr, num } = useLang();
  const verifiedPct = Math.round((kpi.verified / kpi.households) * 100);
  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <StatTile icon={Users} tone="blue" label={tr("दर्ता किसान घरधुरी", "Registered farm households")} value={num(kpi.households, 0)} note={tr("सूचीकरण प्रणालीमा", "In the registry system")} />
      <StatTile icon={BadgeCheck} tone="green" label={tr("प्रमाणित किसान", "Verified farmers")} value={num(kpi.verified, 0)} note={tr(`वडाबाट प्रमाणित, कुल दर्ताको ${num(verifiedPct)}%`, `Ward verified, ${verifiedPct}% of registered`)} />
      <StatTile icon={Layers} tone="blue" label={tr("वर्गीकृत किसान", "Classified farmers")} value={num(kpi.classified, 0)} note={tr("अनुसूची ५ अनुसार वर्ग तोकिएको", "Class set under Schedule 5")} />
      <StatTile icon={Map} tone="brown" label={tr("कृषि जग्गा", "Agricultural land")} value={num(kpi.landHa, 1)} note={tr("हेक्टर", "Hectares")} />
      <StatTile icon={Droplets} tone="teal" label={tr("सिँचित जग्गा", "Irrigated land")} value={`${num(kpi.irrigatedPct)}%`} note={tr(`${num(kpi.irrigatedHa, 1)} हेक्टर`, `${num(kpi.irrigatedHa, 1)} hectares`)} />
      <StatTile icon={Wheat} tone="gold" label={tr("बाली उत्पादन", "Crop production")} value={num(kpi.productionMt, 1)} note={tr("मेट्रिक टन", "Metric tonnes")} />
      <StatTile icon={Beef} tone="brown" label={tr("पशुपन्छी", "Livestock")} value={num(kpi.livestock, 0)} note={tr(`${num(kpi.livestockUnits, 1)} पशुधन एकाइ, माछा बाहेक`, `${num(kpi.livestockUnits, 1)} livestock units, fish excluded`)} />
      <StatTile icon={HandCoins} tone="teal" label={tr("अनुदान वितरण", "Subsidy recorded")} value={`${tr("रु.", "NPR")} ${num(kpi.subsidyNpr, 0)}`} note={tr(`${num(kpi.subsidyRecords)} अनुदान अभिलेख`, `${kpi.subsidyRecords} subsidy records`)} />
      <StatTile icon={Landmark} tone="blue" label={tr("समेटिएका पालिका", "Local levels covered")} value={`${num(kpi.municipalities)} / ${num(kpi.municipalities)}`} note={tr("दर्ता भएका स्थानीय तह", "Local levels registered")} />
    </section>
  );
}
