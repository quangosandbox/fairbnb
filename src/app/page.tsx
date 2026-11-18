import { SearchBar } from "@/components/SearchBar";
import { ListingCard } from "@/components/ListingCard";
import { parseDay, searchListings } from "@/lib/listings";
import { nightsBetween } from "@/lib/pricing";

export const dynamic = "force-dynamic";

type SP = { q?: string; checkIn?: string; checkOut?: string; guests?: string };

export default async function Home({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const checkIn = parseDay(sp.checkIn);
  const checkOut = parseDay(sp.checkOut);
  const validDates = checkIn && checkOut && checkOut > checkIn;
  const nights = validDates ? nightsBetween(checkIn, checkOut) : undefined;
  const guests = Math.max(1, Number(sp.guests) || 1);
  const listings = await searchListings({
    q: sp.q,
    checkIn: validDates ? checkIn : null,
    checkOut: validDates ? checkOut : null,
    guests,
  });
  const query = new URLSearchParams(
    Object.entries({ checkIn: sp.checkIn, checkOut: sp.checkOut, guests: sp.guests }).filter(([, v]) => v) as [string, string][],
  ).toString();
  const searching = Boolean(sp.q || validDates || sp.guests);

  return (
    <div className="mx-auto max-w-7xl px-4">
      {!searching && (
        <section className="py-12 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            Stays without the <span className="text-brand-600">fee surprise</span>.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-neutral-600">
            Fairbnb charges guests and hosts nothing. The price you see is the price you pay, and hosts keep every cent of it.
          </p>
        </section>
      )}
      <div className={searching ? "pt-6" : ""}>
        <SearchBar q={sp.q} checkIn={sp.checkIn} checkOut={sp.checkOut} guests={sp.guests} />
      </div>
      {sp.checkIn && sp.checkOut && !validDates && (
        <p className="mt-3 text-sm text-red-600">Check-out must be after check-in.</p>
      )}
      <div className="mt-6 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">
          {searching ? `${listings.length} stay${listings.length === 1 ? "" : "s"}` : "Explore stays"}
        </h2>
        {nights && <p className="text-sm text-neutral-600">Prices are all-in totals, taxes and card processing included.</p>}
      </div>
      {listings.length === 0 ? (
        <p className="py-20 text-center text-neutral-500">No stays match. Try different dates or a broader place.</p>
      ) : (
        <div className="mt-4 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {listings.map((l) => (
            <ListingCard key={l.id} listing={l} nights={nights} query={query} />
          ))}
        </div>
      )}
    </div>
  );
}
