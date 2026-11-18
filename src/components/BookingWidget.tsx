"use client";

import { useActionState, useCallback, useRef, useState } from "react";
import { calculatePrice, formatMoney } from "@/lib/pricing";
import { PriceBreakdown } from "./PriceBreakdown";
import { createBooking, type BookingState } from "@/app/actions/bookings";
import { DateRangeCalendar, GuestPicker, guestSummary, useClickOutside, type BlockedRange, type GuestCounts } from "./DateRangeCalendar";
import { Icon } from "./Icons";
import { formatLong, formatSlash, nightsCount } from "./listing/dates";

export type BookingListing = {
  id: string;
  city: string;
  nightlyPriceCents: number;
  cleaningFeeCents: number;
  taxRateBps: number;
  currency: string;
  maxGuests: number;
  minNights: number;
};

/** Trip state shared by the booking card, the inline calendar and the mobile reserve bar. */
export type Trip = { checkIn?: string; checkOut?: string; guests: GuestCounts; donationCents: number };

const DONATION_CHOICES = [0, 200, 500, 1000];

export function tripPrice(listing: BookingListing, trip: Trip) {
  const nights = nightsCount(trip.checkIn, trip.checkOut);
  if (nights < Math.max(1, listing.minNights)) return null;
  return calculatePrice({ ...listing, nights, donationCents: trip.donationCents });
}

/**
 * Airbnb-style booking card. Fully controlled: the parent owns the trip so the inline
 * calendar on the page and this card always show the same dates.
 */
export function BookingWidget({
  listing,
  trip,
  onTripChange,
  blocked = [],
  loggedIn,
  isOwner,
  avgRating,
  reviewCount,
  bare = false,
}: {
  listing: BookingListing;
  trip: Trip;
  onTripChange: (t: Trip) => void;
  blocked?: BlockedRange[];
  loggedIn: boolean;
  isOwner: boolean;
  avgRating: number | null;
  reviewCount: number;
  /** Drop the card border/shadow (used inside the mobile bottom sheet). */
  bare?: boolean;
}) {
  const [state, action, pending] = useActionState<BookingState, FormData>(createBooking, undefined);
  const [datesOpen, setDatesOpen] = useState(false);
  const [guestsOpen, setGuestsOpen] = useState(false);
  const datesRef = useRef<HTMLDivElement>(null);
  const guestsRef = useRef<HTMLDivElement>(null);
  const closeDates = useCallback(() => setDatesOpen(false), []);
  const closeGuests = useCallback(() => setGuestsOpen(false), []);
  useClickOutside(datesRef, closeDates, datesOpen);
  useClickOutside(guestsRef, closeGuests, guestsOpen);

  const { checkIn, checkOut, guests } = trip;
  const nights = nightsCount(checkIn, checkOut);
  const price = tripPrice(listing, trip);
  const guestCount = guests.adults + guests.children;
  const money = (c: number) => formatMoney(c, listing.currency);
  const setDates = (ci?: string, co?: string) => onTripChange({ ...trip, checkIn: ci, checkOut: co });
  const pickingCheckout = !!checkIn && !checkOut;

  const field = "block w-full px-3 pb-2.5 pt-2 text-left transition hover:bg-neutral-50";
  const fieldLabel = "block text-[10px] font-extrabold uppercase tracking-wide text-neutral-900";
  const fieldValue = "block truncate text-sm text-neutral-600";

  return (
    <form action={action} className={bare ? "" : "rounded-2xl border border-neutral-200 bg-white p-6 shadow-[0_6px_16px_rgba(0,0,0,0.12)]"}>
      <input type="hidden" name="listingId" value={listing.id} />
      <input type="hidden" name="checkIn" value={checkIn ?? ""} />
      <input type="hidden" name="checkOut" value={checkOut ?? ""} />
      <input type="hidden" name="guests" value={guestCount} />
      <input type="hidden" name="donationCents" value={trip.donationCents} />

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p>
          <span className="text-2xl font-semibold text-neutral-900">{money(listing.nightlyPriceCents)}</span>{" "}
          <span className="text-neutral-600">night</span>
        </p>
        {avgRating !== null && reviewCount > 0 && (
          <p className="flex items-center gap-1 text-sm">
            <Icon name="star" className="h-3.5 w-3.5 fill-current" />
            <span className="font-semibold">{avgRating.toFixed(2)}</span>
            <span className="text-neutral-400">·</span>
            <a href="#reviews" className="text-neutral-600 underline">{reviewCount} review{reviewCount === 1 ? "" : "s"}</a>
          </p>
        )}
      </div>

      {/* CHECK-IN | CHECKOUT / GUESTS */}
      <div className="relative mt-6">
        <div className="rounded-xl border border-neutral-400">
          <div className="grid grid-cols-2">
            <button type="button" onClick={() => setDatesOpen(true)} className={`${field} rounded-tl-xl border-r border-neutral-400`} data-testid="bw-checkin">
              <span className={fieldLabel}>Check-in</span>
              <span className={fieldValue}>{checkIn ? formatSlash(checkIn) : "Add date"}</span>
            </button>
            <button type="button" onClick={() => setDatesOpen(true)} className={`${field} rounded-tr-xl`} data-testid="bw-checkout">
              <span className={fieldLabel}>Checkout</span>
              <span className={fieldValue}>{checkOut ? formatSlash(checkOut) : "Add date"}</span>
            </button>
          </div>
          <div ref={guestsRef} className="relative border-t border-neutral-400">
            <button
              type="button"
              onClick={() => setGuestsOpen((o) => !o)}
              aria-expanded={guestsOpen}
              className={`${field} flex items-center justify-between rounded-b-xl ${guestsOpen ? "ring-2 ring-inset ring-neutral-900" : ""}`}
              data-testid="bw-guests"
            >
              <span className="min-w-0">
                <span className={fieldLabel}>Guests</span>
                <span className={fieldValue}>{guestSummary(guests)}</span>
              </span>
              <Icon name="chevronDown" className={`h-4 w-4 shrink-0 transition ${guestsOpen ? "rotate-180" : ""}`} />
            </button>
            {guestsOpen && (
              <div className="absolute inset-x-0 top-full z-30 mt-1 rounded-xl border border-neutral-200 bg-white px-4 pb-4 shadow-[0_6px_20px_rgba(0,0,0,0.2)]">
                <GuestPicker value={guests} onChange={(g) => onTripChange({ ...trip, guests: g })} maxGuests={listing.maxGuests} />
                <p className="pt-3 text-xs text-neutral-500">
                  This place has a maximum of {listing.maxGuests} guest{listing.maxGuests === 1 ? "" : "s"}, not including infants. Ask the host before bringing pets.
                </p>
                <div className="mt-3 flex justify-end">
                  <button type="button" onClick={closeGuests} className="rounded-lg px-3 py-1.5 font-semibold underline hover:bg-neutral-100">
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {datesOpen && (
          <div
            ref={datesRef}
            className="absolute right-0 top-[-12px] z-30 w-[min(720px,calc(100vw-3rem))] rounded-2xl border border-neutral-200 bg-white p-4 shadow-[0_6px_20px_rgba(0,0,0,0.2)] sm:p-6"
            data-testid="bw-calendar"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xl font-semibold text-neutral-900">{nights > 0 ? `${nights} night${nights === 1 ? "" : "s"}` : "Select dates"}</p>
                <p className="text-sm text-neutral-500">
                  {nights > 0
                    ? `${formatLong(checkIn)} – ${formatLong(checkOut)}`
                    : listing.minNights > 1
                      ? `Minimum stay: ${listing.minNights} nights`
                      : "Add your travel dates for exact pricing"}
                </p>
              </div>
              <div className="grid w-full grid-cols-2 rounded-xl border border-neutral-400 sm:w-72">
                <div className={`rounded-xl px-3 py-2 ${!pickingCheckout ? "ring-2 ring-neutral-900" : ""}`}>
                  <span className={fieldLabel}>Check-in</span>
                  <span className={fieldValue}>{checkIn ? formatSlash(checkIn) : "MM/DD/YYYY"}</span>
                </div>
                <div className={`rounded-xl px-3 py-2 ${pickingCheckout ? "ring-2 ring-neutral-900" : ""}`}>
                  <span className={fieldLabel}>Checkout</span>
                  <span className={fieldValue}>{checkOut ? formatSlash(checkOut) : "MM/DD/YYYY"}</span>
                </div>
              </div>
            </div>
            <div className="mt-6">
              <DateRangeCalendar checkIn={checkIn} checkOut={checkOut} onChange={setDates} blocked={blocked} minNights={listing.minNights} />
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setDates(undefined, undefined)} className="rounded-lg px-3 py-2 text-sm font-semibold underline hover:bg-neutral-100">
                Clear dates
              </button>
              <button type="button" onClick={closeDates} className="rounded-lg bg-neutral-900 px-5 py-2 text-sm font-semibold text-white hover:bg-neutral-700">
                Close
              </button>
            </div>
          </div>
        )}
      </div>

      {listing.minNights > 1 && !price && <p className="mt-2 text-xs text-neutral-500">{listing.minNights}-night minimum stay</p>}

      {price && (
        <div className="mt-4">
          <p className="text-sm font-semibold text-neutral-900">Chip in for Fairbnb? <span className="font-normal text-neutral-500">(optional)</span></p>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {DONATION_CHOICES.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => onTripChange({ ...trip, donationCents: c })}
                aria-pressed={trip.donationCents === c}
                className={`rounded-lg border px-1 py-1.5 text-sm transition ${trip.donationCents === c ? "border-brand-600 bg-brand-50 font-semibold text-brand-700" : "border-neutral-300 hover:border-neutral-900"}`}
              >
                {c === 0 ? "No thanks" : money(c)}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-neutral-500">Fairbnb is free and runs on donations. Skipping this changes nothing about your booking.</p>
        </div>
      )}

      {state?.error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{state.error}</p>}

      {isOwner ? (
        <p className="mt-4 rounded-lg bg-neutral-100 py-3 text-center text-sm text-neutral-600">This is your listing.</p>
      ) : price ? (
        <button className="btn-primary mt-4 w-full py-3 text-base" disabled={pending} data-testid="bw-reserve">
          {pending ? "Reserving…" : loggedIn ? "Reserve" : "Log in to reserve"}
        </button>
      ) : (
        <button type="button" onClick={() => setDatesOpen(true)} className="btn-primary mt-4 w-full py-3 text-base">
          Check availability
        </button>
      )}

      {price && (
        <>
          <p className="mt-3 text-center text-sm text-neutral-600">You won&apos;t be charged yet</p>
          <p className="mt-0.5 text-center text-xs text-neutral-500">The total is final. Nothing is added at checkout.</p>
          <div className="mt-5">
            <PriceBreakdown price={price} currency={listing.currency} taxRateBps={listing.taxRateBps} />
          </div>
        </>
      )}
    </form>
  );
}
