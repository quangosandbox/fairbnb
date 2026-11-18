import { beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

// ---- Mocks -----------------------------------------------------------------
// A fake Stripe client: every call is recorded so we can assert on exactly
// what would be sent to Stripe.
const fake = vi.hoisted(() => ({
  refunds: { create: vi.fn(), list: vi.fn() },
  paymentIntents: { retrieve: vi.fn() },
  applicationFees: { createRefund: vi.fn(), retrieve: vi.fn() },
  charges: { retrieve: vi.fn() },
  checkout: { sessions: { expire: vi.fn() } },
}));
vi.mock("stripe", () => ({
  default: vi.fn(function FakeStripe() {
    return fake;
  }),
}));

const db = vi.hoisted(() => {
  const booking = { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() };
  const donation = { create: vi.fn(), deleteMany: vi.fn() };
  const client = {
    booking,
    donation,
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn({ booking, donation })),
  };
  return client;
});
vi.mock("@/lib/db", () => ({ db }));

const emails = vi.hoisted(() => ({ sendBookingConfirmedEmails: vi.fn(), sendBookingCancelledEmails: vi.fn() }));
vi.mock("@/lib/booking-emails", () => emails);

import { handleStripeEvent, refundBookingPayment, type RefundRequest } from "@/lib/stripe";

process.env.STRIPE_SECRET_KEY = "sk_test_fake";
const client = fake as unknown as Stripe;

beforeEach(() => {
  vi.clearAllMocks();
  fake.refunds.create.mockResolvedValue({ id: "re_1", status: "succeeded" });
  fake.paymentIntents.retrieve.mockResolvedValue({ id: "pi_1", latest_charge: { id: "ch_1", application_fee: "fee_1" } });
  fake.applicationFees.createRefund.mockResolvedValue({ id: "fr_1" });
});

const base: RefundRequest = {
  bookingId: "bk_1",
  paymentIntentId: "pi_1",
  stripeAccount: "acct_host",
  amountCents: 0,
  totalCents: 47_000,
  donationCents: 500,
  donationRefunded: true,
  cancelledBy: "guest",
};

describe("refundBookingPayment", () => {
  it("full refund (host cancel): refunds the whole charge on the host's account and returns the application fee", async () => {
    const r = await refundBookingPayment({ ...base, amountCents: 47_000, cancelledBy: "host" }, client);
    expect(fake.refunds.create).toHaveBeenCalledTimes(1);
    expect(fake.refunds.create).toHaveBeenCalledWith(
      {
        payment_intent: "pi_1",
        amount: 47_000,
        reason: "requested_by_customer",
        refund_application_fee: true,
        metadata: { bookingId: "bk_1", source: "fairbnb", cancelledBy: "host" },
      },
      { stripeAccount: "acct_host", idempotencyKey: "refund-bk_1" },
    );
    // No separate fee refund needed.
    expect(fake.applicationFees.createRefund).not.toHaveBeenCalled();
    expect(r).toEqual({ refundId: "re_1", status: "succeeded", applicationFeeRefunded: true });
  });

  it("partial refund with donation: no proportional fee refund; returns exactly the donation from the platform", async () => {
    const r = await refundBookingPayment({ ...base, amountCents: 45_000 }, client);
    const [params, opts] = fake.refunds.create.mock.calls[0];
    expect(params).not.toHaveProperty("refund_application_fee");
    expect(params.amount).toBe(45_000);
    expect(opts).toEqual({ stripeAccount: "acct_host", idempotencyKey: "refund-bk_1" });
    expect(fake.paymentIntents.retrieve).toHaveBeenCalledWith("pi_1", { expand: ["latest_charge"] }, { stripeAccount: "acct_host" });
    // Fee refund happens on the PLATFORM (no stripeAccount), for the donation amount.
    expect(fake.applicationFees.createRefund).toHaveBeenCalledWith(
      "fee_1",
      { amount: 500, metadata: { bookingId: "bk_1" } },
      { idempotencyKey: "refund-bk_1-fee" },
    );
    expect(r?.applicationFeeRefunded).toBe(true);
  });

  it("no donation: plain refund, no fee handling", async () => {
    await refundBookingPayment({ ...base, amountCents: 40_000, donationCents: 0, donationRefunded: false }, client);
    expect(fake.refunds.create.mock.calls[0][0]).not.toHaveProperty("refund_application_fee");
    expect(fake.paymentIntents.retrieve).not.toHaveBeenCalled();
    expect(fake.applicationFees.createRefund).not.toHaveBeenCalled();
  });

  it("a failed fee refund doesn't undo the guest's refund", async () => {
    fake.applicationFees.createRefund.mockRejectedValue(new Error("boom"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await refundBookingPayment({ ...base, amountCents: 45_000 }, client);
    expect(r).toMatchObject({ refundId: "re_1", applicationFeeRefunded: false });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("zero amount makes no Stripe call; over-refund and bad amounts throw", async () => {
    expect(await refundBookingPayment({ ...base, amountCents: 0 }, client)).toBeNull();
    expect(fake.refunds.create).not.toHaveBeenCalled();
    await expect(refundBookingPayment({ ...base, amountCents: 47_001 }, client)).rejects.toThrow(/exceeds/);
    await expect(refundBookingPayment({ ...base, amountCents: 10_000, alreadyRefundedCents: 40_000 }, client)).rejects.toThrow(/exceeds/);
    await expect(refundBookingPayment({ ...base, amountCents: 1.5 }, client)).rejects.toThrow(/integer/);
  });

  it("propagates Stripe errors so the caller doesn't mark the booking cancelled", async () => {
    fake.refunds.create.mockRejectedValue(new Error("insufficient balance"));
    await expect(refundBookingPayment({ ...base, amountCents: 47_000 }, client)).rejects.toThrow("insufficient balance");
  });

  it("uses a custom idempotency key when given", async () => {
    await refundBookingPayment({ ...base, amountCents: 47_000, idempotencyKey: "refund-bk_1-pi_9" }, client);
    expect(fake.refunds.create.mock.calls[0][1]).toEqual({ stripeAccount: "acct_host", idempotencyKey: "refund-bk_1-pi_9" });
  });
});

// ---- Webhook handling ---------------------------------------------------------

function sessionEvent(over: Partial<Stripe.Checkout.Session> = {}): Stripe.Event {
  return {
    type: "checkout.session.completed",
    account: "acct_host",
    data: {
      object: {
        id: "cs_1",
        payment_status: "paid",
        payment_intent: "pi_late",
        amount_total: 47_000,
        metadata: { bookingId: "bk_1" },
        ...over,
      },
    },
  } as unknown as Stripe.Event;
}

const dbBooking = (over: Record<string, unknown> = {}) => ({
  id: "bk_1",
  guestId: "u_guest",
  status: "PENDING_PAYMENT",
  totalCents: 47_000,
  donationCents: 500,
  currency: "usd",
  stripePaymentIntentId: null,
  listing: { host: { stripeAccountId: "acct_host" } },
  ...over,
});

describe("handleStripeEvent: checkout.session.completed", () => {
  it("confirms, records the donation and sends the confirmation email once", async () => {
    db.booking.findUnique.mockResolvedValue(dbBooking());
    db.booking.updateMany.mockResolvedValue({ count: 1 });
    await handleStripeEvent(sessionEvent());
    expect(db.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "bk_1", status: "PENDING_PAYMENT" } }),
    );
    expect(db.donation.create).toHaveBeenCalledTimes(1);
    expect(emails.sendBookingConfirmedEmails).toHaveBeenCalledWith("bk_1");
    expect(fake.refunds.create).not.toHaveBeenCalled();
  });

  it("payment for a CANCELLED booking is refunded in full, idempotently", async () => {
    db.booking.findUnique.mockResolvedValue(dbBooking({ status: "CANCELLED" }));
    db.booking.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await handleStripeEvent(sessionEvent());
    warn.mockRestore();
    expect(fake.refunds.create).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: "pi_late", amount: 47_000, refund_application_fee: true }),
      { stripeAccount: "acct_host", idempotencyKey: "refund-bk_1-pi_late" },
    );
    expect(db.booking.updateMany).toHaveBeenLastCalledWith({
      where: { id: "bk_1", status: "CANCELLED", stripeRefundId: null },
      data: { stripePaymentIntentId: "pi_late", stripeRefundId: "re_1", refundCents: 47_000, paymentMode: "stripe" },
    });
    expect(db.donation.create).not.toHaveBeenCalled();
    expect(emails.sendBookingCancelledEmails).toHaveBeenCalledWith("bk_1");
  });

  it("duplicate delivery of an already-recorded payment never refunds (even after the booking was cancelled)", async () => {
    db.booking.findUnique.mockResolvedValue(dbBooking({ status: "CANCELLED", stripePaymentIntentId: "pi_late" }));
    db.booking.updateMany.mockResolvedValue({ count: 0 });
    await handleStripeEvent(sessionEvent());
    expect(fake.refunds.create).not.toHaveBeenCalled();
    expect(emails.sendBookingConfirmedEmails).not.toHaveBeenCalled();
  });

  it("a Stripe failure while auto-refunding throws (webhook returns 500 → Stripe retries)", async () => {
    db.booking.findUnique.mockResolvedValue(dbBooking({ status: "CANCELLED" }));
    db.booking.updateMany.mockResolvedValue({ count: 0 });
    fake.refunds.create.mockRejectedValue(new Error("stripe down"));
    await expect(handleStripeEvent(sessionEvent())).rejects.toThrow("stripe down");
  });
});

describe("handleStripeEvent: charge.refunded", () => {
  const chargeEvent = (over: Record<string, unknown>) =>
    ({
      type: "charge.refunded",
      account: "acct_host",
      data: { object: { id: "ch_1", payment_intent: "pi_1", amount_refunded: 47_000, refunded: true, application_fee: "fee_1", ...over } },
    }) as unknown as Stripe.Event;

  it("records amount_refunded; a full refund from the host's dashboard cancels the booking", async () => {
    db.booking.findFirst.mockResolvedValue(dbBooking({ status: "CONFIRMED", stripePaymentIntentId: "pi_1" }));
    db.booking.updateMany.mockResolvedValue({ count: 1 });
    fake.refunds.list.mockResolvedValue({ data: [{ id: "re_x", metadata: {} }] });
    fake.applicationFees.retrieve.mockResolvedValue({ id: "fee_1", amount_refunded: 500 });
    await handleStripeEvent(chargeEvent({}));
    expect(db.booking.update).toHaveBeenCalledWith({ where: { id: "bk_1" }, data: { refundCents: 47_000 } });
    expect(db.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "bk_1", status: "CONFIRMED" }, data: expect.objectContaining({ status: "CANCELLED", cancelledBy: "host" }) }),
    );
    expect(db.donation.deleteMany).toHaveBeenCalledWith({ where: { bookingId: "bk_1" } });
    expect(emails.sendBookingCancelledEmails).toHaveBeenCalledWith("bk_1");
  });

  it("refunds Fairbnb issued itself are left to the cancel flow", async () => {
    db.booking.findFirst.mockResolvedValue(dbBooking({ status: "CONFIRMED", stripePaymentIntentId: "pi_1" }));
    fake.refunds.list.mockResolvedValue({ data: [{ id: "re_1", metadata: { source: "fairbnb" } }] });
    await handleStripeEvent(chargeEvent({}));
    expect(db.booking.update).toHaveBeenCalledTimes(1);
    expect(db.booking.updateMany).not.toHaveBeenCalled();
  });

  it("partial refunds only update refundCents", async () => {
    db.booking.findFirst.mockResolvedValue(dbBooking({ status: "CONFIRMED", stripePaymentIntentId: "pi_1" }));
    await handleStripeEvent(chargeEvent({ amount_refunded: 5_000, refunded: false }));
    expect(db.booking.update).toHaveBeenCalledWith({ where: { id: "bk_1" }, data: { refundCents: 5_000 } });
    expect(fake.refunds.list).not.toHaveBeenCalled();
    expect(db.booking.updateMany).not.toHaveBeenCalled();
  });
});
