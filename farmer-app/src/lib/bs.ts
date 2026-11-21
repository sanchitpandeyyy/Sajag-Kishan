/**
 * Bikram Sambat (Nepali) dates for the farmer app.
 * All API dates are Gregorian ISO strings; farmers see them as BS ("५ मंसिर").
 * Months are 0-indexed (0 = Baisakh) like the underlying library.
 */
import { MONTH_EN, MONTH_NP, NEPALI_DATE_MAP, NepaliDate, WEEK_SHORT_EN, WEEK_SHORT_NP } from "nepali-date-library";
import type { Lang } from "./i18n";

const DEVANAGARI = "०१२३४५६७८९";

export const BS_MONTHS: Record<Lang, string[]> = { ne: MONTH_NP, en: MONTH_EN };
export const BS_WEEK_SHORT: Record<Lang, string[]> = { ne: WEEK_SHORT_NP, en: WEEK_SHORT_EN };

/** Digits in Nepali numerals when the app language is Nepali. */
export function digits(n: number | string, lang: Lang): string {
  const s = String(n);
  return lang === "ne" ? s.replace(/[0-9]/g, (x) => DEVANAGARI[Number(x)]!) : s;
}

export interface BsDate {
  year: number;
  month: number;
  day: number;
}

/** "2026-11-21" (Gregorian, a calendar date with no time zone) to its BS date. */
export function isoToBs(iso: string): BsDate {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number) as [number, number, number];
  const bs = new NepaliDate(new Date(y, m - 1, d));
  return { year: bs.year, month: bs.month, day: bs.day };
}

export function todayIso(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

export function daysInBsMonth(year: number, month: number): number {
  return NEPALI_DATE_MAP.find((y) => y.year === year)?.days[month] ?? 30;
}

/** Month list bounds supported by the converter. */
export const BS_MIN_YEAR = NEPALI_DATE_MAP[0]!.year;
export const BS_MAX_YEAR = NEPALI_DATE_MAP[NEPALI_DATE_MAP.length - 1]!.year;

/** "५ मंसिर" or "5 Mangsir" for a Gregorian ISO date. */
export function bsDateText(iso: string, lang: Lang): string {
  const b = isoToBs(iso);
  return `${digits(b.day, lang)} ${BS_MONTHS[lang][b.month]}`;
}

/** "५ मंसिर २०८३" with the year. */
export function bsDateYearText(iso: string, lang: Lang): string {
  const b = isoToBs(iso);
  return `${digits(b.day, lang)} ${BS_MONTHS[lang][b.month]} ${digits(b.year, lang)}`;
}

export function bsMonthTitle(year: number, month: number, lang: Lang): string {
  return `${BS_MONTHS[lang][month]} ${digits(year, lang)}`;
}

export function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const idx = year * 12 + month + delta;
  return { year: Math.floor(idx / 12), month: ((idx % 12) + 12) % 12 };
}

export interface BsCell {
  day: number;
  /** Gregorian date of this BS day, "YYYY-MM-DD". */
  iso: string;
  /** Gregorian day of month, shown small under the BS day. */
  adDay: number;
  weekday: number; // 0 = Sunday ... 6 = Saturday
}

/** Rows of 7 (Sunday first); null pads the days outside the month. */
export function bsMonthGrid(year: number, month: number): (BsCell | null)[][] {
  const first = new NepaliDate(year, month, 1);
  const start = first.getEnglishDate();
  // The converter returns the instant of local-midnight-in-Nepal; read it in UTC so every phone time zone agrees.
  const base = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const lead = first.getDay();
  const total = daysInBsMonth(year, month);
  const cells: (BsCell | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= total; d++) {
    const g = new Date(base + (d - 1) * 86_400_000);
    cells.push({
      day: d,
      iso: `${g.getUTCFullYear()}-${String(g.getUTCMonth() + 1).padStart(2, "0")}-${String(g.getUTCDate()).padStart(2, "0")}`,
      adDay: g.getUTCDate(),
      weekday: (lead + d - 1) % 7,
    });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (BsCell | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}
