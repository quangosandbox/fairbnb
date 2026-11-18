"use client";

import { useActionState, useMemo, useState } from "react";
import { calculatePrice, formatMoney, nightsBetween } from "@/lib/pricing";
import { PriceBreakdown } from "./PriceBreakdown";
import { createBooking, type BookingState } from "@/app/actions/bookings";

type Listing = {
  id: string;
  nightlyPriceCents: number;
  cleaningFeeCents: number;
  taxRateBps: number;
  currency: string;
  maxGuests: number;
  minNights: number;
};

const DONATION_CHOICES = [0, 200, 500, 1000];

export function BookingWidget({ listing, initial, loggedIn, isOwner }: {
  listing: Listing;
  initial: { checkIn?: string; checkOut?: string; guests?: string };
  loggedIn: boolean;
  isOwner: boolean;
}) {
  const [checkIn, setCheckIn] = useState(initial.checkIn ?? "");
  const [checkOut, setCheckOut] = useState(initial.checkOut ?? "");
  const [guests, setGuests] = useState(initial.guests ?? "1");
  const [donation, setDonation] = useState(0);
  const [state, action, pending] = useActionState<BookingState, FormData>(createBooking, undefined);

  const nights = useMemo(() => {
    if (!checkIn || !checkOut) return 0;
    const n = nightsBetween(new Date(checkIn), new Date(checkOut));
    return n > 0 ? n : 0;
  }, [checkIn, checkOut]);
  const price = nights ? calculatePrice({ ...listing, nights, donationCents: donation }) : null;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} className="rounded-2xl border border-neutral-200 p-5 shadow-lg">
      <input type="hidden" name="listingId" value={listing.id} />
      <input type="hidden" name="donationCents" value={donation} />
      <p className="text-xl">
        <span className="font-bold">{formatMoney(listing.nightlyPriceCents, listing.currency)}</span>{" "}
        <span className="text-base text-neutral-600">night</span>
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div>
          <label className="label" htmlFor="bw-in">Check in</label>
          <input className="input" id="bw-in" name="checkIn" type="date" min={today} value={checkIn} onChange={(e) => setCheckIn(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="bw-out">Check out</label>
          <input className="input" id="bw-out" name="checkOut" type="date" min={checkIn || today} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} required />
        </div>
        <div className="col-span-2">
          <label className="label" htmlFor="bw-guests">Guests</label>
          <input className="input" id="bw-guests" name="guests" type="number" min={1} max={listing.maxGuests} value={guests} onChange={(e) => setGuests(e.target.value)} required />
        </div>
      </div>
      {listing.minNights > 1 && <p className="mt-2 text-xs text-neutral-500">{listing.minNights}-night minimum</p>}

      {price && (
        <>
          <div className="mt-4">
            <p className="label">Support Fairbnb? (optional)</p>
            <div className="flex gap-2">
              {DONATION_CHOICES.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setDonation(c)}
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-sm ${donation === c ? "border-brand-600 bg-brand-50 font-semibold text-brand-700" : "border-neutral-300"}`}
                >
                  {c === 0 ? "No thanks" : formatMoney(c)}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-neutral-500">Fairbnb is free and runs on donations. Skipping this changes nothing about your booking.</p>
          </div>
          <div className="mt-4">
            <PriceBreakdown price={price} currency={listing.currency} taxRateBps={listing.taxRateBps} />
          </div>
        </>
      )}

      {state?.error && <p className="mt-3 text-sm text-red-600">{state.error}</p>}
      {isOwner ? (
        <p className="mt-4 text-center text-sm text-neutral-500">This is your listing.</p>
      ) : (
        <button className="btn-primary mt-4 w-full" disabled={pending || !price}>
          {pending ? "Reserving…" : !loggedIn ? "Log in to reserve" : price ? `Reserve · ${formatMoney(price.totalCents, listing.currency)}` : "Pick dates"}
        </button>
      )}
      <p className="mt-2 text-center text-xs text-neutral-500">The total above is the final price. Nothing gets added at checkout.</p>
    </form>
  );
}
