import { describe, expect, it } from "vitest";
import { generateCalendar } from "./calendar";
import { estimateProductionKg, summarizeLand } from "./land-accounting";
import { allocate, farmerNeedKg, type FarmerNeedInput } from "./subsidy";

describe("calendar", () => {
  it("builds a Terai paddy calendar from the template", () => {
    const ev = generateCalendar({ crop: "paddy", zone: "TERAI", year: 2026 });
    expect(ev.find((e) => e.task === "TRANSPLANTING")?.startsOn).toBe("2026-06-25");
    expect(ev.find((e) => e.task === "NURSERY")?.startsOn).toBe("2026-05-31");
    expect(ev.at(-1)?.task).toBe("STORAGE");
  });
  it("stretches later stages at a cooler site", () => {
    const base = generateCalendar({ crop: "paddy", zone: "TERAI", sowingDate: "2026-07-01" });
    const cool = generateCalendar({ crop: "paddy", zone: "TERAI", sowingDate: "2026-07-01", referenceMeanTempC: 28, parcelMeanTempC: 22 });
    const h = (x: typeof base) => x.find((e) => e.task === "HARVEST")!.startsOn;
    expect(h(cool) > h(base)).toBe(true);
  });
  it("postpones transplanting on heavy-rain days", () => {
    const ev = generateCalendar({
      crop: "paddy",
      zone: "TERAI",
      sowingDate: "2026-07-01",
      forecast: [
        { date: "2026-07-01", precipitationMm: 60, tempMaxC: 30, tempMinC: 24 },
        { date: "2026-07-02", precipitationMm: 40, tempMaxC: 30, tempMinC: 24 },
      ],
    });
    const t = ev.find((e) => e.task === "TRANSPLANTING")!;
    expect(t.startsOn).toBe("2026-07-03");
    expect(t.reason.postponedForRainDays).toBe(2);
  });
  it("falls back to the nearest zone template", () => {
    expect(generateCalendar({ crop: "wheat", zone: "LOWER_HILL", year: 2026 }).length).toBeGreaterThan(0);
  });
});

describe("land accounting", () => {
  it("splits cultivated, fallow and no-data land", () => {
    const s = summarizeLand([
      { id: "a", wardId: 1, areaM2: 1000, verified: true, fertilized: true, declaredCrops: [{ crop: "paddy", sownAreaM2: 900 }], satelliteGreen: false },
      { id: "b", wardId: 1, areaM2: 500, verified: false, fertilized: false, declaredCrops: [{ crop: "x", sownAreaM2: 0, isFallow: true }] },
      { id: "c", wardId: 1, areaM2: 300, verified: false, fertilized: false, declaredCrops: [] },
    ]);
    expect(s.registeredM2).toBe(1800);
    expect(s.cultivatedM2).toBe(900);
    expect(s.declaredFallowM2).toBe(500);
    expect(s.noDataM2).toBe(300);
    expect(s.conflictParcels).toEqual(["a"]);
    expect(s.byCrop[0]).toEqual({ crop: "paddy", areaM2: 900, parcels: 1 });
  });
  it("estimates production with a clamped season factor", () => {
    expect(estimateProductionKg(10_000, 3500)).toBe(3500);
    expect(estimateProductionKg(10_000, 3500, -1)).toBe(2100);
  });
});

describe("subsidy", () => {
  const f = (id: string, areaM2: number, extra: Partial<FarmerNeedInput> = {}): FarmerNeedInput => ({
    farmerId: id,
    registeredAreaM2: areaM2,
    crops: [{ crop: "paddy", areaM2 }],
    alreadyDeliveredKg: 0,
    tenant: false,
    verified: true,
    recentSubsidyKg: 0,
    ...extra,
  });

  it("computes urea need from area and dose", () => {
    expect(farmerNeedKg(f("a", 10_000), "Urea")).toBe(180);
  });
  it("gives full need when stock is enough", () => {
    const lines = allocate([f("a", 10_000), f("b", 5_000)], "Urea", 1000);
    expect(lines.map((l) => l.allocatedKg)).toEqual([180, 90]);
  });
  it("never exceeds stock or individual need under scarcity, favours smallholders", () => {
    const lines = allocate([f("big", 20_000), f("small", 3_000, { tenant: true })], "Urea", 200);
    const total = lines.reduce((s, l) => s + l.allocatedKg, 0);
    expect(total).toBeLessThanOrEqual(200);
    lines.forEach((l) => expect(l.allocatedKg).toBeLessThanOrEqual(l.needKg));
    const small = lines.find((l) => l.farmerId === "small")!;
    expect(small.allocatedKg / small.needKg).toBeGreaterThan(lines[0]!.allocatedKg / lines[0]!.needKg);
  });
  it("blocks farmers with no declared cultivation", () => {
    const [line] = allocate([f("a", 5_000, { crops: [] })], "Urea", 500);
    expect(line?.allocatedKg).toBe(0);
    expect(line?.flags).toContain("NO_CULTIVATION_DECLARED");
  });
});
