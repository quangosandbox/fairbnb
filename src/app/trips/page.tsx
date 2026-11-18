import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { formatMoney } from "@/lib/pricing";
import { todayUTC } from "@/lib/listings";
import { Icon } from "@/components/Icons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Trips — Fairbnb" };

const md = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const year = (d: Date) => d.getUTCFullYear();

/** "Mar 3 – 7, 2026", "Mar 30 – Apr 2, 2026", "Dec 30, 2026 – Jan 2, 2027" */
function dateRange(a: Date, b: Date) {
  if (year(a) !== year(b)) return `${md(a)}, ${year(a)} – ${md(b)}, ${year(b)}`;
  if (a.getUTCMonth() === b.getUTCMonth()) return `${md(a)} – ${b.getUTCDate()}, ${year(b)}`;
  return `${md(a)} – ${md(b)}, ${year(b)}`;
}

export default async function TripsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/trips");
  const bookings = await db.booking.findMany({
    where: { guestId: user.id, status: { not: "PENDING_PAYMENT" } },
    include: {
      listing: {
        include: {
          photos: { take: 1, orderBy: { position: "asc" } },
          host: { select: { name: true } },
        },
      },
    },
    orderBy: { checkIn: "asc" },
  });
  const today = todayUTC();
  const cancelled = bookings.filter((b) => b.status === "CANCELLED");
  const active = bookings.filter((b) => b.status !== "CANCELLED");
  const upcoming = active.filter((b) => b.status === "CONFIRMED" && b.checkOut > today);
  const past = active.filter((b) => !upcoming.includes(b)).reverse();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10">
      <h1 className="text-3xl font-semibold tracking-tight">Trips</h1>

      {bookings.length === 0 ? (
        <section className="mt-8 border-y border-neutral-200 py-8">
          <div className="grid items-center gap-6 overflow-hidden rounded-xl border border-neutral-200 md:grid-cols-2">
            <div className="p-6 sm:p-8">
              <Icon name="sparkles" className="h-9 w-9 text-brand-600" strokeWidth={1.5} />
              <h2 className="mt-4 text-2xl font-semibold">No trips booked...yet!</h2>
              <p className="mt-2 text-neutral-600">Time to dust off your bags and start planning your next adventure.</p>
              <Link href="/" className="btn-primary mt-6 px-6 py-3">Start searching</Link>
            </div>
            <div className="hidden h-full min-h-56 bg-gradient-to-br from-brand-100 via-brand-50 to-white md:block" />
          </div>
        </section>
      ) : (
        <>
          <section className="mt-8">
            <h2 className="text-2xl font-semibold">Upcoming reservations</h2>
            {upcoming.length === 0 ? (
              <div className="mt-4 rounded-xl border border-neutral-200 p-6">
                <p className="font-semibold">No upcoming trips...yet!</p>
                <p className="mt-1 text-neutral-600">Time to start planning your next adventure.</p>
                <Link href="/" className="btn-primary mt-4">Start searching</Link>
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
                {upcoming.map((b) => {
                  const inProgress = b.checkIn <= today;
                  return (
                    <Link
                      key={b.id}
                      href={`/trips/${b.id}`}
                      className="group flex flex-col-reverse overflow-hidden rounded-xl border border-neutral-200 shadow-sm transition hover:shadow-md sm:flex-row"
                    >
                      <div className="flex flex-1 flex-col p-5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">{inProgress ? "Happening now" : "Confirmed"}</p>
                        <h3 className="mt-1 line-clamp-2 text-lg font-semibold">{b.listing.title}</h3>
                        <p className="text-sm text-neutral-600">{b.listing.propertyType} hosted by {b.listing.host.name}</p>
                        <div className="mt-auto flex gap-4 border-t border-neutral-200 pt-4 text-sm">
                          <div className="pr-4">
                            <p className="font-semibold">{md(b.checkIn)} –</p>
                            <p className="font-semibold">{md(b.checkOut)}</p>
                            <p className="text-neutral-500">{year(b.checkOut)}</p>
                          </div>
                          <div className="border-l border-neutral-200 pl-4">
                            <p className="font-semibold">{b.listing.city}</p>
                            <p className="text-neutral-600">{b.listing.region ? `${b.listing.region}, ` : ""}{b.listing.country}</p>
                          </div>
                        </div>
                      </div>
                      <div className="relative aspect-[16/10] bg-neutral-200 sm:aspect-auto sm:w-56 sm:shrink-0">
                        {b.listing.photos[0] && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={b.listing.photos[0].url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          {past.length > 0 && (
            <section className="mt-12">
              <h2 className="text-2xl font-semibold">Where you&apos;ve been</h2>
              <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
                {past.map((b) => (
                  <Link key={b.id} href={`/trips/${b.id}`} className="flex items-center gap-4 rounded-xl p-1 transition hover:bg-neutral-50">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-neutral-200">
                      {b.listing.photos[0] && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={b.listing.photos[0].url} alt="" className="h-full w-full object-cover" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{b.listing.city}</p>
                      <p className="truncate text-sm text-neutral-600">Hosted by {b.listing.host.name}</p>
                      <p className="text-sm text-neutral-600">{dateRange(b.checkIn, b.checkOut)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {cancelled.length > 0 && (
            <section className="mt-12 border-t border-neutral-200 pt-8">
              <h2 className="text-lg font-semibold text-neutral-500">Cancelled reservations</h2>
              <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {cancelled.reverse().map((b) => (
                  <li key={b.id}>
                    <Link href={`/trips/${b.id}`} className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-neutral-500 transition hover:text-neutral-700">
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-neutral-200 opacity-60 grayscale">
                        {b.listing.photos[0] && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={b.listing.photos[0].url} alt="" className="h-full w-full object-cover" />
                        )}
                      </div>
                      <div className="min-w-0 text-sm">
                        <p className="truncate font-medium">{b.listing.title}</p>
                        <p>{dateRange(b.checkIn, b.checkOut)} · <span className="line-through">{formatMoney(b.totalCents, b.currency)}</span></p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
