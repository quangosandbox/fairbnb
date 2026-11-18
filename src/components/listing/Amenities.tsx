"use client";

import { useCallback, useState } from "react";
import { Icon, amenityIcon } from "@/components/Icons";
import { Modal } from "./Modal";

export function Amenities({ amenities }: { amenities: string[] }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  if (amenities.length === 0) return <p className="text-neutral-600">The host hasn&apos;t listed amenities yet.</p>;
  return (
    <>
      <ul className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {amenities.slice(0, 10).map((a) => (
          <li key={a} className="flex items-center gap-4 text-neutral-800">
            <Icon name={amenityIcon(a)} className="h-6 w-6 shrink-0 text-neutral-700" strokeWidth={1.5} />
            {a}
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => setOpen(true)} className="mt-8 rounded-lg border border-neutral-900 px-6 py-3 font-semibold transition hover:bg-neutral-100">
        Show all {amenities.length} amenities
      </button>
      <Modal open={open} onClose={close} title="What this place offers" size="md:max-w-2xl">
        <ul className="divide-y divide-neutral-200 px-6 pb-6">
          {amenities.map((a) => (
            <li key={a} className="flex items-center gap-4 py-5 text-neutral-800">
              <Icon name={amenityIcon(a)} className="h-6 w-6 shrink-0 text-neutral-700" strokeWidth={1.5} />
              {a}
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}
