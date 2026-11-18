"use client";

import { useActionState, useState } from "react";
import { createListing, type ListingFormState } from "@/app/actions/listings";
import { calculatePrice, formatMoney } from "@/lib/pricing";

export function ListingForm() {
  const [state, action, pending] = useActionState<ListingFormState, FormData>(createListing, undefined);
  const [nightly, setNightly] = useState("120");
  const [cleaning, setCleaning] = useState("40");
  const [tax, setTax] = useState("0");
  const preview = calculatePrice({
    nightlyPriceCents: Math.round(Number(nightly) * 100) || 0,
    cleaningFeeCents: Math.round(Number(cleaning) * 100) || 0,
    taxRateBps: Math.round(Number(tax) * 100) || 0,
    nights: 3,
  });

  const field = (name: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input className="input" id={name} name={name} required {...props} />
    </div>
  );

  return (
    <form action={action} className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">{field("title", "Title", { placeholder: "Sunny loft near the river" })}</div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="description">Description</label>
          <textarea className="input" id="description" name="description" rows={6} required minLength={20} />
        </div>
        <div>
          <label className="label" htmlFor="propertyType">Property type</label>
          <select className="input" id="propertyType" name="propertyType">
            {["Entire home", "Apartment", "Private room", "Cabin", "Cottage", "Villa", "Tiny home", "Treehouse", "Boat"].map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        {field("city", "City")}
        {field("region", "State / region", { required: false })}
        {field("country", "Country")}
      </section>
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {field("maxGuests", "Guests", { type: "number", min: 1, defaultValue: 2 })}
        {field("bedrooms", "Bedrooms", { type: "number", min: 0, defaultValue: 1 })}
        {field("beds", "Beds", { type: "number", min: 1, defaultValue: 1 })}
        {field("bathrooms", "Baths", { type: "number", min: 0, step: 0.5, defaultValue: 1 })}
      </section>
      <section className="grid gap-4 sm:grid-cols-4">
        {field("nightlyPriceCents", "Nightly price ($)", { type: "number", min: 1, step: 0.01, value: nightly, onChange: (e) => setNightly(e.target.value) })}
        {field("cleaningFeeCents", "Cleaning fee ($)", { type: "number", min: 0, step: 0.01, value: cleaning, onChange: (e) => setCleaning(e.target.value) })}
        {field("taxRateBps", "Lodging tax (%)", { type: "number", min: 0, max: 30, step: 0.01, value: tax, onChange: (e) => setTax(e.target.value) })}
        {field("minNights", "Min nights", { type: "number", min: 1, defaultValue: 1 })}
        <p className="text-xs text-neutral-500 sm:col-span-4">
          Lodging tax: enter the occupancy tax your city/state requires you to collect. You are responsible for remitting it. Example for 3 nights:
          guest pays <b>{formatMoney(preview.totalCents)}</b>, you receive <b>{formatMoney(preview.hostPayoutCents)}</b>, Fairbnb takes <b>$0</b>.
        </p>
      </section>
      <section className="space-y-4">
        <div>
          <label className="label" htmlFor="amenities">Amenities (comma separated)</label>
          <input className="input" id="amenities" name="amenities" placeholder="Wifi, Kitchen, Free parking, Washer" />
        </div>
        <div>
          <label className="label" htmlFor="photoUrls">Photo URLs (one per line)</label>
          <textarea className="input font-mono text-xs" id="photoUrls" name="photoUrls" rows={4} required placeholder="https://…" />
          <p className="mt-1 text-xs text-neutral-500">Direct uploads are on the roadmap; for now paste https image links.</p>
        </div>
      </section>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button className="btn-primary" disabled={pending}>{pending ? "Publishing…" : "Publish listing"}</button>
    </form>
  );
}
