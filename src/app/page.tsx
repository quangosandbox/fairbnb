import { Suspense } from "react";
import Link from "next/link";
import { CategoryBar } from "@/components/CategoryBar";
import { ListingCard } from "@/components/ListingCard";
import { parseDay, searchListings } from "@/lib/listings";
import { nightsBetween } from "@/lib/pricing";
import { getCurrentUser } from "@/lib/auth";
import { getFavoriteIds } from "@/app/actions/favorites";
import { Icon } from "@/components/Icons";

export const dynamic = "force-dynamic";

type SP = { q?: string; checkIn?: string; checkOut?: string; guests?: string; category?: string };

export default async function Home({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const checkIn = parseDay(sp.checkIn);
  const checkOut = parseDay(sp.checkOut);
  const validDates = !!(checkIn && checkOut && checkOut > checkIn);
  const nights = validDates ? nightsBetween(checkIn!, checkOut!) : undefined;
  const guests = Math.max(1, Number(sp.guests) || 1);
  const user = await getCurrentUser();
  const [listings, favs] = await Promise.all([
    searchListings({ q: sp.q, checkIn: validDates ? checkIn : null, checkOut: validDates ? checkOut : null, guests, category: sp.category }),
    getFavoriteIds(user?.id),
  ]);
  const query = new URLSearchParams(
    Object.entries({ checkIn: validDates ? sp.checkIn : undefined, checkOut: validDates ? sp.checkOut : undefined, guests: sp.guests }).filter(([, v]) => v) as [string, string][],
  ).toString();

  return (
    <div>
      <div className="sticky top-[83px] z-20 border-b border-neutral-100 bg-white pt-3 md:top-[167px] md:pt-4">
        <div className="mx-auto flex max-w-[1760px] items-center gap-6 px-6 lg:px-10">
          <div className="min-w-0 flex-1"><Suspense><CategoryBar /></Suspense></div>
          <Link href="/fees" className="hidden shrink-0 items-center gap-2 rounded-xl border border-neutral-300 px-4 py-3 text-xs font-semibold hover:border-neutral-900 md:flex">
            <Icon name="check" className="h-4 w-4 text-brand-600" strokeWidth={3} />
            Prices include every fee
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-[1760px] px-6 pt-6 lg:px-10">
        {sp.checkIn && sp.checkOut && !validDates && <p className="mb-4 text-sm text-red-600">Check-out must be after check-in.</p>}
        {(sp.q || validDates) && (
          <p className="mb-6 text-sm font-semibold">
            {listings.length > 0 ? `${listings.length} stay${listings.length === 1 ? "" : "s"}` : "No exact matches"}
            {sp.q ? ` in ${sp.q}` : ""}
            {nights ? <span className="font-normal text-neutral-600"> · totals include taxes and card processing; Fairbnb fee is $0</span> : null}
          </p>
        )}
        {listings.length === 0 ? (
          <div className="py-24 text-center">
            <p className="text-xl font-semibold">No exact matches</p>
            <p className="mt-2 text-neutral-600">Try changing or removing some of your filters or adjusting your search area.</p>
            <Link href="/" className="btn-secondary mt-6">Remove all filters</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {listings.map((l) => (
              <ListingCard
                key={l.id}
                listing={l}
                nights={nights}
                query={query}
                saved={favs.has(l.id)}
                checkIn={validDates ? sp.checkIn : undefined}
                checkOut={validDates ? sp.checkOut : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
