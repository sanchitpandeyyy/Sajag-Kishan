/**
 * Pure spectral and radar index maths (no network). Hand-checked in indices.test.ts.
 *
 * Sentinel-2 L2A bands used (reflectance = (DN - offset) / 10000):
 *   B03 green 10 m, B04 red 10 m, B05 red edge 20 m, B08 NIR 10 m, B8A narrow NIR 20 m, B11 SWIR 20 m.
 *
 *   NDVI = (B08 - B04) / (B08 + B04)    greenness, how much living plant cover
 *   NDRE = (B8A - B05) / (B8A + B05)    crop vigour and nitrogen; keeps rising in dense crops where NDVI saturates
 *   NDWI = (B03 - B08) / (B03 + B08)    open water (McFeeters); flooded paddy at transplanting shows > 0
 *   NDMI = (B8A - B11) / (B8A + B11)    leaf and canopy water; drought stress drops it
 *   EVI  = 2.5 (B08 - B04) / (B08 + 6 B04 - 7.5 B02 + 1)   greenness corrected for haze and soil (B02 blue)
 *   SAVI = 1.5 (B08 - B04) / (B08 + B04 + 0.5)             greenness for sparse crops on bright soil
 *   dNDVI = NDVI(now) - NDVI(before)    change: green-up, harvest, damage
 *
 * Sentinel-1 RTC gives gamma0 in linear power; dB = 10 log10(power).
 */

export type Index = "ndvi" | "ndre" | "ndwi" | "ndmi" | "evi" | "savi";

const round3 = (x: number) => Math.round(x * 1000) / 1000;
const valid = (x: number | null | undefined): x is number => x != null && Number.isFinite(x);

/** Enhanced vegetation index; null when bands are missing or the result is outside its physical range. */
export function evi(nir: number | null | undefined, red: number | null | undefined, blue: number | null | undefined): number | null {
  if (!valid(nir) || !valid(red) || !valid(blue)) return null;
  const den = nir + 6 * red - 7.5 * blue + 1;
  if (den <= 0) return null;
  const v = (2.5 * (nir - red)) / den;
  return v < -1 || v > 1 ? null : round3(v);
}

/** Soil-adjusted vegetation index (L = 0.5). */
export function savi(nir: number | null | undefined, red: number | null | undefined): number | null {
  if (!valid(nir) || !valid(red)) return null;
  const den = nir + red + 0.5;
  return den <= 0 ? null : round3((1.5 * (nir - red)) / den);
}

/** Normalised difference (a - b) / (a + b), or null when the inputs are missing or invalid. */
export function normalizedDifference(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b)) return null;
  const sum = a + b;
  if (sum <= 0) return null;
  return Math.round(((a - b) / sum) * 1000) / 1000;
}

/** Digital number to surface reflectance. Processing baseline 04.00+ adds a +1000 offset. DN 0 is nodata. */
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

/** Mean of the valid numbers, or null. */
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

/**
 * NDVI scale from 0 to 0.9+ used on every screen (lower bound inclusive).
 * Below 0 is water, cloud or snow. 0.9+ is rare and usually a saturated, very dense canopy.
 */
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

/** Linear power to decibels. */
export function toDb(power: number | null): number | null {
  if (power == null || !(power > 0)) return null;
  return Math.round(10 * Math.log10(power) * 100) / 100;
}

/** Slope and aspect from a 3x3 elevation window (Horn's method). Cell sizes in metres. */
export function slopeAspect(z: number[], cellX: number, cellY: number): { slopeDeg: number; aspectDeg: number } | null {
  if (z.length !== 9 || z.some((v) => !Number.isFinite(v) || v < -500) || cellX <= 0 || cellY <= 0) return null;
  const [a, b, c, d, , f, g, h, i] = z as [number, number, number, number, number, number, number, number, number];
  const dzdx = (c + 2 * f + i - (a + 2 * d + g)) / (8 * cellX);
  const dzdy = (g + 2 * h + i - (a + 2 * b + c)) / (8 * cellY);
  const slopeDeg = (Math.atan(Math.hypot(dzdx, dzdy)) * 180) / Math.PI;
  // Aspect: the compass direction the slope faces (downhill; 0 north, 90 east). Rows run north to south,
  // so the downhill vector is (east -dzdx, north +dzdy). Flat ground returns 0.
  let aspectDeg = (Math.atan2(-dzdx, dzdy) * 180) / Math.PI;
  aspectDeg = (aspectDeg + 360) % 360;
  if (slopeDeg < 0.05) aspectDeg = 0;
  return { slopeDeg: Math.round(slopeDeg * 10) / 10, aspectDeg: Math.round(aspectDeg) };
}
