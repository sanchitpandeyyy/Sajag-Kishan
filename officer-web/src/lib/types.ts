export interface MapSummary {
  fiscalYearBs: string;
  season: "BARSHE" | "HIUDE" | "CHAITE";
  totals: {
    parcels: number;
    registeredM2: number;
    cultivatedM2: number;
    declaredFallowM2: number;
    noDataM2: number;
    fertilizedM2: number;
    verifiedM2: number;
    conflictParcels: string[];
    byCrop: { crop: string; nameNe: string; areaM2: number; parcels: number }[];
  };
  wards: { wardId: number; number?: number; registeredM2: number; cultivatedM2: number; fallowM2: number; fertilizedM2: number; parcels: number }[];
  fertilizerDemandKg: Record<string, number>;
  sources: Record<string, string>;
  satellite?: { checkedParcels: number; greenParcels: number; conflictParcels: number };
}

export const SEASON_NE = { BARSHE: "बर्खे", HIUDE: "हिउँदे", CHAITE: "चैते" } as const;

export const CROP_COLORS: Record<string, string> = {
  paddy: "#16804A",
  wheat: "#E9A23B",
  maize: "#F5A524",
  potato: "#8A5A3B",
  mustard: "#D4C02A",
  lentil: "#B5651D",
  millet: "#6B8E23",
};

/** English crop names (Nepali names come from the API). */
export const CROP_EN: Record<string, string> = {
  paddy: "Paddy",
  wheat: "Wheat",
  maize: "Maize",
  potato: "Potato",
  mustard: "Mustard",
  lentil: "Lentil",
  millet: "Finger millet",
};
