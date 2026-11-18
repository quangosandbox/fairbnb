/**
 * The single source of truth for what a stay costs.
 *
 * Fairbnb's promise:
 *   - Platform fee is ALWAYS zero, for guests and for hosts.
 *   - The price a guest sees in search results is the total they pay.
 *   - The only costs on top of the host's price are ones we can't legally or
 *     physically avoid (lodging tax the host must collect, and card processing
 *     charged by the payment network) — and each is shown as its own line.
 *   - Hosts receive every cent of their nightly price + cleaning fee + tax.
 */

// Card processing is charged by Stripe, not Fairbnb. US standard online rate.
// Passed through at cost so the host is made whole; Fairbnb keeps nothing.
export const PROCESSING_PERCENT = 0.029;
export const PROCESSING_FIXED_CENTS = 30;

export const PLATFORM_FEE_CENTS = 0;

export type PriceInput = {
  nightlyPriceCents: number;
  cleaningFeeCents: number;
  taxRateBps: number;
  nights: number;
  donationCents?: number;
};

export type PriceBreakdown = {
  nights: number;
  nightlyPriceCents: number;
  subtotalCents: number;
  cleaningFeeCents: number;
  taxCents: number;
  processingCents: number;
  platformFeeCents: number;
  donationCents: number;
  totalCents: number;
  /** What lands in the host's account after Stripe takes its processing fee. */
  hostPayoutCents: number;
};

/**
 * Gross-up so that after Stripe deducts (gross * pct + fixed) the host still
 * nets exactly `net`. Solving gross - (gross*p + f) = net gives
 * gross = (net + f) / (1 - p).
 */
export function processingFeeFor(netCents: number): number {
  if (netCents <= 0) return 0;
  const gross = Math.ceil((netCents + PROCESSING_FIXED_CENTS) / (1 - PROCESSING_PERCENT));
  return gross - netCents;
}

export function calculatePrice(input: PriceInput): PriceBreakdown {
  const nights = Math.max(0, Math.floor(input.nights));
  const subtotalCents = input.nightlyPriceCents * nights;
  const cleaningFeeCents = nights > 0 ? input.cleaningFeeCents : 0;
  const taxCents = Math.round(((subtotalCents + cleaningFeeCents) * input.taxRateBps) / 10_000);
  const hostPayoutCents = subtotalCents + cleaningFeeCents + taxCents;
  const donationCents = Math.max(0, Math.floor(input.donationCents ?? 0));
  // Processing applies to everything that moves through the card, donation included.
  const processingCents = processingFeeFor(hostPayoutCents + donationCents);
  const totalCents = hostPayoutCents + processingCents + PLATFORM_FEE_CENTS + donationCents;
  return {
    nights,
    nightlyPriceCents: input.nightlyPriceCents,
    subtotalCents,
    cleaningFeeCents,
    taxCents,
    processingCents,
    platformFeeCents: PLATFORM_FEE_CENTS,
    donationCents,
    totalCents,
    hostPayoutCents,
  };
}

/** Rough comparison: typical big-platform fees (guest service fee ~14%, host fee ~3%). */
export function typicalPlatformComparison(b: PriceBreakdown) {
  const base = b.subtotalCents + b.cleaningFeeCents;
  const guestServiceFee = Math.round(base * 0.142);
  const hostServiceFee = Math.round(base * 0.03);
  return {
    guestPaysCents: base + b.taxCents + guestServiceFee,
    hostGetsCents: base + b.taxCents - hostServiceFee,
    platformKeepsCents: guestServiceFee + hostServiceFee,
  };
}

export function nightsBetween(checkIn: Date, checkOut: Date): number {
  const ms = Date.UTC(checkOut.getUTCFullYear(), checkOut.getUTCMonth(), checkOut.getUTCDate()) -
    Date.UTC(checkIn.getUTCFullYear(), checkIn.getUTCMonth(), checkIn.getUTCDate());
  return Math.round(ms / 86_400_000);
}

export function formatMoney(cents: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}
