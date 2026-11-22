import { Hono } from "hono";
import { compress } from "hono/compress";
import { describe, expect, it } from "vitest";

describe("response compression", () => {
  it("gzips large JSON responses", async () => {
    const app = new Hono();
    app.use("*", compress());
    const features = Array.from({ length: 500 }, (_, i) => ({ type: "Feature", geometry: { type: "Point", coordinates: [84.4 + i / 1e4, 27.6] }, properties: { id: `p${i}`, ward: 3, crop: "wheat", status: "CULTIVATED" } }));
    app.get("/big", (c) => c.json({ type: "FeatureCollection", features }));
    const raw = JSON.stringify({ type: "FeatureCollection", features }).length;
    const big = await app.request("/big", { headers: { "accept-encoding": "gzip" } });
    expect(big.headers.get("content-encoding")).toBe("gzip");
    const zipped = (await big.arrayBuffer()).byteLength;
    console.log(`map-like JSON: ${raw} bytes -> ${zipped} bytes gzipped (${Math.round((1 - zipped / raw) * 100)}% smaller)`);
    expect(zipped).toBeLessThan(raw / 4);
    const plain = await app.request("/big");
    expect(plain.headers.get("content-encoding")).toBeNull();
  });
});
