/**
 * Fairbnb's cancellation policy ("Flexible"). Pure: no DB, no network, no clock.
 *
 * Guest cancels
 *   - 24 hours or more before check-in (3:00 PM UTC on the check-in day):
 *     refund of everything paid EXCEPT card processing. Stripe keeps its fee when
 *     a payment is refunded, so that money is already gone; it is not kept by the
 *     host or by Fairbnb.
 *   - Less than 24 hours before check-in: the first night is non-refundable
 *     (it's very hard for the host to rebook). Every other night, cleaning, tax
 *     and any donation are refunded. Card processing is not refunded.
 *   - After check-in: guests can't cancel online; contact the host.
 *
 * Host cancels (any time before checkout)
 *   - The guest gets every cent back, card processing included. The host absorbs
 *     Stripe's fee. That's the industry norm and the fair outcome: the guest did
 *     nothing wrong.
 *
 * System (e.g. a payment that arrived for an already-expired booking): full refund.
 *
 * All amounts are integer cents. Refunds never exceed what's still refundable
 * (totalCents - refundCents already refunded).
 */

export const CHECK_IN_HOUR_UTC = 15;
export const CHECK_OUT_HOUR_UTC = 11;
export const FREE_CANCELLATION_HOURS = 24;

export type CancelActor = "guest" | "host" | "system";

export type RefundableBooking = {
  status: "PENDING_PAYMENT" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
  checkIn: Date;
  checkOut: Date;
  nights: number;
  subtotalCents: number;
  cleaningFeeCents: number;
  taxCents: number;
  processingCents: number;
  donationCents: number;
  totalCents: number;
  /** Already refunded (e.g. a partial refund the host made from Stripe). */
  refundCents?: number;
};

export type RefundLine = { label: string; cents: number; refunded: boolean; note?: string };

export type RefundQuote = {
  allowed: boolean;
  /** Human-readable reason; always set (explains the policy applied, or why not allowed). */
  reason: string;
  refundCents: number;
  /** What the guest keeps paying (not refunded). */
  nonRefundableCents: number;
  /** Whether the donation is part of the refund (so the platform's application fee must be returned). */
  donationRefunded: boolean;
  /** "none" = nothing was paid yet (PENDING_PAYMENT), so cancelling moves no money. */
  kind: "full" | "flexible" | "late" | "unpaid" | "none";
  lines: RefundLine[];
};

const HOUR = 3_600_000;

/** Check-in moment: the check-in date (stored as a UTC day) at 15:00 UTC. */
export function checkInAt(checkIn: Date): Date {
  return new Date(Date.UTC(checkIn.getUTCFullYear(), checkIn.getUTCMonth(), checkIn.getUTCDate(), CHECK_IN_HOUR_UTC));
}

export function checkOutAt(checkOut: Date): Date {
  return new Date(Date.UTC(checkOut.getUTCFullYear(), checkOut.getUTCMonth(), checkOut.getUTCDate(), CHECK_OUT_HOUR_UTC));
}

/** The moment free cancellation ends for the guest. */
export function freeCancellationDeadline(checkIn: Date): Date {
  return new Date(checkInAt(checkIn).getTime() - FREE_CANCELLATION_HOURS * HOUR);
}

/** Price of the first night. subtotal = nightly × nights, so this is exact for real bookings. */
export function firstNightCents(b: Pick<RefundableBooking, "subtotalCents" | "nights">): number {
  if (b.nights <= 0) return b.subtotalCents;
  return Math.min(b.subtotalCents, Math.round(b.subtotalCents / b.nights));
}

function notAllowed(reason: string): RefundQuote {
  return { allowed: false, reason, refundCents: 0, nonRefundableCents: 0, donationRefunded: false, kind: "none", lines: [] };
}

export function computeRefund(booking: RefundableBooking, actor: CancelActor, now: Date): RefundQuote {
  const b = booking;
  if (b.status === "CANCELLED") return notAllowed("This reservation is already cancelled.");
  if (b.status === "COMPLETED") return notAllowed("This stay is already completed.");

  if (b.status === "PENDING_PAYMENT") {
    return {
      allowed: true,
      reason: "Nothing has been charged yet, so there's nothing to refund.",
      refundCents: 0,
      nonRefundableCents: 0,
      donationRefunded: false,
      kind: "unpaid",
      lines: [],
    };
  }

  const alreadyRefunded = Math.max(0, b.refundCents ?? 0);
  const refundable = Math.max(0, b.totalCents - alreadyRefunded);
  const cap = (n: number) => Math.max(0, Math.min(n, refundable));

  const nightsLine = (cents: number, refunded: boolean, label?: string): RefundLine => ({
    label: label ?? `${b.nights} night${b.nights === 1 ? "" : "s"}`,
    cents,
    refunded,
  });
  const extras = (): RefundLine[] => [
    ...(b.cleaningFeeCents > 0 ? [{ label: "Cleaning fee", cents: b.cleaningFeeCents, refunded: true }] : []),
    ...(b.taxCents > 0 ? [{ label: "Lodging tax", cents: b.taxCents, refunded: true }] : []),
    ...(b.donationCents > 0 ? [{ label: "Donation to Fairbnb", cents: b.donationCents, refunded: true }] : []),
  ];
  const finish = (kind: RefundQuote["kind"], reason: string, lines: RefundLine[]): RefundQuote => {
    const gross = lines.filter((l) => l.refunded).reduce((s, l) => s + l.cents, 0);
    const refundCents = cap(gross);
    if (alreadyRefunded > 0) {
      lines = [...lines, { label: "Already refunded", cents: alreadyRefunded, refunded: false, note: "Refunded earlier" }];
    }
    return {
      allowed: true,
      reason,
      refundCents,
      nonRefundableCents: b.totalCents - alreadyRefunded - refundCents,
      donationRefunded: b.donationCents > 0 && refundCents > 0,
      kind,
      lines,
    };
  };

  if (actor === "host" || actor === "system") {
    if (actor === "host" && now.getTime() >= checkOutAt(b.checkOut).getTime()) {
      return notAllowed("This stay has already ended.");
    }
    return finish(
      "full",
      actor === "host"
        ? "Host cancellations are refunded in full, including card processing."
        : "Refunded in full.",
      [
        nightsLine(b.subtotalCents, true),
        ...extras(),
        { label: "Card processing", cents: b.processingCents, refunded: true, note: "Paid by the host" },
      ],
    );
  }

  // Guest
  const untilCheckIn = checkInAt(b.checkIn).getTime() - now.getTime();
  if (untilCheckIn <= 0) {
    return notAllowed("Your stay has started, so it can't be cancelled online. Please contact your host.");
  }
  const processingLine: RefundLine = {
    label: "Card processing",
    cents: b.processingCents,
    refunded: false,
    note: "Kept by Stripe, not by your host or Fairbnb",
  };
  if (untilCheckIn >= FREE_CANCELLATION_HOURS * HOUR) {
    return finish("flexible", "Cancelled 24 hours or more before check-in: everything except card processing is refunded.", [
      nightsLine(b.subtotalCents, true),
      ...extras(),
      processingLine,
    ]);
  }
  const first = firstNightCents(b);
  const rest = b.subtotalCents - first;
  const lines: RefundLine[] = [
    { label: "First night", cents: first, refunded: false, note: "Non-refundable within 24 hours of check-in" },
  ];
  if (b.nights > 1) lines.push(nightsLine(rest, true, `Remaining ${b.nights - 1} night${b.nights - 1 === 1 ? "" : "s"}`));
  lines.push(...extras(), processingLine);
  return finish("late", "Cancelled less than 24 hours before check-in: the first night is non-refundable.", lines);
}
