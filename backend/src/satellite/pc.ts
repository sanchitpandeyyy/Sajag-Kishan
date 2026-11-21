/**
 * Microsoft Planetary Computer helpers shared by Sentinel-2, Sentinel-1 and the terrain model.
 * Free and open, no account: STAC search + a short-lived SAS token per collection, then HTTP range
 * reads of only the few pixels around a field from cloud-optimised GeoTIFFs.
 */
import { fromUrl } from "geotiff";
import proj4 from "proj4";

const STAC = "https://planetarycomputer.microsoft.com/api/stac/v1/search";
const TOKEN = "https://planetarycomputer.microsoft.com/api/sas/v1/token/";

export interface StacItem {
  id: string;
  properties: Record<string, unknown>;
  assets: Record<string, { href: string }>;
}

const tokens = new Map<string, { token: string; expires: number }>();

export async function sasToken(collection: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const cached = tokens.get(collection);
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;
  const res = await fetchImpl(TOKEN + collection);
  if (!res.ok) throw new Error(`Planetary Computer token failed (${collection}): ${res.status}`);
  const j = (await res.json()) as { token: string; "msft:expiry": string };
  tokens.set(collection, { token: j.token, expires: new Date(j["msft:expiry"]).getTime() });
  return j.token;
}

export async function signHref(collection: string, href: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const token = await sasToken(collection, fetchImpl);
  return `${href}${href.includes("?") ? "&" : "?"}${token}`;
}

export async function stacSearch(body: Record<string, unknown>, fetchImpl: typeof fetch = fetch): Promise<StacItem[]> {
  const res = await fetchImpl(STAC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`STAC search failed: ${res.status}`);
  return ((await res.json()) as { features: StacItem[] }).features;
}

/** EPSG code of an item, from `proj:epsg` or `proj:code` ("EPSG:32645"). */
export function epsgOf(p: Record<string, unknown>): number {
  return (p["proj:epsg"] as number | undefined) ?? Number(String(p["proj:code"] ?? "").replace("EPSG:", ""));
}

export function utmFor(epsg: number): string {
  const south = epsg >= 32701;
  const zone = epsg - (south ? 32700 : 32600);
  return `+proj=utm +zone=${zone} ${south ? "+south " : ""}+datum=WGS84 +units=m +no_defs`;
}

/** Lat/lng to the scene's CRS (UTM metres, or degrees for EPSG:4326). */
export function toSceneXY(epsg: number, lat: number, lng: number): [number, number] {
  if (epsg === 4326) return [lng, lat];
  const [x, y] = proj4("EPSG:4326", utmFor(epsg), [lng, lat]);
  return [x!, y!];
}

export interface PixelWindow {
  values: number[];
  width: number;
  height: number;
  /** Pixel size in the scene's units (metres for UTM, degrees for EPSG:4326). */
  resX: number;
  resY: number;
}

/** Read a small square window (radius pixels) around x,y. Values are row by row. */
export async function readWindow(href: string, x: number, y: number, radius: number): Promise<PixelWindow> {
  const tiff = await fromUrl(href, { allowFullFile: false });
  const image = await tiff.getImage();
  const [minX = 0, minY = 0, maxX = 0, maxY = 0] = image.getBoundingBox();
  const resX = (maxX - minX) / image.getWidth();
  const resY = (maxY - minY) / image.getHeight();
  const px = Math.floor((x - minX) / resX);
  const py = Math.floor((maxY - y) / resY);
  const x0 = Math.max(0, px - radius);
  const y0 = Math.max(0, py - radius);
  const x1 = Math.min(image.getWidth(), px + radius + 1);
  const y1 = Math.min(image.getHeight(), py + radius + 1);
  if (x1 <= x0 || y1 <= y0) return { values: [], width: 0, height: 0, resX, resY };
  const rasters = await image.readRasters({ window: [x0, y0, x1, y1], interleave: false });
  return { values: Array.from(rasters[0] as ArrayLike<number>), width: x1 - x0, height: y1 - y0, resX, resY };
}
