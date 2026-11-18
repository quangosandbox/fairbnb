"use client";

import { useState } from "react";

/** Round avatar: the photo sits on top of an initial circle and is dropped if it fails to load. */
export function Avatar({ name, src, className = "h-10 w-10 text-base" }: { name: string; src?: string | null; className?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-800 font-semibold text-white ${className}`}>
      <span aria-hidden>{name.trim().charAt(0).toUpperCase() || "?"}</span>
      {src && !failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" onError={() => setFailed(true)} className="absolute inset-0 h-full w-full object-cover" />
      )}
    </span>
  );
}
