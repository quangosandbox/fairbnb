import "server-only";
import Stripe from "stripe";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/payments";
import { formatMoney } from "@/lib/pricing";

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
        data: { status: "CANCELLED" },
      });
      return;
    }
    case "account.updated": {
      await applyAccountStatus(event.data.object);
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

  await db.$transaction(async (tx) => {
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
      if (booking.status === "CONFIRMED" || booking.status === "COMPLETED") return; // duplicate delivery
      // Paid for a booking that was already cancelled (e.g. expired, or the
      // dates were released). Money is in the host's account: needs a refund.
      console.error(
        `[stripe] Booking ${bookingId} was paid (PI ${paymentIntentId}, account ${accountId}) but is ${booking.status}; refund required`,
      );
      return;
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
  });
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
