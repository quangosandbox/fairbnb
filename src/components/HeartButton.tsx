"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleFavorite } from "@/app/actions/favorites";
import { Icon } from "./Icons";

/** Airbnb-style save heart. `variant="overlay"` sits on photos; `"inline"` is the "Save" button on listing pages. */
export function HeartButton({ listingId, saved: initial, variant = "overlay" }: { listingId: string; saved: boolean; variant?: "overlay" | "inline" }) {
  const [saved, setSaved] = useState(initial);
  const [pending, start] = useTransition();
  const router = useRouter();
  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSaved((s) => !s);
    start(async () => {
      const res = await toggleFavorite(listingId);
      if (res === null) {
        setSaved(initial);
        router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      } else setSaved(res);
    });
  };
  if (variant === "inline") {
    return (
      <button onClick={onClick} disabled={pending} className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-semibold underline hover:bg-neutral-100">
        <Icon name="heart" className={`h-4 w-4 ${saved ? "fill-brand-600 text-brand-600" : ""}`} />
        {saved ? "Saved" : "Save"}
      </button>
    );
  }
  return (
    <button onClick={onClick} disabled={pending} aria-label={saved ? "Remove from wishlist" : "Save to wishlist"} className="absolute right-3 top-3 z-10 transition active:scale-90">
      <Icon name="heart" strokeWidth={2} className={`h-7 w-7 drop-shadow ${saved ? "fill-brand-600 text-white" : "fill-black/40 text-white"}`} />
    </button>
  );
}
