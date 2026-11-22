import { slopeAspect } from "./indices";
import { epsgOf, readWindow, signHref, stacSearch, toSceneXY } from "./pc";

const COLLECTION = "cop-dem-glo-30";
const M_PER_DEG_LAT = 111_320;

export interface Terrain {
  elevationM: number;
  slopeDeg: number | null;
  aspectDeg: number | null;
  source: string;
}

export async function terrainAt(lat: number, lng: number, fetchImpl: typeof fetch = fetch): Promise<Terrain | null> {
  const items = await stacSearch({ collections: [COLLECTION], intersects: { type: "Point", coordinates: [lng, lat] }, limit: 1 }, fetchImpl);
  const item = items[0];
  const href = item?.assets.data?.href;
  if (!item || !href) return null;
  const epsg = epsgOf(item.properties) || 4326;
  const [x, y] = toSceneXY(epsg, lat, lng);
  const w = await readWindow(await signHref(COLLECTION, href, fetchImpl), x, y, 1);
  if (w.values.length !== 9) {
    const centre = w.values[Math.floor(w.values.length / 2)];
    return centre == null ? null : { elevationM: Math.round(centre), slopeDeg: null, aspectDeg: null, source: "Copernicus DEM GLO-30" };
  }
  const cellX = epsg === 4326 ? w.resX * M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180) : w.resX;
  const cellY = epsg === 4326 ? w.resY * M_PER_DEG_LAT : w.resY;
  const sa = slopeAspect(w.values, cellX, cellY);
  return { elevationM: Math.round(w.values[4]!), slopeDeg: sa?.slopeDeg ?? null, aspectDeg: sa?.aspectDeg ?? null, source: "Copernicus DEM GLO-30" };
}
