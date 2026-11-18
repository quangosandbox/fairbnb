import "server-only";
import Stripe from "stripe";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/payments";
import { formatMoney } from "@/lib/pricing";
import { sendBookingCancelledEmails, sendBookingConfirmedEmails } from "@/lib/booking-emails";

/**
 * Real Stripe path.
 *
 * Model: Stripe Connect, Standard connected accounts, DIRECT charges.
 *  - Booking Checkout Sessions are created ON the host's own Stripe account
 *    (`stripeAccount` request option). The host is the merchant of record;
 *    Stripe deducts its processing fee from the host's balance, and the guest's
 *    "card processing" line (grossed up in pricing.ts) exactly offsets it.
 *  - Fairbnb's only cut is the optional donation, moved to the platform via
 *    `application_fee_amount`. Platform fee is always 0.
 *  - Direct donations to Fairbnb are plain Checkout Sessions on the platform.
 */

let _stripe: Stripe | null = null;

/** Lazily constructed so importing this module never requires the key. */
export function stripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  _stripe = new Stripe(key, { appInfo: { name: "Fairbnb" } });
  return _stripe;
}

// Stripe Checkout requires expires_at to be 30 min – 24 h out. Keep it short so
// an abandoned checkout doesn't squat on the host's dates for a day.
const CHECKOUT_TTL_SECONDS = 31 * 60;

// ---------------------------------------------------------------------------
// Pure helpers (no network / DB) — unit tested.
// ---------------------------------------------------------------------------

export type CheckoutPricing = {
  nights: number;
  subtotalCents: number;
  cleaningFeeCents: number;
  taxCents: number;
  processingCents: number;
  platformFeeCents: number;
  donationCents: number;
  totalCents: number;
  currency: string;
};

export type CheckoutLineItem = Stripe.Checkout.SessionCreateParams.LineItem;

function line(currency: string, name: string, amountCents: number, description?: string): CheckoutLineItem {
  return {
    quantity: 1,
    price_data: {
      currency,
      unit_amount: amountCents,
      product_data: description ? { name, description } : { name },
    },
  };
}

/**
 * Builds the guest-facing line items for a booking's Checkout Session from the
 * frozen price breakdown on the booking. Each cost is its own line so the
 * Stripe-hosted page mirrors exactly what the guest saw on Fairbnb.
 *
 * Throws if the lines don't sum to `totalCents` or if a platform fee sneaks in.
 */
export function buildCheckoutLineItems(b: CheckoutPricing): CheckoutLineItem[] {
  const currency = b.currency.toLowerCase();
  const ints = [b.nights, b.subtotalCents, b.cleaningFeeCents, b.taxCents, b.processingCents, b.donationCents, b.totalCents];
  if (!ints.every((n) => Number.isInteger(n) && n >= 0)) {
    throw new Error("Booking price fields must be non-negative integers (cents)");
  }
  if (b.platformFeeCents !== 0) {
    throw new Error(`Fairbnb never charges a platform fee (got ${b.platformFeeCents})`);
  }
  if (b.nights <= 0 || b.subtotalCents <= 0) {
    throw new Error("A booking must have at least one paid night");
  }

  // subtotal = nightly × nights, so this is exact for real bookings.
  const nightlyLabel = formatMoney(Math.round(b.subtotalCents / b.nights), currency);
  const items: CheckoutLineItem[] = [
    line(currency, `${b.nights} ${b.nights === 1 ? "night" : "nights"} × ${nightlyLabel}`, b.subtotalCents),
  ];
  if (b.cleaningFeeCents > 0) items.push(line(currency, "Cleaning fee", b.cleaningFeeCents, "Set by the host"));
  if (b.taxCents > 0) items.push(line(currency, "Lodging tax", b.taxCents, "Collected for and remitted by the host"));
  if (b.processingCents > 0) {
    items.push(
      line(
        currency,
        "Card processing — charged by Stripe, not Fairbnb",
        b.processingCents,
        "Passed through at cost so your host receives their full price",
      ),
    );
  }
  if (b.donationCents > 0) {
    items.push(line(currency, "Donation to Fairbnb", b.donationCents, "Optional — thank you for keeping Fairbnb fee-free"));
  }

  const sum = lineItemsTotal(items);
  if (sum !== b.totalCents) {
    throw new Error(`Checkout line items sum to ${sum} but booking total is ${b.totalCents}`);
  }
  return items;
}

export function lineItemsTotal(items: CheckoutLineItem[]): number {
  return items.reduce((s, li) => s + (li.price_data?.unit_amount ?? 0) * (li.quantity ?? 1), 0);
}

/** Host can take bookings only once Stripe says the account can charge AND onboarding is done. */
export function accountCanTakePayments(acct: Pick<Stripe.Account, "charges_enabled" | "details_submitted">): boolean {
  return Boolean(acct.charges_enabled && acct.details_submitted);
}

// ---------------------------------------------------------------------------
// Host onboarding (Connect, Standard accounts)
// ---------------------------------------------------------------------------

export async function ensureConnectedAccount(userId: string): Promise<string> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.stripeAccountId) return user.stripeAccountId;

  const account = await stripe().accounts.create(
    { type: "standard", email: user.email, metadata: { userId: user.id } },
    // Retry-safe: a double-click won't create two accounts for the same user.
    { idempotencyKey: `fairbnb-connect-account-${user.id}` },
  );
  // Only set if still null, in case a concurrent request won the race.
  const { count } = await db.user.updateMany({
    where: { id: user.id, stripeAccountId: null },
    data: { stripeAccountId: account.id },
  });
  if (count === 0) {
    const fresh = await db.user.findUniqueOrThrow({ where: { id: userId } });
    return fresh.stripeAccountId!;
  }
  return account.id;
}

export async function createAccountLink(accountId: string): Promise<string> {
  const link = await stripe().accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${appUrl()}/api/stripe/connect/refresh`,
    return_url: `${appUrl()}/api/stripe/connect/return`,
  });
  return link.url;
}

export async function createOnboardingLink(userId: string): Promise<string> {
  const accountId = await ensureConnectedAccount(userId);
  return createAccountLink(accountId);
}

/** Pulls the account from Stripe and mirrors its status into User.payoutsEnabled. */
export async function syncAccountStatus(accountId: string): Promise<boolean> {
  const acct = await stripe().accounts.retrieve(accountId);
  return applyAccountStatus(acct);
}

export async function applyAccountStatus(acct: Stripe.Account): Promise<boolean> {
  const enabled = accountCanTakePayments(acct);
  await db.user.updateMany({ where: { stripeAccountId: acct.id }, data: { payoutsEnabled: enabled } });
  return enabled;
}

// ---------------------------------------------------------------------------
// Guest checkout (direct charge on the host's account)
// ---------------------------------------------------------------------------

export async function startStripeCheckout(bookingId: string): Promise<string> {
  const booking = await db.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { listing: { include: { host: true } }, guest: true },
  });
  if (booking.status !== "PENDING_PAYMENT") {
    throw new Error(`Booking ${bookingId} is ${booking.status}, not awaiting payment`);
  }
  const host = booking.listing.host;
  if (!host.stripeAccountId || !host.payoutsEnabled) {
    throw new Error("This host hasn't finished setting up payouts yet, so the stay can't be paid for online.");
  }
  const stripeAccount = host.stripeAccountId;

  // If the guest already has an open session for this booking, reuse it rather
  // than leaving a second payable session around (which could double-charge).
  if (booking.stripeCheckoutId) {
    try {
      const existing = await stripe().checkout.sessions.retrieve(booking.stripeCheckoutId, {}, { stripeAccount });
      if (existing.status === "open" && existing.url) return existing.url;
    } catch {
      // Session missing / wrong account — fall through and create a new one.
    }
  }

  const lineItems = buildCheckoutLineItems(booking);

  const session = await stripe().checkout.sessions.create(
    {
      mode: "payment",
      line_items: lineItems,
      // The processing gross-up in pricing.ts assumes card pricing. Other methods
      // (ACH, BNPL, wallets with different rates) would leave the host short or
      // over-charge the guest, so restrict to cards.
      allowed_payment_method_types: ["card"],
      // Adaptive Pricing would re-quote in the guest's currency (with an FX fee
      // that our gross-up doesn't cover). Keep the price exactly as shown.
      adaptive_pricing: { enabled: false },
      customer_email: booking.guest.email,
      client_reference_id: booking.id,
      metadata: { bookingId: booking.id },
      payment_intent_data: {
        ...(booking.donationCents > 0 ? { application_fee_amount: booking.donationCents } : {}),
        metadata: { bookingId: booking.id, listingId: booking.listingId },
        description: `Fairbnb stay: ${booking.listing.title}`,
      },
      expires_at: Math.floor(Date.now() / 1000) + CHECKOUT_TTL_SECONDS,
      success_url: `${appUrl()}/trips/${booking.id}?paid=1`,
      cancel_url: `${appUrl()}/listings/${booking.listingId}?cancelled=1`,
    },
    { stripeAccount },
  );

  await db.booking.update({
    where: { id: booking.id },
    data: { stripeCheckoutId: session.id, paymentMode: "stripe" },
  });
  if (!session.url) throw new Error("Stripe did not return a Checkout URL");
  return session.url;
}

// ---------------------------------------------------------------------------
// Refunds (on the host's connected account — direct charges)
// ---------------------------------------------------------------------------

export type RefundRequest = {
  bookingId: string;
  paymentIntentId: string;
  /** Host's connected account (the charge lives there). */
  stripeAccount: string;
  amountCents: number;
  /** The charge total and what was already refunded, to tell full from partial refunds. */
  totalCents: number;
  alreadyRefundedCents?: number;
  /** Donation (= application fee) on the charge, and whether it is part of this refund. */
  donationCents: number;
  donationRefunded: boolean;
  /** Who/what triggered it, recorded in Stripe metadata. */
  cancelledBy: string;
  /** Defaults to `refund-<bookingId>`. Same key + same params = same refund on retry / double-submit. */
  idempotencyKey?: string;
};

export type RefundResult = { refundId: string; status: string | null; applicationFeeRefunded: boolean };

/**
 * Refunds a booking payment on the host's account.
 *
 * Direct charges: the refund comes out of the host's Stripe balance. Fairbnb's
 * only cut is the donation (the application fee); when the donation is refunded
 * the platform must hand that fee back to the host, or the host would pay the
 * guest's donation out of pocket.
 *  - Full refund: `refund_application_fee: true` returns the whole fee.
 *  - Partial refund: Stripe would return the fee only *proportionally*, so instead
 *    we refund the exact donation amount via an application-fee refund.
 *
 * Exported with an injectable client for tests.
 */
export async function refundBookingPayment(req: RefundRequest, client: Stripe = stripe()): Promise<RefundResult | null> {
  if (!Number.isInteger(req.amountCents) || req.amountCents < 0) throw new Error("Refund must be a non-negative integer (cents)");
  if (req.amountCents === 0) return null;
  const remaining = req.totalCents - (req.alreadyRefundedCents ?? 0);
  if (req.amountCents > remaining) throw new Error(`Refund ${req.amountCents} exceeds refundable ${remaining}`);
  const isFull = req.amountCents === remaining && (req.alreadyRefundedCents ?? 0) === 0;
  const withFee = req.donationRefunded && req.donationCents > 0;
  const key = req.idempotencyKey ?? `refund-${req.bookingId}`;

  const refund = await client.refunds.create(
    {
      payment_intent: req.paymentIntentId,
      amount: req.amountCents,
      reason: "requested_by_customer",
      ...(withFee && isFull ? { refund_application_fee: true } : {}),
      metadata: { bookingId: req.bookingId, source: "fairbnb", cancelledBy: req.cancelledBy },
    },
    { stripeAccount: req.stripeAccount, idempotencyKey: key },
  );

  let applicationFeeRefunded = withFee && isFull;
  if (withFee && !isFull) {
    // Find the application fee on the charge, then refund exactly the donation from the platform.
    try {
      const pi = await client.paymentIntents.retrieve(
        req.paymentIntentId,
        { expand: ["latest_charge"] },
        { stripeAccount: req.stripeAccount },
      );
      const charge = pi.latest_charge;
      const fee = charge && typeof charge !== "string" ? charge.application_fee : null;
      const feeId = typeof fee === "string" ? fee : (fee?.id ?? null);
      if (!feeId) throw new Error("charge has no application fee");
      await client.applicationFees.createRefund(
        feeId,
        { amount: req.donationCents, metadata: { bookingId: req.bookingId } },
        { idempotencyKey: `${key}-fee` },
      );
      applicationFeeRefunded = true;
    } catch (e) {
      // The guest is refunded either way; this only affects who funds the donation refund.
      console.error(
        `[stripe] ACTION NEEDED: refunded booking ${req.bookingId} but could not return the ${req.donationCents}c donation fee to ${req.stripeAccount}`,
        e,
      );
    }
  }
  return { refundId: refund.id, status: refund.status, applicationFeeRefunded };
}

/** Best-effort: stop an open Checkout Session from being paid after the booking is cancelled. */
export async function expireCheckoutSession(sessionId: string, stripeAccount: string): Promise<void> {
  try {
    await stripe().checkout.sessions.expire(sessionId, {}, { stripeAccount });
  } catch {
    // Already expired / completed. If it was paid, the webhook auto-refunds.
  }
}

// ---------------------------------------------------------------------------
// Direct donations (platform account)
// ---------------------------------------------------------------------------

export const MIN_DONATION_CENTS = 100;
export const MAX_DONATION_CENTS = 1_000_000;

export async function startStripeDonation(amountCents: number, userId: string | null): Promise<string> {
  if (!Number.isInteger(amountCents) || amountCents < MIN_DONATION_CENTS || amountCents > MAX_DONATION_CENTS) {
    throw new Error(`Donation must be between ${formatMoney(MIN_DONATION_CENTS)} and ${formatMoney(MAX_DONATION_CENTS)}`);
  }
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    submit_type: "donate",
    line_items: [line("usd", "Donation to Fairbnb", amountCents, "Keeps Fairbnb free of platform fees for everyone")],
    metadata: { kind: "donation", ...(userId ? { userId } : {}) },
    payment_intent_data: { metadata: { kind: "donation", ...(userId ? { userId } : {}) } },
    success_url: `${appUrl()}/donate?thanks=1`,
    cancel_url: `${appUrl()}/donate`,
  });
  if (!session.url) throw new Error("Stripe did not return a Checkout URL");
  return session.url;
}

// ---------------------------------------------------------------------------
// Webhook handling
// ---------------------------------------------------------------------------

/**
 * Verifies a webhook payload. Stripe signs platform events and Connect
 * (connected-account) events with DIFFERENT secrets when they are configured
 * as separate endpoints, so accept either.
 */
export function constructWebhookEvent(rawBody: string, signature: string): Stripe.Event {
  const secrets = [process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_CONNECT_WEBHOOK_SECRET].filter(
    (s): s is string => Boolean(s),
  );
  if (secrets.length === 0) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  let lastErr: unknown;
  for (const secret of secrets) {
    try {
      return stripe().webhooks.constructEvent(rawBody, signature, secret);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object;
      if (session.payment_status !== "paid") return; // async methods: wait for async_payment_succeeded
      if (event.account && session.metadata?.bookingId) {
        await confirmBookingPaid(session, event.account);
      } else if (!event.account && session.metadata?.kind === "donation") {
        await recordDirectDonation(session);
      }
      return;
    }
    case "checkout.session.expired": {
      const session = event.data.object;
      const bookingId = session.metadata?.bookingId;
      if (!event.account || !bookingId) return;
      // Only cancel if this is still the booking's current session; a newer
      // session may have replaced it.
      await db.booking.updateMany({
        where: { id: bookingId, status: "PENDING_PAYMENT", stripeCheckoutId: session.id },
        data: { status: "CANCELLED", cancelledAt: new Date(), cancelledBy: "system" },
      });
      return;
    }
    case "account.updated": {
      await applyAccountStatus(event.data.object);
      return;
    }
    case "charge.refunded": {
      if (!event.account) return;
      await syncChargeRefunds(event.data.object, event.account);
      return;
    }
    case "refund.created":
    case "refund.updated":
    case "refund.failed":
    case "charge.refund.updated": {
      if (!event.account) return;
      const refund = event.data.object;
      if (refund.status === "failed" || refund.status === "canceled") {
        console.error(`[stripe] ACTION NEEDED: refund ${refund.id} on ${event.account} is ${refund.status}`, refund.failure_reason);
      }
      const chargeId = typeof refund.charge === "string" ? refund.charge : refund.charge?.id;
      if (!chargeId) return;
      const charge = await stripe().charges.retrieve(chargeId, {}, { stripeAccount: event.account });
      await syncChargeRefunds(charge, event.account);
      return;
    }
    default:
      return;
  }
}

async function confirmBookingPaid(session: Stripe.Checkout.Session, accountId: string) {
  const bookingId = session.metadata!.bookingId!;
  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null);

  type Outcome = { kind: "confirmed" } | { kind: "duplicate" } | { kind: "orphan"; totalCents: number; donationCents: number; cancelled: boolean };
  const outcome: Outcome = await db.$transaction(async (tx): Promise<Outcome> => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: { listing: { include: { host: { select: { stripeAccountId: true } } } } },
    });
    if (!booking) throw new Error(`Webhook for unknown booking ${bookingId}`);
    if (booking.listing.host.stripeAccountId !== accountId) {
      throw new Error(`Booking ${bookingId} paid on ${accountId}, which isn't the host's account`);
    }
    if (session.amount_total !== null && session.amount_total !== booking.totalCents) {
      throw new Error(`Booking ${bookingId}: paid ${session.amount_total} but total is ${booking.totalCents}`);
    }

    // Conditional update makes this idempotent: only one delivery flips
    // PENDING_PAYMENT -> CONFIRMED, and only that one records the donation.
    const { count } = await tx.booking.updateMany({
      where: { id: bookingId, status: "PENDING_PAYMENT" },
      data: {
        status: "CONFIRMED",
        paymentMode: "stripe",
        stripeCheckoutId: session.id,
        stripePaymentIntentId: paymentIntentId,
      },
    });
    if (count === 0) {
      // Duplicate delivery of the payment we already recorded (the booking may
      // since have been confirmed, completed, or cancelled+refunded normally).
      if (!paymentIntentId || booking.stripePaymentIntentId === paymentIntentId) return { kind: "duplicate" };
      // A payment we never recorded: it arrived after the booking was cancelled
      // (expired / released dates), or it's a second payment for a confirmed
      // booking. Either way the money is in the host's account: refund it in full.
      return {
        kind: "orphan",
        totalCents: session.amount_total ?? booking.totalCents,
        donationCents: booking.donationCents,
        cancelled: booking.status === "CANCELLED",
      };
    }
    if (booking.donationCents > 0) {
      await tx.donation.create({
        data: {
          userId: booking.guestId,
          bookingId: booking.id,
          amountCents: booking.donationCents,
          currency: booking.currency,
          source: "booking",
        },
      });
    }
    return { kind: "confirmed" };
  });

  if (outcome.kind === "confirmed") {
    await sendBookingConfirmedEmails(bookingId);
    return;
  }
  if (outcome.kind === "orphan") {
    await refundOrphanPayment(bookingId, paymentIntentId!, accountId, outcome);
  }
}

/**
 * Full, idempotent refund of a payment that doesn't belong to a live booking.
 * Throws on failure so the webhook returns 500 and Stripe retries (same
 * idempotency key, so a retry never refunds twice).
 */
async function refundOrphanPayment(
  bookingId: string,
  paymentIntentId: string,
  accountId: string,
  o: { totalCents: number; donationCents: number; cancelled: boolean },
) {
  const result = await refundBookingPayment({
    bookingId,
    paymentIntentId,
    stripeAccount: accountId,
    amountCents: o.totalCents,
    totalCents: o.totalCents,
    donationCents: o.donationCents,
    donationRefunded: o.donationCents > 0,
    cancelledBy: "system",
    idempotencyKey: `refund-${bookingId}-${paymentIntentId}`,
  });
  console.warn(`[stripe] Auto-refunded late/duplicate payment ${paymentIntentId} for booking ${bookingId} (${result?.refundId})`);
  if (!o.cancelled || !result) return; // second payment on a confirmed booking: booking itself is unchanged
  const { count } = await db.booking.updateMany({
    where: { id: bookingId, status: "CANCELLED", stripeRefundId: null },
    data: {
      stripePaymentIntentId: paymentIntentId,
      stripeRefundId: result.refundId,
      refundCents: o.totalCents,
      paymentMode: "stripe",
    },
  });
  if (count === 1) await sendBookingCancelledEmails(bookingId);
}

/**
 * Mirrors a charge's refund state onto its booking. Covers refunds made outside
 * Fairbnb (e.g. from the host's Stripe dashboard): refundCents always tracks
 * charge.amount_refunded, and a full refund we didn't initiate cancels the booking.
 */
export async function syncChargeRefunds(charge: Stripe.Charge, accountId: string): Promise<void> {
  const pi = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!pi) return;
  const booking = await db.booking.findFirst({
    where: { stripePaymentIntentId: pi, listing: { host: { stripeAccountId: accountId } } },
  });
  if (!booking) return;

  await db.booking.update({ where: { id: booking.id }, data: { refundCents: charge.amount_refunded } });

  if (!charge.refunded || booking.status !== "CONFIRMED") return;
  // Fully refunded while still CONFIRMED. If Fairbnb issued the refund, the
  // cancel flow is finishing up and owns the status change; don't race it.
  const refunds = await stripe().refunds.list({ payment_intent: pi, limit: 20 }, { stripeAccount: accountId });
  if (refunds.data.some((r) => r.metadata?.source === "fairbnb")) return;

  const { count } = await db.booking.updateMany({
    where: { id: booking.id, status: "CONFIRMED" },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelledBy: "host", refundCents: charge.amount_refunded },
  });
  if (count === 0) return;
  // Only drop the donation from the ledger if the platform actually gave it back.
  if (booking.donationCents > 0 && charge.application_fee) {
    const feeId = typeof charge.application_fee === "string" ? charge.application_fee : charge.application_fee.id;
    try {
      const fee = await stripe().applicationFees.retrieve(feeId);
      if (fee.amount_refunded >= booking.donationCents) await db.donation.deleteMany({ where: { bookingId: booking.id } });
    } catch (e) {
      console.error(`[stripe] could not check application fee ${feeId} for booking ${booking.id}`, e);
    }
  }
  await sendBookingCancelledEmails(booking.id);
}

async function recordDirectDonation(session: Stripe.Checkout.Session) {
  const amount = session.amount_total ?? 0;
  if (amount <= 0) return;
  // Unique stripeCheckoutId makes duplicate webhook deliveries a no-op.
  await db.donation.upsert({
    where: { stripeCheckoutId: session.id },
    update: {},
    create: {
      userId: session.metadata?.userId || null,
      amountCents: amount,
      currency: session.currency ?? "usd",
      source: "direct",
      stripeCheckoutId: session.id,
    },
  });
}
