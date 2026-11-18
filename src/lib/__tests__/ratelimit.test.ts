import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("next/headers", () => ({ headers: vi.fn() }));

const { evaluateWindow, parseClientIp, tooManyAttemptsMessage } = await import("@/lib/ratelimit");

const h = (values: Record<string, string>) => ({ get: (name: string) => values[name] ?? null });

describe("parseClientIp", () => {
  it("uses the first x-forwarded-for entry", () => {
    expect(parseClientIp(h({ "x-forwarded-for": "203.0.113.7, 10.0.0.1", "x-real-ip": "10.0.0.2" }))).toBe("203.0.113.7");
    expect(parseClientIp(h({ "x-forwarded-for": "  2001:db8::1 " }))).toBe("2001:db8::1");
  });
  it("falls back to x-real-ip, then unknown", () => {
    expect(parseClientIp(h({ "x-real-ip": "198.51.100.4" }))).toBe("198.51.100.4");
    expect(parseClientIp(h({ "x-forwarded-for": " , ", "x-real-ip": "198.51.100.4" }))).toBe("198.51.100.4");
    expect(parseClientIp(h({}))).toBe("unknown");
  });
});

describe("evaluateWindow", () => {
  const now = Date.parse("2026-01-01T12:00:00Z");
  const ago = (ms: number) => new Date(now - ms);
  const opts = { limit: 3, windowMs: 60_000 };

  it("allows while under the limit", () => {
    expect(evaluateWindow([], opts, now)).toEqual({ ok: true, retryAfterSeconds: 0 });
    expect(evaluateWindow([ago(1000), ago(2000)], opts, now).ok).toBe(true);
  });

  it("ignores hits that slid out of the window", () => {
    expect(evaluateWindow([ago(1000), ago(2000), ago(61_000)], opts, now).ok).toBe(true);
  });

  it("blocks at the limit until the oldest counted hit leaves the window", () => {
    const res = evaluateWindow([ago(1000), ago(20_000), ago(50_000)], opts, now);
    expect(res).toEqual({ ok: false, retryAfterSeconds: 10 });
  });

  it("with more hits than the limit, waits for the limit-th newest", () => {
    const res = evaluateWindow([ago(50_000), ago(1000), ago(5000), ago(40_000)], opts, now);
    expect(res).toEqual({ ok: false, retryAfterSeconds: 20 });
  });
});

describe("tooManyAttemptsMessage", () => {
  it("rounds up to whole minutes", () => {
    expect(tooManyAttemptsMessage(10)).toBe("Too many attempts. Try again in 1 minute.");
    expect(tooManyAttemptsMessage(61)).toBe("Too many attempts. Try again in 2 minutes.");
    expect(tooManyAttemptsMessage(900)).toBe("Too many attempts. Try again in 15 minutes.");
  });
});
