/**
 * KrishiCalendar generator (docs/05-engine-algorithms.md §2).
 *
 * v0: zone templates (expert-reviewed later) + altitude shift + weather gating.
 * Templates use a sowing anchor; each stage is an offset in days from sowing.
 * Altitude shift: cooler sites grow slower, so later stages stretch by the GDD ratio.
 */
import { getCrop } from "./crops";
import type { DailyForecast } from "./weather-alerts";
import type { AgroZone } from "./zoning";

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
  /** Offset from sowing, in days (negative = before sowing). */
  offsetDays: number;
  durationDays: number;
  titleNe: string;
  noteNe?: string;
}

export interface CropZoneTemplate {
  crop: string;
  zone: AgroZone;
  season: "BARSHE" | "HIUDE" | "CHAITE";
  /** Typical sowing window start, as AD month (1–12) and day. */
  sowingStart: { month: number; day: number };
  /** Width of the sowing window in days. */
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

/** Initial templates for the pilot (Terai). Must be reviewed by agronomists. */
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
  // Exact zone first, then the nearest available template for that crop.
  const order: AgroZone[] = ["TERAI", "LOWER_HILL", "MID_HILL", "UPPER_HILL", "MOUNTAIN"];
  const target = order.indexOf(zone);
  return forCrop.sort((a, b) => Math.abs(order.indexOf(a.zone) - target) - Math.abs(order.indexOf(b.zone) - target))[0];
}

export interface GeneratedEvent {
  crop: string;
  task: CalendarTask;
  startsOn: string; // ISO date
  endsOn: string;
  titleNe: string;
  noteNe?: string;
  reason: Record<string, string | number>;
}

export interface GenerateOptions {
  crop: string;
  zone: AgroZone;
  season?: string;
  /** Declared sowing date. Defaults to the template's window start in `year`. */
  sowingDate?: string;
  year?: number;
  /** Mean temperature at the template's reference elevation vs the parcel, °C. Used to stretch stages. */
  referenceMeanTempC?: number;
  parcelMeanTempC?: number;
  forecast?: DailyForecast[];
}

const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Generate dated calendar events for one crop on one parcel. */
export function generateCalendar(opts: GenerateOptions): GeneratedEvent[] {
  const tpl = findTemplate(opts.crop, opts.zone, opts.season);
  if (!tpl) return [];
  const crop = getCrop(opts.crop);

  const year = opts.year ?? new Date().getUTCFullYear();
  const sowing = opts.sowingDate
    ? new Date(`${opts.sowingDate}T00:00:00Z`)
    : new Date(Date.UTC(year, tpl.sowingStart.month - 1, tpl.sowingStart.day));

  // Thermal stretch: GDD/day falls at cooler sites, so stages after sowing take longer.
  let stretch = 1;
  if (crop && opts.referenceMeanTempC != null && opts.parcelMeanTempC != null) {
    const refGdd = Math.max(1, opts.referenceMeanTempC - crop.gddBase);
    const siteGdd = Math.max(1, opts.parcelMeanTempC - crop.gddBase);
    stretch = Math.min(1.6, Math.max(0.8, refGdd / siteGdd));
  }

  const heavyRainDays = new Set((opts.forecast ?? []).filter((d) => d.precipitationMm >= 30).map((d) => d.date));

  return tpl.stages.map((s) => {
    const offset = s.offsetDays > 0 ? Math.round(s.offsetDays * stretch) : s.offsetDays;
    let start = new Date(sowing.getTime() + offset * DAY);
    const reason: Record<string, string | number> = { template: tpl.version, zone: tpl.zone };
    if (stretch !== 1) reason.thermalStretch = Math.round(stretch * 100) / 100;

    // Weather gating: postpone fertilizing/sowing by a day per forecast heavy-rain day.
    if (["FERTILIZING", "SOWING", "TRANSPLANTING"].includes(s.task)) {
      let shifted = 0;
      while (heavyRainDays.has(iso(start)) && shifted < 5) {
        start = new Date(start.getTime() + DAY);
        shifted++;
      }
      if (shifted) reason.postponedForRainDays = shifted;
    }

    return {
      crop: tpl.crop,
      task: s.task,
      startsOn: iso(start),
      endsOn: iso(new Date(start.getTime() + s.durationDays * DAY)),
      titleNe: s.titleNe,
      noteNe: s.noteNe,
      reason,
    };
  });
}
