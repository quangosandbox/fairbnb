"use client";

import { useCallback, useEffect, useState } from "react";
import { BookingWidget, tripPrice, type BookingListing, type Trip } from "@/components/BookingWidget";
import { DateRangeCalendar, type BlockedRange } from "@/components/DateRangeCalendar";
import { formatMoney } from "@/lib/pricing";
import { Modal } from "./Modal";
import { formatLong, formatRangeShort, nightsCount } from "./dates";

/**
 * Owns the trip (dates, guests, donation) for the listing page and shares it between
 * the inline "N nights in City" calendar, the sticky booking card and the mobile reserve bar.
 * `children` is the server-rendered left column that sits above the inline calendar.
 */
export function ListingReservation({
  listing,
  blocked,
  initial,
  loggedIn,
  isOwner,
  avgRating,
  reviewCount,
  children,
}: {
  listing: BookingListing;
  blocked: BlockedRange[];
  initial: { checkIn?: string; checkOut?: string; guests: number };
  loggedIn: boolean;
  isOwner: boolean;
  avgRating: number | null;
  reviewCount: number;
  children: React.ReactNode;
}) {
  const [trip, setTrip] = useState<Trip>({
    checkIn: initial.checkIn,
    checkOut: initial.checkOut,
    guests: { adults: initial.guests, children: 0, infants: 0, pets: 0 },
    donationCents: 0,
  });
  const [sheetOpen, setSheetOpen] = useState(false);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  // Keep the URL shareable: ?checkIn=…&checkOut=…&guests=…
  useEffect(() => {
    const url = new URL(window.location.href);
    const set = (k: string, v?: string) => (v ? url.searchParams.set(k, v) : url.searchParams.delete(k));
    set("checkIn", trip.checkIn);
    set("checkOut", trip.checkOut);
    const g = trip.guests.adults + trip.guests.children;
    set("guests", g > 1 ? String(g) : undefined);
    if (url.href !== window.location.href) window.history.replaceState(window.history.state, "", url);
  }, [trip.checkIn, trip.checkOut, trip.guests]);

  const nights = nightsCount(trip.checkIn, trip.checkOut);
  const price = tripPrice(listing, trip);
  const setDates = (checkIn?: string, checkOut?: string) => setTrip((t) => ({ ...t, checkIn, checkOut }));

  const calendarHeading = nights > 0 ? `${nights} night${nights === 1 ? "" : "s"} in ${listing.city}` : trip.checkIn ? "Select checkout date" : "Select check-in date";
  const calendarSub =
    nights > 0
      ? `${formatLong(trip.checkIn)} – ${formatLong(trip.checkOut)}`
      : listing.minNights > 1
        ? `Minimum stay: ${listing.minNights} nights`
        : "Add your travel dates for exact pricing";

  const widgetProps = { listing, trip, onTripChange: setTrip, blocked, loggedIn, isOwner, avgRating, reviewCount };

  return (
    <>
      <div className="grid gap-x-16 lg:grid-cols-[minmax(0,1fr)_372px]">
        <div className="min-w-0">
          {children}

          <section className="py-8" aria-labelledby="calendar-heading" id="availability">
            <h2 id="calendar-heading" className="text-2xl font-semibold text-neutral-900">{calendarHeading}</h2>
            <p className="mt-1 text-sm text-neutral-500">{calendarSub}</p>
            <div className="mt-6">
              {/* Two months where there's room for them; one in the narrow lg–xl band next to the card. */}
              <div className="lg:hidden xl:block">
                <DateRangeCalendar checkIn={trip.checkIn} checkOut={trip.checkOut} onChange={setDates} blocked={blocked} minNights={listing.minNights} months={2} />
              </div>
              <div className="hidden lg:block xl:hidden">
                <DateRangeCalendar checkIn={trip.checkIn} checkOut={trip.checkOut} onChange={setDates} blocked={blocked} minNights={listing.minNights} months={1} />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setDates(undefined, undefined)}
                disabled={!trip.checkIn}
                className="rounded-lg px-2 py-1 text-sm font-semibold underline hover:bg-neutral-100 disabled:no-underline disabled:opacity-40"
              >
                Clear dates
              </button>
            </div>
          </section>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-24 pt-8">
            <BookingWidget {...widgetProps} />
            <p className="mt-4 text-center text-sm text-neutral-500">
              Fairbnb takes <span className="font-semibold text-brand-700">$0</span> from you and from your host.
            </p>
          </div>
        </aside>
      </div>

      {/* Mobile reserve bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden" data-testid="mobile-bar">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <button type="button" onClick={() => setSheetOpen(true)} className="min-w-0 text-left">
            {price ? (
              <>
                <span className="block font-semibold text-neutral-900 underline">{formatMoney(price.totalCents, listing.currency)} total</span>
                <span className="block text-sm text-neutral-600">{formatRangeShort(trip.checkIn, trip.checkOut)} · {nights} night{nights === 1 ? "" : "s"}</span>
              </>
            ) : (
              <>
                <span className="block">
                  <span className="font-semibold text-neutral-900">{formatMoney(listing.nightlyPriceCents, listing.currency)}</span>{" "}
                  <span className="text-neutral-600">night</span>
                </span>
                <span className="block text-sm font-semibold text-neutral-900 underline">Add dates</span>
              </>
            )}
          </button>
          <button type="button" onClick={() => setSheetOpen(true)} className="btn-primary shrink-0 px-7 py-3 text-base">
            Reserve
          </button>
        </div>
      </div>

      <Modal open={sheetOpen} onClose={closeSheet} variant="sheet" title="Your trip" size="md:max-w-lg">
        <div className="px-6 pb-8 pt-4">
          <BookingWidget {...widgetProps} bare />
        </div>
      </Modal>
    </>
  );
}
