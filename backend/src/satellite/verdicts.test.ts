import { describe, expect, it } from "vitest";
import { radarVerdict } from "./sentinel1";
import { greennessVerdict } from "./sentinel2";
import { combinedFallow } from "./sync";

const d = (i: number) => `2026-07-${String(i + 1).padStart(2, "0")}`;

describe("radar verdict", () => {
  it("sees the flooded-then-growing paddy signature", () => {
    const vh = [-23, -21, -18, -16, -14];
    const v = radarVerdict(vh.map((x, i) => ({ date: d(i), vvDb: -10 + i * 0.5, vhDb: x })));
    expect(v.vhRangeDb).toBe(9);
    expect(v.cropCycleSeen).toBe(true);
    expect(v.paddySignature).toBe(true);
    expect(v.moistureIndex).toBe(1);
  });

  it("keeps a flat fallow field flat", () => {
    const v = radarVerdict([-17, -17.5, -16.8, -17.2].map((x, i) => ({ date: d(i), vvDb: -11, vhDb: x })));
    expect(v.cropCycleSeen).toBe(false);
    expect(v.paddySignature).toBe(false);
    expect(v.moistureIndex).toBeNull();
  });

  it("refuses to judge with too few readings", () => {
    expect(radarVerdict([{ date: d(0), vvDb: -10, vhDb: -15 }]).cropCycleSeen).toBeNull();
  });
});

describe("greenness verdict", () => {
  it("reports dNDVI and the season amplitude", () => {
    const v = greennessVerdict([0.2, 0.45, 0.8, 0.6].map((ndvi, i) => ({ date: d(i), ndvi })));
    expect(v.peakNdvi).toBe(0.8);
    expect(v.dNdvi).toBe(-0.2);
    expect(v.seasonAmplitude).toBe(0.6);
    expect(v.likelyFallow).toBe(false);
    expect(v.latestClass?.key).toBe("dense");
  });
});

describe("combined fallow", () => {
  it("lets radar overrule a cloud-hidden crop", () => expect(combinedFallow(true, true)).toBe(false));
  it("trusts optical when radar is silent", () => expect(combinedFallow(true, null)).toBe(true));
  it("uses radar alone when optical has no readings", () => expect(combinedFallow(null, false)).toBe(true));
  it("stays unknown with no data", () => expect(combinedFallow(null, null)).toBeNull());
});
