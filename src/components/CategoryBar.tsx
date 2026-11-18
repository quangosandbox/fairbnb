"use client";

import { useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CATEGORIES } from "@/lib/categories";
import { Icon } from "./Icons";

export function CategoryBar() {
  const sp = useSearchParams();
  const active = sp.get("category") ?? "trending";
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) => ref.current?.scrollBy({ left: dir * 300, behavior: "smooth" });
  const hrefFor = (slug: string) => {
    const p = new URLSearchParams(sp.toString());
    if (slug === "trending") p.delete("category");
    else p.set("category", slug);
    const s = p.toString();
    return s ? `/?${s}` : "/";
  };
  return (
    <div className="relative flex items-center">
      <button onClick={() => scroll(-1)} aria-label="Scroll categories left" className="absolute left-0 z-10 hidden rounded-full border border-neutral-300 bg-white p-1.5 shadow-sm hover:shadow md:block">
        <Icon name="chevronLeft" className="h-3.5 w-3.5" strokeWidth={2.5} />
      </button>
      <div ref={ref} className="flex gap-8 overflow-x-auto scroll-smooth px-0 [scrollbar-width:none] md:px-10 [&::-webkit-scrollbar]:hidden">
        {CATEGORIES.map((c) => {
          const on = c.slug === active;
          return (
            <Link
              key={c.slug}
              href={hrefFor(c.slug)}
              scroll={false}
              className={`flex shrink-0 flex-col items-center gap-2 border-b-2 pb-3 pt-1 text-xs font-semibold transition ${on ? "border-neutral-900 text-neutral-900" : "border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-900"}`}
            >
              <Icon name={c.icon} className="h-6 w-6" strokeWidth={1.6} />
              {c.label}
            </Link>
          );
        })}
      </div>
      <button onClick={() => scroll(1)} aria-label="Scroll categories right" className="absolute right-0 z-10 hidden rounded-full border border-neutral-300 bg-white p-1.5 shadow-sm hover:shadow md:block">
        <Icon name="chevronRight" className="h-3.5 w-3.5" strokeWidth={2.5} />
      </button>
    </div>
  );
}
