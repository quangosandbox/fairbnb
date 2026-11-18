import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { formatMoney } from "@/lib/pricing";

export const dynamic = "force-dynamic";

const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export default async function TripsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/trips");
  const bookings = await db.booking.findMany({
    where: { guestId: user.id, status: { not: "PENDING_PAYMENT" } },
    include: { listing: { include: { photos: { take: 1, orderBy: { position: "asc" } } } } },
    orderBy: { checkIn: "desc" },
  });
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold">Your trips</h1>
      {bookings.length === 0 ? (
        <p className="mt-6 text-neutral-600">No trips yet. <Link href="/" className="text-brand-700 underline">Find a place</Link>.</p>
      ) : (
        <ul className="mt-6 divide-y divide-neutral-200">
          {bookings.map((b) => (
            <li key={b.id}>
              <Link href={`/trips/${b.id}`} className="flex gap-4 py-4 hover:bg-neutral-50">
                {b.listing.photos[0] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.listing.photos[0].url} alt="" className="h-20 w-28 shrink-0 rounded-lg object-cover" />
                )}
                <div className="flex-1">
                  <p className="font-semibold">{b.listing.title}</p>
                  <p className="text-sm text-neutral-600">{b.listing.city} · {fmt(b.checkIn)} – {fmt(b.checkOut)}</p>
                  <p className="text-sm">{formatMoney(b.totalCents, b.currency)} · <span className="capitalize">{b.status.toLowerCase()}</span></p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
