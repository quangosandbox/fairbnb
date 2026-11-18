"use client";

import { useState } from "react";
import { calculatePrice, formatMoney, typicalPlatformComparison } from "@/lib/pricing";
import { PriceBreakdown } from "./PriceBreakdown";

export function FeeCalculator() {
  const [nightly, setNightly] = useState(150);
  const [nights, setNights] = useState(4);
  const [cleaning, setCleaning] = useState(60);
  const [tax, setTax] = useState(10);
  const price = calculatePrice({ nightlyPriceCents: nightly * 100, cleaningFeeCents: cleaning * 100, taxRateBps: tax * 100, nights });
  const typical = typicalPlatformComparison(price);
  const num = (label: string, v: number, set: (n: number) => void, step = 1) => (
    <label className="block">
      <span className="label">{label}</span>
      <input className="input rounded-lg py-2.5 text-base" type="number" min={0} step={step} value={v} onChange={(e) => set(Math.max(0, Number(e.target.value)))} />
    </label>
  );
  return (
    <div className="grid gap-8 rounded-xl border border-neutral-200 p-5 shadow-sm sm:p-8 md:grid-cols-2">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {num("Nightly price ($)", nightly, setNightly)}
          {num("Nights", nights, (n) => setNights(Math.max(1, Math.floor(n))))}
          {num("Cleaning fee ($)", cleaning, setCleaning)}
          {num("Lodging tax (%)", tax, setTax, 0.5)}
        </div>
        <div className="mt-4 rounded-xl bg-neutral-50 p-5 text-sm">
          <p className="font-semibold">Same stay on a typical big platform*</p>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
            <div><p className="text-xs text-neutral-500">Guest pays</p><p className="font-bold">{formatMoney(typical.guestPaysCents)}</p></div>
            <div><p className="text-xs text-neutral-500">Host gets</p><p className="font-bold">{formatMoney(typical.hostGetsCents)}</p></div>
            <div><p className="text-xs text-neutral-500">Platform keeps</p><p className="font-bold text-red-700">{formatMoney(typical.platformKeepsCents)}</p></div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div><p className="text-xs text-neutral-500">Guest pays here</p><p className="font-bold text-brand-700">{formatMoney(price.totalCents)}</p></div>
            <div><p className="text-xs text-neutral-500">Host gets here</p><p className="font-bold text-brand-700">{formatMoney(price.hostPayoutCents)}</p></div>
            <div><p className="text-xs text-neutral-500">Fairbnb keeps</p><p className="font-bold text-brand-700">$0</p></div>
          </div>
          <p className="mt-3 text-xs text-neutral-500">*Estimate using a ~14.2% guest service fee and 3% host fee (a common split-fee model). Actual fees elsewhere vary.</p>
        </div>
      </div>
      <div className="rounded-xl border border-neutral-200 p-5">
        <p className="mb-3 text-lg font-semibold">Price details</p>
        <PriceBreakdown price={price} taxRateBps={tax * 100} />
      </div>
    </div>
  );
}
