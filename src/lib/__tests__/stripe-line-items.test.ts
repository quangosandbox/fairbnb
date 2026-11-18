import { describe, expect, it, vi } from "vitest";

// stripe.ts imports the Prisma client; keep tests offline.
vi.mock("@/lib/db", () => ({ db: {} }));

import { calculatePrice } from "@/lib/pricing";
import { accountCanTakePayments, buildCheckoutLineItems, lineItemsTotal, type CheckoutPricing } from "@/lib/stripe";

function pricing(input: Parameters<typeof calculatePrice>[0], currency = "usd"): CheckoutPricing {
  return { ...calculatePrice(input), currency };
}

const names = (items: ReturnType<typeof buildCheckoutLineItems>) =>
  items.map((li) => (li.price_data!.product_data as { name: string }).name);
const amounts = (items: ReturnType<typeof buildCheckoutLineItems>) => items.map((li) => li.price_data!.unit_amount);

describe("buildCheckoutLineItems", () => {
  it("emits one line per cost, in order, summing to the total", () => {
    const p = pricing({ nightlyPriceCents: 12_500, cleaningFeeCents: 6_000, taxRateBps: 1_200, nights: 3, donationCents: 500 });
    const items = buildCheckoutLineItems(p);
    expect(names(items)).toEqual([
      "3 nights × $125",
      "Cleaning fee",
      "Lodging tax",
      "Card processing — charged by Stripe, not Fairbnb",
      "Donation to Fairbnb",
    ]);
    expect(amounts(items)).toEqual([p.subtotalCents, p.cleaningFeeCents, p.taxCents, p.processingCents, p.donationCents]);
    expect(lineItemsTotal(items)).toBe(p.totalCents);
    for (const li of items) {
      expect(li.quantity).toBe(1);
      expect(li.price_data!.currency).toBe("usd");
      expect(Number.isInteger(li.price_data!.unit_amount)).toBe(true);
    }
  });

  it("omits zero cleaning, tax and donation lines", () => {
    const p = pricing({ nightlyPriceCents: 8_999, cleaningFeeCents: 0, taxRateBps: 0, nights: 1 });
    const items = buildCheckoutLineItems(p);
    expect(names(items)).toEqual(["1 night × $89.99", "Card processing — charged by Stripe, not Fairbnb"]);
    expect(lineItemsTotal(items)).toBe(p.totalCents);
  });

  it("never contains a platform-fee line", () => {
    const p = pricing({ nightlyPriceCents: 20_000, cleaningFeeCents: 1_000, taxRateBps: 900, nights: 4, donationCents: 1_000 });
    expect(names(buildCheckoutLineItems(p)).some((n) => /platform|service fee/i.test(n))).toBe(false);
  });

  it("sums to the total across many bookings", () => {
    for (const nights of [1, 2, 7, 31]) {
      for (const taxRateBps of [0, 737, 1_500]) {
        for (const donationCents of [0, 1, 2_500]) {
          const p = pricing({ nightlyPriceCents: 13_337, cleaningFeeCents: 4_250, taxRateBps, nights, donationCents });
          expect(lineItemsTotal(buildCheckoutLineItems(p))).toBe(p.totalCents);
        }
      }
    }
  });

  it("throws when lines don't add up to the stored total", () => {
    const p = pricing({ nightlyPriceCents: 10_000, cleaningFeeCents: 0, taxRateBps: 0, nights: 2 });
    expect(() => buildCheckoutLineItems({ ...p, totalCents: p.totalCents + 1 })).toThrow(/sum to/);
  });

  it("refuses a non-zero platform fee", () => {
    const p = pricing({ nightlyPriceCents: 10_000, cleaningFeeCents: 0, taxRateBps: 0, nights: 2 });
    expect(() => buildCheckoutLineItems({ ...p, platformFeeCents: 100, totalCents: p.totalCents + 100 })).toThrow(/platform fee/);
  });

  it("refuses zero-night or non-integer bookings", () => {
    const zero = pricing({ nightlyPriceCents: 10_000, cleaningFeeCents: 0, taxRateBps: 0, nights: 0 });
    expect(() => buildCheckoutLineItems(zero)).toThrow(/at least one/);
    const p = pricing({ nightlyPriceCents: 10_000, cleaningFeeCents: 0, taxRateBps: 0, nights: 1 });
    expect(() => buildCheckoutLineItems({ ...p, taxCents: 0.5 })).toThrow(/integers/);
  });

  it("lower-cases the currency for Stripe", () => {
    const p = pricing({ nightlyPriceCents: 10_000, cleaningFeeCents: 0, taxRateBps: 0, nights: 1 }, "USD");
    expect(buildCheckoutLineItems(p).every((li) => li.price_data!.currency === "usd")).toBe(true);
  });
});

describe("accountCanTakePayments", () => {
  it("requires both charges_enabled and details_submitted", () => {
    expect(accountCanTakePayments({ charges_enabled: true, details_submitted: true })).toBe(true);
    expect(accountCanTakePayments({ charges_enabled: true, details_submitted: false })).toBe(false);
    expect(accountCanTakePayments({ charges_enabled: false, details_submitted: true })).toBe(false);
  });
});
