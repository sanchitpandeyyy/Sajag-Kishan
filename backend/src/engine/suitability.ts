/**
 * Explainable crop suitability (EcoCrop-style), docs/05-engine-algorithms.md §3.
 * suitability = min(tempScore, rainScore, phScore) × 100
 */
import { CROPS, type CropParams, type Range4 } from "./crops";

/** 0 outside [min,max], 1 inside [optLow,optHigh], linear in between. */
export function trapezoid(x: number, [min, optLow, optHigh, max]: Range4): number {
  if (x <= min || x >= max) return 0;
  if (x >= optLow && x <= optHigh) return 1;
  if (x < optLow) return (x - min) / (optLow - min);
  return (max - x) / (max - optHigh);
}

export interface SiteConditions {
  /** Mean temperature over the candidate growing season, °C. */
  seasonMeanTempC: number;
  /** Total rainfall over the candidate growing season, mm. */
  seasonRainMm: number;
  soilPh?: number;
  irrigated?: boolean;
}

export interface SuitabilityResult {
  crop: string;
  nameNe: string;
  score: number;
  factors: { temperature: number; rainfall: number; soilPh: number | null };
  limitingFactor: "temperature" | "rainfall" | "soilPh";
}

export function scoreCrop(crop: CropParams, site: SiteConditions): SuitabilityResult {
  const temperature = trapezoid(site.seasonMeanTempC, crop.temp);
  let rainfall = trapezoid(site.seasonRainMm, crop.rain);
  if (site.irrigated) rainfall = Math.max(rainfall, 0.8);
  const soilPh = site.soilPh == null ? null : trapezoid(site.soilPh, crop.soilPh);

  const candidates: [SuitabilityResult["limitingFactor"], number][] = [
    ["temperature", temperature],
    ["rainfall", rainfall],
  ];
  if (soilPh != null) candidates.push(["soilPh", soilPh]);
  const [limitingFactor, min] = candidates.reduce((a, b) => (b[1] < a[1] ? b : a));

  return {
    crop: crop.code,
    nameNe: crop.nameNe,
    score: Math.round(min * 100),
    factors: { temperature, rainfall, soilPh },
    limitingFactor,
  };
}

/** Rank all known crops for a site, best first. */
export function rankCrops(site: SiteConditions, crops: readonly CropParams[] = CROPS): SuitabilityResult[] {
  return crops.map((c) => scoreCrop(c, site)).sort((a, b) => b.score - a.score);
}
