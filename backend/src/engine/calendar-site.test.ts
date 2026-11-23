import { describe, expect, it } from "vitest";
import { generateCalendar, satelliteAdvice, soilAdvice } from "./calendar";
import { seasonsSinceStart } from "../satellite/history";

const day = (d: string, mm = 0, min = 20, max = 30) => ({ date: d, precipitationMm: mm, tempMinC: min, tempMaxC: max });
const find = (ev: ReturnType<typeof generateCalendar>, task: string) => ev.find((e) => e.task === task)!;

describe("calendar with field data", () => {
  it("is unchanged when no field data is given", () => {
    const a = generateCalendar({ crop: "paddy", zone: "TERAI", sowingDate: "2026-07-01" });
    const b = generateCalendar({ crop: "paddy", zone: "TERAI", sowingDate: "2026-07-01", site: {} });
    expect(b).toEqual(a);
  });

  it("stretches the season on a field cooler than the template zone", () => {
    const base = generateCalendar({ crop: "paddy", zone: "MID_HILL", sowingDate: "2026-06-15" });
    const high = generateCalendar({ crop: "paddy", zone: "MID_HILL", sowingDate: "2026-06-15", site: { elevationM: 1900, seasonMeanTempC: 20 } });
    expect(find(high, "HARVEST").startsOn > find(base, "HARVEST").startsOn).toBe(true);
    expect(find(high, "HARVEST").reason.thermalStretch).toBeGreaterThan(1);
  });

  it("keeps timing when the field sits at the template's elevation", () => {
    const ev = generateCalendar({ crop: "paddy", zone: "TERAI", sowingDate: "2026-07-01", site: { elevationM: 150, seasonMeanTempC: 29 } });
    expect(find(ev, "HARVEST").reason.thermalStretch).toBeUndefined();
  });

  it("postpones paddy transplanting on a cold morning but not wheat sowing", () => {
    const fc = [day("2026-07-01", 0, 3), day("2026-07-02", 0, 12)];
    const paddy = generateCalendar({ crop: "paddy", zone: "TERAI", sowingDate: "2026-07-01", forecast: fc });
    expect(find(paddy, "TRANSPLANTING").startsOn).toBe("2026-07-02");
    expect(find(paddy, "TRANSPLANTING").reason.postponedForColdDays).toBe(1);
    const wheat = generateCalendar({ crop: "wheat", zone: "TERAI", sowingDate: "2026-07-01", forecast: fc });
    expect(find(wheat, "SOWING").startsOn).toBe("2026-07-01");
  });

  it("still postpones for heavy rain exactly as before", () => {
    const ev = generateCalendar({ crop: "paddy", zone: "TERAI", sowingDate: "2026-07-01", forecast: [day("2026-07-01", 45), day("2026-07-02", 40)] });
    expect(find(ev, "TRANSPLANTING").startsOn).toBe("2026-07-03");
    expect(find(ev, "TRANSPLANTING").reason.postponedForRainDays).toBe(2);
  });

  it("tells the farmer to skip irrigation when rain is coming", () => {
    const ev = generateCalendar({ crop: "wheat", zone: "TERAI", sowingDate: "2026-11-10", forecast: [day("2026-12-01", 10), day("2026-12-02", 8)] });
    expect(find(ev, "IRRIGATION").noteNe).toMatch(/सिँचाइ नगर्नुहोस्/);
  });

  it("adds soil and slope advice to the right stages", () => {
    const notes = soilAdvice("wheat", { soilPh: 5.0, soilPhEstimated: true, soilOrganicC: 6, clayPct: 45, slopeDeg: 18 });
    const keys = notes.map((n) => `${n.task}:${n.key}`);
    expect(keys).toEqual(expect.arrayContaining(["LAND_PREP:soilPhLow", "LAND_PREP:lowOrganicC", "SOWING:heavyClay", "LAND_PREP:steepSlope", "FERTILIZING:slopeFertilizer"]));
    expect(notes.find((n) => n.key === "soilPhLow")!.ne).toMatch(/अनुमानित/);
    expect(soilAdvice("paddy", { clayPct: 45 })).toEqual([]);
    expect(soilAdvice("wheat", { soilPh: 6.5, soilOrganicC: 20, clayPct: 25, slopeDeg: 3 })).toEqual([]);
  });

  it("reads the field's greenness for a sown crop", () => {
    const sow = new Date("2026-07-01T00:00:00Z");
    expect(satelliteAdvice({ today: "2026-08-20", ndvi: [{ date: "2026-08-15", ndvi: 0.22 }] }, sow, 105)?.key).toBe("ndviWeak");
    expect(satelliteAdvice({ today: "2026-08-20", ndvi: [{ date: "2026-08-01", ndvi: 0.7 }, { date: "2026-08-15", ndvi: 0.5 }] }, sow, 105)?.key).toBe("ndviDrop");
    expect(satelliteAdvice({ today: "2026-10-05", ndvi: [{ date: "2026-09-01", ndvi: 0.8 }, { date: "2026-10-01", ndvi: 0.45 }] }, sow, 105)?.key).toBe("ndviRipening");
    expect(satelliteAdvice({ today: "2026-08-20", ndvi: [{ date: "2026-08-15", ndvi: 0.65 }] }, sow, 105)).toBeNull();
    expect(satelliteAdvice({ today: "2026-08-20", ndvi: [{ date: "2026-07-10", ndvi: 0.1 }] }, sow, 105)).toBeNull(); // stale reading
  });

  it("attaches the satellite note to the calendar only when a sowing date is known", () => {
    const site = { today: "2026-08-20", ndvi: [{ date: "2026-08-15", ndvi: 0.2 }] };
    expect(find(generateCalendar({ crop: "paddy", zone: "TERAI", sowingDate: "2026-07-01", site }), "PEST_SCOUTING").reason.ndviWeak).toBe(0.2);
    expect(find(generateCalendar({ crop: "paddy", zone: "TERAI", year: 2026, site }), "PEST_SCOUTING").reason.ndviWeak).toBeUndefined();
  });
});

describe("satellite history range", () => {
  it("reaches back to 2019", () => {
    expect(seasonsSinceStart(new Date("2026-11-23T00:00:00Z"))).toBeGreaterThanOrEqual(23);
  });
});
