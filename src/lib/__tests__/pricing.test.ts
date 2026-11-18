import { describe, expect, it } from "vitest";
import {
  PLATFORM_FEE_CENTS,
  PROCESSING_FIXED_CENTS,
  PROCESSING_PERCENT,
  calculatePrice,
  processingFeeFor,
} from "@/lib/pricing";

/** Stripe's fee on a charge, under either rounding convention (we must survive both). */
const stripeFeeRounded = (gross: number) => Math.round(gross * PROCESSING_PERCENT) + PROCESSING_FIXED_CENTS;
const stripeFeeCeil = (gross: number) => Math.ceil(gross * PROCESSING_PERCENT) + PROCESSING_FIXED_CENTS;

describe("processingFeeFor", () => {
  it("is 0 for nothing to charge", () => {
    expect(processingFeeFor(0)).toBe(0);
    expect(processingFeeFor(-5)).toBe(0);
  });

  it("makes the payee whole after Stripe's 2.9% + 30¢ for every amount from 1¢ to $500, and over-collects by at most 1¢", () => {
    for (let net = 1; net <= 50_000; net++) {
      const gross = net + processingFeeFor(net);
      for (const fee of [stripeFeeRounded(gross), stripeFeeCeil(gross)]) {
        const received = gross - fee;
        expect(received).toBeGreaterThanOrEqual(net);
        expect(received - net).toBeLessThanOrEqual(1);
      }
    }
  });

  it.each([100, 9_999, 123_456, 1_000_000, 5_000_000])("makes the payee whole for %i¢", (net) => {
    const gross = net + processingFeeFor(net);
    expect(gross - stripeFeeCeil(gross)).toBeGreaterThanOrEqual(net);
  });
});

describe("calculatePrice", () => {
  const cases = [
    { nightlyPriceCents: 10_000, cleaningFeeCents: 5_000, taxRateBps: 1_200, nights: 3, donationCents: 0 },
    { nightlyPriceCents: 8_950, cleaningFeeCents: 0, taxRateBps: 0, nights: 1 },
    { nightlyPriceCents: 25_000, cleaningFeeCents: 12_500, taxRateBps: 1_475, nights: 7, donationCents: 1_000 },
    { nightlyPriceCents: 4_100, cleaningFeeCents: 2_000, taxRateBps: 600, nights: 30, donationCents: 333 },
    { nightlyPriceCents: 99, cleaningFeeCents: 1, taxRateBps: 1, nights: 2, donationCents: 0 },
  ];

  it.each(cases)("platform fee is 0 and total = sum of lines (%o)", (input) => {
    const p = calculatePrice(input);
    expect(p.platformFeeCents).toBe(0);
    expect(PLATFORM_FEE_CENTS).toBe(0);
    expect(p.subtotalCents).toBe(input.nightlyPriceCents * input.nights);
    expect(p.totalCents).toBe(
      p.subtotalCents + p.cleaningFeeCents + p.taxCents + p.processingCents + p.platformFeeCents + p.donationCents,
    );
    expect(p.hostPayoutCents).toBe(p.subtotalCents + p.cleaningFeeCents + p.taxCents);
  });

  it.each(cases)("after Stripe takes its fee and the donation goes to Fairbnb, host nets their full payout (%o)", (input) => {
    const p = calculatePrice(input);
    for (const fee of [stripeFeeRounded(p.totalCents), stripeFeeCeil(p.totalCents)]) {
      // Direct charge: fee comes out of the host's account; application fee (= donation) goes to Fairbnb.
      const hostNet = p.totalCents - fee - p.donationCents;
      expect(hostNet).toBeGreaterThanOrEqual(p.hostPayoutCents);
      expect(hostNet - p.hostPayoutCents).toBeLessThanOrEqual(1);
    }
  });

  it("holds across a sweep of nightly prices, stays, taxes and donations", () => {
    for (const nightly of [1_000, 4_999, 7_777, 15_000, 49_900]) {
      for (const nights of [1, 2, 5, 14, 28]) {
        for (const taxRateBps of [0, 650, 1_350]) {
          for (const donationCents of [0, 500, 2_345]) {
            const p = calculatePrice({ nightlyPriceCents: nightly, cleaningFeeCents: 3_500, taxRateBps, nights, donationCents });
            const hostNet = p.totalCents - stripeFeeCeil(p.totalCents) - p.donationCents;
            expect(hostNet).toBeGreaterThanOrEqual(p.hostPayoutCents);
            expect(p.platformFeeCents).toBe(0);
          }
        }
      }
    }
  });

  it("zero nights costs nothing (no cleaning fee, tax or processing)", () => {
    const p = calculatePrice({ nightlyPriceCents: 10_000, cleaningFeeCents: 5_000, taxRateBps: 1_000, nights: 0 });
    expect(p).toMatchObject({
      nights: 0,
      subtotalCents: 0,
      cleaningFeeCents: 0,
      taxCents: 0,
      processingCents: 0,
      platformFeeCents: 0,
      donationCents: 0,
      totalCents: 0,
      hostPayoutCents: 0,
    });
  });

  it("clamps negative / fractional nights and donations", () => {
    expect(calculatePrice({ nightlyPriceCents: 10_000, cleaningFeeCents: 0, taxRateBps: 0, nights: -2 }).totalCents).toBe(0);
    const p = calculatePrice({ nightlyPriceCents: 10_000, cleaningFeeCents: 0, taxRateBps: 0, nights: 2.9, donationCents: -100 });
    expect(p.nights).toBe(2);
    expect(p.donationCents).toBe(0);
  });
});
