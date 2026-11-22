import { describe, expect, it } from "vitest";
import { imageKey, isAllowedImageSource } from "./image-store";

describe("stored satellite images", () => {
  it("only fetches from Planetary Computer over https", () => {
    expect(isAllowedImageSource("https://planetarycomputer.microsoft.com/api/data/v1/item/bbox/1,2,3,4.jpg?x=1")).toBe(true);
    expect(isAllowedImageSource("http://planetarycomputer.microsoft.com/a.jpg")).toBe(false);
    expect(isAllowedImageSource("https://evil.example.com/a.jpg")).toBe(false);
    expect(isAllowedImageSource("https://planetarycomputer.microsoft.com.evil.com/a.jpg")).toBe(false);
    expect(isAllowedImageSource("http://169.254.169.254/latest")).toBe(false);
    expect(isAllowedImageSource("not a url")).toBe(false);
  });
  it("gives one stable key per picture", () => {
    const a = imageKey("https://planetarycomputer.microsoft.com/x?a=1");
    expect(a).toBe(imageKey("https://planetarycomputer.microsoft.com/x?a=1"));
    expect(a).not.toBe(imageKey("https://planetarycomputer.microsoft.com/x?a=2"));
    expect(a).toMatch(/^satellite\/[0-9a-f]{40}\.jpg$/);
  });
});
