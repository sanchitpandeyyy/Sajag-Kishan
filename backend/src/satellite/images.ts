/**
 * Picture links for Sentinel-2 scenes, rendered on the fly by the Microsoft Planetary Computer data API
 * (free, no key): a true-colour photo and an NDVI map of any box, as JPEG (about 5x smaller than PNG). Nothing is stored; the officer's
 * browser loads the PNG straight from Planetary Computer.
 *
 * NDVI colours: red (bare, 0) to yellow to green (dense crop, 0.9). Since processing baseline 04.00
 * (25 Jan 2022) each band carries a +1000 offset, which the expression removes.
 */

const DATA_API = "https://planetarycomputer.microsoft.com/api/data/v1/item/bbox";
const BASELINE_04 = Date.UTC(2022, 0, 25);

export type BBox = [number, number, number, number]; // minLng, minLat, maxLng, maxLat

export function boxAround(lat: number, lng: number, halfDeg: number): BBox {
  return [lng - halfDeg, lat - halfDeg, lng + halfDeg, lat + halfDeg].map((v) => Math.round(v * 1e5) / 1e5) as BBox;
}

/** Box around a set of points with a margin, at least `minHalfDeg` each way. */
export function boxAroundPoints(points: { lat: number; lng: number }[], marginDeg = 0.01, minHalfDeg = 0.01): BBox | null {
  if (!points.length) return null;
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const cLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const cLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
  const half = Math.max(minHalfDeg, (Math.max(...lats) - Math.min(...lats)) / 2 + marginDeg, (Math.max(...lngs) - Math.min(...lngs)) / 2 + marginDeg);
  return boxAround(cLat, cLng, half);
}

export interface SceneImages {
  sceneId: string;
  date: string;
  bbox: BBox;
  trueColor: string;
  ndvi: string;
}

export function sceneImages(sceneId: string, date: string, bbox: BBox, size = 320): SceneImages {
  const offset = Date.parse(date) >= BASELINE_04;
  const box = bbox.join(",");
  const base = `${DATA_API}/${box}.jpg?collection=sentinel-2-l2a&item=${encodeURIComponent(sceneId)}&width=${size}&height=${size}`;
  const lo = offset ? 1000 : 0;
  const trueColor = `${base}&assets=B04&assets=B03&assets=B02&rescale=${lo},${lo + 2200}&color_formula=${encodeURIComponent("Gamma RGB 1.4 Saturation 1.3")}`;
  const expr = offset ? "(B08-B04)/(B08+B04-2000)" : "(B08-B04)/(B08+B04)";
  const ndvi = `${base}&expression=${encodeURIComponent(expr)}&asset_as_band=true&rescale=0,0.9&colormap_name=rdylgn`;
  return { sceneId, date, bbox, trueColor, ndvi };
}
