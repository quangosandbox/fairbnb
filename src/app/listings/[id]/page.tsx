import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ratingSummary } from "@/lib/listings";
import { BookingWidget } from "@/components/BookingWidget";

export const dynamic = "force-dynamic";

type SP = { checkIn?: string; checkOut?: string; guests?: string; cancelled?: string };

export default async function ListingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const { id } = await params;
  const sp = await searchParams;
  const [listing, user] = await Promise.all([
    db.listing.findUnique({
      where: { id },
      include: {
        photos: { orderBy: { position: "asc" } },
        host: { select: { id: true, name: true, bio: true, avatarUrl: true, createdAt: true } },
        reviews: { include: { author: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
      },
    }),
    getCurrentUser(),
  ]);
  if (!listing || (!listing.published && listing.hostId !== user?.id)) notFound();
  const { avgRating, reviewCount } = ratingSummary(listing.reviews);
  const [hero, ...rest] = listing.photos;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {sp.cancelled && <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Checkout was cancelled. You haven&apos;t been charged.</p>}
      <h1 className="text-2xl font-bold sm:text-3xl">{listing.title}</h1>
      <p className="mt-1 text-sm text-neutral-600">
        {avgRating !== null && <>★ {avgRating.toFixed(2)} · {reviewCount} review{reviewCount === 1 ? "" : "s"} · </>}
        {listing.city}, {listing.region}, {listing.country}
      </p>

      <div className="mt-4 grid gap-2 overflow-hidden rounded-2xl sm:grid-cols-4 sm:grid-rows-2">
        {hero && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={hero.url} alt={hero.alt || listing.title} className="aspect-[4/3] h-full w-full object-cover sm:col-span-2 sm:row-span-2" />
        )}
        {rest.slice(0, 4).map((p) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={p.id} src={p.url} alt={p.alt || listing.title} className="hidden aspect-[4/3] h-full w-full object-cover sm:block" />
        ))}
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_380px]">
        <div>
          <div className="border-b border-neutral-200 pb-6">
            <h2 className="text-xl font-semibold">{listing.propertyType} hosted by {listing.host.name}</h2>
            <p className="text-neutral-600">
              {listing.maxGuests} guests · {listing.bedrooms} bedroom{listing.bedrooms === 1 ? "" : "s"} · {listing.beds} bed{listing.beds === 1 ? "" : "s"} · {listing.bathrooms} bath{listing.bathrooms === 1 ? "" : "s"}
            </p>
          </div>
          <div className="whitespace-pre-line border-b border-neutral-200 py-6 leading-relaxed">{listing.description}</div>
          {listing.amenities.length > 0 && (
            <div className="border-b border-neutral-200 py-6">
              <h3 className="text-lg font-semibold">What this place offers</h3>
              <ul className="mt-3 grid grid-cols-2 gap-2 text-sm">
                {listing.amenities.map((a) => <li key={a}>✓ {a}</li>)}
              </ul>
            </div>
          )}
          <div className="border-b border-neutral-200 py-6">
            <h3 className="text-lg font-semibold">About the host</h3>
            <p className="mt-1 font-medium">{listing.host.name}</p>
            <p className="text-sm text-neutral-500">Hosting since {listing.host.createdAt.getFullYear()}</p>
            {listing.host.bio && <p className="mt-2 text-sm">{listing.host.bio}</p>}
          </div>
          <div className="py-6">
            <h3 className="text-lg font-semibold">
              {reviewCount ? <>★ {avgRating!.toFixed(2)} · {reviewCount} review{reviewCount === 1 ? "" : "s"}</> : "No reviews yet"}
            </h3>
            <div className="mt-4 grid gap-6 sm:grid-cols-2">
              {listing.reviews.map((r) => (
                <div key={r.id}>
                  <p className="font-medium">{r.author.name}</p>
                  <p className="text-xs text-neutral-500">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)} · {r.createdAt.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p>
                  <p className="mt-1 text-sm">{r.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="lg:sticky lg:top-24 lg:self-start">
          <BookingWidget
            listing={listing}
            initial={{ checkIn: sp.checkIn, checkOut: sp.checkOut, guests: sp.guests }}
            loggedIn={!!user}
            isOwner={user?.id === listing.hostId}
          />
        </div>
      </div>
    </div>
  );
}
