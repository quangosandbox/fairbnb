"use server";

import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { blockingBookingWhere, parseDay, todayUTC } from "@/lib/listings";
import { calculatePrice, nightsBetween } from "@/lib/pricing";
import { startCheckout } from "@/lib/payments";

export type BookingState = { error?: string } | undefined;

const MAX_DONATION_CENTS = 100_000;

export async function createBooking(_: BookingState, form: FormData): Promise<BookingState> {
  const listingId = String(form.get("listingId") ?? "");
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/listings/${listingId}`)}`);

  const checkIn = parseDay(String(form.get("checkIn")));
  const checkOut = parseDay(String(form.get("checkOut")));
  const guests = Math.floor(Number(form.get("guests")));
  const donationCents = Math.min(MAX_DONATION_CENTS, Math.max(0, Math.floor(Number(form.get("donationCents")) || 0)));

  if (!checkIn || !checkOut || checkOut <= checkIn) return { error: "Choose valid dates." };
  if (checkIn < todayUTC()) return { error: "Check-in can't be in the past." };

  const listing = await db.listing.findUnique({ where: { id: listingId } });
  if (!listing || !listing.published) return { error: "This listing isn't available." };
  if (listing.hostId === user.id) return { error: "You can't book your own listing." };
  if (!(guests >= 1 && guests <= listing.maxGuests)) return { error: `This place fits up to ${listing.maxGuests} guests.` };

  const nights = nightsBetween(checkIn, checkOut);
  if (nights < listing.minNights) return { error: `Minimum stay is ${listing.minNights} nights.` };
  if (nights > 90) return { error: "Stays are limited to 90 nights." };

  // Price is always recomputed server-side; the client's numbers are for display only.
  const price = calculatePrice({ ...listing, nights, donationCents });

  let bookingId: string;
  try {
    bookingId = await db.$transaction(
      async (tx) => {
        const clash = await tx.booking.findFirst({ where: { listingId, ...blockingBookingWhere(checkIn, checkOut) } });
        if (clash) throw new Error("UNAVAILABLE");
        const b = await tx.booking.create({
          data: {
            listingId,
            guestId: user.id,
            checkIn,
            checkOut,
            guests,
            nights,
            subtotalCents: price.subtotalCents,
            cleaningFeeCents: price.cleaningFeeCents,
            taxCents: price.taxCents,
            processingCents: price.processingCents,
            platformFeeCents: price.platformFeeCents,
            donationCents: price.donationCents,
            totalCents: price.totalCents,
            hostPayoutCents: price.hostPayoutCents,
            currency: listing.currency,
          },
        });
        return b.id;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (e) {
    if (e instanceof Error && e.message === "UNAVAILABLE") return { error: "Those dates were just booked. Try others." };
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2034") return { error: "Someone else is booking right now. Try again." };
    throw e;
  }

  let url: string;
  try {
    url = await startCheckout(bookingId);
  } catch (e) {
    await db.booking.update({ where: { id: bookingId }, data: { status: "CANCELLED" } });
    console.error(e);
    return { error: "This host can't accept payments yet. Please try again later." };
  }
  redirect(url);
}

export async function cancelBooking(form: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const id = String(form.get("bookingId"));
  const booking = await db.booking.findUnique({ where: { id }, include: { listing: true } });
  if (!booking || (booking.guestId !== user.id && booking.listing.hostId !== user.id)) return;
  if (booking.status !== "PENDING_PAYMENT" && booking.status !== "CONFIRMED") return;
  // NOTE: refunds for paid Stripe bookings are not automated yet; see LAUNCH.md.
  await db.booking.update({ where: { id }, data: { status: "CANCELLED" } });
  redirect(booking.guestId === user.id ? `/trips/${id}` : "/host");
}
