"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import { DateRangeCalendar, GuestPicker, formatShort, guestSummary, useClickOutside, type GuestCounts } from "./DateRangeCalendar";
import { Icon } from "./Icons";

export type Destination = { city: string; region: string; country: string };
type Panel = "where" | "checkIn" | "checkOut" | "who" | null;

function useSearchState() {
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [checkIn, setCheckIn] = useState<string | undefined>(sp.get("checkIn") ?? undefined);
  const [checkOut, setCheckOut] = useState<string | undefined>(sp.get("checkOut") ?? undefined);
  const g = Number(sp.get("guests")) || 0;
  const [guests, setGuests] = useState<GuestCounts>({ adults: Math.max(1, g), children: 0, infants: 0, pets: 0 });
  const [guestsTouched, setGuestsTouched] = useState(g > 0);
  const router = useRouter();
  const submit = () => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (checkIn && checkOut) {
      params.set("checkIn", checkIn);
      params.set("checkOut", checkOut);
    }
    if (guestsTouched) params.set("guests", String(guests.adults + guests.children));
    const cat = sp.get("category");
    if (cat) params.set("category", cat);
    router.push(`/?${params.toString()}`);
  };
  return { q, setQ, checkIn, checkOut, setDates: (a?: string, b?: string) => { setCheckIn(a); setCheckOut(b); }, guests, setGuests: (x: GuestCounts) => { setGuests(x); setGuestsTouched(true); }, guestsTouched, submit, sp };
}

function DestinationList({ destinations, q, onPick }: { destinations: Destination[]; q: string; onPick: (s: string) => void }) {
  const needle = q.trim().toLowerCase();
  const list = (needle
    ? destinations.filter((d) => `${d.city} ${d.region} ${d.country}`.toLowerCase().includes(needle))
    : destinations
  ).slice(0, 7);
  return (
    <div>
      <p className="px-4 pb-2 text-xs font-semibold text-neutral-500">{needle ? "Matches" : "Suggested destinations"}</p>
      {list.length === 0 && <p className="px-4 py-2 text-sm text-neutral-500">Search for “{q}”</p>}
      {list.map((d) => (
        <button type="button" key={`${d.city}-${d.country}`} onClick={() => onPick(d.city)} className="flex w-full items-center gap-4 rounded-xl px-4 py-2.5 text-left hover:bg-neutral-100">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Icon name="pin" /></span>
          <span>
            <span className="block text-sm font-medium">{d.city}, {d.country}</span>
            <span className="block text-xs text-neutral-500">{d.region}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

/** Full desktop pill: Where | Check in | Check out | Who [search]. */
export function SearchBar({ destinations, onDone }: { destinations: Destination[]; onDone?: () => void }) {
  const s = useSearchState();
  const [panel, setPanel] = useState<Panel>(null);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setPanel(null), []);
  useClickOutside(ref, close, panel !== null);
  const go = () => { setPanel(null); s.submit(); onDone?.(); };

  const seg = (id: Panel, label: string, value: React.ReactNode, extra = "") => (
    <button
      type="button"
      onClick={() => setPanel(id)}
      className={`relative rounded-full px-6 py-3 text-left transition ${panel === id ? "bg-white shadow-lg" : panel ? "hover:bg-neutral-200" : "hover:bg-neutral-100"} ${extra}`}
    >
      <span className="block text-xs font-semibold text-neutral-900">{label}</span>
      <span className="block truncate text-sm text-neutral-500">{value}</span>
    </button>
  );

  return (
    <div ref={ref} className="relative mx-auto w-full max-w-[850px]">
      <div className={`grid grid-cols-[1.4fr_1fr_1fr_1.3fr] items-center rounded-full border border-neutral-200 shadow-md transition ${panel ? "bg-neutral-100" : "bg-white"}`}>
        <div className={`relative rounded-full px-6 py-3 transition ${panel === "where" ? "bg-white shadow-lg" : panel ? "hover:bg-neutral-200" : "hover:bg-neutral-100"}`} onClick={() => setPanel("where")}>
          <label htmlFor="search-where" className="block text-xs font-semibold">Where</label>
          <input
            id="search-where"
            value={s.q}
            onChange={(e) => { s.setQ(e.target.value); setPanel("where"); }}
            onFocus={() => setPanel("where")}
            onKeyDown={(e) => e.key === "Enter" && go()}
            placeholder="Search destinations"
            autoComplete="off"
            className="w-full bg-transparent text-sm outline-none placeholder:text-neutral-500"
          />
        </div>
        {seg("checkIn", "Check in", s.checkIn ? formatShort(s.checkIn) : "Add dates")}
        {seg("checkOut", "Check out", s.checkOut ? formatShort(s.checkOut) : "Add dates")}
        <div className={`flex items-center justify-between rounded-full py-2 pl-6 pr-2 transition ${panel === "who" ? "bg-white shadow-lg" : panel ? "hover:bg-neutral-200" : "hover:bg-neutral-100"}`}>
          <button type="button" onClick={() => setPanel("who")} className="min-w-0 flex-1 text-left">
            <span className="block text-xs font-semibold">Who</span>
            <span className="block truncate text-sm text-neutral-500">{s.guestsTouched ? guestSummary(s.guests) : "Add guests"}</span>
          </button>
          <button type="button" onClick={go} className="flex h-12 items-center gap-2 rounded-full bg-brand-600 px-4 font-semibold text-white hover:bg-brand-700">
            <Icon name="search" className="h-4 w-4" strokeWidth={3} />
            {panel && <span>Search</span>}
          </button>
        </div>
      </div>

      {panel === "where" && (
        <div className="absolute left-0 top-full z-40 mt-3 w-[420px] rounded-3xl bg-white py-6 shadow-2xl ring-1 ring-black/5">
          <DestinationList destinations={destinations} q={s.q} onPick={(c) => { s.setQ(c); setPanel("checkIn"); }} />
        </div>
      )}
      {(panel === "checkIn" || panel === "checkOut") && (
        <div className="absolute left-1/2 top-full z-40 mt-3 w-[min(850px,95vw)] -translate-x-1/2 rounded-3xl bg-white p-8 shadow-2xl ring-1 ring-black/5">
          <DateRangeCalendar
            checkIn={s.checkIn}
            checkOut={s.checkOut}
            onChange={(a, b) => { s.setDates(a, b); setPanel(b ? "who" : "checkOut"); }}
          />
          <div className="mt-4 flex justify-end">
            <button type="button" className="text-sm font-semibold underline" onClick={() => s.setDates(undefined, undefined)}>Clear dates</button>
          </div>
        </div>
      )}
      {panel === "who" && (
        <div className="absolute right-0 top-full z-40 mt-3 w-[400px] rounded-3xl bg-white px-8 py-4 shadow-2xl ring-1 ring-black/5">
          <GuestPicker value={s.guests} onChange={s.setGuests} />
        </div>
      )}
    </div>
  );
}

/** Mobile: a "Where to?" pill that opens a full-screen search sheet. */
export function MobileSearch({ destinations }: { destinations: Destination[] }) {
  const s = useSearchState();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"where" | "when" | "who">("where");
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);
  const summary = [s.q || "Anywhere", s.checkIn && s.checkOut ? `${formatShort(s.checkIn)} – ${formatShort(s.checkOut)}` : "Any week", s.guestsTouched ? guestSummary(s.guests) : "Add guests"];

  const card = (id: typeof step, label: string, value: string, body: React.ReactNode) =>
    step === id ? (
      <div className="rounded-3xl bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-2xl font-bold">{label === "Where" ? "Where to?" : label === "When" ? "When's your trip?" : "Who's coming?"}</h2>
        {body}
      </div>
    ) : (
      <button type="button" onClick={() => setStep(id)} className="flex w-full justify-between rounded-2xl bg-white px-5 py-4 text-sm shadow">
        <span className="text-neutral-500">{label}</span>
        <span className="font-semibold">{value}</span>
      </button>
    );

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex w-full items-center gap-3 rounded-full border border-neutral-200 bg-white px-5 py-2.5 text-left shadow-md">
        <Icon name="search" className="h-5 w-5" strokeWidth={2.5} />
        <span className="min-w-0">
          <span className="block text-sm font-semibold">{s.q || "Where to?"}</span>
          <span className="block truncate text-xs text-neutral-500">{summary.slice(1).join(" · ")}</span>
        </span>
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-50 flex flex-col bg-neutral-100">
          <div className="flex items-center p-4">
            <button type="button" onClick={() => setOpen(false)} aria-label="Close search" className="rounded-full border border-neutral-300 bg-white p-2"><Icon name="close" className="h-4 w-4" /></button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto px-3 pb-4">
            {card("where", "Where", s.q || "I'm flexible", (
              <>
                <div className="mb-4 flex items-center gap-3 rounded-xl border border-neutral-300 px-4 py-3">
                  <Icon name="search" className="h-4 w-4" />
                  <input autoFocus value={s.q} onChange={(e) => s.setQ(e.target.value)} placeholder="Search destinations" className="w-full text-sm outline-none" />
                </div>
                <div className="-mx-4"><DestinationList destinations={destinations} q={s.q} onPick={(c) => { s.setQ(c); setStep("when"); }} /></div>
              </>
            ))}
            {card("when", "When", s.checkIn && s.checkOut ? `${formatShort(s.checkIn)} – ${formatShort(s.checkOut)}` : "Add dates", (
              <DateRangeCalendar months={1} checkIn={s.checkIn} checkOut={s.checkOut} onChange={(a, b) => { s.setDates(a, b); if (b) setStep("who"); }} />
            ))}
            {card("who", "Who", s.guestsTouched ? guestSummary(s.guests) : "Add guests", <GuestPicker value={s.guests} onChange={s.setGuests} />)}
          </div>
          <div className="flex items-center justify-between border-t border-neutral-200 bg-white px-5 py-3">
            <button type="button" className="font-semibold underline" onClick={() => { s.setQ(""); s.setDates(undefined, undefined); }}>Clear all</button>
            <button type="button" className="btn-primary gap-2 px-6 py-3" onClick={() => { setOpen(false); s.submit(); }}>
              <Icon name="search" className="h-4 w-4" strokeWidth={3} /> Search
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

/** Compact pill used on inner pages: "Anywhere | Any week | Add guests". Expands into the full bar. */
export function CompactSearch({ destinations }: { destinations: Destination[] }) {
  const sp = useSearchParams();
  const [expanded, setExpanded] = useState(false);
  if (expanded) {
    return (
      <>
        <div className="fixed inset-0 top-[var(--header-h,80px)] z-30 bg-black/25" onClick={() => setExpanded(false)} />
        <div className="absolute inset-x-0 top-full z-40 border-b border-neutral-200 bg-white px-4 pb-6 pt-2">
          <SearchBar destinations={destinations} onDone={() => setExpanded(false)} />
        </div>
      </>
    );
  }
  const q = sp.get("q");
  const ci = sp.get("checkIn");
  const co = sp.get("checkOut");
  const g = sp.get("guests");
  return (
    <button type="button" onClick={() => setExpanded(true)} className="flex items-center rounded-full border border-neutral-200 py-2 pl-6 pr-2 text-sm shadow-sm transition hover:shadow-md">
      <span className="font-semibold">{q || "Anywhere"}</span>
      <span className="mx-4 h-6 w-px bg-neutral-300" />
      <span className="font-semibold">{ci && co ? `${formatShort(ci)} – ${formatShort(co)}` : "Any week"}</span>
      <span className="mx-4 h-6 w-px bg-neutral-300" />
      <span className={g ? "font-semibold" : "text-neutral-500"}>{g ? `${g} guest${g === "1" ? "" : "s"}` : "Add guests"}</span>
      <span className="ml-3 flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-white"><Icon name="search" className="h-3.5 w-3.5" strokeWidth={3} /></span>
    </button>
  );
}
