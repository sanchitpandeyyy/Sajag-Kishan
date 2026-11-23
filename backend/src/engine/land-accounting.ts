export interface ParcelFact {
  id: string;
  wardId: number;
  areaM2: number;
  verified: boolean;
  declaredCrops: { crop: string; sownAreaM2: number; isFallow?: boolean }[];
  fertilized: boolean;
  satelliteGreen?: boolean | null;
}

export interface LandSummary {
  parcels: number;
  registeredM2: number;
  cultivatedM2: number;
  declaredFallowM2: number;
  noDataM2: number;
  fertilizedM2: number;
  verifiedM2: number;
  conflictParcels: string[];
  byCrop: { crop: string; areaM2: number; parcels: number }[];
}

export function summarizeLand(parcels: ParcelFact[]): LandSummary {
  const byCrop = new Map<string, { areaM2: number; parcels: number }>();
  const s: LandSummary = {
    parcels: parcels.length,
    registeredM2: 0,
    cultivatedM2: 0,
    declaredFallowM2: 0,
    noDataM2: 0,
    fertilizedM2: 0,
    verifiedM2: 0,
    conflictParcels: [],
    byCrop: [],
  };

  for (const p of parcels) {
    s.registeredM2 += p.areaM2;
    if (p.verified) s.verifiedM2 += p.areaM2;
    if (p.fertilized) s.fertilizedM2 += p.areaM2;

    const cropped = p.declaredCrops.filter((d) => !d.isFallow);
    if (cropped.length) {
      s.cultivatedM2 += Math.min(p.areaM2, Math.max(...cropped.map((d) => d.sownAreaM2)));
      for (const d of cropped) {
        const cur = byCrop.get(d.crop) ?? { areaM2: 0, parcels: 0 };
        cur.areaM2 += d.sownAreaM2;
        cur.parcels += 1;
        byCrop.set(d.crop, cur);
      }
      if (p.satelliteGreen === false) s.conflictParcels.push(p.id);
    } else if (p.declaredCrops.some((d) => d.isFallow)) {
      s.declaredFallowM2 += p.areaM2;
    } else {
      s.noDataM2 += p.areaM2;
    }
  }

  s.byCrop = [...byCrop].map(([crop, v]) => ({ crop, ...v })).sort((a, b) => b.areaM2 - a.areaM2);
  return s;
}

export function estimateProductionKg(areaM2: number, baseYieldKgHa: number, ndviAnomaly = 0, k = 0.8): number {
  const factor = Math.min(1.2, Math.max(0.6, 1 + k * ndviAnomaly));
  return Math.round((areaM2 / 10_000) * baseYieldKgHa * factor);
}
