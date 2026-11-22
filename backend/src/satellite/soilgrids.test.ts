import { describe, expect, it } from "vitest";
import { parseSoilGrids } from "./soilgrids";

// Live response for 80.17, 28.995 (pilot area), from rest.isric.org.
const sample = {
  properties: {
    layers: [
      { name: "clay", unit_measure: { d_factor: 10, target_units: "%" }, depths: [{ label: "0-5cm", values: { mean: 231 } }] },
      { name: "nitrogen", unit_measure: { d_factor: 100, target_units: "g/kg" }, depths: [{ label: "0-5cm", values: { mean: 203 } }] },
      { name: "phh2o", unit_measure: { d_factor: 10, target_units: "-" }, depths: [{ label: "0-5cm", values: { mean: 65 } }] },
      { name: "soc", unit_measure: { d_factor: 10, target_units: "g/kg" }, depths: [{ label: "0-5cm", values: { mean: 339 } }] },
    ],
  },
};

describe("SoilGrids parser", () => {
  it("converts scaled integers to target units", () => {
    expect(parseSoilGrids(sample)).toMatchObject({ soilPh: 6.5, soilOrganicC: 33.9, soilNitrogen: 2.03, clayPct: 23.1, depth: "0-5cm" });
  });

  it("returns nulls for nodata", () => {
    const r = parseSoilGrids({ properties: { layers: [{ name: "phh2o", unit_measure: { d_factor: 10 }, depths: [{ label: "0-5cm", values: { mean: -32768 } }] }] } });
    expect(r.soilPh).toBeNull();
    expect(r.soilOrganicC).toBeNull();
  });
});
