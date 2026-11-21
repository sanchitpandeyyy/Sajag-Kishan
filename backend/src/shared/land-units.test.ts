import { describe, expect, it } from "vitest";
import { fromSquareMetres, toAsciiDigits, toSquareMetres } from "./land-units";
import { citizenshipNoSchema, mobileSchema } from "./validation";

describe("land units", () => {
  it("converts compound Terai area", () => {
    expect(toSquareMetres({ bigha: 1, kattha: 5 })).toBeCloseTo(6772.63 + 5 * 338.63, 2);
  });
  it("round-trips hill units", () => {
    const m2 = toSquareMetres({ ropani: 3, aana: 4 });
    expect(fromSquareMetres(m2, "hill")).toEqual({ ropani: 3, aana: 4 });
  });
  it("rejects negative values", () => {
    expect(() => toSquareMetres({ kattha: -1 })).toThrow();
  });
  it("converts Devanagari digits", () => {
    expect(toAsciiDigits("९८४१२३४५६७")).toBe("9841234567");
  });
});

describe("validation", () => {
  it("accepts Nepali mobile numbers", () => {
    expect(mobileSchema.parse("९८४१२३४५६७")).toBe("9841234567");
    expect(() => mobileSchema.parse("9512345678")).toThrow();
  });
  it("normalizes citizenship slashes", () => {
    expect(citizenshipNoSchema.parse("27/01/123")).toBe("27-01-123");
  });
});
