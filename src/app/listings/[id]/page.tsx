import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { parseDay, ratingSummary, toDay, todayUTC } from "@/lib/listings";
import { getFavoriteIds } from "@/app/actions/favorites";
import { HeartButton } from "@/components/HeartButton";
import { Icon } from "@/components/Icons";
import { Avatar } from "@/components/listing/Avatar";
import { Amenities } from "@/components/listing/Amenities";
import { Description } from "@/components/listing/Description";
import { Laurel } from "@/components/listing/Laurel";
import { ListingReservation } from "@/components/listing/ListingReservation";
import { PhotoGallery } from "@/components/listing/PhotoGallery";
import { Reviews, Stars, type ReviewItem } from "@/components/listing/Reviews";
import { ShareButton } from "@/components/listing/ShareButton";

export const dynamic = "force-dynamic";

type SP = { checkIn?: string; checkOut?: string; guests?: string; cancelled?: string };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function hostingFor(since: Date) {
  const months = Math.floor((Date.now() - since.getTime()) / (30.44 * 86_400_000));
  if (months >= 12) return `${plural(Math.floor(months / 12), "year")} hosting`;
  if (months >= 1) return `${plural(months, "month")} hosting`;
  return "New to hosting";
}

function hostingStat(since: Date) {
  const months = Math.floor((Date.now() - since.getTime()) / (30.44 * 86_400_000));
  return months >= 12 ? { value: Math.floor(months / 12), label: Math.floor(months / 12) === 1 ? "Year hosting" : "Years hosting" } : { value: Math.max(months, 0), label: months === 1 ? "Month hosting" : "Months hosting" };
}

function coord(v: number, pos: string, neg: string) {
  return `${Math.abs(v).toFixed(3)}° ${v >= 0 ? pos : neg}`;
}

export default async function ListingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const { id } = await params;
  const sp = await searchParams;
  const today = todayUTC();
  const [listing, user] = await Promise.all([
    db.listing.findUnique({
      where: { id },
      include: {
        photos: { orderBy: { position: "asc" } },
        host: { select: { id: true, name: true, bio: true, avatarUrl: true, createdAt: true } },
        reviews: { include: { author: { select: { name: true, avatarUrl: true } } }, orderBy: { createdAt: "desc" } },
      },
    }),
    getCurrentUser(),
  ]);
  if (!listing || (!listing.published && listing.hostId !== user?.id)) notFound();

  const [favoriteIds, bookings, hostReviews] = await Promise.all([
    getFavoriteIds(user?.id),
    // Same rule as blockingBookingWhere: paid stays, plus checkouts started in the last 30 minutes.
    db.booking.findMany({
      where: {
        listingId: listing.id,
        checkOut: { gte: today },
        OR: [{ status: { in: ["CONFIRMED", "COMPLETED"] } }, { status: "PENDING_PAYMENT", createdAt: { gt: new Date(Date.now() - 30 * 60_000) } }],
      },
      select: { checkIn: true, checkOut: true },
      orderBy: { checkIn: "asc" },
    }),
    db.review.aggregate({ where: { listing: { hostId: listing.hostId } }, _count: true, _avg: { rating: true } }),
  ]);
  const blocked = bookings.map((b) => ({ from: toDay(b.checkIn), to: toDay(b.checkOut) }));

  const { avgRating, reviewCount } = ratingSummary(listing.reviews);
  const guestFavorite = avgRating !== null && avgRating >= 4.8 && reviewCount >= 3;
  const isOwner = user?.id === listing.hostId;
  const saved = favoriteIds.has(listing.id);
  const host = listing.host;
  const hostFirst = host.name.split(" ")[0];
  const amen = listing.amenities.map((a) => a.toLowerCase());
  const has = (...words: string[]) => amen.some((a) => words.some((w) => a.includes(w)));

  // Initial trip from search params (ignored if invalid or in the past).
  const ci = parseDay(sp.checkIn);
  const co = parseDay(sp.checkOut);
  const validIn = ci && ci >= today ? sp.checkIn : undefined;
  const validOut = validIn && co && co > ci! ? sp.checkOut : undefined;
  const initialGuests = Math.min(listing.maxGuests, Math.max(1, Math.floor(Number(sp.guests)) || 1));

  const highlights: { icon: string; title: string; body: string }[] = [];
  if (has("self check-in", "keypad", "lockbox", "smart lock", "private entrance")) {
    highlights.push({ icon: "door", title: "Self check-in", body: "Let yourself in whenever you arrive after 3:00 PM." });
  }
  if (has("workspace")) highlights.push({ icon: "desk", title: "Room to work", body: "A dedicated workspace with wifi for the days you can't fully unplug." });
  highlights.push({ icon: "calendar", title: "Free cancellation before check-in", body: "Change of plans? Cancel any time before your stay starts." });
  highlights.push({ icon: "leaf", title: "Zero platform fee", body: `${hostFirst} keeps 100% of the nightly price. Fairbnb takes nothing from either of you.` });

  const reviewItems: ReviewItem[] = listing.reviews.map((r) => ({
    id: r.id,
    author: r.author.name.split(" ")[0],
    avatarUrl: r.author.avatarUrl,
    date: r.createdAt.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }),
    rating: r.rating,
    body: r.body,
  }));

  const ratingHeader = (
    <h2 className="flex items-center gap-2 text-2xl font-semibold text-neutral-900">
      <Icon name="star" className="h-5 w-5 fill-current" />
      {avgRating !== null ? <>{avgRating.toFixed(2)} · {plural(reviewCount, "review")}</> : "No reviews yet"}
    </h2>
  );
  const hs = hostingStat(host.createdAt);

  return (
    <div className="pb-24 lg:pb-0">
      {/* Mobile: full-bleed carousel first, like a native app */}
      <div className="md:hidden">
        <PhotoGallery photos={listing.photos} title={listing.title} variant="mobile" />
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {sp.cancelled && (
          <p className="mt-6 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Checkout was cancelled. You haven&apos;t been charged.
          </p>
        )}

        {/* Title row */}
        <div className="flex flex-col gap-2 pt-6 md:flex-row md:items-end md:justify-between md:gap-6">
          <h1 className="text-2xl font-semibold text-neutral-900 sm:text-[26px]">{listing.title}</h1>
          <div className="-ml-2 flex shrink-0 items-center gap-1 md:ml-0 md:-mr-2">
            <ShareButton />
            <HeartButton listingId={listing.id} saved={saved} variant="inline" />
          </div>
        </div>

        {/* Desktop photo grid */}
        <div className="mt-6 hidden md:block">
          <PhotoGallery photos={listing.photos} title={listing.title} variant="desktop" />
        </div>

        <ListingReservation
          listing={{
            id: listing.id,
            city: listing.city,
            nightlyPriceCents: listing.nightlyPriceCents,
            cleaningFeeCents: listing.cleaningFeeCents,
            taxRateBps: listing.taxRateBps,
            currency: listing.currency,
            maxGuests: listing.maxGuests,
            minNights: listing.minNights,
          }}
          blocked={blocked}
          initial={{ checkIn: validIn, checkOut: validOut, guests: initialGuests }}
          loggedIn={!!user}
          isOwner={isOwner}
          avgRating={avgRating}
          reviewCount={reviewCount}
        >
          {/* Overview */}
          <section className="pb-8 pt-6 md:pt-8">
            <h2 className="text-[22px] font-semibold text-neutral-900">
              {listing.propertyType} in {listing.city}, {listing.country}
            </h2>
            <p className="mt-1 text-neutral-700">
              {plural(listing.maxGuests, "guest")} · {plural(listing.bedrooms, "bedroom")} · {plural(listing.beds, "bed")} · {plural(listing.bathrooms, "bath")}
            </p>

            {guestFavorite ? (
              <a href="#reviews" className="mt-6 flex items-center gap-4 rounded-xl border border-neutral-300 px-5 py-4 transition hover:bg-neutral-50 sm:gap-6" data-testid="guest-favorite">
                <div className="flex items-center gap-1">
                  <Laurel />
                  <p className="text-center text-base font-semibold leading-tight text-neutral-900">
                    Guest
                    <br />
                    favorite
                  </p>
                  <Laurel flip />
                </div>
                <p className="hidden flex-1 font-medium text-neutral-800 sm:block">Among the best-loved stays on Fairbnb, by guest ratings</p>
                <div className="ml-auto flex items-center gap-4 sm:ml-0">
                  <div className="text-center">
                    <p className="text-lg font-semibold leading-tight">{avgRating.toFixed(2)}</p>
                    <Stars rating={Math.round(avgRating)} className="h-2.5 w-2.5" />
                  </div>
                  <div className="h-10 w-px bg-neutral-300" />
                  <div className="text-center">
                    <p className="text-lg font-semibold leading-tight">{reviewCount}</p>
                    <p className="text-xs font-semibold underline">Reviews</p>
                  </div>
                </div>
              </a>
            ) : (
              <p className="mt-2 flex items-center gap-1 font-semibold text-neutral-900">
                <Icon name="star" className="h-4 w-4 fill-current" />
                {avgRating !== null ? (
                  <>
                    {avgRating.toFixed(2)} ·{" "}
                    <a href="#reviews" className="underline">
                      {plural(reviewCount, "review")}
                    </a>
                  </>
                ) : (
                  "New · no reviews yet"
                )}
              </p>
            )}
          </section>

          {/* Host row */}
          <section className="flex items-center gap-4 border-t border-neutral-200 py-6">
            <Avatar name={host.name} src={host.avatarUrl} className="h-10 w-10 text-base" />
            <div>
              <p className="font-semibold text-neutral-900">Hosted by {host.name}</p>
              <p className="text-sm text-neutral-500">{hostingFor(host.createdAt)}</p>
            </div>
          </section>

          {/* Highlights */}
          <section className="space-y-6 border-t border-neutral-200 py-8">
            {highlights.slice(0, 3).map((h) => (
              <div key={h.title} className="flex gap-6">
                <Icon name={h.icon} className="mt-0.5 h-6 w-6 shrink-0 text-neutral-800" strokeWidth={1.5} />
                <div>
                  <p className="font-semibold text-neutral-900">{h.title}</p>
                  <p className="text-sm text-neutral-500">{h.body}</p>
                </div>
              </div>
            ))}
          </section>

          {/* Description */}
          <section className="border-t border-neutral-200 py-8">
            <Description text={listing.description} />
          </section>

          {/* Amenities */}
          <section className="border-t border-neutral-200 py-8">
            <h2 className="mb-6 text-[22px] font-semibold text-neutral-900">What this place offers</h2>
            <Amenities amenities={listing.amenities} />
          </section>

          <div className="border-t border-neutral-200" />
        </ListingReservation>

        {/* Reviews */}
        <section id="reviews" className="scroll-mt-24 border-t border-neutral-200 py-10">
          <div className="mb-8">{ratingHeader}</div>
          {reviewItems.length > 0 ? (
            <Reviews reviews={reviewItems} header={ratingHeader} />
          ) : (
            <p className="text-neutral-600">Be one of the first guests to stay here and leave a review.</p>
          )}
        </section>

        {/* Location */}
        <section className="border-t border-neutral-200 py-10">
          <h2 className="text-[22px] font-semibold text-neutral-900">Where you&apos;ll be</h2>
          <p className="mt-2 text-neutral-700">
            {listing.city}, {listing.region}, {listing.country}
          </p>
          <div
            className="relative mt-6 h-[320px] overflow-hidden rounded-xl bg-gradient-to-br from-brand-50 via-brand-100 to-emerald-50 sm:h-[420px]"
            role="img"
            aria-label={`Map placeholder for ${listing.city}`}
          >
            <div
              className="absolute inset-0 opacity-60"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(4,120,87,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(4,120,87,0.08) 1px, transparent 1px)",
                backgroundSize: "48px 48px",
              }}
            />
            <svg className="absolute inset-0 h-full w-full text-white" preserveAspectRatio="none" viewBox="0 0 400 200" aria-hidden>
              <path d="M-10 150 C 80 120, 140 170, 220 110 S 340 60, 420 80" fill="none" stroke="currentColor" strokeWidth="6" opacity="0.9" />
              <path d="M120 -10 C 140 60, 110 120, 160 210" fill="none" stroke="currentColor" strokeWidth="4" opacity="0.8" />
              <path d="M300 -10 C 280 70, 330 130, 300 210" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.7" />
              <ellipse cx="340" cy="160" rx="60" ry="30" fill="rgba(16,185,129,0.12)" stroke="none" />
            </svg>
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <span className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-500/15" />
              <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg ring-4 ring-white">
                <Icon name="pin" className="h-7 w-7" />
              </span>
            </div>
            {listing.latitude !== null && listing.longitude !== null && (
              <span className="absolute bottom-4 left-4 rounded-lg bg-white/90 px-3 py-1.5 text-xs font-semibold text-neutral-700 shadow-sm">
                {coord(listing.latitude, "N", "S")}, {coord(listing.longitude, "E", "W")}
              </span>
            )}
          </div>
          <p className="mt-4 text-sm text-neutral-500">The exact address is shared after your booking is confirmed.</p>
        </section>

        {/* Meet your host */}
        <section className="border-t border-neutral-200 py-10">
          <h2 className="mb-6 text-[22px] font-semibold text-neutral-900">Meet your host</h2>
          <div className="grid gap-10 md:grid-cols-[minmax(0,380px)_1fr] md:gap-16">
            <div className="flex items-center gap-6 rounded-3xl bg-white p-6 shadow-[0_6px_20px_rgba(0,0,0,0.12)]">
              <div className="flex flex-1 flex-col items-center text-center">
                <Avatar name={host.name} src={host.avatarUrl} className="h-24 w-24 text-4xl" />
                <p className="mt-3 text-2xl font-bold text-neutral-900">{host.name}</p>
                <p className="text-sm font-semibold text-neutral-600">Host</p>
              </div>
              <dl className="w-28 divide-y divide-neutral-200">
                <div className="pb-3">
                  <dd className="text-xl font-bold leading-tight">{hostReviews._count}</dd>
                  <dt className="text-[10px] font-semibold text-neutral-600">Reviews</dt>
                </div>
                <div className="py-3">
                  <dd className="flex items-center gap-1 text-xl font-bold leading-tight">
                    {hostReviews._avg.rating ? hostReviews._avg.rating.toFixed(2) : "–"}
                    <Icon name="star" className="h-3 w-3 fill-current" />
                  </dd>
                  <dt className="text-[10px] font-semibold text-neutral-600">Rating</dt>
                </div>
                <div className="pt-3">
                  <dd className="text-xl font-bold leading-tight">{hs.value}</dd>
                  <dt className="text-[10px] font-semibold text-neutral-600">{hs.label}</dt>
                </div>
              </dl>
            </div>
            <div className="space-y-5">
              {host.bio ? <p className="leading-relaxed text-neutral-800">{host.bio}</p> : <p className="text-neutral-600">{hostFirst} hasn&apos;t written a bio yet.</p>}
              <div className="flex gap-3 rounded-xl bg-brand-50 p-4 text-sm text-brand-900">
                <Icon name="leaf" className="h-5 w-5 shrink-0 text-brand-700" />
                <p>
                  When you book, your payment goes to {hostFirst} through Stripe. Fairbnb doesn&apos;t take a cut from either side.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Things to know */}
        <section className="border-t border-neutral-200 py-10">
          <h2 className="mb-6 text-[22px] font-semibold text-neutral-900">Things to know</h2>
          <div className="grid gap-8 text-neutral-800 md:grid-cols-3">
            <div>
              <h3 className="flex items-center gap-2 font-semibold text-neutral-900">
                <Icon name="key" className="h-5 w-5" strokeWidth={1.5} /> House rules
              </h3>
              <ul className="mt-3 space-y-2">
                <li>Check-in after 3:00 PM</li>
                <li>Checkout before 11:00 AM</li>
                <li>{plural(listing.maxGuests, "guest")} maximum</li>
                {listing.minNights > 1 && <li>{listing.minNights}-night minimum stay</li>}
                {has("pets allowed") && <li>Pets allowed</li>}
              </ul>
            </div>
            <div>
              <h3 className="flex items-center gap-2 font-semibold text-neutral-900">
                <Icon name="door" className="h-5 w-5" strokeWidth={1.5} /> Safety &amp; property
              </h3>
              <ul className="mt-3 space-y-2">
                <li>Ask {hostFirst} about smoke and carbon monoxide alarms</li>
                {has("pool", "hot tub", "plunge", "onsen", "beach", "waterfront", "creek", "kayak") && <li>Water nearby. Keep an eye on kids</li>}
                <li>Exact address shared after booking</li>
              </ul>
            </div>
            <div>
              <h3 className="flex items-center gap-2 font-semibold text-neutral-900">
                <Icon name="calendar" className="h-5 w-5" strokeWidth={1.5} /> Cancellation policy
              </h3>
              <ul className="mt-3 space-y-2">
                <li>Free cancellation before check-in.</li>
                <li>Refunds are handled by your host through Stripe.</li>
                <li>Fairbnb never charges a cancellation fee.</li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
