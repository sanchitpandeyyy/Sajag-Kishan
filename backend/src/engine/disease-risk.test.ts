import { describe, expect, it } from "vitest";
import { assessDiseaseRisk } from "./disease-risk";

const hours = (day: string, tempC: (h: number) => number, rh: (h: number) => number) =>
  Array.from({ length: 24 }, (_, h) => ({ time: `${day}T${String(h).padStart(2, "0")}:00`, tempC: tempC(h), relativeHumidity: rh(h) }));
const day = (date: string, precipitationMm = 0) => ({ date, precipitationMm, tempMaxC: 20, tempMinC: 10 });

describe("disease risk", () => {
  it("flags late blight for potato after cool, very humid days", () => {
    const hourly = ["2026-12-01", "2026-12-02", "2026-12-03"].flatMap((d) => hours(d, (h) => 11 + (h % 5), (h) => (h < 14 ? 95 : 80)));
    const r = assessDiseaseRisk({ crop: "potato", hourly, daily: ["2026-12-01", "2026-12-02", "2026-12-03"].map((d) => day(d)) });
    expect(r[0]?.code).toBe("LATE_BLIGHT");
    expect(r[0]?.prevent.length).toBeGreaterThan(0);
    expect(r[0]?.why.ne.length).toBeGreaterThan(0);
  });

  it("ignores crops the rule does not cover", () => {
    const hourly = hours("2026-12-01", () => 12, () => 95);
    expect(assessDiseaseRisk({ crop: "lentil", hourly, daily: [day("2026-12-01")] })).toEqual([]);
  });

  it("raises the score when the ward had the same problem before", () => {
    const hourly = ["2026-08-01", "2026-08-02"].flatMap((d) => hours(d, () => 23, () => 95));
    const daily = ["2026-08-01", "2026-08-02"].map((d) => day(d));
    const fresh = assessDiseaseRisk({ crop: "paddy", stage: "FERTILIZING", hourly, daily }).find((x) => x.code === "RICE_BLAST")!;
    const repeat = assessDiseaseRisk({ crop: "paddy", stage: "FERTILIZING", hourly, daily, pastAlertsInWard: 3 }).find((x) => x.code === "RICE_BLAST")!;
    expect(repeat.score).toBeGreaterThan(fresh.score);
  });
});
