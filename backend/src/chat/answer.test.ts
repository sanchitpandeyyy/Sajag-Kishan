import { describe, expect, it } from "vitest";
import { answer, detectIntent } from "./answer";
import type { FarmerChatContext } from "./context";
import { retrieve } from "./knowledge";

const ctx: FarmerChatContext = {
  name: "राम थापा", wardNumber: 5, totalAreaM2: 3386, zone: "TERAI",
  crops: [{ code: "wheat", nameNe: "गहुँ", nameEn: "Wheat", areaM2: 3386, sowingDate: null }],
  nextTasks: [{ crop: "गहुँ", titleNe: "बीउ छर्ने", task: "SOWING", startsOn: "2026-11-10", endsOn: "2026-11-25" }],
  forecast: [{ date: "2026-11-21", rainMm: 0, tMax: 26, tMin: 12 }, { date: "2026-11-22", rainMm: 14, tMax: 22, tMin: 13 }],
  alerts: [], risks: [], subsidy: [{ scheme: "युरिया अनुदान", unit: "kg", allocated: 25, delivered: null, status: "PLANNED" }],
};

describe("chat (local mode)", () => {
  it("detects intents in Nepali", () => {
    expect(detectIntent("भोलि पानी पर्छ?")).toBe("weather");
    expect(detectIntent("आज खेतमा के काम गर्ने?")).toBe("task");
    expect(detectIntent("मेरो खेतमा युरिया कति हाल्ने?")).toBe("fertilizer");
    expect(detectIntent("आलुमा डढुवा रोग लाग्यो")).toBe("disease");
    expect(detectIntent("मल अनुदान कहिले पाइन्छ?")).toBe("subsidy");
  });
  it("retrieves the right passage", () => {
    expect(retrieve("आलुमा डढुवा रोग")[0]?.doc.id).toBe("disease.LATE_BLIGHT.potato");
    expect(retrieve("तोरीमा लाही कीरा")[0]?.doc.id).toContain("MUSTARD_APHID");
  });
  it("answers from the farmer's own data", async () => {
    const w = await answer("भोलि पानी पर्छ?", [], ctx);
    expect(w.mode).toBe("local");
    expect(w.answerNe).toContain("भोलि");
    const f = await answer("मेरो खेतमा युरिया कति हाल्ने?", [], ctx);
    expect(f.answerNe).toContain("कट्ठा");
    const s = await answer("मल अनुदान कहिले पाइन्छ?", [], ctx);
    expect(s.answerNe).toContain("युरिया अनुदान");
    console.log([w, f, s].map((a) => `${a.understoodEn} => ${a.answerNe}`).join("\n"));
  });
});
