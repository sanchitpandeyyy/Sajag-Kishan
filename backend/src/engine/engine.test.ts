import { describe, expect, it } from "vitest";
import { rankCrops, trapezoid } from "./suitability";
import { evaluateLateBlight, evaluateWeatherAlerts } from "./weather-alerts";
import { adjustTempForElevation, zoneForElevation } from "./zoning";

describe("zoning", () => {
  it("classifies elevations", () => {
    expect(zoneForElevation(120)).toBe("TERAI");
    expect(zoneForElevation(1300)).toBe("MID_HILL");
    expect(zoneForElevation(3000)).toBe("MOUNTAIN");
  });
  it("applies the lapse rate", () => {
    expect(adjustTempForElevation(30, 100, 1100)).toBeCloseTo(23.5, 5);
  });
});

describe("suitability", () => {
  it("trapezoid edges", () => {
    expect(trapezoid(25, [15, 20, 32, 38])).toBe(1);
    expect(trapezoid(17.5, [15, 20, 32, 38])).toBeCloseTo(0.5);
    expect(trapezoid(40, [15, 20, 32, 38])).toBe(0);
  });
  it("ranks paddy first for a hot wet Terai monsoon", () => {
    const top = rankCrops({ seasonMeanTempC: 28, seasonRainMm: 1500, soilPh: 6.5 })[0];
    expect(top?.crop).toBe("paddy");
  });
  it("ranks wheat/mustard/lentil high in cool dry winter", () => {
    const ranked = rankCrops({ seasonMeanTempC: 16, seasonRainMm: 120, soilPh: 6.8, irrigated: true });
    expect(["wheat", "mustard", "lentil", "potato"]).toContain(ranked[0]?.crop);
    const paddy = ranked.find((r) => r.crop === "paddy");
    expect(paddy?.score).toBeLessThan(30);
    expect(paddy?.limitingFactor).toBe("temperature");
  });
});

describe("weather alerts", () => {
  const day = (date: string, p: number, tmin = 15, tmax = 28) => ({ date, precipitationMm: p, tempMinC: tmin, tempMaxC: tmax });

  it("flags heavy rain and flood risk", () => {
    const alerts = evaluateWeatherAlerts([day("2026-07-01", 60), day("2026-07-02", 110), day("2026-07-03", 20)]);
    expect(alerts.some((a) => a.type === "HEAVY_RAIN" && a.severity === "SEVERE")).toBe(true);
    expect(alerts.some((a) => a.type === "FLOOD_RISK")).toBe(true);
  });
  it("flags frost and dry spell", () => {
    const days = Array.from({ length: 10 }, (_, i) => day(`2026-01-${String(i + 1).padStart(2, "0")}`, 0, 1, 18));
    const types = new Set(evaluateWeatherAlerts(days).map((a) => a.type));
    expect(types.has("FROST")).toBe(true);
    expect(types.has("DRY_SPELL")).toBe(true);
  });
  it("detects late blight conditions over two humid days", () => {
    const hours = ["2026-08-10", "2026-08-11"].flatMap((d) =>
      Array.from({ length: 24 }, (_, h) => ({
        time: `${d}T${String(h).padStart(2, "0")}:00`,
        tempC: 14 + (h % 6),
        relativeHumidity: h < 12 ? 95 : 80,
      })),
    );
    expect(evaluateLateBlight(hours)).toHaveLength(1);
  });
});
