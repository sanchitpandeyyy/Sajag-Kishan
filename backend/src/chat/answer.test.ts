import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { answer, detectIntent } from "./answer";
import { compactJson, factsFor, type FarmerChatContext } from "./context";
import { areaNe, landSystemFor, plantOptions, summarizeAlerts, unitSystemAsked, type AlertFact } from "./facts";
import { retrieve } from "./knowledge";

beforeAll(() => {
  for (const k of ["GEMINI_API_KEY", "ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN"]) vi.stubEnv(k, "");
});
afterAll(() => vi.unstubAllEnvs());

const today = new Date().toISOString().slice(0, 10);
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

const frost: AlertFact = {
  type: "COLD_WAVE",
  titleNe: "शीतलहरको चेतावनी",
  messageNe: "राति तापक्रम ५ डिग्रीभन्दा तल जान सक्छ।",
  severity: "SEVERE",
  crops: ["wheat"],
  validFrom: today,
  validTo: inDays(2),
  active: true,
  seen: false,
};

function makeCtx(over: Partial<FarmerChatContext> = {}): FarmerChatContext {
  const base: FarmerChatContext = {
    name: "राम थापा",
    wardNumber: 5,
    place: "भरतपुर, चितवन",
    zone: "TERAI",
    zoneNe: "तराई",
    land: {
      system: "terai",
      totalM2: 10159,
      totalNe: areaNe(10159, "terai"),
      totalEn: "1 bigha 10 kattha",
      cultivatedM2: 3386,
      fallowM2: 0,
      parcels: [
        { name: "घर अगाडिको खेत", areaM2: 3386, areaNe: areaNe(3386, "terai"), irrigation: "CANAL", ownership: "OWNED", elevationM: 180, slopeDeg: 1, soilPh: 6.5, landCover: "cropland", cropNow: "गहुँ", fallow: false },
        { name: "खोला छेउ", areaM2: 6773, areaNe: areaNe(6773, "terai"), irrigation: "RAINFED", ownership: "OWNED", elevationM: 182, slopeDeg: 2, soilPh: 6.5, landCover: "cropland", cropNow: null, fallow: false },
      ],
    },
    crops: [{ code: "wheat", nameNe: "गहुँ", nameEn: "Wheat", areaM2: 3386, areaNe: areaNe(3386, "terai"), sowingDate: null }],
    nextTasks: [{ crop: "गहुँ", titleNe: "बीउ छर्ने", task: "SOWING", startsOn: today, endsOn: inDays(10), done: false, overdue: false }],
    forecast: [
      { date: today, rainMm: 0, tMax: 26, tMin: 12 },
      { date: inDays(1), rainMm: 14, tMax: 22, tMin: 13 },
    ],
    alerts: [],
    alertSummary: { active: 0, severe: 0, forMyCrops: [], recentTypes: [] },
    advisories: [],
    risks: [],
    inputsApplied: [],
    subsidy: [{ scheme: "युरिया अनुदान", unit: "kg", allocated: 25, delivered: null, status: "PLANNED" }],
    plantOptions: [
      { crop: "potato", nameNe: "आलु", nameEn: "Potato", season: "HIUDE", windowStart: inDays(-5), windowEnd: inDays(20), status: "open", soilFit: "good", alreadyGrowing: false },
      { crop: "wheat", nameNe: "गहुँ", nameEn: "Wheat", season: "HIUDE", windowStart: inDays(-2), windowEnd: inDays(23), status: "open", soilFit: "good", alreadyGrowing: true },
    ],
  };
  return { ...base, ...over };
}

describe("chat intents", () => {
  it("detects intents in Nepali", () => {
    expect(detectIntent("भोलि पानी पर्छ?")).toBe("weather");
    expect(detectIntent("आज खेतमा के काम गर्ने?")).toBe("task");
    expect(detectIntent("मेरो खेतमा युरिया कति हाल्ने?")).toBe("fertilizer");
    expect(detectIntent("आलुमा डढुवा रोग लाग्यो")).toBe("disease");
    expect(detectIntent("मल अनुदान कहिले पाइन्छ?")).toBe("subsidy");
    expect(detectIntent("मेरो कति बिघा जग्गा छ?")).toBe("land");
    expect(detectIntent("मेरो जग्गा कति रोपनी छ")).toBe("land");
    expect(detectIntent("अहिले के लगाउने?")).toBe("plant");
    expect(detectIntent("कुन बाली रोप्दा राम्रो?")).toBe("plant");
  });
  it("retrieves the right passage", () => {
    expect(retrieve("आलुमा डढुवा रोग")[0]?.doc.id).toBe("disease.LATE_BLIGHT.potato");
    expect(retrieve("तोरीमा लाही कीरा")[0]?.doc.id).toContain("MUSTARD_APHID");
  });
});

describe("land units", () => {
  it("picks the farmer's land system", () => {
    expect(landSystemFor("MID_HILL", [{ bigha: 1 }])).toBe("terai");
    expect(landSystemFor("TERAI", [{ ropani: 4 }])).toBe("hill");
    expect(landSystemFor("MID_HILL", [null])).toBe("hill");
    expect(landSystemFor(null, [])).toBe("terai");
  });
  it("speaks area the way farmers say it", () => {
    expect(areaNe(3386.3, "terai")).toBe("१० कट्ठा");
    expect(areaNe(10159, "terai")).toBe("१ बिघा १० कट्ठा");
    expect(areaNe(6773 + 50, "terai")).toBe("१ बिघा ३ धुर");
    expect(areaNe(2034.9, "hill")).toBe("४ रोपनी");
    expect(areaNe(508.72 * 2.5, "hill")).toBe("२ रोपनी ८ आना");
  });
  it("uses the unit named in the question", () => {
    expect(unitSystemAsked("कति रोपनी छ?")).toBe("hill");
    expect(unitSystemAsked("how many bigha")).toBe("terai");
    expect(unitSystemAsked("मेरो जग्गा कति छ")).toBeNull();
  });
});

describe("chat answers from the farmer's own data (local mode)", () => {
  it("weather, fertilizer and subsidy", async () => {
    const ctx = makeCtx();
    const w = await answer("भोलि पानी पर्छ?", [], ctx);
    expect(w.mode).toBe("local");
    expect(w.answerNe).toContain("भोलि");
    const f = await answer("मेरो खेतमा युरिया कति हाल्ने?", [], ctx);
    expect(f.answerNe).toContain("कट्ठा");
    const s = await answer("मल अनुदान कहिले पाइन्छ?", [], ctx);
    expect(s.answerNe).toContain("युरिया अनुदान");
  });

  it("answers land size in bigha, or in ropani when asked", async () => {
    const ctx = makeCtx();
    const a = await answer("मेरो कति बिघा जग्गा छ?", [], ctx);
    expect(a.intent).toBe("land");
    expect(a.answerNe).toContain("बिघा");
    expect(a.answerNe).toContain("खोला छेउ");
    const r = await answer("मेरो जग्गा कति रोपनी छ?", [], ctx);
    expect(r.answerNe).toContain("रोपनी");
  });

  it("suggests what to plant from open sowing windows, skipping crops already grown", async () => {
    const a = await answer("अहिले के लगाउने?", [], makeCtx());
    expect(a.intent).toBe("plant");
    expect(a.answerNe).toContain("आलु");
    expect(a.answerNe).not.toMatch(/उपयुक्त बाली:[^।]*गहुँ/);
    expect(a.answerNe).toContain("खाली");
  });

  it("warns about active alerts in the area before field work", async () => {
    const ctx = makeCtx({ alerts: [frost], alertSummary: summarizeAlerts([frost], ["wheat"]) });
    const t = await answer("आज खेतमा के काम गर्ने?", [], ctx);
    expect(t.answerNe).toContain("शीतलहर");
    const p = await answer("अहिले के लगाउने?", [], ctx);
    expect(p.answerNe).toContain("शीतलहर");
  });

  it("subtracts fertilizer already applied", async () => {
    const ctx = makeCtx({ inputsApplied: [{ crop: "गहुँ", product: "DAP", kg: 10, appliedAt: today }] });
    const f = await answer("गहुँमा युरिया कति हाल्ने?", [], ctx);
    expect(f.answerNe).toContain("घटाएर");
  });

  it("gives different answers to different farmers", async () => {
    const small = makeCtx({ land: { ...makeCtx().land, totalM2: 677, parcels: [makeCtx().land.parcels[0]!] } });
    const a = await answer("मेरो कति बिघा जग्गा छ?", [], makeCtx());
    const b = await answer("मेरो कति बिघा जग्गा छ?", [], small);
    expect(a.answerNe).not.toBe(b.answerNe);
  });

  it("gives an officer (no farm facts) no farm data", async () => {
    const a = await answer("मेरो कति बिघा जग्गा छ?", [], null);
    expect(a.answerNe).toContain("दर्ता भएको छैन");
  });
});

describe("token budget", () => {
  it("sends only the sections an intent needs", () => {
    const ctx = makeCtx({ alerts: [frost], alertSummary: summarizeAlerts([frost], ["wheat"]) });
    const weather = factsFor("weather", ctx);
    expect(Object.keys(weather)).not.toContain("land");
    expect(Object.keys(weather)).toContain("alerts");
    expect(Object.keys(factsFor("land", ctx))).not.toContain("forecast");
    expect(compactJson(factsFor("land", ctx)).length).toBeLessThan(compactJson(ctx).length);
    expect(compactJson({ a: null, b: [], c: 1 })).toBe('{"c":1}');
  });
});

describe("plant options", () => {
  it("lists crops whose sowing window is open or coming soon", () => {
    const opts = plantOptions("TERAI", "2026-11-15", { soilPh: 6.5, growing: ["wheat"] });
    const wheat = opts.find((o) => o.crop === "wheat");
    expect(wheat?.status).toBe("open");
    expect(wheat?.alreadyGrowing).toBe(true);
    expect(opts.every((o) => o.status === "open" || o.status === "soon")).toBe(true);
    expect(plantOptions(null, "2026-11-15")).toEqual([]);
  });
  it("summarises alerts for the farmer's crops", () => {
    const s = summarizeAlerts([frost, { ...frost, titleNe: "पुरानो", active: false }], ["wheat"]);
    expect(s).toMatchObject({ active: 1, severe: 1, forMyCrops: ["शीतलहरको चेतावनी"] });
  });
});
