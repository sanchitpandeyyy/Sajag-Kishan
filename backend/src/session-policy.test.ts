import { describe, expect, it, vi } from "vitest";

vi.mock("./lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("./db", () => ({ getPrisma: vi.fn() }));

const { officerSessionIdle, OFFICER_IDLE_MS } = await import("./auth");

describe("session policy", () => {
  const now = Date.UTC(2026, 10, 23);
  const ago = (days: number) => new Date(now - days * 86_400_000);

  it("never expires a farmer, however long unused", () => {
    expect(officerSessionIdle("FARMER", ago(3650), now)).toBe(false);
  });

  it("signs out an officer after about a month unused", () => {
    expect(officerSessionIdle("AGRICULTURE_OFFICER", ago(10), now)).toBe(false);
    expect(officerSessionIdle("AGRICULTURE_OFFICER", ago(32), now)).toBe(true);
    expect(officerSessionIdle("SUPER_ADMIN", new Date(now - OFFICER_IDLE_MS - 1), now)).toBe(true);
  });
});
