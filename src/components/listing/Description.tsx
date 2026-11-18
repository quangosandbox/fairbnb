"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icons";
import { Modal } from "./Modal";

/** Description clamped to ~6 lines, with "Show more" opening the full text in a dialog. */
export function Description({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setOverflowing(el.scrollHeight > el.clientHeight + 2);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <>
      <p ref={ref} className="line-clamp-6 whitespace-pre-line leading-relaxed text-neutral-800">
        {text}
      </p>
      {overflowing && (
        <button type="button" onClick={() => setOpen(true)} className="mt-4 flex items-center gap-1 font-semibold underline">
          Show more <Icon name="chevronRight" className="h-4 w-4" />
        </button>
      )}
      <Modal open={open} onClose={close} title="About this place">
        <div className="whitespace-pre-line px-6 py-6 leading-relaxed text-neutral-800">{text}</div>
      </Modal>
    </>
  );
}
