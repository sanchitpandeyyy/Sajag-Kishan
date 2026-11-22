import { afterEach, describe, expect, it, vi } from "vitest";
import { audienceWhere } from "./notify";
import { deadTokens, sendPush } from "./push";

afterEach(() => vi.unstubAllGlobals());

const msg = (to: string) => ({ to, title: "t", body: "b" });

describe("sendPush", () => {
  it("reads Expo's per-phone tickets", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ data: [{ status: "ok" }, { status: "error", details: { error: "DeviceNotRegistered" } }] }), { status: 200 })),
    );
    const r = await sendPush([msg("ExponentPushToken[a]"), msg("ExponentPushToken[b]")]);
    expect(r).toEqual([
      { to: "ExponentPushToken[a]", ok: true },
      { to: "ExponentPushToken[b]", ok: false, error: "DeviceNotRegistered" },
    ]);
    expect(deadTokens(r)).toEqual(["ExponentPushToken[b]"]);
  });

  it("marks the whole batch failed on an HTTP error or network error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 500 })));
    expect((await sendPush([msg("x")]))[0]).toMatchObject({ ok: false, error: "http_500" });
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("offline"))));
    expect((await sendPush([msg("x")]))[0]).toMatchObject({ ok: false, error: "TypeError" });
  });

  it("sends at most 100 messages per request", async () => {
    const f = vi.fn(async (_url: string, init: RequestInit) => {
      const n = (JSON.parse(String(init.body)) as unknown[]).length;
      return new Response(JSON.stringify({ data: Array.from({ length: n }, () => ({ status: "ok" })) }), { status: 200 });
    });
    vi.stubGlobal("fetch", f);
    const r = await sendPush(Array.from({ length: 150 }, (_, i) => msg(`t${i}`)));
    expect(f).toHaveBeenCalledTimes(2);
    expect(r.filter((x) => x.ok)).toHaveLength(150);
  });
});

describe("alert audience", () => {
  it("reaches farmers by farming ward or by a field in the ward", () => {
    expect(audienceWhere({ wardId: 7 })).toEqual({ OR: [{ farmingWardId: 7 }, { parcels: { some: { wardId: 7 } } }] });
  });
  it("limits crop alerts to this season's growers of that crop", () => {
    const w = audienceWhere({ wardId: 7, cropCodes: ["wheat"] }) as { AND: [unknown, { declarations: { some: Record<string, unknown> } }] };
    expect(w.AND[1].declarations.some).toMatchObject({ isFallow: false, crop: { code: { in: ["wheat"] } } });
    expect(w.AND[1].declarations.some).toHaveProperty("fiscalYearBs");
    expect(w.AND[1].declarations.some).toHaveProperty("season");
  });
});
