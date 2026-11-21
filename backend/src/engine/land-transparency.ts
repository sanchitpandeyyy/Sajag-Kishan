/**
 * Land transparency: what the satellite saw on each field, season by season, compared with what the
 * farmer declared and the subsidy they received. Pure functions (no database), rule version "season-v1".
 *
 * Why: today subsidy follows the registered land area only. The office cannot see whether the land is
 * still farmed, partly farmed, or abandoned while urea is still requested. Sentinel-2 NDVI history
 * shows, for every field and season, whether a crop actually grew. Every result is an indicator for an
 * officer visit, never proof (AGENT.md rule 6).
 */

export type Season = "BARSHE" | "HIUDE" | "CHAITE";

export interface SeasonWindow {
  key: string; // "2083/84-HIUDE"
  fiscalYearBs: string;
  season: Season;
  from: Date;
  to: Date;
  labelNe: string;
  labelEn: string;
}

const SEASON_NE: Record<Season, string> = { BARSHE: "बर्खे", HIUDE: "हिउँदे", CHAITE: "चैते" };
const SEASON_EN: Record<Season, string> = { BARSHE: "Monsoon", HIUDE: "Winter", CHAITE: "Spring" };

/**
 * Growing windows (AD) used to read the crop signal:
 *   Barshe (monsoon paddy, maize): 15 Jun to 31 Oct
 *   Hiude (wheat, mustard, potato): 1 Nov to end of Feb
 *   Chaite (spring maize, vegetables): 1 Mar to 14 Jun
 */
function windowFor(season: Season, startYear: number): { from: Date; to: Date } {
  if (season === "BARSHE") return { from: new Date(Date.UTC(startYear, 5, 15)), to: new Date(Date.UTC(startYear, 9, 31, 23, 59)) };
  if (season === "HIUDE") return { from: new Date(Date.UTC(startYear, 10, 1)), to: new Date(Date.UTC(startYear + 1, 1, 28, 23, 59)) };
  return { from: new Date(Date.UTC(startYear, 2, 1)), to: new Date(Date.UTC(startYear, 5, 14, 23, 59)) };
}

/** Nepali fiscal year (starts about 16 July) of a date, as "2083/84". Same rule as scope.ts. */
export function fiscalYearOf(d: Date): string {
  const afterJul16 = d.getUTCMonth() > 6 || (d.getUTCMonth() === 6 && d.getUTCDate() >= 16);
  const startBs = d.getUTCFullYear() + 56 + (afterJul16 ? 1 : 0);
  return `${startBs}/${String((startBs + 1) % 100).padStart(2, "0")}`;
}

function seasonOf(d: Date): { season: Season; startYear: number } {
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  if ((m === 6 && day >= 15) || (m >= 7 && m <= 10)) return { season: "BARSHE", startYear: d.getUTCFullYear() };
  if (m >= 11) return { season: "HIUDE", startYear: d.getUTCFullYear() };
  if (m <= 2) return { season: "HIUDE", startYear: d.getUTCFullYear() - 1 };
  return { season: "CHAITE", startYear: d.getUTCFullYear() };
}

const DEVANAGARI = "०१२३४५६७८९";
const toDevanagari = (x: string) => x.replace(/\d/g, (d) => DEVANAGARI[Number(d)]!);

const ORDER: Season[] = ["CHAITE", "BARSHE", "HIUDE"]; // within one AD year, by start date

/** The current season and the `count - 1` before it, oldest first. */
export function seasonWindows(now: Date, count: number): SeasonWindow[] {
  let { season, startYear } = seasonOf(now);
  const out: SeasonWindow[] = [];
  for (let i = 0; i < count; i++) {
    const w = windowFor(season, startYear);
    const fy = fiscalYearOf(new Date((w.from.getTime() + w.to.getTime()) / 2));
    out.push({ key: `${fy}-${season}`, fiscalYearBs: fy, season, from: w.from, to: w.to, labelNe: `${SEASON_NE[season]} ${toDevanagari(fy)}`, labelEn: `${SEASON_EN[season]} ${fy}` });
    const idx = ORDER.indexOf(season);
    if (idx === 0) {
      season = "HIUDE";
      startYear -= 1;
    } else season = ORDER[idx - 1]!;
  }
  return out.reverse();
}

/**
 * Days after a season starts before its crops are expected near their peak. Until then a low NDVI
 * means "not grown yet", not "fallow", so the season cannot be judged.
 */
export const DAYS_TO_JUDGE = 75;

export function seasonJudgeable(w: SeasonWindow, now: Date): boolean {
  return now.getTime() >= w.from.getTime() + DAYS_TO_JUDGE * 86_400_000;
}

/** Index of the latest window that can be judged (its crops have had time to grow). */
export function latestJudgeableIndex(windows: SeasonWindow[], now: Date): number {
  for (let i = windows.length - 1; i >= 0; i--) if (seasonJudgeable(windows[i]!, now)) return i;
  return 0;
}

export type FieldStatus = "cultivated" | "weak" | "fallow" | "unknown";

/** Thresholds (season-v1). NDVI peak in the season window, clear readings only. */
export const SEASON_RULES = { cultivatedPeak: 0.5, fallowPeak: 0.35, minReadingsForFallow: 2, rule: "season-v1" } as const;

/**
 * Status of one field in one season from its NDVI readings inside the window:
 *   cultivated: a clear crop peak (NDVI >= 0.5)
 *   weak: some green (0.35 to 0.5): sparse or late crop, part of the field farmed, or weeds
 *   fallow: 2+ clear readings and never above 0.35
 *   unknown: too few clear readings (cloud, or not synced yet)
 */
export function seasonStatus(ndvi: (number | null)[]): { status: FieldStatus; peakNdvi: number | null; readings: number } {
  const v = ndvi.filter((x): x is number => x != null && Number.isFinite(x));
  if (!v.length) return { status: "unknown", peakNdvi: null, readings: 0 };
  const peak = Math.max(...v);
  const status: FieldStatus = peak >= SEASON_RULES.cultivatedPeak ? "cultivated" : peak >= SEASON_RULES.fallowPeak ? "weak" : v.length >= SEASON_RULES.minReadingsForFallow ? "fallow" : "unknown";
  return { status, peakNdvi: Math.round(peak * 1000) / 1000, readings: v.length };
}

export type CheckFlag = "subsidy_on_fallow" | "declared_not_seen" | "farmed_not_declared" | "abandoned" | "area_overclaim";

/** Severity used for sorting and the dashboard: subsidy misuse first. */
export const FLAG_WEIGHT: Record<CheckFlag, number> = { subsidy_on_fallow: 5, declared_not_seen: 3, abandoned: 3, area_overclaim: 2, farmed_not_declared: 1 };

export interface FieldCheckInput {
  registeredM2: number;
  /** This season: declared a crop (true), declared fallow (false), nothing declared (null). */
  declaredCultivated: boolean | null;
  declaredSownM2: number;
  /** Fertilizer recorded for this field this season (declared inputs + delivered subsidy), kg. */
  fertilizerKg: number;
  status: FieldStatus;
  /** Satellite status of the previous seasons, oldest first. */
  history: FieldStatus[];
}

/** Flags for one field this season. Empty = consistent or not enough data. */
export function fieldFlags(f: FieldCheckInput): CheckFlag[] {
  const flags: CheckFlag[] = [];
  if (f.status === "fallow" && f.fertilizerKg > 0) flags.push("subsidy_on_fallow");
  if (f.status === "fallow" && f.declaredCultivated === true) flags.push("declared_not_seen");
  if (f.status === "cultivated" && f.declaredCultivated == null) flags.push("farmed_not_declared");
  // Fallow now and in every known earlier season (at least two): likely given up.
  const known = [...f.history, f.status].filter((s) => s !== "unknown");
  if (known.length >= 3 && known.every((s) => s === "fallow")) flags.push("abandoned");
  if (f.declaredSownM2 > f.registeredM2 * 1.05) flags.push("area_overclaim");
  return flags.sort((a, b) => FLAG_WEIGHT[b] - FLAG_WEIGHT[a]);
}

export type Productivity = "high" | "normal" | "low" | "unknown";

/**
 * Productivity indicator: the field's average seasonal NDVI peak compared with the median of all fields
 * in the municipality. A satellite proxy for how well the land produces, not a soil test.
 */
export function productivityClass(fieldPeaks: (number | null)[], municipalityMedian: number | null): { cls: Productivity; ratio: number | null } {
  const v = fieldPeaks.filter((x): x is number => x != null);
  if (v.length < 2 || !municipalityMedian) return { cls: "unknown", ratio: null };
  const ratio = Math.round((v.reduce((s, x) => s + x, 0) / v.length / municipalityMedian) * 100) / 100;
  return { cls: ratio >= 1.1 ? "high" : ratio <= 0.85 ? "low" : "normal", ratio };
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}
