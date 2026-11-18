import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { formatMoney } from "@/lib/pricing";
import { paymentMode } from "@/lib/payments";
import { todayUTC } from "@/lib/listings";
import { setUpPayouts, togglePublished } from "@/app/actions/listings";
import { cancelBooking } from "@/app/actions/bookings";
import { Icon } from "@/components/Icons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Hosting — Fairbnb" };

const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const DAY = 86_400_000;

const TABS = [
  { key: "checking-out", label: "Checking out" },
  { key: "hosting", label: "Currently hosting" },
  { key: "arriving", label: "Arriving soon" },
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const EMPTY: Record<TabKey, string> = {
  "checking-out": "No guests are checking out today.",
  hosting: "You don't have any guests staying with you right now.",
  arriving: "No guests are arriving in the next week.",
  upcoming: "You don't have any upcoming reservations.",
  past: "No past reservations yet.",
};

export default async function HostPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/host");
  const { tab: tabParam } = await searchParams;
  const [listings, bookings] = await Promise.all([
    db.listing.findMany({ where: { hostId: user.id }, include: { photos: { take: 1, orderBy: { position: "asc" } } }, orderBy: { createdAt: "desc" } }),
    db.booking.findMany({
      where: { listing: { hostId: user.id }, status: { in: ["CONFIRMED", "COMPLETED"] } },
      include: { listing: { select: { title: true } }, guest: { select: { name: true } } },
      orderBy: { checkIn: "desc" },
      take: 50,
    }),
  ]);
  const earned = bookings.reduce((s, b) => s + b.hostPayoutCents, 0);
  const wouldHavePaid = bookings.reduce((s, b) => s + Math.round((b.subtotalCents + b.cleaningFeeCents) * 0.03), 0);

  const today = todayUTC().getTime();
  const inTab = (b: (typeof bookings)[number], key: TabKey) => {
    const ci = b.checkIn.getTime();
    const co = b.checkOut.getTime();
    switch (key) {
      case "checking-out": return co === today;
      case "hosting": return ci <= today && co > today;
      case "arriving": return ci >= today && ci <= today + 7 * DAY;
      case "upcoming": return ci > today;
      case "past": return co < today;
    }
  };
  const groups = Object.fromEntries(
    TABS.map((t) => {
      const list = bookings.filter((b) => inTab(b, t.key));
      // Future-facing tabs read soonest first; past reads most recent first (query order).
      return [t.key, t.key === "past" ? list : [...list].reverse()];
    }),
  ) as Record<TabKey, typeof bookings>;
  const isTab = (v: string | undefined): v is TabKey => TABS.some((t) => t.key === v);
  const tab: TabKey = isTab(tabParam)
    ? tabParam
    : (["checking-out", "hosting", "arriving", "upcoming"] as TabKey[]).find((k) => groups[k].length > 0) ?? "upcoming";
  const shown = groups[tab];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Welcome back, {user.name.split(" ")[0]}</h1>
        <Link href="/listings/new" className="btn-secondary gap-1 rounded-full px-5">
          <Icon name="plus" className="h-4 w-4" /> Create listing
        </Link>
      </div>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold">Your reservations</h2>
        <nav className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1" aria-label="Reservation filters">
          {TABS.map((t) => {
            const active = t.key === tab;
            return (
              <Link
                key={t.key}
                href={`/host?tab=${t.key}`}
                scroll={false}
                aria-current={active ? "page" : undefined}
                className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-sm transition ${
                  active ? "border-neutral-900 bg-neutral-900 font-semibold text-white" : "border-neutral-300 hover:border-neutral-900"
                }`}
              >
                {t.label} ({groups[t.key].length})
              </Link>
            );
          })}
        </nav>
        {shown.length === 0 ? (
          <div className="mt-4 flex min-h-40 flex-col items-center justify-center rounded-xl bg-neutral-50 p-8 text-center">
            <Icon name="calendar" className="h-8 w-8 text-neutral-400" strokeWidth={1.5} />
            <p className="mt-3 max-w-xs text-neutral-600">{EMPTY[tab]}</p>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((b) => {
              const ci = b.checkIn.getTime();
              const co = b.checkOut.getTime();
              const badge =
                co === today ? "Checking out today"
                : ci === today ? "Arriving today"
                : ci < today && co > today ? "Currently hosting"
                : ci > today ? `Arrives in ${Math.round((ci - today) / DAY)} day${Math.round((ci - today) / DAY) === 1 ? "" : "s"}`
                : "Checked out";
              return (
                <div key={b.id} className="flex min-w-0 flex-col rounded-xl border border-neutral-200 p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold ${ci > today || co >= today ? "text-brand-700" : "text-neutral-500"}`}>{badge}</p>
                      <p className="mt-1 truncate text-lg font-semibold">{b.guest.name}</p>
                      <p className="truncate text-sm text-neutral-600">{b.listing.title}</p>
                    </div>
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-lg font-semibold text-white">
                      {b.guest.name.charAt(0).toUpperCase()}
                    </div>
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-3 border-t border-neutral-200 pt-4 text-sm">
                    <div>
                      <p className="font-medium">{fmt(b.checkIn)} – {fmt(b.checkOut)}</p>
                      <p className="text-neutral-600">{b.guests} guest{b.guests === 1 ? "" : "s"} · {b.nights} night{b.nights === 1 ? "" : "s"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-neutral-500">Payout</p>
                      <p className="font-semibold">{formatMoney(b.hostPayoutCents, b.currency)}</p>
                    </div>
                  </div>
                  {b.status === "CONFIRMED" && b.checkIn > new Date() && (
                    <form action={cancelBooking} className="mt-3 text-right">
                      <input type="hidden" name="bookingId" value={b.id} />
                      <button className="text-xs font-semibold text-red-700 underline-offset-2 hover:underline">Cancel reservation</button>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-12 grid gap-4 sm:grid-cols-3">
        <Stat label="You've earned" value={formatMoney(earned)} />
        <Stat label="Fairbnb took" value="$0" accent />
        <Stat label="Saved vs. a 3% host fee" value={formatMoney(wouldHavePaid)} />
      </section>

      <section className="mt-6 rounded-xl border border-neutral-200 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <Icon name="key" className="mt-0.5 h-6 w-6 shrink-0" strokeWidth={1.5} />
            <div>
              <h2 className="text-lg font-semibold">Payouts</h2>
              {user.payoutsEnabled ? (
                <p className="mt-1 text-sm text-brand-700">✓ Payouts are set up{paymentMode() === "mock" ? " (demo mode)" : ""}. Guests pay you directly through Stripe.</p>
              ) : (
                <p className="mt-1 text-sm text-neutral-600">Connect a Stripe account so guests can pay you directly. Fairbnb never holds your money.</p>
              )}
            </div>
          </div>
          {!user.payoutsEnabled && (
            <form action={setUpPayouts}><button className="btn-primary px-6 py-3">Set up payouts</button></form>
          )}
        </div>
      </section>

      <section className="mt-12">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-semibold">Your listings</h2>
          <span className="text-sm text-neutral-500">{listings.length} total</span>
        </div>
        {listings.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-neutral-300 p-8 text-center">
            <p className="text-neutral-600">No listings yet.</p>
            <Link href="/listings/new" className="btn-primary mt-4">Create your first listing</Link>
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200">
            <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1fr)_7rem_7rem_8rem] gap-4 border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-neutral-500 md:grid">
              <span>Listing</span><span>Location</span><span>Price</span><span>Status</span><span className="text-right">Action</span>
            </div>
            <ul className="divide-y divide-neutral-200">
              {listings.map((l) => (
                <li key={l.id} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-4 py-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_7rem_7rem_8rem]">
                  <Link href={`/listings/${l.id}`} className="flex min-w-0 items-center gap-4 hover:underline">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-neutral-200">
                      {l.photos[0] && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={l.photos[0].url} alt="" className="h-full w-full object-cover" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{l.title}</p>
                      <p className="truncate text-sm text-neutral-600 md:hidden">{l.city}, {l.country} · {formatMoney(l.nightlyPriceCents, l.currency)}/night</p>
                    </div>
                  </Link>
                  <p className="hidden truncate text-sm text-neutral-600 md:block">{l.city}{l.region ? `, ${l.region}` : ""}, {l.country}</p>
                  <p className="hidden text-sm md:block">{formatMoney(l.nightlyPriceCents, l.currency)}</p>
                  <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold max-md:row-start-1 max-md:col-start-2 ${l.published ? "bg-brand-50 text-brand-700" : "bg-neutral-100 text-neutral-600"}`}>
                    <span className={`h-2 w-2 rounded-full ${l.published ? "bg-brand-500" : "bg-neutral-400"}`} />
                    {l.published ? "Listed" : "Unlisted"}
                  </span>
                  <form action={togglePublished} className="col-span-2 text-right md:col-span-1">
                    <input type="hidden" name="listingId" value={l.id} />
                    <button className="btn-secondary px-3 py-1.5 text-sm">{l.published ? "Unpublish" : "Publish"}</button>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-neutral-200 p-5">
      <p className="text-sm text-neutral-600">{label}</p>
      <p className={`mt-1 text-3xl font-semibold ${accent ? "text-brand-700" : ""}`}>{value}</p>
    </div>
  );
}
