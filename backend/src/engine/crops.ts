export type Range4 = readonly [min: number, optLow: number, optHigh: number, max: number];

export interface CropParams {
  code: string;
  nameNe: string;
  nameEn: string;
  temp: Range4;
  rain: Range4;
  soilPh: Range4;
  gddBase: number;
  durationDays: number;
}

export const CROPS: readonly CropParams[] = [
  { code: "paddy", nameNe: "धान", nameEn: "Paddy", temp: [15, 20, 32, 38], rain: [800, 1200, 2500, 4000], soilPh: [4.5, 5.5, 7.0, 8.0], gddBase: 10, durationDays: 130 },
  { code: "wheat", nameNe: "गहुँ", nameEn: "Wheat", temp: [5, 15, 23, 30], rain: [300, 450, 650, 1000], soilPh: [5.5, 6.0, 7.5, 8.5], gddBase: 4, durationDays: 140 },
  { code: "maize", nameNe: "मकै", nameEn: "Maize", temp: [10, 18, 30, 40], rain: [400, 600, 1200, 1800], soilPh: [5.0, 5.8, 7.0, 8.0], gddBase: 10, durationDays: 120 },
  { code: "potato", nameNe: "आलु", nameEn: "Potato", temp: [5, 15, 20, 28], rain: [300, 500, 800, 1200], soilPh: [4.5, 5.0, 6.5, 7.5], gddBase: 7, durationDays: 110 },
  { code: "mustard", nameNe: "तोरी", nameEn: "Mustard", temp: [5, 12, 22, 30], rain: [250, 350, 600, 1000], soilPh: [5.5, 6.0, 7.5, 8.5], gddBase: 5, durationDays: 100 },
  { code: "lentil", nameNe: "मसुरो", nameEn: "Lentil", temp: [6, 15, 25, 30], rain: [250, 350, 600, 1000], soilPh: [5.5, 6.0, 7.5, 8.5], gddBase: 5, durationDays: 120 },
  { code: "millet", nameNe: "कोदो", nameEn: "Finger millet", temp: [12, 18, 28, 35], rain: [400, 600, 1200, 2000], soilPh: [4.5, 5.0, 7.0, 8.0], gddBase: 10, durationDays: 120 },
];

export function getCrop(code: string): CropParams | undefined {
  return CROPS.find((c) => c.code === code);
}
