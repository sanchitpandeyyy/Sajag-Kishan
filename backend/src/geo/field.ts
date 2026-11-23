import { area, booleanPointInPolygon, centerOfMass, kinks, point, pointOnFeature, pointToPolygonDistance, polygon as turfPolygon } from "@turf/turf";

export type Ring = [number, number][];
export interface PolygonGeom {
  type: "Polygon";
  coordinates: Ring[];
}
export interface PointGeom {
  type: "Point";
  coordinates: [number, number];
}

const isPair = (p: unknown): p is [number, number] => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]);

/** The stored field shape if it is a usable polygon (outer ring of 4+ points, closed), else null. */
export function asPolygon(geometry: unknown): PolygonGeom | null {
  const g = geometry as { type?: string; coordinates?: unknown } | null;
  if (!g || g.type !== "Polygon" || !Array.isArray(g.coordinates)) return null;
  const rings = (g.coordinates as unknown[]).filter((r): r is Ring => Array.isArray(r) && r.length >= 4 && r.every(isPair)).map((r) => r.map(([x, y]) => [x, y] as [number, number]));
  if (!rings.length) return null;
  const outer = rings[0]!;
  const [a, b] = [outer[0]!, outer.at(-1)!];
  if (a[0] !== b[0] || a[1] !== b[1]) outer.push([a[0], a[1]]);
  return { type: "Polygon", coordinates: rings };
}

const feature = (p: PolygonGeom) => turfPolygon(p.coordinates);

/** Ground area of the drawn shape in m² (geodesic). */
export function measuredAreaM2(geometry: unknown): number | null {
  const p = asPolygon(geometry);
  if (!p) return null;
  try {
    return Math.round(area(feature(p)));
  } catch {
    return null;
  }
}

/** A representative point that is always inside the field (centre of mass, or a point on the surface for L/U shapes). */
export function fieldCentroid(p: PolygonGeom): { lat: number; lng: number } {
  const f = feature(p);
  let c = centerOfMass(f).geometry.coordinates as [number, number];
  if (!booleanPointInPolygon(point(c), f)) c = pointOnFeature(f).geometry.coordinates as [number, number];
  return { lng: c[0], lat: c[1] };
}

export type PolygonProblem = "self_intersecting" | "too_small" | "too_large";
export const MIN_FIELD_M2 = 10;
export const MAX_FIELD_M2 = 1_000_000; // 100 ha

export function polygonProblems(p: PolygonGeom): PolygonProblem[] {
  const f = feature(p);
  const out: PolygonProblem[] = [];
  if (kinks(f).features.length > 0) out.push("self_intersecting");
  const a = area(f);
  if (a < MIN_FIELD_M2) out.push("too_small");
  if (a > MAX_FIELD_M2) out.push("too_large");
  return out;
}

/** Metres from the point to the field (0 when inside). */
export function distanceToFieldM(p: PolygonGeom, lng: number, lat: number): number {
  const f = feature(p);
  const pt = point([lng, lat]);
  if (booleanPointInPolygon(pt, f)) return 0;
  return Math.round(Math.abs(pointToPolygonDistance(pt, f, { units: "meters" })));
}

/** True when the mapped shape and the registered area disagree by more than ~30%. */
export function areaMismatch(registeredM2: number, measuredM2: number | null | undefined): boolean {
  if (!measuredM2 || !registeredM2) return false;
  const ratio = measuredM2 / registeredM2;
  return ratio < 0.7 || ratio > 1.3;
}

/** Planar point-in-polygon on projected (metre) coordinates; used to mask raster pixels to a field. */
export function insideProjected(ring: Ring, x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
