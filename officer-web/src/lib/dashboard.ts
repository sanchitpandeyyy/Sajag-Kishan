import { CircleOff, EyeOff, FilePlus, HandCoins, Ruler, Trees, type LucideIcon } from "lucide-react";
import type { AreaByStatus, FieldStatus } from "@/components/land-charts";

export type Flag = "subsidy_on_fallow" | "declared_not_seen" | "farmed_not_declared" | "abandoned" | "area_overclaim" | "not_farmland";
export type Productivity = "high" | "normal" | "low" | "unknown";

export interface DashboardField {
  id: string;
  farmerId: string;
  farmerNameNe: string;
  localName: string | null;
  ward: number;
  areaM2: number;
  lat: number | null;
  lng: number | null;
  verification: string;
  landCover: string | null;
  croplandShare: number | null;
  declaredCrop: { code: string; nameNe: string; nameEn: string } | null;
  declaredCultivated: boolean | null;
  declaredSownM2: number;
  fertilizerKg: number;
  status: FieldStatus;
  peakNdvi: number | null;
  history: { key: string; status: FieldStatus; peakNdvi: number | null; readings: number }[];
  productivity: Productivity;
  productivityRatio: number | null;
  prediction: { label: string; probability: number; version: string } | null;
  flags: Flag[];
}

export interface Dashboard {
  scope: {
    localLevel: { id: number; nameNe: string; nameEn: string };
    district: { nameNe: string; nameEn: string };
    province: { nameNe: string; nameEn: string };
    wards: number;
    fiscalYearBs: string;
    season: string;
    seasonLabel: { ne: string; en: string };
    mainSeason: { key: string; ne: string; en: string; fiscalYearBs: string; season: string };
    inProgress: { key: string; ne: string; en: string } | null;
    choices: { id: number; nameNe: string; nameEn: string }[];
  };
  farmers: { total: number; withAccount: number; disabled: number; fields: number; mappedFields: number; verifiedFields: number };
  land: {
    registeredM2: number;
    declaredCultivatedM2: number;
    declaredFallowM2: number;
    noDeclarationM2: number;
    satellite: AreaByStatus;
    fertilizedM2: number;
    cultivatedUnfertilizedM2: number;
    fertilizerOnFallowKg: number;
  };
  seasons: { key: string; labelNe: string; labelEn: string; inProgress: boolean; satellite: AreaByStatus; declaredCultivatedM2: number; fertilizedM2: number; hasDeclarations: boolean }[];
  wards: { number: number; fields: number; registeredM2: number; declaredCultivatedM2: number; satellite: AreaByStatus; fertilizedM2: number; flagged: number }[];
  checks: DashboardField[];
  productivity: Record<Productivity, { fields: number; areaM2: number }>;
  fields: DashboardField[];
  method: { rule: string; cultivatedPeak: number; fallowPeak: number; municipalityMedianPeak: number | null; sources: Record<string, string> };
}

export const FLAGS: Record<Flag, { icon: LucideIcon; ne: string; en: string }> = {
  subsidy_on_fallow: { icon: HandCoins, ne: "मल/अनुदान लियो, तर भू-उपग्रहमा जग्गा बाँझो", en: "Received fertilizer, but the satellite saw the land fallow" },
  not_farmland: { icon: Trees, ne: "दर्ता बिन्दु खेतीयोग्य जमिनमा छैन (जङ्गल, बस्ती वा खोला)", en: "Registered point is not on farmland (forest, town or river)" },
  declared_not_seen: { icon: EyeOff, ne: "बाली घोषणा गरियो, भू-उपग्रहमा देखिएन", en: "Crop declared, not seen by the satellite" },
  abandoned: { icon: CircleOff, ne: "लगातार ३ मौसम बाँझो: छाडिएको हुन सक्छ", en: "Fallow 3 seasons in a row: possibly abandoned" },
  area_overclaim: { icon: Ruler, ne: "घोषित खेती क्षेत्र दर्ता जग्गाभन्दा बढी", en: "Declared crop area is larger than the registered land" },
  farmed_not_declared: { icon: FilePlus, ne: "खेती देखियो, घोषणा छैन", en: "Farmed, but nothing declared" },
};

export const PRODUCTIVITY: Record<Productivity, { ne: string; en: string; color: string }> = {
  high: { ne: "उच्च उत्पादकत्व", en: "High productivity", color: "#1f7a4d" },
  normal: { ne: "सामान्य", en: "Normal", color: "#8cc96a" },
  low: { ne: "न्यून उत्पादकत्व", en: "Low productivity", color: "#a0522d" },
  unknown: { ne: "थाहा छैन", en: "Not enough data", color: "#c3c8d1" },
};

export function seasonShort(key: string, tr: (ne: string, en: string) => string): string {
  const [fy = "", season = ""] = key.split("-");
  const yy = fy.slice(2);
  const names: Record<string, [string, string]> = { BARSHE: ["बर्खे", "Monsoon"], HIUDE: ["हिउँदे", "Winter"], CHAITE: ["चैते", "Spring"] };
  const [ne, en] = names[season] ?? [season, season];
  return tr(`${ne} ${yy}`, `${en} ${yy}`);
}
