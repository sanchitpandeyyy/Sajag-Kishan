import { describe, expect, it } from "vitest";
import { audioFromRequest } from "./audio";

const bytes = Buffer.from("fake-m4a-bytes");
const json = (body: unknown) => new Request("http://x/v1/chat/transcribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("voice upload parsing", () => {
  it("reads the JSON base64 body the farmer app sends", async () => {
    const a = await audioFromRequest(json({ audio: bytes.toString("base64"), mimeType: "audio/mp4" }));
    expect(a?.bytes.equals(bytes)).toBe(true);
    expect(a?.mimeType).toBe("audio/mp4");
  });

  it("accepts a data: URL prefix and defaults a missing mime type", async () => {
    const a = await audioFromRequest(json({ audio: `data:audio/mp4;base64,${bytes.toString("base64")}` }));
    expect(a?.bytes.equals(bytes)).toBe(true);
    expect(a?.mimeType).toBe("audio/mp4");
  });

  it("rejects a non-audio mime type by falling back to the default", async () => {
    const a = await audioFromRequest(json({ audio: bytes.toString("base64"), mimeType: "text/html" }));
    expect(a?.mimeType).toBe("audio/mp4");
  });

  it("still reads a multipart file upload", async () => {
    const form = new FormData();
    form.set("audio", new File([bytes], "a.m4a", { type: "audio/aac" }));
    const a = await audioFromRequest(new Request("http://x/", { method: "POST", body: form }));
    expect(a?.bytes.equals(bytes)).toBe(true);
    expect(a?.mimeType).toBe("audio/aac");
  });

  it("returns null when there is no audio", async () => {
    expect(await audioFromRequest(json({}))).toBeNull();
    expect(await audioFromRequest(json({ audio: "" }))).toBeNull();
    expect(await audioFromRequest(json({ audio: 5 }))).toBeNull();
    expect(await audioFromRequest(new Request("http://x/", { method: "POST", headers: { "content-type": "application/json" }, body: "not json" }))).toBeNull();
    expect(await audioFromRequest(new Request("http://x/", { method: "POST", body: new FormData() }))).toBeNull();
  });
});
