import { areaMismatch } from "../geo/field";
export type Season = "BARSHE" | "HIUDE" | "CHAITE";

export interface SeasonWindow {
  key: string;
  fiscalYearBs: string;
  season: Season;
  from: Date;
  to: Date;
  /** Start of the part of the season used to judge it. The first weeks are skipped because the previous crop is often still standing (wheat in March, rice in November). */
  judgeFrom: Date;
  labelNe: string;
  labelEn: string;
}

const SEASON_NE: Record<Season, string> = { BARSHE: "बर्खे", HIUDE: "हिउँदे", CHAITE: "चैते" };
const SEASON_EN: Record<Season, string> = { BARSHE: "Monsoon", HIUDE: "Winter", CHAITE: "Spring" };

function windowFor(season: Season, startYear: number): { from: Date; to: Date } {
  if (season === "BARSHE") return { from: new Date(Date.UTC(startYear, 5, 15)), to: new Date(Date.UTC(startYear, 9, 31, 23, 59)) };
  if (season === "HIUDE") return { from: new Date(Date.UTC(startYear, 10, 1)), to: new Date(Date.UTC(startYear + 1, 1, 28, 23, 59)) };
  return { from: new Date(Date.UTC(startYear, 2, 1)), to: new Date(Date.UTC(startYear, 5, 14, 23, 59)) };
}

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

/** Days at the start of a season skipped when judging it, so the previous crop's tail is not counted. */
export const CARRYOVER_DAYS = 30;

const DEVANAGARI = "०१२३४५६७८९";
const toDevanagari = (x: string) => x.replace(/\d/g, (d) => DEVANAGARI[Number(d)]!);

const ORDER: Season[] = ["CHAITE", "BARSHE", "HIUDE"];

export function seasonWindows(now: Date, count: number): SeasonWindow[] {
  let { season, startYear } = seasonOf(now);
  const out: SeasonWindow[] = [];
  for (let i = 0; i < count; i++) {
    const w = windowFor(season, startYear);
    const fy = fiscalYearOf(new Date((w.from.getTime() + w.to.getTime()) / 2));
    out.push({ key: `${fy}-${season}`, fiscalYearBs: fy, season, from: w.from, to: w.to, judgeFrom: new Date(w.from.getTime() + CARRYOVER_DAYS * 86_400_000), labelNe: `${SEASON_NE[season]} ${toDevanagari(fy)}`, labelEn: `${SEASON_EN[season]} ${fy}` });
    const idx = ORDER.indexOf(season);
    if (idx === 0) {
      season = "HIUDE";
      startYear -= 1;
    } else season = ORDER[idx - 1]!;
  }
  return out.reverse();
}

export const DAYS_TO_JUDGE = 75;

export function seasonJudgeable(w: SeasonWindow, now: Date): boolean {
  return now.getTime() >= w.from.getTime() + DAYS_TO_JUDGE * 86_400_000;
}

export function latestJudgeableIndex(windows: SeasonWindow[], now: Date): number {
  for (let i = windows.length - 1; i >= 0; i--) if (seasonJudgeable(windows[i]!, now)) return i;
  return 0;
}

export type FieldStatus = "cultivated" | "weak" | "fallow" | "unknown";

export const SEASON_RULES = { cultivatedPeak: 0.5, fallowPeak: 0.35, minReadingsForFallow: 2, rule: "season-v2" } as const;

export function seasonStatus(ndvi: (number | null)[]): { status: FieldStatus; peakNdvi: number | null; readings: number } {
  const v = ndvi.filter((x): x is number => x != null && Number.isFinite(x));
  if (!v.length) return { status: "unknown", peakNdvi: null, readings: 0 };
  const peak = Math.max(...v);
  const status: FieldStatus = peak >= SEASON_RULES.cultivatedPeak ? "cultivated" : peak >= SEASON_RULES.fallowPeak ? "weak" : v.length >= SEASON_RULES.minReadingsForFallow ? "fallow" : "unknown";
  return { status, peakNdvi: Math.round(peak * 1000) / 1000, readings: v.length };
}

export type CheckFlag = "subsidy_on_fallow" | "declared_not_seen" | "farmed_not_declared" | "abandoned" | "area_overclaim" | "area_mismatch";

export const FLAG_WEIGHT: Record<CheckFlag, number> = { subsidy_on_fallow: 5, declared_not_seen: 3, abandoned: 3, area_overclaim: 2, area_mismatch: 2, farmed_not_declared: 1 };

export interface FieldCheckInput {
  registeredM2: number;
  declaredCultivated: boolean | null;
  declaredSownM2: number;
  fertilizerKg: number;
  status: FieldStatus;
  history: FieldStatus[];
  /** Area of the mapped outline (m²), when the field has one. */
  measuredM2?: number | null;
}

export function fieldFlags(f: FieldCheckInput): CheckFlag[] {
  const flags: CheckFlag[] = [];
  if (f.status === "fallow" && f.fertilizerKg > 0) flags.push("subsidy_on_fallow");
  if (f.status === "fallow" && f.declaredCultivated === true) flags.push("declared_not_seen");
  if (f.status === "cultivated" && f.declaredCultivated == null) flags.push("farmed_not_declared");
  const known = [...f.history, f.status].filter((s) => s !== "unknown");
  if (known.length >= 3 && known.every((s) => s === "fallow")) flags.push("abandoned");
  if (f.declaredSownM2 > f.registeredM2 * 1.05) flags.push("area_overclaim");
  if (areaMismatch(f.registeredM2, f.measuredM2)) flags.push("area_mismatch");
  return flags.sort((a, b) => FLAG_WEIGHT[b] - FLAG_WEIGHT[a]);
}

export type Productivity = "high" | "normal" | "low" | "unknown";

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
