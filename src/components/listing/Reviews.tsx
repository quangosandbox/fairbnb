"use client";

import { useCallback, useState } from "react";
import { Icon } from "@/components/Icons";
import { Avatar } from "./Avatar";
import { Modal } from "./Modal";

export type ReviewItem = { id: string; author: string; avatarUrl: string | null; date: string; rating: number; body: string };

export function Stars({ rating, className = "h-3 w-3" }: { rating: number; className?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Icon key={i} name="star" strokeWidth={1.5} className={`${className} ${i < rating ? "fill-current text-neutral-900" : "text-neutral-300"}`} />
      ))}
    </span>
  );
}

function Review({ r, clamp }: { r: ReviewItem; clamp: boolean }) {
  return (
    <article>
      <div className="flex items-center gap-3">
        <Avatar name={r.author} src={r.avatarUrl} className="h-12 w-12 text-lg" />
        <div>
          <p className="font-semibold text-neutral-900">{r.author}</p>
          <p className="text-sm text-neutral-500">{r.date}</p>
        </div>
      </div>
      <div className="mt-3">
        <Stars rating={r.rating} className="h-2.5 w-2.5" />
      </div>
      <p className={`mt-1 whitespace-pre-line leading-relaxed text-neutral-800 ${clamp ? "line-clamp-3" : ""}`}>{r.body}</p>
    </article>
  );
}

export function Reviews({ reviews, header }: { reviews: ReviewItem[]; header: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <div className="grid gap-x-16 gap-y-10 md:grid-cols-2">
        {reviews.slice(0, 6).map((r) => <Review key={r.id} r={r} clamp />)}
      </div>
      {reviews.length > 6 && (
        <button type="button" onClick={() => setOpen(true)} className="mt-10 rounded-lg border border-neutral-900 px-6 py-3 font-semibold transition hover:bg-neutral-100">
          Show all {reviews.length} reviews
        </button>
      )}
      <Modal open={open} onClose={close} title="Reviews" size="md:max-w-3xl">
        <div className="px-6 py-6">
          <div className="mb-8">{header}</div>
          <div className="space-y-10">
            {reviews.map((r) => <Review key={r.id} r={r} clamp={false} />)}
          </div>
        </div>
      </Modal>
    </>
  );
}
