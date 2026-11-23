import { describe, expect, it } from "vitest";
import { localAnswer, localSummary } from "./officer";
import { alertTypesMentioned, detectOfficerTopics, periodFor, type OfficerFacts } from "./officer-facts";

const base: OfficerFacts = {
  scope: { wards: 9, places: ["भरतपुर"] },
  period: { ne: "यो महिना", en: "this month", from: "2026-11-01", to: "2026-11-22" },
  topics: ["alerts"],
  filters: { alertTypes: ["LATE_BLIGHT"], crops: [] },
};

describe("officer question parsing", () => {
  it("finds topics", () => {
    expect(detectOfficerTopics("which wards had blight alerts this month")).toEqual(["alerts"]);
    expect(detectOfficerTopics("कति जग्गा बाँझो छ?")).toEqual(["land"]);
    expect(detectOfficerTopics("मल अनुदान कति वितरण भयो?")).toContain("subsidy");
    expect(detectOfficerTopics("कति कित्ता प्रमाणित हुन बाँकी छ?")).toContain("farmers");
    expect(detectOfficerTopics("hello")).toEqual([]);
  });
  it("finds alert types, telling bacterial leaf blight from late blight", () => {
    expect(alertTypesMentioned("डढुवाको चेतावनी")).toEqual(["LATE_BLIGHT"]);
    expect(alertTypesMentioned("पात डढुवा")).toEqual(["BACTERIAL_LEAF_BLIGHT"]);
    expect(alertTypesMentioned("frost or heavy rain")).toEqual(expect.arrayContaining(["FROST", "HEAVY_RAIN"]));
  });
  it("reads the time period", () => {
    const now = new Date("2026-11-22T10:00:00Z");
    expect(periodFor("this month", now).from.toISOString().slice(0, 10)).toBe("2026-11-01");
    expect(periodFor("गत महिना", now).from.toISOString().slice(0, 10)).toBe("2026-10-01");
    expect(periodFor("यो हप्ता", now).from.toISOString().slice(0, 10)).toBe("2026-11-16");
    expect(periodFor("anything", now).en).toBe("the last 30 days");
  });
});

describe("officer answers without an AI key", () => {
  it("lists wards with blight alerts", () => {
    const f: OfficerFacts = {
      ...base,
      alerts: {
        total: 5,
        severe: 2,
        byType: [{ type: "LATE_BLIGHT", count: 5 }],
        byWard: [
          { ward: "वडा 3", type: "LATE_BLIGHT", count: 4 },
          { ward: "वडा 7", type: "LATE_BLIGHT", count: 1 },
        ],
        reach: { farmers: 40, pushed: 30, read: 12 },
      },
    };
    const a = localAnswer(f);
    expect(a.ne).toContain("वडा 3 डढुवा 4");
    expect(a.en).toContain("ward 3 late blight 4");
    expect(a.en).toContain("12 read");
  });
  it("says so when there were no alerts", () => {
    const a = localAnswer({ ...base, alerts: { total: 0, severe: 0, byType: [], byWard: [], reach: { farmers: 0, pushed: 0, read: 0 } } });
    expect(a.en).toBe("No alerts were issued this month.");
  });
  it("builds a dashboard summary with findings and next steps", () => {
    const s = localSummary({
      ...base,
      topics: ["alerts", "farmers", "subsidy", "land"],
      alerts: { total: 6, severe: 1, byType: [{ type: "LATE_BLIGHT", count: 6 }], byWard: [{ ward: "वडा 3", type: "LATE_BLIGHT", count: 6 }], reach: { farmers: 40, pushed: 35, read: 5 } },
      farmers: { total: 300, byWard: [], parcelsVerified: 100, parcelsUnverified: 80, parcelsDisputed: 2 },
      subsidy: { byStatus: [], schemes: [{ scheme: "युरिया", unit: "kg", allocated: 1000, delivered: 400, farmers: 50 }] },
      land: { parcels: 400, areaHa: 120, fallowHa: 14, byWard: [] },
    });
    expect(s.headline.en).toContain("late blight");
    expect(s.points.map((p) => p.en).join(" ")).toContain("80 parcels are still unverified");
    expect(s.actions.length).toBeGreaterThanOrEqual(2);
    expect(s.actions.length).toBeLessThanOrEqual(3);
  });
});
