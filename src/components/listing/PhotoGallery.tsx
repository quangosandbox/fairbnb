"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icons";
import { Modal } from "./Modal";

export type Photo = { id: string; url: string; alt: string };

/**
 * Listing photos.
 *  - variant "desktop": one large photo on the left half, a 2×2 grid on the right, "Show all photos" button.
 *  - variant "mobile":  full-bleed swipeable carousel with a "1 / 5" counter.
 * Either one opens the full-screen photo tour.
 */
export function PhotoGallery({ photos, title, variant }: { photos: Photo[]; title: string; variant: "desktop" | "mobile" }) {
  const [tourAt, setTourAt] = useState<number | null>(null);
  const close = useCallback(() => setTourAt(null), []);

  return (
    <>
      {variant === "desktop" ? <DesktopGrid photos={photos} title={title} onOpen={setTourAt} /> : <MobileCarousel photos={photos} title={title} onOpen={setTourAt} />}
      <PhotoTour photos={photos} title={title} startAt={tourAt} onClose={close} />
    </>
  );
}

function DesktopGrid({ photos, title, onOpen }: { photos: Photo[]; title: string; onOpen: (i: number) => void }) {
  if (photos.length === 0) {
    return <div className="flex h-[420px] items-center justify-center rounded-xl bg-neutral-100 text-neutral-500">No photos yet</div>;
  }
  const single = photos.length === 1;
  const slots = single ? [photos[0]] : Array.from({ length: 5 }, (_, i) => photos[i] ?? null);
  return (
    <div className={`relative grid h-[420px] gap-2 overflow-hidden rounded-xl lg:h-[480px] ${single ? "grid-cols-1" : "grid-cols-4 grid-rows-2"}`}>
      {slots.map((p, i) =>
        p ? (
          <button
            key={p.id}
            type="button"
            onClick={() => onOpen(i)}
            className={`group relative h-full w-full overflow-hidden bg-neutral-200 ${i === 0 && !single ? "col-span-2 row-span-2" : ""}`}
            aria-label={`Open photo ${i + 1} of ${photos.length}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={p.alt || title} className="h-full w-full object-cover" />
            <span className="absolute inset-0 bg-black/0 transition group-hover:bg-black/15" />
          </button>
        ) : (
          <div key={`empty-${i}`} className="bg-neutral-100" />
        ),
      )}
      <button
        type="button"
        onClick={() => onOpen(0)}
        className="absolute bottom-5 right-5 flex items-center gap-2 rounded-lg border border-neutral-900 bg-white px-4 py-1.5 text-sm font-semibold shadow-sm transition hover:bg-neutral-100"
      >
        <Icon name="grid" className="h-4 w-4" />
        Show all photos
      </button>
    </div>
  );
}

function MobileCarousel({ photos, title, onOpen }: { photos: Photo[]; title: string; onOpen: (i: number) => void }) {
  const [index, setIndex] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const onScroll = () => {
    const el = ref.current;
    if (el && el.clientWidth) setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };
  if (photos.length === 0) return <div className="aspect-[4/3] w-full bg-neutral-100" />;
  return (
    <div className="relative">
      <div
        ref={ref}
        onScroll={onScroll}
        className="flex aspect-[4/3] w-full snap-x snap-mandatory overflow-x-auto bg-neutral-200 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {photos.map((p, i) => (
          <button key={p.id} type="button" onClick={() => onOpen(i)} className="h-full w-full shrink-0 snap-center snap-always" aria-label={`Open photo ${i + 1} of ${photos.length}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={p.alt || title} className="h-full w-full object-cover" loading={i < 2 ? "eager" : "lazy"} />
          </button>
        ))}
      </div>
      <span className="pointer-events-none absolute bottom-3 right-3 rounded-md bg-black/65 px-2.5 py-1 text-xs font-semibold text-white" data-testid="photo-counter">
        {Math.min(index + 1, photos.length)} / {photos.length}
      </span>
    </div>
  );
}

/** Full-screen "photo tour": every photo stacked, alternating one wide and two side by side. */
function PhotoTour({ photos, title, startAt, onClose }: { photos: Photo[]; title: string; startAt: number | null; onClose: () => void }) {
  useEffect(() => {
    if (startAt === null) return;
    // Wait a frame so the portal has mounted.
    const t = requestAnimationFrame(() => document.getElementById(`tour-photo-${startAt}`)?.scrollIntoView({ block: "center" }));
    return () => cancelAnimationFrame(t);
  }, [startAt]);

  return (
    <Modal open={startAt !== null} onClose={onClose} variant="full" title={`${photos.length} photo${photos.length === 1 ? "" : "s"}`}>
      <div className="mx-auto max-w-3xl px-4 pb-16 pt-4 sm:px-6">
        <h2 className="mb-6 text-2xl font-semibold">Photo tour</h2>
        <div className="grid grid-cols-2 gap-2">
          {photos.map((p, i) => (
            <figure key={p.id} id={`tour-photo-${i}`} className={`scroll-mt-20 ${i % 3 === 0 ? "col-span-2" : ""}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={p.alt || title} className={`w-full bg-neutral-200 object-cover ${i % 3 === 0 ? "aspect-[3/2]" : "aspect-square"}`} />
              {p.alt && <figcaption className="mt-1 text-xs text-neutral-500">{p.alt}</figcaption>}
            </figure>
          ))}
        </div>
      </div>
    </Modal>
  );
}
