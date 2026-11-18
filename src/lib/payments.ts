import "server-only";
import { db } from "./db";
import { computeRefund, type CancelActor } from "./cancellation";
import { sendBookingCancelledEmails, sendBookingConfirmedEmails } from "./booking-emails";
import { formatMoney } from "./pricing";

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
    await sendBookingConfirmedEmails(bookingId);
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

export type CancelResult =
  | { ok: true; refundCents: number; alreadyCancelled?: boolean }
  | { ok: false; error: string };

/**
 * Cancels a booking under the cancellation policy and refunds the guest.
 *
 * Safe under double-submit: the Stripe refund uses the idempotency key
 * `refund-<bookingId>` (a second identical request returns the same refund), and
 * the status flip is a conditional update on CONFIRMED, so only one request
 * records the cancellation, deletes the donation and sends emails.
 * If the Stripe refund fails, nothing changes and the error is returned.
 *
 * `expectedRefundCents` is the amount the user was shown; if the policy now
 * gives a different number (e.g. the 24h mark passed), we refuse rather than
 * refund an amount they didn't agree to.
 */
export async function cancelAndRefund(
  bookingId: string,
  actor: CancelActor,
  opts: { expectedRefundCents?: number; now?: Date } = {},
): Promise<CancelResult> {
  const now = opts.now ?? new Date();
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: { listing: { include: { host: { select: { stripeAccountId: true } } } } },
  });
  if (!booking) return { ok: false, error: "Reservation not found." };
  if (booking.status === "CANCELLED") return { ok: true, refundCents: booking.refundCents, alreadyCancelled: true };

  const quote = computeRefund(booking, actor, now);
  if (!quote.allowed) return { ok: false, error: quote.reason };
  if (opts.expectedRefundCents !== undefined && opts.expectedRefundCents !== quote.refundCents) {
    return {
      ok: false,
      error: `The refund amount has changed to ${formatMoney(quote.refundCents, booking.currency)}. Please review it and confirm again.`,
    };
  }

  const stripeAccount = booking.listing.host.stripeAccountId;

  if (booking.status === "PENDING_PAYMENT") {
    const { count } = await db.booking.updateMany({
      where: { id: bookingId, status: "PENDING_PAYMENT" },
      data: { status: "CANCELLED", cancelledAt: now, cancelledBy: actor },
    });
    if (count === 1 && booking.paymentMode === "stripe" && booking.stripeCheckoutId && stripeAccount) {
      const { expireCheckoutSession } = await import("./stripe");
      await expireCheckoutSession(booking.stripeCheckoutId, stripeAccount);
    }
    if (count === 0) return cancelAndRefund(bookingId, actor, { ...opts, now }); // paid meanwhile: re-evaluate
    return { ok: true, refundCents: 0 };
  }

  // CONFIRMED
  let stripeRefundId: string | null = null;
  if (booking.paymentMode === "stripe" && quote.refundCents > 0) {
    if (!booking.stripePaymentIntentId || !stripeAccount) {
      return { ok: false, error: "We couldn't find the payment for this reservation. Please contact support." };
    }
    try {
      const { refundBookingPayment } = await import("./stripe");
      const result = await refundBookingPayment({
        bookingId,
        paymentIntentId: booking.stripePaymentIntentId,
        stripeAccount,
        amountCents: quote.refundCents,
        totalCents: booking.totalCents,
        alreadyRefundedCents: booking.refundCents,
        donationCents: booking.donationCents,
        donationRefunded: quote.donationRefunded,
        cancelledBy: actor,
      });
      stripeRefundId = result?.refundId ?? null;
    } catch (e) {
      console.error(`[payments] refund for booking ${bookingId} failed`, e);
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: `Stripe couldn't process the refund, so the reservation was not cancelled. (${msg})` };
    }
  }

  const refundCents = booking.refundCents + quote.refundCents;
  const won = await db.$transaction(async (tx) => {
    const { count } = await tx.booking.updateMany({
      where: { id: bookingId, status: "CONFIRMED" },
      data: { status: "CANCELLED", cancelledAt: now, cancelledBy: actor, refundCents, stripeRefundId },
    });
    if (count === 1 && quote.donationRefunded) {
      // The donation went back to the guest, so it no longer counts on /transparency.
      await tx.donation.deleteMany({ where: { bookingId, source: "booking" } });
    }
    return count === 1;
  });
  if (!won) {
    const fresh = await db.booking.findUnique({ where: { id: bookingId } });
    return { ok: true, refundCents: fresh?.refundCents ?? refundCents, alreadyCancelled: true };
  }
  await sendBookingCancelledEmails(bookingId);
  return { ok: true, refundCents };
}
