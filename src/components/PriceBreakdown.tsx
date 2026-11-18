import { formatMoney, type PriceBreakdown as PB } from "@/lib/pricing";

export function PriceBreakdown({ price, currency = "usd", taxRateBps }: { price: PB; currency?: string; taxRateBps?: number }) {
  const m = (c: number) => formatMoney(c, currency);
  const row = (label: React.ReactNode, value: string, hint?: string) => (
    <div className="flex justify-between gap-4 py-1">
      <div>
        <span>{label}</span>
        {hint && <p className="text-xs text-neutral-500">{hint}</p>}
      </div>
      <span className="shrink-0">{value}</span>
    </div>
  );
  return (
    <div className="text-sm">
      {row(`${m(price.nightlyPriceCents)} × ${price.nights} night${price.nights === 1 ? "" : "s"}`, m(price.subtotalCents), "Goes to the host")}
      {price.cleaningFeeCents > 0 && row("Cleaning", m(price.cleaningFeeCents), "Set by the host, goes to the host")}
      {price.taxCents > 0 &&
        row(
          `Lodging tax${taxRateBps ? ` (${(taxRateBps / 100).toFixed(2).replace(/\.?0+$/, "")}%)` : ""}`,
          m(price.taxCents),
          "Required by local law, remitted by the host",
        )}
      {row("Card processing", m(price.processingCents), "Charged by Stripe at cost (2.9% + 30¢). Fairbnb keeps none of it.")}
      {row(<span className="font-semibold text-brand-700">Fairbnb fee</span>, m(0))}
      {price.donationCents > 0 && row("Your donation to Fairbnb", m(price.donationCents), "Optional. Thank you!")}
      <div className="mt-2 flex justify-between border-t border-neutral-200 pt-3 text-base font-bold">
        <span>Total</span>
        <span>{m(price.totalCents)}</span>
      </div>
      <p className="mt-1 text-xs text-neutral-500">Host receives {m(price.hostPayoutCents)}, everything except card processing{price.donationCents > 0 ? " and your donation" : ""}.</p>
    </div>
  );
}
