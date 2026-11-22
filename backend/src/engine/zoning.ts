export type AgroZone = "TERAI" | "LOWER_HILL" | "MID_HILL" | "UPPER_HILL" | "MOUNTAIN";

export const ZONE_LABEL_NE: Record<AgroZone, string> = {
  TERAI: "तराई",
  LOWER_HILL: "तल्लो पहाड",
  MID_HILL: "मध्य पहाड",
  UPPER_HILL: "उच्च पहाड",
  MOUNTAIN: "हिमाल",
};

export function zoneForElevation(elevationM: number): AgroZone {
  if (elevationM < 500) return "TERAI";
  if (elevationM < 1000) return "LOWER_HILL";
  if (elevationM < 1500) return "MID_HILL";
  if (elevationM < 2500) return "UPPER_HILL";
  return "MOUNTAIN";
}

export const LAPSE_RATE_C_PER_M = -0.0065;

export function adjustTempForElevation(tempC: number, fromElevationM: number, toElevationM: number): number {
  return tempC + (toElevationM - fromElevationM) * LAPSE_RATE_C_PER_M;
}

export function dailyGdd(tMin: number, tMax: number, base: number): number {
  return Math.max(0, (tMin + tMax) / 2 - base);
}
