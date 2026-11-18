import Link from "next/link";
import { calculatePrice, formatMoney } from "@/lib/pricing";

type Props = {
  listing: {
    id: string;
    title: string;
    city: string;
    region: string;
    country: string;
    propertyType: string;
    nightlyPriceCents: number;
    cleaningFeeCents: number;
    taxRateBps: number;
    currency: string;
    photos: { url: string; alt: string }[];
    avgRating: number | null;
    reviewCount: number;
  };
  nights?: number;
  query?: string;
};

export function ListingCard({ listing: l, nights, query }: Props) {
  const price = nights ? calculatePrice({ ...l, nights }) : null;
  return (
    <Link href={`/listings/${l.id}${query ? `?${query}` : ""}`} className="group block">
      <div className="aspect-[4/3] overflow-hidden rounded-xl bg-neutral-100">
        {l.photos[0] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={l.photos[0].url} alt={l.photos[0].alt || l.title} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
        )}
      </div>
      <div className="mt-2 flex items-start justify-between gap-2">
        <p className="font-semibold leading-tight">{l.city}, {l.country}</p>
        {l.avgRating !== null && <p className="shrink-0 text-sm">★ {l.avgRating.toFixed(2)} <span className="text-neutral-500">({l.reviewCount})</span></p>}
      </div>
      <p className="line-clamp-1 text-sm text-neutral-600">{l.title}</p>
      <p className="text-sm text-neutral-500">{l.propertyType}</p>
      {price ? (
        <p className="mt-1">
          <span className="font-semibold">{formatMoney(price.totalCents, l.currency)}</span>{" "}
          <span className="text-sm text-neutral-600">total for {nights} night{nights === 1 ? "" : "s"}</span>
        </p>
      ) : (
        <p className="mt-1">
          <span className="font-semibold">{formatMoney(l.nightlyPriceCents, l.currency)}</span>{" "}
          <span className="text-sm text-neutral-600">night · no service fee</span>
        </p>
      )}
    </Link>
  );
}
