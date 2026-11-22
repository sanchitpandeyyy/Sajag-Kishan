import { describe, expect, it } from "vitest";
import { fieldFlags, fiscalYearOf, latestJudgeableIndex, median, productivityClass, seasonJudgeable, seasonStatus, seasonWindows } from "./land-transparency";

describe("season windows", () => {
  it("lists the current season and the ones before, oldest first", () => {
    const w = seasonWindows(new Date("2026-11-21T00:00:00Z"), 4);
    expect(w.map((x) => x.key)).toEqual(["2082/83-HIUDE", "2082/83-CHAITE", "2083/84-BARSHE", "2083/84-HIUDE"]);
    expect(w.at(-1)!.from.toISOString().slice(0, 10)).toBe("2026-11-01");
    expect(w.at(-1)!.to.toISOString().slice(0, 10)).toBe("2027-02-28");
    expect(w[2]!.labelEn).toBe("Monsoon 2083/84");
    expect(w[2]!.labelNe).toBe("बर्खे २०८३/८४");
  });

  it("puts January in the winter season that started the year before", () => {
    const w = seasonWindows(new Date("2027-01-10T00:00:00Z"), 1);
    expect(w[0]!.key).toBe("2083/84-HIUDE");
  });

  it("uses the 16 July fiscal year boundary", () => {
    expect(fiscalYearOf(new Date("2026-07-15T00:00:00Z"))).toBe("2082/83");
    expect(fiscalYearOf(new Date("2026-07-16T00:00:00Z"))).toBe("2083/84");
  });
});

describe("judgeable season", () => {
  it("waits 75 days before judging a season", () => {
    const now = new Date("2026-11-22T00:00:00Z");
    const w = seasonWindows(now, 3);
    expect(seasonJudgeable(w[2]!, now)).toBe(false);
    expect(latestJudgeableIndex(w, now)).toBe(1);
    expect(w[1]!.key).toBe("2083/84-BARSHE");
  });
});

describe("season status", () => {
  it("calls a clear peak cultivated", () => expect(seasonStatus([0.2, 0.83, 0.6]).status).toBe("cultivated"));
  it("calls some green weak", () => expect(seasonStatus([0.2, 0.42]).status).toBe("weak"));
  it("needs two clear readings to call fallow", () => {
    expect(seasonStatus([0.2]).status).toBe("unknown");
    expect(seasonStatus([0.2, 0.25, null]).status).toBe("fallow");
  });
  it("is unknown with no clear reading", () => expect(seasonStatus([null, null]).status).toBe("unknown"));
});

describe("field flags", () => {
  const base = { registeredM2: 10_000, declaredCultivated: true, declaredSownM2: 9_000, fertilizerKg: 0, status: "cultivated" as const, history: [] };

  it("is quiet when declaration and satellite agree", () => expect(fieldFlags(base)).toEqual([]));

  it("flags fertilizer given to a field the satellite saw fallow, first", () => {
    expect(fieldFlags({ ...base, status: "fallow", fertilizerKg: 100 })).toEqual(["subsidy_on_fallow", "declared_not_seen"]);
  });

  it("flags farmed land with no declaration", () => expect(fieldFlags({ ...base, declaredCultivated: null })).toEqual(["farmed_not_declared"]));

  it("flags land fallow for three known seasons as abandoned", () => {
    expect(fieldFlags({ ...base, declaredCultivated: null, status: "fallow", history: ["fallow", "unknown", "fallow"] })).toEqual(["abandoned"]);
  });

  it("flags declared sown area above the registered area", () => {
    expect(fieldFlags({ ...base, declaredSownM2: 12_000 })).toEqual(["area_overclaim"]);
  });
});

describe("productivity", () => {
  it("compares a field with the municipality median", () => {
    expect(median([0.5, 0.7, 0.6])).toBe(0.6);
    expect(productivityClass([0.8, 0.7], 0.6)).toEqual({ cls: "high", ratio: 1.25 });
    expect(productivityClass([0.45, 0.45], 0.6).cls).toBe("low");
    expect(productivityClass([0.6, 0.62], 0.6).cls).toBe("normal");
    expect(productivityClass([0.9], 0.6).cls).toBe("unknown");
  });
});
