/**
 * Disease and pest risk from weather, crop, growth stage and history (docs/10-prediction-models.md §4).
 * Farmers never diagnose anything: we warn ahead, explain why, and say how to prevent or respond.
 * Thresholds and advice are INITIAL VALUES pending review by NARC / Plant Protection Directorate.
 */
import type { DailyForecast, HourlyForecast } from "./weather-alerts";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface Bilingual {
  ne: string;
  en: string;
}

export interface DiseaseAdvice {
  code: string;
  crop: string;
  name: Bilingual;
  level: RiskLevel;
  /** 0..1, shown as a percentage with the reason. */
  score: number;
  why: Bilingual;
  prevent: Bilingual[];
  ifSigns: Bilingual[];
  /** Days (ISO) when conditions are favourable. */
  days: string[];
  ruleVersion: string;
}

export interface RiskContext {
  crop: string;
  /** Current calendar task for the field, e.g. "TRANSPLANTING", "FERTILIZING"; null if unknown. */
  stage?: string | null;
  hourly: HourlyForecast[];
  daily: DailyForecast[];
  /** How many times this problem was alerted in the field's ward in past seasons. */
  pastAlertsInWard?: number;
}

interface DayStats {
  day: string;
  humidHours: number; // RH >= 90 %
  minT: number;
  maxT: number;
  meanT: number;
  rain: number;
}

function byDay(hourly: HourlyForecast[], daily: DailyForecast[]): DayStats[] {
  const map = new Map<string, { h: HourlyForecast[] }>();
  for (const h of hourly) {
    const d = h.time.slice(0, 10);
    map.set(d, { h: [...(map.get(d)?.h ?? []), h] });
  }
  const rain = new Map(daily.map((d) => [d.date, d.precipitationMm]));
  return [...map]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, { h }]) => {
      const t = h.map((x) => x.tempC);
      return {
        day,
        humidHours: h.filter((x) => x.relativeHumidity >= 90).length,
        minT: Math.min(...t),
        maxT: Math.max(...t),
        meanT: t.reduce((s, x) => s + x, 0) / t.length,
        rain: rain.get(day) ?? 0,
      };
    });
}

interface Rule {
  code: string;
  crops: string[];
  name: Bilingual;
  /** Stages when the crop is most exposed (empty = any stage). */
  stages: string[];
  /** Returns favourable days. */
  favourable: (days: DayStats[]) => string[];
  why: Bilingual;
  prevent: Bilingual[];
  ifSigns: Bilingual[];
}

const RULES: Rule[] = [
  {
    code: "LATE_BLIGHT",
    crops: ["potato"],
    name: { ne: "डढुवा (लेट ब्लाइट)", en: "Late blight" },
    stages: [],
    // Two or more days in a row with Tmin >= 10 °C and 11+ very humid hours (Smith-period style).
    favourable: (d) => d.filter((x, i) => i > 0 && x.minT >= 10 && x.humidHours >= 11 && d[i - 1]!.minT >= 10 && d[i - 1]!.humidHours >= 11).map((x) => x.day),
    why: { ne: "चिसो र धेरै ओसिलो (कुहिरो लाग्ने) मौसम लगातार दुई दिन भन्दा बढी।", en: "Cool, very humid (foggy) weather for two or more days in a row." },
    prevent: [
      { ne: "खेतमा पानी जम्न नदिनुहोस्, नाली सफा राख्नुहोस्।", en: "Do not let water stand; keep drains clear." },
      { ne: "माथिबाट सिँचाइ नगर्नुहोस्।", en: "Avoid overhead watering." },
      { ne: "कृषि प्राविधिकको सल्लाहमा रोकथामको औषधि छर्नुहोस्।", en: "Spray a preventive fungicide on the technician's advice." },
    ],
    ifSigns: [
      { ne: "पातमा कालो-खैरो धब्बा देखिए रोगी बोट हटाउनुहोस्।", en: "If dark brown patches appear on leaves, remove affected plants." },
      { ne: "तुरुन्त कृषि शाखामा खबर गर्नुहोस्।", en: "Inform the agriculture office straight away." },
    ],
  },
  {
    code: "RICE_BLAST",
    crops: ["paddy"],
    name: { ne: "मरुवा (ब्लास्ट)", en: "Rice blast" },
    stages: ["TRANSPLANTING", "FERTILIZING", "WEEDING", "PEST_SCOUTING"],
    favourable: (d) => d.filter((x) => x.humidHours >= 10 && x.minT >= 20 && x.minT <= 26).map((x) => x.day),
    why: { ne: "न्यानो र ओसिलो रात (२०–२६ डिग्री, धेरै आर्द्रता)।", en: "Warm, humid nights (20 to 26 °C, very high humidity)." },
    prevent: [
      { ne: "नाइट्रोजन (युरिया) धेरै नहाल्नुहोस्, किस्तामा हाल्नुहोस्।", en: "Do not overuse nitrogen (urea); apply it in splits." },
      { ne: "बेर्ना धेरै बाक्लो नरोप्नुहोस्।", en: "Do not plant seedlings too densely." },
    ],
    ifSigns: [
      { ne: "पातमा आँखा आकारको खैरो धब्बा देखिए कृषि शाखामा खबर गर्नुहोस्।", en: "If eye-shaped grey spots appear on leaves, inform the agriculture office." },
    ],
  },
  {
    code: "BACTERIAL_LEAF_BLIGHT",
    crops: ["paddy"],
    name: { ne: "पात डढुवा (ब्याक्टेरियल)", en: "Bacterial leaf blight" },
    stages: [],
    favourable: (d) => d.filter((x) => x.rain >= 40 && x.maxT >= 25 && x.maxT <= 34).map((x) => x.day),
    why: { ne: "भारी वर्षा र हावासँगै न्यानो मौसम।", en: "Heavy rain with wind in warm weather." },
    prevent: [
      { ne: "खेतको पानी निकास गर्नुहोस्।", en: "Drain excess water from the field." },
      { ne: "भारी वर्षापछि तुरुन्त युरिया नहाल्नुहोस्।", en: "Do not apply urea right after heavy rain." },
    ],
    ifSigns: [{ ne: "पातको टुप्पोबाट पहेँलो हुँदै सुक्न थाले कृषि शाखामा खबर गर्नुहोस्।", en: "If leaves yellow and dry from the tips, inform the agriculture office." }],
  },
  {
    code: "YELLOW_RUST",
    crops: ["wheat"],
    name: { ne: "पहेँलो सिन्दूरे (रस्ट)", en: "Yellow rust" },
    stages: [],
    favourable: (d) => d.filter((x) => x.meanT >= 8 && x.meanT <= 16 && x.humidHours >= 6).map((x) => x.day),
    why: { ne: "चिसो दिन र शीत पर्ने रात।", en: "Cool days with dewy nights." },
    prevent: [
      { ne: "हप्तामा एकपटक पात हेर्नुहोस्।", en: "Check leaves once a week." },
      { ne: "रोग सहने जातको बीउ प्रयोग गर्नुहोस्।", en: "Use resistant varieties next season." },
    ],
    ifSigns: [{ ne: "पातमा पहेँलो धुलो जस्तो धर्का देखिए कृषि शाखामा खबर गर्नुहोस्।", en: "If yellow powdery stripes appear on leaves, inform the agriculture office." }],
  },
  {
    code: "FALL_ARMYWORM",
    crops: ["maize"],
    name: { ne: "फौजी कीरा", en: "Fall armyworm" },
    stages: ["SOWING", "WEEDING", "FERTILIZING", "PEST_SCOUTING"],
    favourable: (d) => d.filter((x) => x.meanT >= 22 && x.rain < 10).map((x) => x.day),
    why: { ne: "न्यानो र सुक्खा मौसममा कीरा छिटो बढ्छ।", en: "Warm, dry spells let the pest multiply fast." },
    prevent: [
      { ne: "बिहान मकैको गाभो हेर्नुहोस्।", en: "Check maize whorls in the morning." },
      { ne: "फेरोमोन पासो राख्नुहोस्।", en: "Set pheromone traps." },
    ],
    ifSigns: [{ ne: "गाभोमा कीराको मल वा प्वाल देखिए कृषि शाखामा खबर गर्नुहोस्।", en: "If you see droppings or holes in the whorl, inform the agriculture office." }],
  },
  {
    code: "MUSTARD_APHID",
    crops: ["mustard"],
    name: { ne: "लाही कीरा", en: "Mustard aphid" },
    stages: [],
    favourable: (d) => d.filter((x) => x.meanT >= 10 && x.meanT <= 20 && x.rain < 2).map((x) => x.day),
    why: { ne: "चिसो र सुक्खा हप्ताहरू।", en: "Cool, dry weeks." },
    prevent: [
      { ne: "हप्तामा दुईपटक फूल र टुप्पो हेर्नुहोस्।", en: "Check flowers and shoot tips twice a week." },
      { ne: "मित्र कीरा (लेडीबर्ड) नमार्नुहोस्।", en: "Protect natural enemies such as ladybirds." },
    ],
    ifSigns: [{ ne: "टुप्पोमा कीराको झुण्ड देखिए कृषि शाखामा खबर गर्नुहोस्।", en: "If insects cluster on shoot tips, inform the agriculture office." }],
  },
];

const RULE_VERSION = "disease-v0.2";

/** All weather-driven problems that could affect this crop in the forecast window, highest risk first. */
export function assessDiseaseRisk(ctx: RiskContext): DiseaseAdvice[] {
  const days = byDay(ctx.hourly, ctx.daily);
  const out: DiseaseAdvice[] = [];

  for (const r of RULES) {
    if (!r.crops.includes(ctx.crop)) continue;
    const fav = r.favourable(days);
    if (!fav.length) continue;

    // Score: share of favourable days, + exposed stage, + history in the ward.
    let score = Math.min(1, fav.length / 4) * 0.6;
    if (!r.stages.length || (ctx.stage && r.stages.includes(ctx.stage))) score += 0.2;
    score += Math.min(0.2, (ctx.pastAlertsInWard ?? 0) * 0.05);
    score = Math.round(score * 100) / 100;
    const level: RiskLevel = score >= 0.65 ? "HIGH" : score >= 0.4 ? "MEDIUM" : "LOW";

    out.push({ code: r.code, crop: ctx.crop, name: r.name, level, score, why: r.why, prevent: r.prevent, ifSigns: r.ifSigns, days: fav, ruleVersion: RULE_VERSION });
  }
  return out.sort((a, b) => b.score - a.score);
}

/** Crops that have at least one rule (for the alert job). */
export const CROPS_WITH_DISEASE_RULES = [...new Set(RULES.flatMap((r) => r.crops))];

/** All rule texts, used as documents for the farmer assistant. */
export function diseaseKnowledge(): { code: string; crop: string; name: Bilingual; why: Bilingual; prevent: Bilingual[]; ifSigns: Bilingual[] }[] {
  return RULES.flatMap((r) => r.crops.map((crop) => ({ code: r.code, crop, name: r.name, why: r.why, prevent: r.prevent, ifSigns: r.ifSigns })));
}
