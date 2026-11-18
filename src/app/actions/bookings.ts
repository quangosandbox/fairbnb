"use server";

import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentUser, isEmailVerified } from "@/lib/auth";
import { blockingBookingWhere, parseDay, todayUTC } from "@/lib/listings";
import { calculatePrice, nightsBetween } from "@/lib/pricing";
import { cancelAndRefund, startCheckout } from "@/lib/payments";

export type BookingState = { error?: string } | undefined;

const MAX_DONATION_CENTS = 100_000;

export async function createBooking(_: BookingState, form: FormData): Promise<BookingState> {
  const listingId = String(form.get("listingId") ?? "");
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/listings/${listingId}`)}`);
  if (!isEmailVerified(user)) return { error: "Confirm your email before booking. We sent you a link; you can resend it from the banner at the top of the page." };

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
    await db.booking.update({ where: { id: bookingId }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelledBy: "system" } });
    console.error(e);
    return { error: "This host can't accept payments yet. Please try again later." };
  }
  redirect(url);
}

/** Short codes (not free text) so the URL can't be used to put arbitrary messages on the page. */
export type CancelErrorCode = "changed" | "refund_failed" | "not_allowed" | "missing_payment";

function errorCode(msg: string): CancelErrorCode {
  if (msg.startsWith("The refund amount has changed")) return "changed";
  if (msg.startsWith("Stripe couldn't")) return "refund_failed";
  if (msg.startsWith("We couldn't find the payment")) return "missing_payment";
  return "not_allowed";
}

/**
 * Cancels a reservation (guest or the listing's host) under the cancellation
 * policy and refunds the guest. The form posts `expectedRefundCents`, the amount
 * shown on the confirm step; if the policy now gives a different amount, nothing
 * happens and the user is asked to review again.
 */
export async function cancelBooking(form: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const id = String(form.get("bookingId") ?? "");
  const booking = await db.booking.findUnique({ where: { id }, include: { listing: { select: { hostId: true } } } });
  if (!booking) return;
  const actor = booking.guestId === user.id ? "guest" : booking.listing.hostId === user.id ? "host" : null;
  if (!actor) return;

  const expectedRaw = form.get("expectedRefundCents");
  const expected = expectedRaw === null || expectedRaw === "" ? undefined : Math.floor(Number(expectedRaw));
  const result = await cancelAndRefund(id, actor, {
    expectedRefundCents: expected !== undefined && Number.isFinite(expected) ? expected : undefined,
  });

  if (actor === "guest") {
    redirect(result.ok ? `/trips/${id}?cancelled=1` : `/trips/${id}?cancel=1&cancelError=${errorCode(result.error)}#cancel`);
  }
  redirect(result.ok ? `/host?cancelled=${id}` : `/host?cancel=${id}&cancelError=${errorCode(result.error)}#cancel-${id}`);
}
