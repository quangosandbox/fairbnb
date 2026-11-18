import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { formatMoney } from "@/lib/pricing";
import { paymentMode } from "@/lib/payments";
import { setUpPayouts, togglePublished } from "@/app/actions/listings";
import { cancelBooking } from "@/app/actions/bookings";

export const dynamic = "force-dynamic";

const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export default async function HostPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/host");
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

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Hosting</h1>
        <Link href="/listings/new" className="btn-primary">+ New listing</Link>
      </div>

      <section className="mt-6 rounded-xl border border-neutral-200 p-5">
        <h2 className="font-semibold">Payouts</h2>
        {user.payoutsEnabled ? (
          <p className="mt-1 text-sm text-brand-700">✓ Payouts are set up{paymentMode() === "mock" ? " (demo mode)" : ""}. Guests pay you directly through Stripe.</p>
        ) : (
          <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-neutral-600">Connect a Stripe account so guests can pay you directly. Fairbnb never holds your money.</p>
            <form action={setUpPayouts}><button className="btn-primary">Set up payouts</button></form>
          </div>
        )}
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="You've earned" value={formatMoney(earned)} />
        <Stat label="Fairbnb took" value="$0" />
        <Stat label="Saved vs. a 3% host fee" value={formatMoney(wouldHavePaid)} />
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Your listings</h2>
        {listings.length === 0 ? (
          <p className="mt-2 text-neutral-600">No listings yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-neutral-200">
            {listings.map((l) => (
              <li key={l.id} className="flex items-center gap-4 py-3">
                {l.photos[0] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={l.photos[0].url} alt="" className="h-14 w-20 rounded-lg object-cover" />
                )}
                <div className="flex-1">
                  <Link href={`/listings/${l.id}`} className="font-medium hover:underline">{l.title}</Link>
                  <p className="text-sm text-neutral-600">{l.city} · {formatMoney(l.nightlyPriceCents, l.currency)}/night</p>
                </div>
                <form action={togglePublished}>
                  <input type="hidden" name="listingId" value={l.id} />
                  <button className="btn-secondary text-sm">{l.published ? "Unpublish" : "Publish"}</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Reservations</h2>
        {bookings.length === 0 ? (
          <p className="mt-2 text-neutral-600">No reservations yet.</p>
        ) : (
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-xs uppercase text-neutral-500">
              <tr><th className="py-2">Guest</th><th>Listing</th><th>Dates</th><th>Status</th><th className="text-right">You receive</th><th></th></tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {bookings.map((b) => (
                <tr key={b.id}>
                  <td className="py-2">{b.guest.name}</td>
                  <td className="max-w-48 truncate">{b.listing.title}</td>
                  <td>{fmt(b.checkIn)} – {fmt(b.checkOut)}</td>
                  <td className="capitalize">{b.status.toLowerCase()}</td>
                  <td className="text-right font-medium">{formatMoney(b.hostPayoutCents, b.currency)}</td>
                  <td className="text-right">
                    {b.status === "CONFIRMED" && b.checkIn > new Date() && (
                      <form action={cancelBooking}>
                        <input type="hidden" name="bookingId" value={b.id} />
                        <button className="text-xs text-red-700 hover:underline">Cancel</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 p-4">
      <p className="text-xs uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}
