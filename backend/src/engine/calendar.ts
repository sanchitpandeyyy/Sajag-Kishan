import { getCrop } from "./crops";
import type { DailyForecast } from "./weather-alerts";
import { LAPSE_RATE_C_PER_M, type AgroZone } from "./zoning";

export type CalendarTask =
  | "LAND_PREP"
  | "NURSERY"
  | "SOWING"
  | "TRANSPLANTING"
  | "FERTILIZING"
  | "IRRIGATION"
  | "WEEDING"
  | "PEST_SCOUTING"
  | "HARVEST"
  | "STORAGE";

export interface StageTemplate {
  task: CalendarTask;
  offsetDays: number;
  durationDays: number;
  titleNe: string;
  noteNe?: string;
}

export interface CropZoneTemplate {
  crop: string;
  zone: AgroZone;
  season: "BARSHE" | "HIUDE" | "CHAITE";
  sowingStart: { month: number; day: number };
  sowingWindowDays: number;
  stages: StageTemplate[];
  version: string;
}

const paddyStages: StageTemplate[] = [
  { task: "NURSERY", offsetDays: -25, durationDays: 7, titleNe: "बीउ राख्ने (ब्याड)", noteNe: "स्वस्थ बीउ छान्नुहोस्, बीउ उपचार गर्नुहोस्।" },
  { task: "LAND_PREP", offsetDays: -7, durationDays: 7, titleNe: "खेत तयारी र हिलो बनाउने" },
  { task: "TRANSPLANTING", offsetDays: 0, durationDays: 10, titleNe: "रोपाइँ", noteNe: "२१–२५ दिनको बेर्ना रोप्नुहोस्।" },
  { task: "FERTILIZING", offsetDays: 21, durationDays: 5, titleNe: "पहिलो टप ड्रेस (युरिया)" },
  { task: "WEEDING", offsetDays: 25, durationDays: 10, titleNe: "झारपात गोडमेल" },
  { task: "PEST_SCOUTING", offsetDays: 35, durationDays: 50, titleNe: "रोग/कीरा निरीक्षण", noteNe: "मरुवा, पात डढुवा र गबारो हेर्नुहोस्।" },
  { task: "FERTILIZING", offsetDays: 45, durationDays: 5, titleNe: "दोस्रो टप ड्रेस (बाला निस्कने बेला)" },
  { task: "HARVEST", offsetDays: 105, durationDays: 14, titleNe: "बाली भित्र्याउने", noteNe: "८०–८५% दाना पहेँलो भएपछि काट्नुहोस्।" },
  { task: "STORAGE", offsetDays: 120, durationDays: 10, titleNe: "सुकाएर भण्डारण", noteNe: "१२–१४% चिस्यानसम्म सुकाउनुहोस्।" },
];

const wheatStages: StageTemplate[] = [
  { task: "LAND_PREP", offsetDays: -10, durationDays: 10, titleNe: "खेत तयारी र आधार मल" },
  { task: "SOWING", offsetDays: 0, durationDays: 15, titleNe: "बीउ छर्ने" },
  { task: "IRRIGATION", offsetDays: 21, durationDays: 5, titleNe: "पहिलो सिँचाइ (जरा फुट्ने बेला)" },
  { task: "FERTILIZING", offsetDays: 22, durationDays: 5, titleNe: "युरिया टप ड्रेस" },
  { task: "WEEDING", offsetDays: 30, durationDays: 10, titleNe: "झारपात नियन्त्रण" },
  { task: "PEST_SCOUTING", offsetDays: 50, durationDays: 50, titleNe: "रोग निरीक्षण", noteNe: "पहेँलो सिन्दूरे (रस्ट) हेर्नुहोस्।" },
  { task: "IRRIGATION", offsetDays: 65, durationDays: 5, titleNe: "बाला निस्कने बेला सिँचाइ" },
  { task: "HARVEST", offsetDays: 125, durationDays: 14, titleNe: "बाली भित्र्याउने" },
];

const maizeStages: StageTemplate[] = [
  { task: "LAND_PREP", offsetDays: -10, durationDays: 10, titleNe: "खेत तयारी र गोबर मल" },
  { task: "SOWING", offsetDays: 0, durationDays: 10, titleNe: "बीउ छर्ने" },
  { task: "WEEDING", offsetDays: 20, durationDays: 10, titleNe: "गोडमेल" },
  { task: "FERTILIZING", offsetDays: 30, durationDays: 5, titleNe: "युरिया टप ड्रेस (घुँडा उचाइ)" },
  { task: "PEST_SCOUTING", offsetDays: 15, durationDays: 45, titleNe: "फौजी कीरा निरीक्षण", noteNe: "गाभोमा कीरा र मल हेर्नुहोस्।" },
  { task: "HARVEST", offsetDays: 110, durationDays: 14, titleNe: "घोगा भाँच्ने" },
];

const potatoStages: StageTemplate[] = [
  { task: "LAND_PREP", offsetDays: -10, durationDays: 10, titleNe: "खेत तयारी, डिल बनाउने" },
  { task: "SOWING", offsetDays: 0, durationDays: 10, titleNe: "बीउ आलु रोप्ने" },
  { task: "WEEDING", offsetDays: 30, durationDays: 7, titleNe: "उकेरा लगाउने" },
  { task: "FERTILIZING", offsetDays: 30, durationDays: 5, titleNe: "युरिया टप ड्रेस" },
  { task: "PEST_SCOUTING", offsetDays: 35, durationDays: 50, titleNe: "डढुवा रोग निरीक्षण", noteNe: "चिसो र कुहिरो लागेमा विशेष ध्यान दिनुहोस्।" },
  { task: "HARVEST", offsetDays: 100, durationDays: 10, titleNe: "आलु खन्ने" },
];

export const CALENDAR_TEMPLATES: CropZoneTemplate[] = [
  { crop: "paddy", zone: "TERAI", season: "BARSHE", sowingStart: { month: 6, day: 25 }, sowingWindowDays: 30, stages: paddyStages, version: "terai-v0" },
  { crop: "paddy", zone: "MID_HILL", season: "BARSHE", sowingStart: { month: 6, day: 15 }, sowingWindowDays: 25, stages: paddyStages, version: "midhill-v0" },
  { crop: "wheat", zone: "TERAI", season: "HIUDE", sowingStart: { month: 11, day: 10 }, sowingWindowDays: 25, stages: wheatStages, version: "terai-v0" },
  { crop: "wheat", zone: "MID_HILL", season: "HIUDE", sowingStart: { month: 10, day: 25 }, sowingWindowDays: 25, stages: wheatStages, version: "midhill-v0" },
  { crop: "maize", zone: "TERAI", season: "CHAITE", sowingStart: { month: 2, day: 15 }, sowingWindowDays: 30, stages: maizeStages, version: "terai-v0" },
  { crop: "maize", zone: "MID_HILL", season: "CHAITE", sowingStart: { month: 3, day: 15 }, sowingWindowDays: 30, stages: maizeStages, version: "midhill-v0" },
  { crop: "potato", zone: "TERAI", season: "HIUDE", sowingStart: { month: 10, day: 25 }, sowingWindowDays: 25, stages: potatoStages, version: "terai-v0" },
  { crop: "potato", zone: "UPPER_HILL", season: "CHAITE", sowingStart: { month: 2, day: 15 }, sowingWindowDays: 30, stages: potatoStages, version: "upperhill-v0" },
];

export function findTemplate(crop: string, zone: AgroZone, season?: string): CropZoneTemplate | undefined {
  const forCrop = CALENDAR_TEMPLATES.filter((t) => t.crop === crop && (!season || t.season === season));
  const order: AgroZone[] = ["TERAI", "LOWER_HILL", "MID_HILL", "UPPER_HILL", "MOUNTAIN"];
  const target = order.indexOf(zone);
  return forCrop.sort((a, b) => Math.abs(order.indexOf(a.zone) - target) - Math.abs(order.indexOf(b.zone) - target))[0];
}

export interface GeneratedEvent {
  crop: string;
  task: CalendarTask;
  startsOn: string;
  endsOn: string;
  titleNe: string;
  noteNe?: string;
  reason: Record<string, string | number>;
}

/** Field facts that refine the calendar. Every field is optional; a missing value just skips that rule. */
export interface SiteContext {
  elevationM?: number | null;
  slopeDeg?: number | null;
  aspectDeg?: number | null;
  soilPh?: number | null;
  /** true when pH is a SoilGrids estimate, not a field test */
  soilPhEstimated?: boolean;
  /** g/kg (SoilGrids) */
  soilOrganicC?: number | null;
  clayPct?: number | null;
  /** Mean air temperature over this crop's season at the ward, °C (ERA5 history). */
  seasonMeanTempC?: number | null;
  /** Sentinel-2 NDVI readings for this field, any order. */
  ndvi?: { date: string; ndvi: number }[];
  /** ISO date treated as today (defaults to now). */
  today?: string;
}

export interface GenerateOptions {
  crop: string;
  zone: AgroZone;
  season?: string;
  sowingDate?: string;
  year?: number;
  referenceMeanTempC?: number;
  parcelMeanTempC?: number;
  forecast?: DailyForecast[];
  site?: SiteContext;
}

const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const r1 = (x: number) => Math.round(x * 10) / 10;
const r2 = (x: number) => Math.round(x * 100) / 100;

/** Typical elevation each template was written for; used to compare the field's temperature with the template's. */
const TEMPLATE_ELEVATION_M: Record<AgroZone, number> = { TERAI: 150, LOWER_HILL: 750, MID_HILL: 1250, UPPER_HILL: 2000, MOUNTAIN: 3000 };
const COLD_SENSITIVE = new Set(["paddy", "maize", "millet"]);

/** Sun-facing (south) hill slopes run warmer, shaded (north) ones cooler: up to ±1 °C on slopes of 10° or more. */
function aspectTempOffset(slopeDeg?: number | null, aspectDeg?: number | null): number {
  if (slopeDeg == null || aspectDeg == null || slopeDeg < 10) return 0;
  const northness = Math.cos((aspectDeg * Math.PI) / 180); // 1 = north, -1 = south
  return r1(-northness) || 0;
}

export function generateCalendar(opts: GenerateOptions): GeneratedEvent[] {
  const tpl = findTemplate(opts.crop, opts.zone, opts.season);
  if (!tpl) return [];
  const crop = getCrop(opts.crop);
  const site = opts.site ?? {};

  const year = opts.year ?? new Date().getUTCFullYear();
  const sowing = opts.sowingDate
    ? new Date(`${opts.sowingDate}T00:00:00Z`)
    : new Date(Date.UTC(year, tpl.sowingStart.month - 1, tpl.sowingStart.day));

  // Temperature: compare the field's season temperature with what the template assumes for its zone.
  let refT = opts.referenceMeanTempC;
  let siteT = opts.parcelMeanTempC;
  const aspectOffset = aspectTempOffset(site.slopeDeg, site.aspectDeg);
  if ((refT == null || siteT == null) && site.seasonMeanTempC != null && site.elevationM != null) {
    siteT = site.seasonMeanTempC + aspectOffset;
    refT = site.seasonMeanTempC + (TEMPLATE_ELEVATION_M[tpl.zone] - site.elevationM) * LAPSE_RATE_C_PER_M;
  }
  let stretch = 1;
  if (crop && refT != null && siteT != null) {
    const refGdd = Math.max(1, refT - crop.gddBase);
    const siteGdd = Math.max(1, siteT - crop.gddBase);
    stretch = Math.min(1.6, Math.max(0.8, refGdd / siteGdd));
  }

  const fc = new Map((opts.forecast ?? []).map((d) => [d.date, d]));
  const rainFrom = (d: Date, days = 1) => {
    let sum = 0;
    for (let i = 0; i < days; i++) sum += fc.get(iso(new Date(d.getTime() + i * DAY)))?.precipitationMm ?? 0;
    return sum;
  };
  const tooWet = (d: Date) => (fc.get(iso(d))?.precipitationMm ?? 0) >= 30;
  const tooCold = (d: Date) => {
    const f = fc.get(iso(d));
    return !!f && COLD_SENSITIVE.has(tpl.crop) && Number.isFinite(f.tempMinC) && f.tempMinC <= 5;
  };

  const siteNotes = soilAdvice(tpl.crop, site);
  const harvestOffset = tpl.stages.find((s) => s.task === "HARVEST")?.offsetDays ?? 110;
  const sat = opts.sowingDate ? satelliteAdvice(site, sowing, Math.round(harvestOffset * stretch)) : null;

  return tpl.stages.map((s) => {
    const offset = s.offsetDays > 0 ? Math.round(s.offsetDays * stretch) : s.offsetDays;
    let start = new Date(sowing.getTime() + offset * DAY);
    const reason: Record<string, string | number> = { template: tpl.version, zone: tpl.zone };
    if (stretch !== 1) {
      reason.thermalStretch = r2(stretch);
      if (siteT != null) reason.seasonTempC = r1(siteT);
      if (aspectOffset) reason.aspectTempC = aspectOffset;
    }
    const notes: string[] = s.noteNe ? [s.noteNe] : [];

    if (["FERTILIZING", "SOWING", "TRANSPLANTING"].includes(s.task)) {
      let rainDays = 0;
      let coldDays = 0;
      const coldMin = fc.get(iso(start))?.tempMinC;
      while ((tooWet(start) || tooCold(start)) && rainDays + coldDays < 5) {
        if (tooWet(start)) rainDays++;
        else coldDays++;
        start = new Date(start.getTime() + DAY);
      }
      if (rainDays) {
        reason.postponedForRainDays = rainDays;
        notes.push(`ठूलो पानी पर्ने भएकाले ${rainDays} दिन पछि सारिएको।`);
      }
      if (coldDays) {
        reason.postponedForColdDays = coldDays;
        notes.push(`चिसो (न्यूनतम ${r1(coldMin ?? 0)}°C) भएकाले ${coldDays} दिन पछि सारिएको।`);
      }
    }

    const f = fc.get(iso(start));
    if (s.task === "FERTILIZING" && f && rainFrom(new Date(start.getTime() + DAY)) >= 20) {
      notes.push("मल हालेको भोलिपल्ट ठूलो पानी पर्ने: मल बग्न सक्छ, पानी रोकिएपछि हाल्नुहोस्।");
      reason.rainAfterFertilizer = 1;
    }
    if (s.task === "IRRIGATION" && f) {
      const rain3 = rainFrom(start, 3);
      if (rain3 >= 15) {
        notes.push(`आउँदो ३ दिनमा ${Math.round(rain3)} मिमि पानी पर्ने: सिँचाइ नगर्नुहोस्।`);
        reason.irrigationSkipRainMm = Math.round(rain3);
      } else if (rainFrom(start, 7) < 2 && f.tempMaxC >= 32) {
        notes.push(`सुख्खा र गर्मी (${Math.round(f.tempMaxC)}°C): समयमै सिँचाइ गर्नुहोस्।`);
        reason.irrigationHeatC = Math.round(f.tempMaxC);
      }
    }
    if (s.task === "HARVEST" && f && rainFrom(start, 3) >= 10) {
      notes.push("कटनीको सुरुमा पानी पर्ने: पाकेको भए पानी अघि नै काट्नुहोस् र ढाकेर राख्नुहोस्।");
      reason.harvestRain = 1;
    }
    if ((s.task === "SOWING" || s.task === "TRANSPLANTING") && f && f.tempMaxC >= 38) {
      notes.push(`धेरै गर्मी (${Math.round(f.tempMaxC)}°C): बिहान वा बेलुका रोप्नुहोस्।`);
      reason.heatC = Math.round(f.tempMaxC);
    }

    for (const n of siteNotes) {
      if (n.task !== s.task) continue;
      notes.push(n.ne);
      reason[n.key] = n.value;
    }
    if (sat && sat.task === s.task) {
      notes.push(sat.ne);
      reason[sat.key] = sat.value;
    }

    return {
      crop: tpl.crop,
      task: s.task,
      startsOn: iso(start),
      endsOn: iso(new Date(start.getTime() + s.durationDays * DAY)),
      titleNe: s.titleNe,
      noteNe: notes.length ? notes.join(" ") : undefined,
      reason,
    };
  });
}

interface SiteNote {
  task: CalendarTask;
  ne: string;
  key: string;
  value: string | number;
}

/** Soil and terrain advice for this crop, attached to the stage where it matters. */
export function soilAdvice(cropCode: string, site: SiteContext): SiteNote[] {
  const out: SiteNote[] = [];
  const crop = getCrop(cropCode);
  const est = site.soilPhEstimated ? " (अनुमानित, माटो परीक्षणले पक्का गर्नुहोस्)" : "";
  if (crop && site.soilPh != null) {
    const [, optLow, optHigh] = crop.soilPh;
    if (site.soilPh < optLow) out.push({ task: "LAND_PREP", ne: `माटो अमिलो (pH ${r1(site.soilPh)})${est}: खनजोत गर्दा कृषि चुन मिलाउनुहोस्।`, key: "soilPhLow", value: r1(site.soilPh) });
    else if (site.soilPh > optHigh) out.push({ task: "LAND_PREP", ne: `माटो क्षारीय (pH ${r1(site.soilPh)})${est}: कुहिएको गोबर मल वा कम्पोस्ट बढी हाल्नुहोस्।`, key: "soilPhHigh", value: r1(site.soilPh) });
  }
  if (site.soilOrganicC != null && site.soilOrganicC < 10) {
    out.push({ task: "LAND_PREP", ne: "माटोमा प्राङ्गारिक पदार्थ कम: राम्रोसँग कुहिएको गोबर मल वा कम्पोस्ट बढी हाल्नुहोस्।", key: "lowOrganicC", value: r1(site.soilOrganicC) });
  }
  if (site.clayPct != null) {
    if (site.clayPct >= 40 && cropCode !== "paddy") {
      out.push({ task: "SOWING", ne: "चिम्टाइलो माटो: पानी जम्न नदिन निकास कुलो बनाउनुहोस्।", key: "heavyClay", value: r1(site.clayPct) });
    } else if (site.clayPct < 15) {
      out.push({ task: "FERTILIZING", ne: "बलौटे माटो: मल एकैपटक नहाली थोरै-थोरै गरी पटक-पटक हाल्नुहोस्।", key: "sandySoil", value: r1(site.clayPct) });
      out.push({ task: "IRRIGATION", ne: "बलौटे माटो छिटो सुक्छ: हल्का र बारम्बार सिँचाइ गर्नुहोस्।", key: "sandySoil", value: r1(site.clayPct) });
    }
  }
  if (site.slopeDeg != null) {
    if (site.slopeDeg >= 15) out.push({ task: "LAND_PREP", ne: `भिरालो जमिन (${r1(site.slopeDeg)}°): माटो बग्न नदिन गरा वा कन्टुर अनुसार खनजोत गर्नुहोस्।`, key: "steepSlope", value: r1(site.slopeDeg) });
    if (site.slopeDeg >= 8) out.push({ task: "FERTILIZING", ne: "भिरालो खेत: मल माटोमा मिसाउनुहोस्, ठूलो पानी अघि नहाल्नुहोस्।", key: "slopeFertilizer", value: r1(site.slopeDeg) });
  }
  return out;
}

/** What the field's own satellite greenness says about the crop now, for a crop with a known sowing date. */
export function satelliteAdvice(site: SiteContext, sowing: Date, harvestOffsetDays: number): SiteNote | null {
  const today = site.today ? new Date(`${site.today}T00:00:00Z`) : new Date();
  const daysSince = Math.floor((today.getTime() - sowing.getTime()) / DAY);
  if (daysSince < 0 || daysSince > harvestOffsetDays + 20) return null;
  const from = iso(sowing);
  const to = iso(today);
  const pts = (site.ndvi ?? []).filter((p) => p.date >= from && p.date <= to).sort((a, b) => a.date.localeCompare(b.date));
  const latest = pts.at(-1);
  if (!latest || (today.getTime() - Date.parse(`${latest.date}T00:00:00Z`)) / DAY > 25) return null;
  const prev = pts.at(-2);
  const peak = Math.max(...pts.map((p) => p.ndvi));
  const v = r2(latest.ndvi);

  if (daysSince >= harvestOffsetDays - 20) {
    if (peak >= 0.5 && peak - latest.ndvi >= 0.2) return { task: "HARVEST", ne: `भू-उपग्रहमा हरियाली घटेर ${v} पुगेको: बाली पाक्दैछ, कटनीको तयारी गर्नुहोस्।`, key: "ndviRipening", value: v };
    return null;
  }
  if (daysSince >= 30 && latest.ndvi < 0.3) {
    return { task: "PEST_SCOUTING", ne: `भू-उपग्रहमा बाली कमजोर देखियो (NDVI ${v}): पानी, मल र रोग-कीरा जाँच गर्नुहोस्।`, key: "ndviWeak", value: v };
  }
  if (prev && prev.ndvi - latest.ndvi >= 0.15) {
    return { task: "PEST_SCOUTING", ne: `भू-उपग्रहमा हरियाली छिटो घट्यो (${r2(prev.ndvi)} बाट ${v}): रोग, कीरा वा पानीको कमी हेर्नुहोस्।`, key: "ndviDrop", value: v };
  }
  return null;
}
