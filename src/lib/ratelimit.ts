import "server-only";
import { headers } from "next/headers";
import { db } from "./db";

/**
 * Sliding-window rate limiting backed by the RateLimitHit table, so every server instance
 * (Vercel function) shares the same counters.
 */
export type RateLimitOptions = { limit: number; windowMs: number };
export type RateLimitResult = { ok: boolean; retryAfterSeconds: number };

const PRUNE_AFTER_MS = 24 * 60 * 60 * 1000;
const PRUNE_PROBABILITY = 0.01;

/**
 * Pure decision: given the timestamps of the most recent hits (newest first, at most `limit`
 * of them, all inside the window), is another attempt allowed, and if not, when?
 * A slot frees up when the `limit`-th most recent hit slides out of the window.
 */
export function evaluateWindow(recentHits: Date[], { limit, windowMs }: RateLimitOptions, now = Date.now()): RateLimitResult {
  const inWindow = recentHits.filter((d) => d.getTime() > now - windowMs).sort((a, b) => b.getTime() - a.getTime());
  if (inWindow.length < limit) return { ok: true, retryAfterSeconds: 0 };
  const freesAt = inWindow[limit - 1].getTime() + windowMs;
  return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((freesAt - now) / 1000)) };
}

/** Checks the limit without recording an attempt (e.g. to count only failed logins). */
export async function checkRateLimit(key: string, opts: RateLimitOptions): Promise<RateLimitResult> {
  const now = Date.now();
  const hits = await db.rateLimitHit.findMany({
    where: { key, createdAt: { gt: new Date(now - opts.windowMs) } },
    orderBy: { createdAt: "desc" },
    take: opts.limit,
    select: { createdAt: true },
  });
  return evaluateWindow(hits.map((h) => h.createdAt), opts, now);
}

/** Records one attempt against `key`, and now and then prunes hits older than 24 hours. */
export async function recordHit(key: string): Promise<void> {
  await db.rateLimitHit.create({ data: { key } });
  if (Math.random() < PRUNE_PROBABILITY) {
    await db.rateLimitHit
      .deleteMany({ where: { createdAt: { lt: new Date(Date.now() - PRUNE_AFTER_MS) } } })
      .catch((e) => console.error("[ratelimit] prune failed", e));
  }
}

/** Forgets all attempts for `key` (e.g. failed logins once the user gets their password right). */
export async function clearHits(key: string): Promise<void> {
  await db.rateLimitHit.deleteMany({ where: { key } });
}

/** Counts this attempt: blocked attempts are not recorded, allowed ones are. */
export async function rateLimit(key: string, opts: RateLimitOptions): Promise<RateLimitResult> {
  const res = await checkRateLimit(key, opts);
  if (res.ok) await recordHit(key);
  return res;
}

type HeaderGetter = { get(name: string): string | null };

/** Client IP: first x-forwarded-for entry (set by Vercel / the proxy), else x-real-ip, else "unknown". */
export function parseClientIp(h: HeaderGetter): string {
  const first = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (first) return first;
  const real = h.get("x-real-ip")?.trim();
  return real || "unknown";
}

export async function clientIp(): Promise<string> {
  return parseClientIp(await headers());
}

export function tooManyAttemptsMessage(retryAfterSeconds: number): string {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}
