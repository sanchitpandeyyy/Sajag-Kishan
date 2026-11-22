import { CALENDAR_TEMPLATES, findTemplate, getCrop, trapezoid, type AgroZone } from "../engine";
import { formatCompoundAreaNe, LAND_UNIT_M2, type CompoundArea, type LandSystem, type LandUnit } from "../shared/land-units";

const TERAI_UNITS: LandUnit[] = ["bigha", "kattha", "dhur"];
const HILL_UNITS: LandUnit[] = ["ropani", "aana", "paisa", "daam"];

const UNIT_WORDS: [LandSystem, string[]][] = [
  ["terai", ["बिघा", "बिगाहा", "कट्ठा", "धुर", "bigha", "kattha", "katha", "dhur"]],
  ["hill", ["रोपनी", "आना", "पैसा", "दाम", "ropani", "aana", "ana"]],
];

export function landSystemFor(zone: AgroZone | null, originals: unknown[]): LandSystem {
  for (const o of originals) {
    if (!o || typeof o !== "object") continue;
    const keys = Object.keys(o);
    if (keys.some((k) => TERAI_UNITS.includes(k as LandUnit))) return "terai";
    if (keys.some((k) => HILL_UNITS.includes(k as LandUnit))) return "hill";
  }
  return zone && zone !== "TERAI" ? "hill" : "terai";
}

export function unitSystemAsked(question: string): LandSystem | null {
  const q = question.toLowerCase();
  for (const [system, words] of UNIT_WORDS) if (words.some((w) => q.includes(w))) return system;
  return null;
}

export function spokenArea(m2: number, system: LandSystem): CompoundArea {
  if (system === "terai") {
    const dhur = Math.round(m2 / LAND_UNIT_M2.dhur);
    return { bigha: Math.floor(dhur / 400), kattha: Math.floor((dhur % 400) / 20), dhur: dhur % 20 };
  }
  const aana = Math.round(m2 / LAND_UNIT_M2.aana);
  return { ropani: Math.floor(aana / 16), aana: aana % 16 };
}

export function areaNe(m2: number, system: LandSystem): string {
  return formatCompoundAreaNe(spokenArea(m2, system));
}

export function areaEn(m2: number, system: LandSystem): string {
  const parts = Object.entries(spokenArea(m2, system)).filter(([, v]) => v > 0);
  return parts.length ? parts.map(([u, v]) => `${v} ${u}`).join(" ") : "0";
}

export function smallUnit(system: LandSystem): { unit: "kattha" | "ropani"; m2: number; ne: string } {
  return system === "terai" ? { unit: "kattha", m2: LAND_UNIT_M2.kattha, ne: "कट्ठा" } : { unit: "ropani", m2: LAND_UNIT_M2.ropani, ne: "रोपनी" };
}

export interface PlantOption {
  crop: string;
  nameNe: string;
  nameEn: string;
  season: string;
  windowStart: string;
  windowEnd: string;
  status: "open" | "soon";
  soilFit: "good" | "fair" | "poor" | null;
  alreadyGrowing: boolean;
}

const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);

export function plantOptions(zone: AgroZone | null, today: string, opts: { soilPh?: number | null; growing?: string[]; horizonDays?: number } = {}): PlantOption[] {
  if (!zone) return [];
  const now = new Date(`${today}T00:00:00Z`).getTime();
  const horizon = (opts.horizonDays ?? 60) * DAY;
  const seen = new Set<string>();
  const out: PlantOption[] = [];
  for (const { crop, season } of CALENDAR_TEMPLATES) {
    const key = `${crop}:${season}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const tpl = findTemplate(crop, zone, season);
    const info = getCrop(crop);
    if (!tpl || !info) continue;
    const year = new Date(now).getUTCFullYear();
    for (const y of [year - 1, year, year + 1]) {
      const start = Date.UTC(y, tpl.sowingStart.month - 1, tpl.sowingStart.day);
      const end = start + tpl.sowingWindowDays * DAY;
      const status = now >= start && now <= end ? "open" : start > now && start - now <= horizon ? "soon" : null;
      if (!status) continue;
      const fit = opts.soilPh == null ? null : trapezoid(opts.soilPh, info.soilPh);
      out.push({
        crop,
        nameNe: info.nameNe,
        nameEn: info.nameEn,
        season,
        windowStart: iso(new Date(start)),
        windowEnd: iso(new Date(end)),
        status,
        soilFit: fit == null ? null : fit >= 0.8 ? "good" : fit >= 0.4 ? "fair" : "poor",
        alreadyGrowing: (opts.growing ?? []).includes(crop),
      });
      break;
    }
  }
  return out.sort((a, b) => (a.status === b.status ? a.windowStart.localeCompare(b.windowStart) : a.status === "open" ? -1 : 1));
}

export interface AlertFact {
  type: string;
  titleNe: string;
  messageNe: string;
  severity: string;
  crops: string[];
  validFrom: string;
  validTo: string;
  active: boolean;
  seen: boolean;
}

export interface AlertSummary {
  active: number;
  severe: number;
  forMyCrops: string[];
  recentTypes: string[];
}

export function summarizeAlerts(alerts: AlertFact[], myCrops: string[]): AlertSummary {
  const active = alerts.filter((a) => a.active);
  return {
    active: active.length,
    severe: active.filter((a) => a.severity === "SEVERE").length,
    forMyCrops: active.filter((a) => !a.crops.length || a.crops.some((c) => myCrops.includes(c))).map((a) => a.titleNe),
    recentTypes: [...new Set(alerts.map((a) => a.type))],
  };
}
