import { describe, expect, it } from "vitest";
import { calculatePrice } from "@/lib/pricing";
import {
  checkInAt,
  computeRefund,
  firstNightCents,
  freeCancellationDeadline,
  type RefundableBooking,
} from "@/lib/cancellation";

const day = (s: string) => new Date(`${s}T00:00:00.000Z`);

function booking(over: Partial<RefundableBooking> & { nightly?: number; cleaning?: number; taxBps?: number; donation?: number } = {}): RefundableBooking {
  const nights = over.nights ?? 3;
  const p = calculatePrice({
    nightlyPriceCents: over.nightly ?? 12_500,
    cleaningFeeCents: over.cleaning ?? 6_000,
    taxRateBps: over.taxBps ?? 1_200,
    nights,
    donationCents: over.donation ?? 500,
  });
  return {
    status: "CONFIRMED",
    checkIn: day("2027-06-10"),
    checkOut: day("2027-06-13"),
    ...p,
    ...over,
  };
}

const at = (iso: string) => new Date(iso);

describe("policy clock", () => {
  it("check-in is 15:00 UTC on the check-in day; free cancellation ends 24h before", () => {
    expect(checkInAt(day("2027-06-10")).toISOString()).toBe("2027-06-10T15:00:00.000Z");
    expect(freeCancellationDeadline(day("2027-06-10")).toISOString()).toBe("2027-06-09T15:00:00.000Z");
  });
});

describe("computeRefund — guest", () => {
  it("≥ 24h before check-in: refunds everything except card processing", () => {
    const b = booking();
    const q = computeRefund(b, "guest", at("2027-05-01T12:00:00Z"));
    expect(q.allowed).toBe(true);
    expect(q.kind).toBe("flexible");
    expect(q.refundCents).toBe(b.subtotalCents + b.cleaningFeeCents + b.taxCents + b.donationCents);
    expect(q.refundCents).toBe(b.totalCents - b.processingCents);
    expect(q.nonRefundableCents).toBe(b.processingCents);
    expect(q.donationRefunded).toBe(true);
    const proc = q.lines.find((l) => l.label === "Card processing")!;
    expect(proc.refunded).toBe(false);
    expect(proc.note).toMatch(/Stripe/);
  });

  it("exactly 24h before check-in still counts as free cancellation", () => {
    const b = booking();
    expect(computeRefund(b, "guest", at("2027-06-09T15:00:00Z")).kind).toBe("flexible");
    expect(computeRefund(b, "guest", at("2027-06-09T15:00:00.001Z")).kind).toBe("late");
  });

  it("< 24h before check-in: first night non-refundable, rest refunded", () => {
    const b = booking();
    const q = computeRefund(b, "guest", at("2027-06-10T09:00:00Z"));
    expect(q.allowed).toBe(true);
    expect(q.kind).toBe("late");
    expect(q.refundCents).toBe(2 * 12_500 + b.cleaningFeeCents + b.taxCents + b.donationCents);
    expect(q.nonRefundableCents).toBe(12_500 + b.processingCents);
    expect(q.refundCents + q.nonRefundableCents).toBe(b.totalCents);
    expect(q.lines[0]).toMatchObject({ label: "First night", cents: 12_500, refunded: false });
  });

  it("< 24h on a one-night stay refunds only cleaning, tax and donation", () => {
    const b = booking({ nights: 1, checkOut: day("2027-06-11") });
    const q = computeRefund(b, "guest", at("2027-06-10T14:59:00Z"));
    expect(q.refundCents).toBe(b.cleaningFeeCents + b.taxCents + b.donationCents);
    expect(q.lines.some((l) => l.label.startsWith("Remaining"))).toBe(false);
  });

  it("after check-in: guest can't self-cancel", () => {
    const q = computeRefund(booking(), "guest", at("2027-06-10T15:00:00Z"));
    expect(q.allowed).toBe(false);
    expect(q.refundCents).toBe(0);
    expect(q.reason).toMatch(/contact your host/i);
  });

  it("no donation → donationRefunded false and no donation line", () => {
    const q = computeRefund(booking({ donation: 0 }), "guest", at("2027-05-01T00:00:00Z"));
    expect(q.donationRefunded).toBe(false);
    expect(q.lines.some((l) => l.label.includes("Donation"))).toBe(false);
  });
});

describe("computeRefund — host and system", () => {
  it("host cancels before check-in: full refund incl. processing", () => {
    const b = booking();
    const q = computeRefund(b, "host", at("2027-06-10T14:00:00Z"));
    expect(q).toMatchObject({ allowed: true, kind: "full", refundCents: b.totalCents, nonRefundableCents: 0, donationRefunded: true });
    expect(q.lines.find((l) => l.label === "Card processing")!.refunded).toBe(true);
  });

  it("host can cancel mid-stay but not after checkout (11:00 UTC)", () => {
    const b = booking();
    expect(computeRefund(b, "host", at("2027-06-12T10:00:00Z")).refundCents).toBe(b.totalCents);
    expect(computeRefund(b, "host", at("2027-06-13T11:00:00Z")).allowed).toBe(false);
  });

  it("system refunds in full regardless of time", () => {
    const b = booking();
    expect(computeRefund(b, "system", at("2030-01-01T00:00:00Z")).refundCents).toBe(b.totalCents);
  });
});

describe("computeRefund — status and caps", () => {
  it("PENDING_PAYMENT: allowed, nothing to refund", () => {
    const q = computeRefund(booking({ status: "PENDING_PAYMENT" }), "guest", at("2027-05-01T00:00:00Z"));
    expect(q).toMatchObject({ allowed: true, kind: "unpaid", refundCents: 0, donationRefunded: false });
  });

  it("CANCELLED and COMPLETED cannot be cancelled", () => {
    expect(computeRefund(booking({ status: "CANCELLED" }), "host", at("2027-05-01T00:00:00Z")).allowed).toBe(false);
    expect(computeRefund(booking({ status: "COMPLETED" }), "host", at("2027-05-01T00:00:00Z")).allowed).toBe(false);
  });

  it("never refunds more than what is still refundable", () => {
    const b = booking({ refundCents: 10_000 });
    const q = computeRefund(b, "host", at("2027-05-01T00:00:00Z"));
    expect(q.refundCents).toBe(b.totalCents - 10_000);
    expect(q.nonRefundableCents).toBe(0);
    const g = computeRefund(booking({ refundCents: 999_999 }), "guest", at("2027-05-01T00:00:00Z"));
    expect(g.refundCents).toBe(0);
    expect(g.donationRefunded).toBe(false);
  });
});

describe("rounding", () => {
  it("first night is the rounded nightly share and never exceeds the subtotal", () => {
    expect(firstNightCents({ subtotalCents: 10_000, nights: 3 })).toBe(3_333);
    expect(firstNightCents({ subtotalCents: 20_000, nights: 3 })).toBe(6_667);
    expect(firstNightCents({ subtotalCents: 500, nights: 0 })).toBe(500);
  });

  it("all amounts are integers and refund + non-refundable = total for odd prices", () => {
    for (const nightly of [8_999, 10_001, 3_333]) {
      for (const nights of [1, 2, 7]) {
        const b = booking({ nightly, nights, taxBps: 1_175, cleaning: 4_321, donation: 137 });
        for (const [actor, when] of [
          ["guest", "2027-05-01T00:00:00Z"],
          ["guest", "2027-06-10T08:00:00Z"],
          ["host", "2027-06-10T08:00:00Z"],
        ] as const) {
          const q = computeRefund(b, actor, at(when));
          expect(Number.isInteger(q.refundCents)).toBe(true);
          expect(q.refundCents + q.nonRefundableCents).toBe(b.totalCents);
          expect(q.refundCents).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });
});
