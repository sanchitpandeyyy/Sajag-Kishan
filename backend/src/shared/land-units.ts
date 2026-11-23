export const LAND_UNIT_M2 = {
  bigha: 6772.63,
  kattha: 338.63,
  dhur: 16.93,
  ropani: 508.72,
  aana: 31.8,
  paisa: 7.95,
  daam: 1.99,
  sqm: 1,
  hectare: 10_000,
} as const;

export type LandUnit = keyof typeof LAND_UNIT_M2;

export const LAND_UNIT_LABEL_NE: Record<LandUnit, string> = {
  bigha: "बिघा",
  kattha: "कट्ठा",
  dhur: "धुर",
  ropani: "रोपनी",
  aana: "आना",
  paisa: "पैसा",
  daam: "दाम",
  sqm: "वर्ग मिटर",
  hectare: "हेक्टर",
};

export type LandSystem = "terai" | "hill";

export type CompoundArea = Partial<Record<LandUnit, number>>;

export function toSquareMetres(area: CompoundArea): number {
  let total = 0;
  for (const [unit, value] of Object.entries(area) as [LandUnit, number][]) {
    if (value == null) continue;
    if (!Number.isFinite(value) || value < 0) {
      throw new RangeError(`Invalid ${unit} value: ${value}`);
    }
    total += value * LAND_UNIT_M2[unit];
  }
  return Math.round(total * 100) / 100;
}

export function toHectares(m2: number): number {
  return m2 / LAND_UNIT_M2.hectare;
}

export function fromSquareMetres(m2: number, system: LandSystem): CompoundArea {
  const units: LandUnit[] =
    system === "terai" ? ["bigha", "kattha", "dhur"] : ["ropani", "aana", "paisa", "daam"];
  const out: CompoundArea = {};
  let rest = m2;
  units.forEach((unit, i) => {
    const size = LAND_UNIT_M2[unit];
    const isLast = i === units.length - 1;
    const n = isLast ? Math.round((rest / size) * 100) / 100 : Math.floor(rest / size + 1e-9);
    if (n > 0) out[unit] = n;
    rest -= n * size;
  });
  return out;
}

export function formatCompoundAreaNe(area: CompoundArea): string {
  const parts = (Object.entries(area) as [LandUnit, number][])
    .filter(([, v]) => v > 0)
    .map(([u, v]) => `${toDevanagariDigits(String(v))} ${LAND_UNIT_LABEL_NE[u]}`);
  return parts.length ? parts.join(" ") : "०";
}

const DEVANAGARI_DIGITS = "०१२३४५६७८९";

export function toDevanagariDigits(s: string): string {
  return s.replace(/[0-9]/g, (d) => DEVANAGARI_DIGITS[Number(d)]!);
}

export function toAsciiDigits(s: string): string {
  return s.replace(/[०-९]/g, (d) => String(DEVANAGARI_DIGITS.indexOf(d)));
}
