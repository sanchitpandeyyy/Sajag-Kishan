export type Index = "ndvi" | "ndre" | "ndwi" | "ndmi" | "evi" | "savi";

const round3 = (x: number) => Math.round(x * 1000) / 1000;
const valid = (x: number | null | undefined): x is number => x != null && Number.isFinite(x);

export function evi(nir: number | null | undefined, red: number | null | undefined, blue: number | null | undefined): number | null {
  if (!valid(nir) || !valid(red) || !valid(blue)) return null;
  const den = nir + 6 * red - 7.5 * blue + 1;
  if (den <= 0) return null;
  const v = (2.5 * (nir - red)) / den;
  return v < -1 || v > 1 ? null : round3(v);
}

export function savi(nir: number | null | undefined, red: number | null | undefined): number | null {
  if (!valid(nir) || !valid(red)) return null;
  const den = nir + red + 0.5;
  return den <= 0 ? null : round3((1.5 * (nir - red)) / den);
}

export function normalizedDifference(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b)) return null;
  const sum = a + b;
  if (sum <= 0) return null;
  return Math.round(((a - b) / sum) * 1000) / 1000;
}

export function reflectance(dn: number, baseline: number): number | null {
  if (!dn) return null;
  const offset = baseline >= 4 ? 1000 : 0;
  const r = (dn - offset) / 10_000;
  return r > 0 ? r : null;
}

export interface BandSet {
  blue?: number | null;
  green?: number | null;
  red?: number | null;
  redEdge?: number | null;
  nir?: number | null;
  nir8a?: number | null;
  swir?: number | null;
}

export function spectralIndices(b: BandSet): Record<Index, number | null> {
  return {
    ndvi: normalizedDifference(b.nir, b.red),
    ndre: normalizedDifference(b.nir8a, b.redEdge),
    ndwi: normalizedDifference(b.green, b.nir),
    ndmi: normalizedDifference(b.nir8a, b.swir),
    evi: evi(b.nir, b.red, b.blue),
    savi: savi(b.nir, b.red),
  };
}

export function mean(values: (number | null | undefined)[]): number | null {
  const v = values.filter((x): x is number => x != null && Number.isFinite(x));
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
}

export interface NdviClass {
  key: "water" | "bare" | "sparse" | "moderate" | "dense" | "very_dense" | "peak";
  min: number;
  ne: string;
  en: string;
  color: string;
}

export const NDVI_CLASSES: NdviClass[] = [
  { key: "water", min: -1, ne: "पानी, बादल वा हिउँ", en: "Water, cloud or snow", color: "#1d5fa8" },
  { key: "bare", min: 0, ne: "खाली माटो वा बस्ती", en: "Bare soil or built up", color: "#a0522d" },
  { key: "sparse", min: 0.2, ne: "पातलो बिरुवा", en: "Sparse plants", color: "#d9b44a" },
  { key: "moderate", min: 0.4, ne: "मध्यम बाली", en: "Moderate crop", color: "#8cc96a" },
  { key: "dense", min: 0.6, ne: "बाक्लो स्वस्थ बाली", en: "Dense, healthy crop", color: "#4a9f1e" },
  { key: "very_dense", min: 0.75, ne: "धेरै बाक्लो बाली", en: "Very dense crop", color: "#1f7a4d" },
  { key: "peak", min: 0.9, ne: "अधिकतम हरियाली (०.९+)", en: "Peak greenness (0.9+)", color: "#075426" },
];

export function ndviClass(ndvi: number): NdviClass {
  let found = NDVI_CLASSES[0]!;
  for (const c of NDVI_CLASSES) if (ndvi >= c.min) found = c;
  return found;
}

export function toDb(power: number | null): number | null {
  if (power == null || !(power > 0)) return null;
  return Math.round(10 * Math.log10(power) * 100) / 100;
}

export function slopeAspect(z: number[], cellX: number, cellY: number): { slopeDeg: number; aspectDeg: number } | null {
  if (z.length !== 9 || z.some((v) => !Number.isFinite(v) || v < -500) || cellX <= 0 || cellY <= 0) return null;
  const [a, b, c, d, , f, g, h, i] = z as [number, number, number, number, number, number, number, number, number];
  const dzdx = (c + 2 * f + i - (a + 2 * d + g)) / (8 * cellX);
  const dzdy = (g + 2 * h + i - (a + 2 * b + c)) / (8 * cellY);
  const slopeDeg = (Math.atan(Math.hypot(dzdx, dzdy)) * 180) / Math.PI;
  let aspectDeg = (Math.atan2(-dzdx, dzdy) * 180) / Math.PI;
  aspectDeg = (aspectDeg + 360) % 360;
  if (slopeDeg < 0.05) aspectDeg = 0;
  return { slopeDeg: Math.round(slopeDeg * 10) / 10, aspectDeg: Math.round(aspectDeg) };
}
