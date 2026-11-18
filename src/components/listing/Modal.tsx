"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/Icons";

/**
 * Dialog rendered into <body>.
 *  - "center": full-screen on phones, centered rounded panel from md up (amenities, reviews, description).
 *  - "sheet":  slides up from the bottom on phones, centered panel from md up (mobile booking card).
 *  - "full":   always full-screen (photo tour).
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  variant = "center",
  size = "md:max-w-3xl",
  headerRight,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  variant?: "center" | "sheet" | "full";
  /** Full Tailwind class for the panel width from md up, e.g. "md:max-w-lg". */
  size?: string;
  headerRight?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  if (variant === "full") {
    return createPortal(
      <div role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined} className="fixed inset-0 z-50 overflow-y-auto bg-white">
        <div className="sticky top-0 z-10 flex items-center justify-between bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-2 hover:bg-neutral-100">
            <Icon name="chevronLeft" className="h-5 w-5" />
          </button>
          {title && <p className="text-sm font-semibold">{title}</p>}
          <div className="min-w-9">{headerRight}</div>
        </div>
        {children}
      </div>,
      document.body,
    );
  }

  const panel =
    variant === "sheet"
      ? `absolute inset-x-0 bottom-0 max-h-[92vh] rounded-t-2xl md:relative md:inset-auto md:mx-auto md:my-[5vh] md:max-h-[90vh] md:rounded-2xl ${size}`
      : `absolute inset-0 md:relative md:inset-auto md:mx-auto md:my-[5vh] md:max-h-[90vh] md:rounded-2xl ${size}`;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined} className="fixed inset-0 z-50 md:flex md:items-start md:justify-center md:px-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className={`flex w-full flex-col overflow-hidden bg-white shadow-2xl ${panel}`}>
        <div className="flex shrink-0 items-center gap-3 border-b border-neutral-200 px-4 py-3 sm:px-6">
          <button type="button" onClick={onClose} aria-label="Close" className="-ml-2 rounded-full p-2 hover:bg-neutral-100">
            <Icon name="close" className="h-4 w-4" />
          </button>
          {title && <h2 className="flex-1 text-center text-base font-semibold">{title}</h2>}
          <div className="w-8">{headerRight}</div>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
