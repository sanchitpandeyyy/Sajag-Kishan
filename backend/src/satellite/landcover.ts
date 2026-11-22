import { epsgOf, readWindow, signHref, stacSearch, toSceneXY } from "./pc";

const COLLECTION = "esa-worldcover";

export const WORLDCOVER_CLASSES: Record<number, { key: string; ne: string; en: string }> = {
  10: { key: "trees", ne: "रुख/जङ्गल", en: "Trees" },
  20: { key: "shrub", ne: "झाडी", en: "Shrubland" },
  30: { key: "grass", ne: "घाँसे मैदान", en: "Grassland" },
  40: { key: "cropland", ne: "खेतीयोग्य जमिन", en: "Cropland" },
  50: { key: "built", ne: "बस्ती", en: "Built-up" },
  60: { key: "bare", ne: "खाली जमिन", en: "Bare" },
  70: { key: "snow", ne: "हिउँ", en: "Snow and ice" },
  80: { key: "water", ne: "पानी", en: "Water" },
  90: { key: "wetland", ne: "सिमसार", en: "Wetland" },
  95: { key: "mangrove", ne: "म्यान्ग्रोभ", en: "Mangroves" },
  100: { key: "moss", ne: "लेउ", en: "Moss and lichen" },
};

export interface LandCover {
  centre: string | null;
  croplandShare: number;
  mix: Record<string, number>;
  source: string;
}

async function itemFor(lat: number, lng: number, fetchImpl: typeof fetch) {
  const items = await stacSearch({ collections: [COLLECTION], intersects: { type: "Point", coordinates: [lng, lat] }, sortby: [{ field: "datetime", direction: "desc" }], limit: 1 }, fetchImpl);
  const it = items[0];
  return it?.assets.map?.href ? { href: it.assets.map.href, epsg: epsgOf(it.properties) || 4326 } : null;
}

export async function landCoverAt(lat: number, lng: number, fetchImpl: typeof fetch = fetch): Promise<LandCover | null> {
  const it = await itemFor(lat, lng, fetchImpl);
  if (!it) return null;
  const [x, y] = toSceneXY(it.epsg, lat, lng);
  const w = await readWindow(await signHref(COLLECTION, it.href, fetchImpl), x, y, 2);
  if (!w.values.length) return null;
  const mix: Record<string, number> = {};
  for (const v of w.values) {
    const k = WORLDCOVER_CLASSES[v]?.key ?? "other";
    mix[k] = (mix[k] ?? 0) + 1;
  }
  const centreVal = w.values[Math.floor(w.values.length / 2)];
  return {
    centre: centreVal != null ? (WORLDCOVER_CLASSES[centreVal]?.key ?? "other") : null,
    croplandShare: Math.round(((mix.cropland ?? 0) / w.values.length) * 100) / 100,
    mix,
    source: "ESA WorldCover 2021 v200",
  };
}
