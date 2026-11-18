import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { PriceBreakdown } from "@/components/PriceBreakdown";
import { cancelBooking } from "@/app/actions/bookings";
import { leaveReview } from "@/app/actions/reviews";
import { todayUTC } from "@/lib/listings";

export const dynamic = "force-dynamic";

const fmt = (d: Date) => d.toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

export default async function TripPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ paid?: string }> }) {
  const { id } = await params;
  const { paid } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/trips/${id}`);
  const b = await db.booking.findUnique({
    where: { id },
    include: { listing: { include: { host: { select: { name: true, email: true } } } }, review: true },
  });
  if (!b || b.guestId !== user.id) notFound();
  const canReview = (b.status === "COMPLETED" || (b.status === "CONFIRMED" && b.checkOut <= todayUTC())) && !b.review;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {paid && b.status === "CONFIRMED" && <p className="mb-4 rounded-lg bg-brand-50 p-3 text-brand-900">You&apos;re booked! 🎉</p>}
      {paid && b.status === "PENDING_PAYMENT" && <p className="mb-4 rounded-lg bg-amber-50 p-3 text-amber-800">Payment is processing. This page will update shortly.</p>}
      <Link href="/trips" className="text-sm text-neutral-500">← All trips</Link>
      <h1 className="mt-2 text-2xl font-bold">{b.listing.title}</h1>
      <p className="text-neutral-600">{b.listing.city}, {b.listing.country}</p>
      <div className="mt-6 grid grid-cols-2 gap-4 rounded-xl border border-neutral-200 p-4 text-sm">
        <div><p className="label">Check in</p>{fmt(b.checkIn)}</div>
        <div><p className="label">Check out</p>{fmt(b.checkOut)}</div>
        <div><p className="label">Guests</p>{b.guests}</div>
        <div><p className="label">Status</p><span className="capitalize">{b.status.toLowerCase().replace("_", " ")}</span></div>
        <div className="col-span-2"><p className="label">Host</p>{b.listing.host.name} · {b.listing.host.email}</div>
      </div>
      <div className="mt-6 rounded-xl border border-neutral-200 p-4">
        <h2 className="mb-2 font-semibold">What you paid</h2>
        <PriceBreakdown
          price={{ ...b, nightlyPriceCents: Math.round(b.subtotalCents / b.nights) }}
          currency={b.currency}
        />
      </div>
      {canReview && (
        <form action={leaveReview} className="mt-6 space-y-3 rounded-xl border border-neutral-200 p-4">
          <h2 className="font-semibold">How was your stay?</h2>
          <input type="hidden" name="bookingId" value={b.id} />
          <select name="rating" className="input" defaultValue="5">
            {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{"★".repeat(n)} ({n})</option>)}
          </select>
          <textarea name="body" className="input" rows={4} required minLength={10} placeholder="Tell future guests what it was like" />
          <button className="btn-primary">Post review</button>
        </form>
      )}
      {b.status === "CONFIRMED" && b.checkIn > todayUTC() && (
        <form action={cancelBooking} className="mt-6">
          <input type="hidden" name="bookingId" value={b.id} />
          <button className="btn-secondary text-red-700">Cancel booking</button>
        </form>
      )}
    </div>
  );
}
