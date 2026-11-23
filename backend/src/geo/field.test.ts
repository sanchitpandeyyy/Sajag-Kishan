import { describe, expect, it } from "vitest";
import { areaMismatch, asPolygon, distanceToFieldM, fieldCentroid, insideProjected, measuredAreaM2, polygonProblems } from "./field";
import { fieldFlags } from "../engine/land-transparency";
import { zonalIndices, type ZonalGrids } from "../satellite/sentinel2";
import type { PixelGrid } from "../satellite/pc";

// ~100 m × 100 m square near Chitwan (1° lat ≈ 110.6 km; 1° lng at 27.6° ≈ 98.7 km)
const dLat = 100 / 110_600;
const dLng = 100 / 98_700;
const square = { type: "Polygon", coordinates: [[[84.4, 27.6], [84.4 + dLng, 27.6], [84.4 + dLng, 27.6 + dLat], [84.4, 27.6 + dLat], [84.4, 27.6]]] };

// L-shape whose plain vertex average falls outside the field
const L = {
  type: "Polygon",
  coordinates: [[[0, 0], [3, 0], [3, 0.5], [0.5, 0.5], [0.5, 3], [0, 3], [0, 0]].map(([x, y]) => [84.4 + x! * dLng, 27.6 + y! * dLat])],
};

describe("field geometry", () => {
  it("measures area in square metres", () => {
    expect(measuredAreaM2(square)).toBeGreaterThan(9_800);
    expect(measuredAreaM2(square)).toBeLessThan(10_200);
    expect(measuredAreaM2({ type: "Point", coordinates: [84.4, 27.6] })).toBeNull();
  });

  it("closes an open ring and rejects junk", () => {
    const open = { type: "Polygon", coordinates: [square.coordinates[0]!.slice(0, -1).concat([[84.4, 27.6 + dLat / 2]])] };
    expect(asPolygon(open)!.coordinates[0]!.at(-1)).toEqual(asPolygon(open)!.coordinates[0]![0]);
    expect(asPolygon({ type: "Polygon", coordinates: [[[1, 2]]] })).toBeNull();
    expect(asPolygon(null)).toBeNull();
  });

  it("puts the centroid inside an L-shaped field", () => {
    const p = asPolygon(L)!;
    const c = fieldCentroid(p);
    expect(distanceToFieldM(p, c.lng, c.lat)).toBe(0);
  });

  it("finds self-intersecting and implausible shapes", () => {
    const bowtie = asPolygon({ type: "Polygon", coordinates: [[[84.4, 27.6], [84.401, 27.601], [84.401, 27.6], [84.4, 27.601], [84.4, 27.6]]] })!;
    expect(polygonProblems(bowtie)).toContain("self_intersecting");
    expect(polygonProblems(asPolygon(square)!)).toEqual([]);
  });

  it("measures distance from a GPS fix to the field", () => {
    const p = asPolygon(square)!;
    expect(distanceToFieldM(p, 84.4 + dLng / 2, 27.6 + dLat / 2)).toBe(0);
    const d = distanceToFieldM(p, 84.4 + dLng + 50 / 98_700, 27.6 + dLat / 2);
    expect(d).toBeGreaterThan(40);
    expect(d).toBeLessThan(60);
  });

  it("flags a mapped area that disagrees with the registered area", () => {
    expect(areaMismatch(10_000, 10_500)).toBe(false);
    expect(areaMismatch(10_000, 5_000)).toBe(true);
    expect(areaMismatch(10_000, null)).toBe(false);
    const base = { registeredM2: 10_000, declaredCultivated: true, declaredSownM2: 0, fertilizerKg: 0, status: "cultivated" as const, history: [] };
    expect(fieldFlags({ ...base, measuredM2: 20_000 })).toContain("area_mismatch");
    expect(fieldFlags(base)).not.toContain("area_mismatch");
  });

  it("does planar point-in-polygon on projected coordinates", () => {
    const ring: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
    expect(insideProjected(ring, 5, 5)).toBe(true);
    expect(insideProjected(ring, 15, 5)).toBe(false);
  });
});

describe("zonal satellite indices", () => {
  // 6×6 grid of 10 m pixels from x=0..60, y=60..0; 20 m bands as 3×3.
  const grid10 = (fn: (i: number, j: number) => number): PixelGrid => ({ values: Array.from({ length: 36 }, (_, k) => fn(k % 6, Math.floor(k / 6))), width: 6, height: 6, originX: 0, originY: 60, resX: 10, resY: 10 });
  const grid20 = (fn: (i: number, j: number) => number): PixelGrid => ({ values: Array.from({ length: 9 }, (_, k) => fn(k % 3, Math.floor(k / 3))), width: 3, height: 3, originX: 0, originY: 60, resX: 20, resY: 20 });
  // DN with baseline < 4 (no offset): reflectance = DN / 10000
  const crop: Omit<ZonalGrids, "scl"> = {
    red: grid10(() => 500),
    nir: grid10(() => 4500),
    blue: grid10(() => 400),
    green: grid10(() => 800),
    redEdge: grid20(() => 2000),
    nir8a: grid20(() => 4500),
    swir: grid20(() => 2500),
  };
  const field: [number, number][] = [[10, 10], [50, 10], [50, 50], [10, 50], [10, 10]]; // 4×4 pixels inside

  it("averages only pixels inside the field", () => {
    const z = zonalIndices(field, { ...crop, scl: grid20(() => 4) }, 2)!;
    expect(z.pixels).toBe(16);
    expect(z.clearPixels).toBe(16);
    expect(z.indices.ndvi).toBeCloseTo(0.8, 3); // (0.45-0.05)/(0.45+0.05)
  });

  it("drops cloudy pixels and treats a mostly cloudy field as no reading", () => {
    const halfCloud = zonalIndices(field, { ...crop, scl: grid20((i) => (i === 0 ? 9 : 4)) }, 2)!; // left 20 m column cloudy
    expect(halfCloud.clearPixels).toBeLessThan(halfCloud.pixels);
    expect(halfCloud.indices.ndvi).toBeCloseTo(0.8, 3);
    const cloudy = zonalIndices(field, { ...crop, scl: grid20(() => 9) }, 2)!;
    expect(cloudy.indices.ndvi).toBeNull();
  });

  it("returns null for a field smaller than one pixel so the caller falls back to a point read", () => {
    expect(zonalIndices([[11, 11], [13, 11], [13, 13], [11, 13], [11, 11]], { ...crop, scl: grid20(() => 4) }, 2)).toBeNull();
  });
});
