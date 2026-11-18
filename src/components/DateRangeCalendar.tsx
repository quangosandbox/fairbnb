"use client";

import { useEffect, useState } from "react";
import { Icon } from "./Icons";

/** Dates are "YYYY-MM-DD" strings (UTC calendar days). Blocked ranges are [from, to) — `to` is the checkout day and stays selectable as a checkout. */
export type BlockedRange = { from: string; to: string };

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function ymd(y: number, m: number, d: number) {
  return new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
}
export function todayStr() {
  const n = new Date();
  return ymd(n.getFullYear(), n.getMonth(), n.getDate());
}
export function formatShort(s?: string) {
  if (!s) return "";
  return new Date(`${s}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function DateRangeCalendar({
  checkIn,
  checkOut,
  onChange,
  months = 2,
  blocked = [],
  minNights = 1,
}: {
  checkIn?: string;
  checkOut?: string;
  onChange: (checkIn?: string, checkOut?: string) => void;
  months?: 1 | 2;
  blocked?: BlockedRange[];
  minNights?: number;
}) {
  const today = todayStr();
  const start = checkIn ? new Date(`${checkIn}T00:00:00Z`) : new Date(`${today}T00:00:00Z`);
  const [view, setView] = useState({ y: start.getUTCFullYear(), m: start.getUTCMonth() });
  const now = new Date(`${today}T00:00:00Z`);
  const atFirstMonth = view.y === now.getUTCFullYear() && view.m === now.getUTCMonth();

  const isNightBlocked = (d: string) => blocked.some((r) => d >= r.from && d < r.to);
  // Choosing `d` as checkout is OK if no blocked night lies in [checkIn, d).
  const rangeClear = (from: string, to: string) => !blocked.some((r) => r.from < to && r.to > from);
  const nightsBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

  const pick = (d: string) => {
    if (!checkIn || (checkIn && checkOut) || d <= checkIn) {
      if (isNightBlocked(d)) return;
      onChange(d, undefined);
    } else {
      if (!rangeClear(checkIn, d) || nightsBetween(checkIn, d) < minNights) return;
      onChange(checkIn, d);
    }
  };

  const shift = (delta: number) =>
    setView((v) => {
      const d = new Date(Date.UTC(v.y, v.m + delta, 1));
      return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
    });

  return (
    <div>
      <div className={`grid gap-8 ${months === 2 ? "md:grid-cols-2" : ""}`}>
        {Array.from({ length: months }, (_, i) => {
          const first = new Date(Date.UTC(view.y, view.m + i, 1));
          const y = first.getUTCFullYear();
          const m = first.getUTCMonth();
          const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
          const lead = first.getUTCDay();
          return (
            <div key={i} className={i === 1 ? "hidden md:block" : ""}>
              <div className="mb-4 flex items-center justify-between">
                {i === 0 ? (
                  <button type="button" onClick={() => shift(-1)} disabled={atFirstMonth} className="rounded-full p-1.5 hover:bg-neutral-100 disabled:opacity-20" aria-label="Previous month">
                    <Icon name="chevronLeft" className="h-4 w-4" />
                  </button>
                ) : <span className="w-7" />}
                <p className="font-semibold">{first.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}</p>
                {i === months - 1 || months === 1 ? (
                  <button type="button" onClick={() => shift(1)} className="rounded-full p-1.5 hover:bg-neutral-100" aria-label="Next month">
                    <Icon name="chevronRight" className="h-4 w-4" />
                  </button>
                ) : <span className="w-7 md:hidden" />}
                {i === 0 && months === 2 && (
                  <button type="button" onClick={() => shift(1)} className="rounded-full p-1.5 hover:bg-neutral-100 md:hidden" aria-label="Next month">
                    <Icon name="chevronRight" className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-7 text-center text-xs font-semibold text-neutral-500">
                {WEEKDAYS.map((w) => <div key={w} className="pb-2">{w}</div>)}
              </div>
              <div className="grid grid-cols-7">
                {Array.from({ length: lead }, (_, k) => <div key={`l${k}`} />)}
                {Array.from({ length: daysInMonth }, (_, k) => {
                  const d = ymd(y, m, k + 1);
                  const past = d < today;
                  const selectingCheckout = checkIn && !checkOut && d > checkIn;
                  const disabled = past || (selectingCheckout ? !rangeClear(checkIn!, d) || nightsBetween(checkIn!, d) < minNights : isNightBlocked(d));
                  const isStart = d === checkIn;
                  const isEnd = d === checkOut;
                  const inRange = checkIn && checkOut && d > checkIn && d < checkOut;
                  return (
                    <div key={d} className={`relative h-11 ${inRange ? "bg-neutral-100" : ""} ${isStart && checkOut ? "rounded-l-full bg-neutral-100" : ""} ${isEnd ? "rounded-r-full bg-neutral-100" : ""}`}>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => pick(d)}
                        className={`mx-auto flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold transition
                          ${isStart || isEnd ? "bg-neutral-900 text-white" : "hover:border hover:border-neutral-900"}
                          ${disabled ? "cursor-not-allowed text-neutral-300 line-through hover:border-0" : ""}`}
                      >
                        {k + 1}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export type GuestCounts = { adults: number; children: number; infants: number; pets: number };

export function guestSummary(g: GuestCounts) {
  const guests = g.adults + g.children;
  const parts = [`${guests} guest${guests === 1 ? "" : "s"}`];
  if (g.infants) parts.push(`${g.infants} infant${g.infants === 1 ? "" : "s"}`);
  if (g.pets) parts.push(`${g.pets} pet${g.pets === 1 ? "" : "s"}`);
  return parts.join(", ");
}

export function GuestPicker({ value, onChange, maxGuests = 16 }: { value: GuestCounts; onChange: (g: GuestCounts) => void; maxGuests?: number }) {
  const total = value.adults + value.children;
  const rows: { key: keyof GuestCounts; label: string; hint: string; min: number; max: number }[] = [
    { key: "adults", label: "Adults", hint: "Ages 13 or above", min: 1, max: maxGuests - value.children },
    { key: "children", label: "Children", hint: "Ages 2–12", min: 0, max: maxGuests - value.adults },
    { key: "infants", label: "Infants", hint: "Under 2", min: 0, max: 5 },
    { key: "pets", label: "Pets", hint: "Bringing a service animal?", min: 0, max: 5 },
  ];
  return (
    <div className="divide-y divide-neutral-200">
      {rows.map((r) => (
        <div key={r.key} className="flex items-center justify-between py-4">
          <div>
            <p className="font-semibold">{r.label}</p>
            <p className="text-sm text-neutral-500">{r.hint}</p>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" aria-label={`Fewer ${r.label}`} disabled={value[r.key] <= r.min} onClick={() => onChange({ ...value, [r.key]: value[r.key] - 1 })} className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-400 text-neutral-600 hover:border-neutral-900 disabled:cursor-not-allowed disabled:opacity-25">
              <Icon name="minus" className="h-3.5 w-3.5" />
            </button>
            <span className="w-5 text-center">{value[r.key]}</span>
            <button type="button" aria-label={`More ${r.label}`} disabled={value[r.key] >= r.max} onClick={() => onChange({ ...value, [r.key]: value[r.key] + 1 })} className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-400 text-neutral-600 hover:border-neutral-900 disabled:cursor-not-allowed disabled:opacity-25">
              <Icon name="plus" className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
      {total >= maxGuests && <p className="pt-3 text-xs text-neutral-500">This place has a maximum of {maxGuests} guests, not including infants.</p>}
    </div>
  );
}

/** Closes a popover when clicking outside `ref`. */
export function useClickOutside(ref: React.RefObject<HTMLElement | null>, onOutside: () => void, active = true) {
  useEffect(() => {
    if (!active) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [ref, onOutside, active]);
}
