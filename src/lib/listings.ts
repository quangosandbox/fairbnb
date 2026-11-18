import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";

/** Bookings that hold dates: confirmed ones, plus checkouts started in the last 30 minutes. */
export function blockingBookingWhere(checkIn: Date, checkOut: Date): Prisma.BookingWhereInput {
  return {
    checkIn: { lt: checkOut },
    checkOut: { gt: checkIn },
    OR: [
      { status: { in: ["CONFIRMED", "COMPLETED"] } },
      { status: "PENDING_PAYMENT", createdAt: { gt: new Date(Date.now() - 30 * 60_000) } },
    ],
  };
}

export async function isAvailable(listingId: string, checkIn: Date, checkOut: Date) {
  const clash = await db.booking.findFirst({ where: { listingId, ...blockingBookingWhere(checkIn, checkOut) } });
  return !clash;
}

/** Parse a YYYY-MM-DD string as a UTC date; returns null if invalid. */
export function parseDay(s: string | undefined | null): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return isNaN(d.getTime()) ? null : d;
}

export function toDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function todayUTC() {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

export async function searchListings(opts: { q?: string; checkIn?: Date | null; checkOut?: Date | null; guests?: number }) {
  const where: Prisma.ListingWhereInput = { published: true };
  if (opts.q) {
    const q = opts.q.trim();
    where.OR = [
      { city: { contains: q, mode: "insensitive" } },
      { region: { contains: q, mode: "insensitive" } },
      { country: { contains: q, mode: "insensitive" } },
      { title: { contains: q, mode: "insensitive" } },
    ];
  }
  if (opts.guests) where.maxGuests = { gte: opts.guests };
  if (opts.checkIn && opts.checkOut) {
    where.bookings = { none: blockingBookingWhere(opts.checkIn, opts.checkOut) };
  }
  const listings = await db.listing.findMany({
    where,
    include: { photos: { orderBy: { position: "asc" }, take: 1 }, reviews: { select: { rating: true } } },
    orderBy: { createdAt: "desc" },
    take: 60,
  });
  return listings.map((l) => ({ ...l, ...ratingSummary(l.reviews) }));
}

export function ratingSummary(reviews: { rating: number }[]) {
  const reviewCount = reviews.length;
  const avgRating = reviewCount ? reviews.reduce((s, r) => s + r.rating, 0) / reviewCount : null;
  return { reviewCount, avgRating };
}
