import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { PriceBreakdown } from "@/components/PriceBreakdown";
import { Icon } from "@/components/Icons";
import { cancelBooking } from "@/app/actions/bookings";
import { leaveReview } from "@/app/actions/reviews";
import { todayUTC } from "@/lib/listings";
import { computeRefund, freeCancellationDeadline } from "@/lib/cancellation";
import { formatMoney } from "@/lib/pricing";

export const dynamic = "force-dynamic";

const fmt = (d: Date) => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

const STATUS: Record<string, { label: string; cls: string }> = {
  PENDING_PAYMENT: { label: "Awaiting payment", cls: "bg-amber-50 text-amber-800" },
  CONFIRMED: { label: "Confirmed", cls: "bg-brand-50 text-brand-700" },
  COMPLETED: { label: "Completed", cls: "bg-neutral-100 text-neutral-700" },
  CANCELLED: { label: "Cancelled", cls: "bg-red-50 text-red-700" },
};

const fmtMoment = (d: Date) =>
  d.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" });

const CANCEL_ERRORS: Record<string, string> = {
  changed: "The refund amount changed since you opened this page (the 24-hour mark may have passed). Please review the new amount below.",
  refund_failed: "Stripe couldn't process the refund, so your reservation was NOT cancelled. Please try again in a few minutes or contact your host.",
  missing_payment: "We couldn't find the payment for this reservation, so it wasn't cancelled. Please contact support.",
  not_allowed: "This reservation can't be cancelled online anymore.",
};

export default async function TripPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ paid?: string; cancel?: string; cancelled?: string; cancelError?: string }>;
}) {
  const { id } = await params;
  const { paid, cancel, cancelled, cancelError } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/trips/${id}`);
  const b = await db.booking.findUnique({
    where: { id },
    include: {
      listing: {
        include: {
          host: { select: { name: true, email: true, avatarUrl: true } },
          photos: { take: 1, orderBy: { position: "asc" } },
        },
      },
      review: true,
    },
  });
  if (!b || b.guestId !== user.id) notFound();
  const canReview = (b.status === "COMPLETED" || (b.status === "CONFIRMED" && b.checkOut <= todayUTC())) && !b.review;
  const host = b.listing.host;
  const hostFirst = host.name.split(" ")[0];
  const code = b.id.slice(-8).toUpperCase();
  const status = STATUS[b.status];
  const photo = b.listing.photos[0];
  const money = (c: number) => formatMoney(c, b.currency);
  const quote = computeRefund(b, "guest", new Date());
  const cancellable = (b.status === "CONFIRMED" || b.status === "PENDING_PAYMENT") && quote.allowed;
  const deadline = freeCancellationDeadline(b.checkIn);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-10">
      <Link href="/trips" className="inline-flex items-center gap-1 rounded-full py-1 text-sm font-semibold hover:underline">
        <Icon name="chevronLeft" className="h-4 w-4" /> Trips
      </Link>

      {paid && b.status === "CONFIRMED" && <p className="mt-4 rounded-xl bg-brand-50 p-4 font-semibold text-brand-900">You&apos;re booked! Your reservation is confirmed.</p>}
      {paid && b.status === "PENDING_PAYMENT" && <p className="mt-4 rounded-xl bg-amber-50 p-4 text-amber-800">Payment is processing. This page will update shortly.</p>}
      {cancelled && b.status === "CANCELLED" && (
        <p role="status" className="mt-4 rounded-xl bg-neutral-100 p-4 font-semibold text-neutral-900">
          Your reservation is cancelled.{" "}
          {b.refundCents > 0
            ? `Refunded ${money(b.refundCents)} to your card. It can take 5–10 days.`
            : "Nothing was charged, so there's nothing to refund."}
          {b.refundCents > 0 && b.paymentMode === "mock" && <span className="block text-sm font-normal text-neutral-600">Demo mode: no real money moved.</span>}
        </p>
      )}

      <div className="mt-4 grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0">
          <div className="relative aspect-[16/9] overflow-hidden rounded-xl bg-neutral-200">
            {photo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo.url} alt={photo.alt || b.listing.title} className="h-full w-full object-cover" />
            )}
            <span className={`absolute left-4 top-4 rounded-full px-3 py-1 text-sm font-semibold shadow-sm ${status.cls}`}>{status.label}</span>
          </div>

          <h1 className="mt-6 text-3xl font-semibold tracking-tight">Your stay at {hostFirst}&apos;s place</h1>
          <Link href={`/listings/${b.listingId}`} className="mt-1 inline-block text-neutral-600 underline-offset-2 hover:underline">{b.listing.title}</Link>

          <div className="mt-6 grid grid-cols-2 overflow-hidden rounded-xl border border-neutral-200">
            <div className="p-4 sm:p-5">
              <p className="text-sm font-semibold">Check-in</p>
              <p className="mt-1 text-lg">{fmt(b.checkIn)}</p>
              <p className="text-neutral-600">3:00 PM</p>
            </div>
            <div className="border-l border-neutral-200 p-4 sm:p-5">
              <p className="text-sm font-semibold">Checkout</p>
              <p className="mt-1 text-lg">{fmt(b.checkOut)}</p>
              <p className="text-neutral-600">11:00 AM</p>
            </div>
          </div>

          <div className="mt-2 divide-y divide-neutral-200">
            <Row icon="pin" title="Getting there" sub={`Address: ${[b.listing.city, b.listing.region, b.listing.country].filter(Boolean).join(", ")}`} />
            <div className="flex items-center gap-4 py-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-900 text-lg font-semibold text-white">
                {host.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={host.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  host.name.charAt(0).toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">Your host, {host.name}</p>
                <p className="truncate text-sm text-neutral-600">{host.email}</p>
              </div>
              <a href={`mailto:${host.email}`} className="btn-secondary shrink-0 text-sm">Message host</a>
            </div>
          </div>

          <section className="mt-4 border-t border-neutral-200 pt-8">
            <h2 className="text-2xl font-semibold">Reservation details</h2>
            <dl className="mt-4 divide-y divide-neutral-200">
              <Detail label="Who's coming" value={`${b.guests} guest${b.guests === 1 ? "" : "s"}`} />
              <Detail label="Confirmation code" value={<span className="font-mono tracking-wider">{code}</span>} />
              <Detail label="Nights" value={`${b.nights} night${b.nights === 1 ? "" : "s"}`} />
              <Detail label="Status" value={status.label} />
            </dl>
          </section>

          {canReview && (
            <form action={leaveReview} className="mt-8 rounded-xl border border-neutral-200 p-6">
              <h2 className="text-2xl font-semibold">How was your stay?</h2>
              <p className="mt-1 text-sm text-neutral-600">Your review helps future guests and {hostFirst}.</p>
              <input type="hidden" name="bookingId" value={b.id} />
              <fieldset className="mt-4">
                <legend className="sr-only">Rating</legend>
                {/* DOM order 5→1, shown 1→5 so "checked ~ label" fills the stars to its left. */}
                <div className="flex flex-row-reverse justify-end gap-1">
                  {[5, 4, 3, 2, 1].map((n) => (
                    <label
                      key={n}
                      title={`${n} star${n === 1 ? "" : "s"}`}
                      className="cursor-pointer text-neutral-300 transition hover:scale-110 hover:text-neutral-900 has-[:checked]:text-neutral-900 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500 [&:has(:checked)~label]:text-neutral-900 [&:hover~label]:text-neutral-900 rounded"
                    >
                      <input type="radio" name="rating" value={n} defaultChecked={n === 5} className="sr-only" />
                      <Icon name="star" className="h-10 w-10 fill-current" strokeWidth={1} />
                      <span className="sr-only">{n} star{n === 1 ? "" : "s"}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <textarea name="body" className="input mt-4 rounded-xl p-4 text-base" rows={4} required minLength={10} placeholder="Tell future guests what it was like" />
              <button className="btn-primary mt-4 px-6 py-3">Post review</button>
            </form>
          )}

          {cancellable && (
            <section id="cancel" className="mt-8 border-t border-neutral-200 pt-8">
              <h2 className="text-xl font-semibold">Need to change plans?</h2>
              {b.status === "PENDING_PAYMENT" ? (
                <p className="mt-1 text-sm text-neutral-600">You haven&apos;t been charged yet. Cancelling releases the dates.</p>
              ) : (
                <div className="mt-2 space-y-1 text-sm text-neutral-600">
                  <p>
                    <span className="font-semibold text-neutral-900">Flexible cancellation.</span> Cancel by {fmtMoment(deadline)} (24 hours before
                    check-in) for a refund of everything except card processing.
                  </p>
                  <p>After that, and until check-in, the first night is non-refundable; the rest is refunded.</p>
                  <p>
                    Card processing ({money(b.processingCents)}) can&apos;t be refunded: Stripe keeps its fee when a payment is refunded. Neither your
                    host nor Fairbnb gets it.
                  </p>
                  <p>If your host cancels, you get every cent back, card processing included.</p>
                </div>
              )}

              {cancelError && (
                <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-800">
                  {CANCEL_ERRORS[cancelError] ?? CANCEL_ERRORS.not_allowed}
                </p>
              )}

              {cancel ? (
                <div className="mt-4 rounded-xl border border-red-200 p-5" data-testid="cancel-confirm">
                  <h3 className="font-semibold">Cancel this reservation?</h3>
                  {quote.kind !== "unpaid" && (
                    <>
                      <dl className="mt-3 divide-y divide-neutral-100 text-sm">
                        {quote.lines.map((l) => (
                          <div key={l.label} className="flex justify-between gap-4 py-1.5">
                            <dt>
                              {l.label}
                              {l.note && <span className="block text-xs text-neutral-500">{l.note}</span>}
                            </dt>
                            <dd className={l.refunded ? "" : "text-neutral-500 line-through"}>{money(l.cents)}</dd>
                          </div>
                        ))}
                      </dl>
                      <p className="mt-3 flex justify-between border-t border-neutral-200 pt-3 text-base font-bold">
                        <span>You&apos;ll be refunded</span>
                        <span data-testid="refund-amount">{money(quote.refundCents)}</span>
                      </p>
                      <p className="mt-1 text-xs text-neutral-500">
                        {quote.reason} Refunds go back to the card you paid with and can take 5–10 days to appear.
                      </p>
                    </>
                  )}
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <form action={cancelBooking}>
                      <input type="hidden" name="bookingId" value={b.id} />
                      <input type="hidden" name="expectedRefundCents" value={quote.refundCents} />
                      <button className="btn-primary bg-red-700 px-5 py-2.5 hover:bg-red-800">
                        {quote.refundCents > 0 ? `Yes, cancel and refund ${money(quote.refundCents)}` : "Yes, cancel reservation"}
                      </button>
                    </form>
                    <Link href={`/trips/${b.id}`} className="btn-secondary px-5 py-2.5">Keep reservation</Link>
                  </div>
                </div>
              ) : (
                <Link href={`/trips/${b.id}?cancel=1#cancel`} scroll={false} className="btn-secondary mt-4 inline-flex text-red-700">
                  Cancel reservation
                </Link>
              )}
            </section>
          )}

          {b.status === "CONFIRMED" && !quote.allowed && b.checkOut > todayUTC() && (
            <section className="mt-8 border-t border-neutral-200 pt-8">
              <h2 className="text-xl font-semibold">Need to change plans?</h2>
              <p className="mt-1 text-sm text-neutral-600">{quote.reason}</p>
            </section>
          )}
        </div>

        <aside className="lg:pt-0">
          <div className="rounded-xl border border-neutral-200 p-6 shadow-sm lg:sticky lg:top-24">
            <h2 className="text-xl font-semibold">Payment info</h2>
            <div className="mt-4">
              <PriceBreakdown price={{ ...b, nightlyPriceCents: Math.round(b.subtotalCents / b.nights) }} currency={b.currency} />
            </div>
            {(b.status === "CANCELLED" || b.refundCents > 0) && (
              <div className="mt-4 border-t border-neutral-200 pt-4 text-sm">
                <div className="flex justify-between gap-4 font-semibold">
                  <span>Refunded</span>
                  <span data-testid="refunded-total">{money(b.refundCents)}</span>
                </div>
                {b.status === "CANCELLED" && (
                  <p className="mt-1 text-xs text-neutral-500">
                    Cancelled{b.cancelledBy === "host" ? " by your host" : b.cancelledBy === "guest" ? " by you" : b.cancelledBy === "system" ? " automatically (payment not completed)" : ""}
                    {b.cancelledAt ? ` on ${b.cancelledAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}` : ""}.
                  </p>
                )}
              </div>
            )}
            <p className="mt-4 border-t border-neutral-200 pt-4 text-xs text-neutral-500">
              Paid via {b.paymentMode === "stripe" ? "Stripe" : "demo checkout"} · Booked {b.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <div className="flex items-start gap-4 py-5">
      <Icon name={icon} className="mt-0.5 h-6 w-6 shrink-0" strokeWidth={1.5} />
      <div>
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-neutral-600">{sub}</p>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-4">
      <dt className="font-semibold">{label}</dt>
      <dd className="text-right text-neutral-700">{value}</dd>
    </div>
  );
}
