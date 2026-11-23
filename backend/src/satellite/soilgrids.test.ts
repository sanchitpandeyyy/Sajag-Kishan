import { describe, expect, it } from "vitest";
import { parseSoilGrids, soilAt } from "./soilgrids";

const ok = (body: unknown = sample) => new Response(JSON.stringify(body), { status: 200 });
const status = (code: number, headers: Record<string, string> = {}) => new Response("", { status: code, headers });
const noWait = async () => {};

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

describe("SoilGrids fetching", () => {
  it("retries a server error and then succeeds", async () => {
    const calls: number[] = [];
    const f = (async () => (calls.push(1), calls.length < 3 ? status(503) : ok())) as unknown as typeof fetch;
    const waits: number[] = [];
    const r = await soilAt(28.995, 80.17, f, { sleep: async (ms) => void waits.push(ms) });
    expect(r.soilPh).toBe(6.5);
    expect(calls.length).toBe(3);
    expect(waits.slice(0, 2)).toEqual([2000, 6000]);
  });

  it("retries a timeout", async () => {
    let n = 0;
    const f = (async () => {
      if (++n === 1) throw new DOMException("timed out", "TimeoutError");
      return ok();
    }) as unknown as typeof fetch;
    expect((await soilAt(28.995, 80.17, f, { sleep: noWait })).soilPh).toBe(6.5);
    expect(n).toBe(2);
  });

  it("honours Retry-After on a 429", async () => {
    let n = 0;
    const f = (async () => (++n === 1 ? status(429, { "retry-after": "7" }) : ok())) as unknown as typeof fetch;
    const waits: number[] = [];
    await soilAt(28.995, 80.17, f, { sleep: async (ms) => void waits.push(ms) });
    expect(waits[0]).toBe(7000);
  });

  it("does not retry a bad request", async () => {
    let n = 0;
    const f = (async () => (++n, status(400))) as unknown as typeof fetch;
    await expect(soilAt(28.995, 80.17, f, { sleep: noWait })).rejects.toThrow("400");
    expect(n).toBe(1);
  });

  it("gives up after the attempt limit", async () => {
    let n = 0;
    const f = (async () => (++n, status(500))) as unknown as typeof fetch;
    await expect(soilAt(28.995, 80.17, f, { sleep: noWait, attempts: 3 })).rejects.toThrow("500");
    expect(n).toBe(3);
  });

  it("sends one request at a time", async () => {
    let active = 0;
    let peak = 0;
    const f = (async () => {
      peak = Math.max(peak, ++active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return ok();
    }) as unknown as typeof fetch;
    await Promise.all([1, 2, 3, 4].map(() => soilAt(28.995, 80.17, f, { sleep: noWait })));
    expect(peak).toBe(1);
  });
});
