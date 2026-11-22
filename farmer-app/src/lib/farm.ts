import { bsDateText } from "./bs";
import type { Lang } from "./i18n";

const UNIT_NE: Record<string, string> = { bigha: "बिघा", kattha: "कट्ठा", dhur: "धुर", ropani: "रोपनी", aana: "आना", paisa: "पैसा", daam: "दाम" };
const UNIT_EN: Record<string, string> = { bigha: "bigha", kattha: "kattha", dhur: "dhur", ropani: "ropani", aana: "aana", paisa: "paisa", daam: "daam" };

export function landText(areaOriginal: Record<string, number> | null, areaM2: number, lang: Lang, num: (n: number, d?: number) => string): string {
  const parts = Object.entries(areaOriginal ?? {})
    .filter(([u, v]) => v > 0 && UNIT_NE[u])
    .map(([u, v]) => `${num(v)} ${lang === "ne" ? UNIT_NE[u] : UNIT_EN[u]}`);
  if (parts.length) return parts.join(" ");
  return `${num(areaM2 / 10_000)} ${lang === "ne" ? "हेक्टर" : "ha"}`;
}

export const TASK_EN: Record<string, string> = {
  LAND_PREP: "Prepare the land",
  NURSERY: "Prepare the nursery",
  SOWING: "Sow",
  TRANSPLANTING: "Transplant",
  FERTILIZING: "Apply fertilizer",
  IRRIGATION: "Irrigate",
  WEEDING: "Weed",
  PEST_SCOUTING: "Check for pests and disease",
  HARVEST: "Harvest",
  STORAGE: "Dry and store",
};

export function dateText(iso: string, lang: Lang): string {
  return bsDateText(iso, lang);
}

export function isActiveOrUpcoming(endsOn: string): boolean {
  return new Date(`${endsOn.slice(0, 10)}T23:59:59`) >= new Date();
}

export function currentSeason(now = new Date()): "BARSHE" | "HIUDE" | "CHAITE" {
  const m = now.getMonth() + 1;
  if (m >= 6 && m <= 10) return "BARSHE";
  if (m >= 3 && m <= 5) return "CHAITE";
  return "HIUDE";
}
