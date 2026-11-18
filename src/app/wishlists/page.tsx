import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { formatMoney } from "@/lib/pricing";
import { ratingSummary } from "@/lib/listings";
import { HeartButton } from "@/components/HeartButton";
import { Icon } from "@/components/Icons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Wishlists — Fairbnb" };

export default async function WishlistsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/wishlists");
  const favorites = await db.favorite.findMany({
    where: { userId: user.id },
    include: {
      listing: {
        include: {
          photos: { orderBy: { position: "asc" }, take: 1 },
          reviews: { select: { rating: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-10">
      <h1 className="text-3xl font-semibold tracking-tight">Wishlists</h1>
      {favorites.length === 0 ? (
        <div className="mt-8 max-w-md border-t border-neutral-200 pt-8">
          <Icon name="heart" className="h-8 w-8 text-neutral-800" strokeWidth={1.5} />
          <h2 className="mt-4 text-2xl font-semibold">Create your first wishlist</h2>
          <p className="mt-2 text-neutral-600">As you search, tap the heart icon to save your favorite places.</p>
          <Link href="/" className="mt-6 inline-flex rounded-lg border border-neutral-900 px-6 py-3 font-semibold hover:bg-neutral-50">
            Explore stays
          </Link>
        </div>
      ) : (
        <>
          <p className="mt-1 text-neutral-600">{favorites.length} saved {favorites.length === 1 ? "place" : "places"}</p>
          <div className="mt-6 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {favorites.map(({ listing: l }) => {
              const { avgRating, reviewCount } = ratingSummary(l.reviews);
              return (
                <Link key={l.id} href={`/listings/${l.id}`} className="group block">
                  <div className="relative aspect-square overflow-hidden rounded-xl bg-neutral-200">
                    {l.photos[0] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={l.photos[0].url} alt={l.photos[0].alt || l.title} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                    )}
                    <HeartButton listingId={l.id} saved />
                  </div>
                  <div className="mt-3 flex items-start justify-between gap-2 text-[15px]">
                    <p className="truncate font-semibold">{l.city}, {l.country}</p>
                    {avgRating !== null && (
                      <p className="flex shrink-0 items-center gap-1">
                        <Icon name="star" className="h-3.5 w-3.5 fill-current" />
                        {avgRating.toFixed(2)}
                        <span className="text-neutral-500">({reviewCount})</span>
                      </p>
                    )}
                  </div>
                  <p className="truncate text-neutral-600">{l.title}</p>
                  <p className="mt-1"><span className="font-semibold">{formatMoney(l.nightlyPriceCents, l.currency)}</span> night</p>
                  {!l.published && <p className="mt-1 text-xs text-neutral-500">Currently unavailable</p>}
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
