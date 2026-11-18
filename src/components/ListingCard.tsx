"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { calculatePrice, formatMoney } from "@/lib/pricing";
import { HeartButton } from "./HeartButton";
import { Icon } from "./Icons";
import { formatShort } from "./DateRangeCalendar";

export type CardListing = {
  id: string;
  title: string;
  city: string;
  country: string;
  propertyType: string;
  nightlyPriceCents: number;
  cleaningFeeCents: number;
  taxRateBps: number;
  currency: string;
  photos: { url: string; alt: string }[];
  host: { name: string };
  avgRating: number | null;
  reviewCount: number;
};

export function ListingCard({ listing: l, nights, query, saved, checkIn, checkOut }: {
  listing: CardListing;
  nights?: number;
  query?: string;
  saved: boolean;
  checkIn?: string;
  checkOut?: string;
}) {
  const price = nights ? calculatePrice({ ...l, nights }) : null;
  const [idx, setIdx] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const photos = l.photos.length ? l.photos : [{ url: "", alt: l.title }];
  const goTo = (i: number, e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    const n = Math.max(0, Math.min(photos.length - 1, i));
    track.current?.scrollTo({ left: n * track.current.clientWidth, behavior: "smooth" });
    setIdx(n);
  };
  const favorite = l.avgRating !== null && l.avgRating >= 4.8 && l.reviewCount >= 3;

  return (
    <Link href={`/listings/${l.id}${query ? `?${query}` : ""}`} className="group block">
      <div className="relative aspect-square overflow-hidden rounded-xl bg-neutral-200">
        <div
          ref={track}
          onScroll={(e) => setIdx(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
          className="flex h-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {photos.map((p, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={p.url} alt={p.alt || l.title} loading={i === 0 ? "eager" : "lazy"} className="h-full w-full shrink-0 snap-center object-cover" />
          ))}
        </div>
        {favorite && (
          <span className="absolute left-3 top-3 rounded-full bg-white px-3 py-1 text-xs font-semibold shadow">Guest favorite</span>
        )}
        <HeartButton listingId={l.id} saved={saved} />
        {photos.length > 1 && (
          <>
            {idx > 0 && (
              <button onClick={(e) => goTo(idx - 1, e)} aria-label="Previous photo" className="absolute left-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/90 p-1.5 shadow transition hover:scale-105 hover:bg-white group-hover:md:block">
                <Icon name="chevronLeft" className="h-3.5 w-3.5" strokeWidth={3} />
              </button>
            )}
            {idx < photos.length - 1 && (
              <button onClick={(e) => goTo(idx + 1, e)} aria-label="Next photo" className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/90 p-1.5 shadow transition hover:scale-105 hover:bg-white group-hover:md:block">
                <Icon name="chevronRight" className="h-3.5 w-3.5" strokeWidth={3} />
              </button>
            )}
            <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1">
              {photos.map((_, i) => (
                <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === idx ? "bg-white" : "bg-white/60"}`} />
              ))}
            </div>
          </>
        )}
      </div>
      <div className="mt-3 text-[15px] leading-snug">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate font-semibold">{l.city}, {l.country}</p>
          {l.avgRating !== null && (
            <p className="flex shrink-0 items-center gap-1">
              <Icon name="star" className="h-3 w-3 fill-current" />
              {l.avgRating.toFixed(2)}
            </p>
          )}
        </div>
        <p className="truncate text-neutral-500">{l.title}</p>
        <p className="truncate text-neutral-500">
          {checkIn && checkOut ? `${formatShort(checkIn)} – ${formatShort(checkOut)}` : `${l.propertyType} · Hosted by ${l.host.name.split(" ")[0]}`}
        </p>
        {price ? (
          <p className="mt-1.5">
            <span className="font-semibold underline">{formatMoney(price.totalCents, l.currency)}</span>{" "}
            <span className="text-neutral-700">total</span>
          </p>
        ) : (
          <p className="mt-1.5">
            <span className="font-semibold">{formatMoney(l.nightlyPriceCents, l.currency)}</span> <span className="text-neutral-700">night</span>
          </p>
        )}
      </div>
    </Link>
  );
}
