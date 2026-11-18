import "server-only";
import { db } from "./db";

/**
 * Payments facade. Two modes:
 *  - "mock": no STRIPE_SECRET_KEY set. Bookings confirm instantly. For local dev / demos.
 *  - "stripe": Stripe Connect (Standard accounts, direct charges). The guest pays the
 *    host's own Stripe account directly; Stripe's processing fee is deducted there and
 *    is exactly offset by the "card processing" line the guest saw. Fairbnb's
 *    application fee is only the optional donation (usually $0).
 */
export function paymentMode(): "mock" | "stripe" {
  return process.env.STRIPE_SECRET_KEY ? "stripe" : "mock";
}

export function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

/** Returns the URL to send the guest to in order to pay for a PENDING_PAYMENT booking. */
export async function startCheckout(bookingId: string): Promise<string> {
  if (paymentMode() === "mock") {
    const booking = await db.booking.update({
      where: { id: bookingId },
      data: { status: "CONFIRMED", paymentMode: "mock" },
    });
    if (booking.donationCents > 0) {
      await db.donation.create({
        data: { userId: booking.guestId, bookingId, amountCents: booking.donationCents, source: "booking" },
      });
    }
    return `/trips/${bookingId}?paid=1`;
  }
  const { startStripeCheckout } = await import("./stripe");
  return startStripeCheckout(bookingId);
}

/** Returns a URL where the host can set up / manage payouts. */
export async function hostPayoutsLink(userId: string): Promise<string> {
  if (paymentMode() === "mock") {
    await db.user.update({ where: { id: userId }, data: { payoutsEnabled: true } });
    return "/host?payouts=mock";
  }
  const { createOnboardingLink } = await import("./stripe");
  return createOnboardingLink(userId);
}

/** Starts a one-off donation to Fairbnb itself. */
export async function startDonation(amountCents: number, userId: string | null): Promise<string> {
  if (paymentMode() === "mock") {
    await db.donation.create({ data: { userId, amountCents, source: "direct" } });
    return "/donate?thanks=1";
  }
  const { startStripeDonation } = await import("./stripe");
  return startStripeDonation(amountCents, userId);
}
