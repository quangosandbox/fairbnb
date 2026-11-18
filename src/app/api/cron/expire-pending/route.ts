import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Unpaid bookings older than this are released. Stripe Checkout sessions expire after 31 min. */
const PENDING_TTL_MINUTES = 45;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // fail closed: never run unauthenticated
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

/**
 * Cancels PENDING_PAYMENT bookings whose checkout was abandoned. Vercel Cron
 * calls this with `Authorization: Bearer $CRON_SECRET`. If a payment for one of
 * these still arrives later, the Stripe webhook refunds it automatically.
 */
export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const now = new Date();
  const cutoff = new Date(now.getTime() - PENDING_TTL_MINUTES * 60_000);
  const { count } = await db.booking.updateMany({
    where: { status: "PENDING_PAYMENT", createdAt: { lt: cutoff } },
    data: { status: "CANCELLED", cancelledAt: now, cancelledBy: "system" },
  });
  if (count > 0) console.info(`[cron] expired ${count} unpaid booking(s) older than ${PENDING_TTL_MINUTES} min`);
  return NextResponse.json({ expired: count, cutoff: cutoff.toISOString() });
}
