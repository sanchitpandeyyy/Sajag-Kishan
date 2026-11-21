import { describe, expect, it } from "vitest";
import { ndviClass, normalizedDifference, reflectance, slopeAspect, spectralIndices, toDb } from "./indices";

describe("spectral indices", () => {
  it("computes NDVI for a green crop by hand", () => {
    // NIR 0.40, red 0.05: (0.40 - 0.05) / 0.45 = 0.778
    expect(normalizedDifference(0.4, 0.05)).toBe(0.778);
  });

  it("returns null for missing or zero-sum bands", () => {
    expect(normalizedDifference(null, 0.1)).toBeNull();
    expect(normalizedDifference(0, 0)).toBeNull();
  });

  it("applies the baseline 04.00 offset and treats DN 0 as nodata", () => {
    expect(reflectance(5000, 4)).toBe(0.4);
    expect(reflectance(4000, 3)).toBe(0.4);
    expect(reflectance(0, 4)).toBeNull();
    expect(reflectance(900, 4)).toBeNull();
  });

  it("computes all four indices for flooded paddy at transplanting", () => {
    // Water over the field: green above NIR, so NDWI > 0 and NDVI low.
    const i = spectralIndices({ green: 0.08, red: 0.06, redEdge: 0.07, nir: 0.05, nir8a: 0.05, swir: 0.02 });
    expect(i.ndwi).toBeGreaterThan(0);
    expect(i.ndvi).toBeLessThan(0);
    expect(i.ndmi).toBe(0.429);
  });

  it("places NDVI on the 0 to 0.9+ scale", () => {
    expect(ndviClass(-0.1).key).toBe("water");
    expect(ndviClass(0.1).key).toBe("bare");
    expect(ndviClass(0.35).key).toBe("sparse");
    expect(ndviClass(0.55).key).toBe("moderate");
    expect(ndviClass(0.7).key).toBe("dense");
    expect(ndviClass(0.8).key).toBe("very_dense");
    expect(ndviClass(0.92).key).toBe("peak");
  });
});

describe("radar and terrain", () => {
  it("converts linear backscatter to dB", () => {
    expect(toDb(0.01)).toBe(-20);
    expect(toDb(0.1)).toBe(-10);
    expect(toDb(0)).toBeNull();
  });

  it("finds a north-facing slope", () => {
    // Ground rises 10 m per 30 m cell towards the south: slope atan(1/3) = 18.4 deg, faces north.
    const z = [100, 100, 100, 110, 110, 110, 120, 120, 120];
    expect(slopeAspect(z, 30, 30)).toEqual({ slopeDeg: 18.4, aspectDeg: 0 });
  });

  it("finds a west-facing slope", () => {
    const z = [100, 110, 120, 100, 110, 120, 100, 110, 120];
    expect(slopeAspect(z, 30, 30)?.aspectDeg).toBe(270);
  });

  it("reports flat ground", () => {
    expect(slopeAspect([50, 50, 50, 50, 50, 50, 50, 50, 50], 30, 30)).toEqual({ slopeDeg: 0, aspectDeg: 0 });
  });
});
