"use client";

import { useState } from "react";
import { Icon } from "@/components/Icons";

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for non-secure contexts (e.g. plain http on a LAN IP).
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

export function ShareButton() {
  const [copied, setCopied] = useState(false);
  const onClick = async () => {
    const url = window.location.href;
    if (await copy(url)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  return (
    <div className="relative">
      <button type="button" onClick={onClick} className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-semibold underline hover:bg-neutral-100">
        <Icon name="share" className="h-4 w-4" />
        Share
      </button>
      <span
        role="status"
        aria-live="polite"
        className={`pointer-events-none absolute right-0 top-full mt-2 whitespace-nowrap rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white shadow-lg transition ${copied ? "opacity-100" : "opacity-0"}`}
      >
        {copied ? (
          <span className="flex items-center gap-1.5">
            <Icon name="check" className="h-3.5 w-3.5" /> Link copied
          </span>
        ) : null}
      </span>
    </div>
  );
}
