"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createListing, type ListingFormState } from "@/app/actions/listings";
import { calculatePrice, formatMoney } from "@/lib/pricing";
import { Icon } from "./Icons";

const PROPERTY_TYPES: { label: string; icon: string }[] = [
  { label: "Entire home", icon: "door" },
  { label: "Apartment", icon: "city" },
  { label: "Private room", icon: "room" },
  { label: "Cabin", icon: "cabin" },
  { label: "Cottage", icon: "countryside" },
  { label: "Villa", icon: "pool" },
  { label: "Loft", icon: "grid" },
  { label: "Townhouse", icon: "city" },
  { label: "Tiny home", icon: "unique" },
  { label: "Treehouse", icon: "leaf" },
  { label: "Houseboat", icon: "beach" },
  { label: "Camper/RV", icon: "car" },
  { label: "Farm stay", icon: "countryside" },
  { label: "Guesthouse", icon: "key" },
  { label: "Chalet", icon: "mountain" },
];

const AMENITIES: { label: string; icon: string }[] = [
  { label: "Wifi", icon: "wifi" },
  { label: "Kitchen", icon: "kitchen" },
  { label: "Washer", icon: "washer" },
  { label: "Dryer", icon: "washer" },
  { label: "Air conditioning", icon: "snow" },
  { label: "Heating", icon: "fire" },
  { label: "Dedicated workspace", icon: "desk" },
  { label: "TV", icon: "tv" },
  { label: "Free parking on premises", icon: "car" },
  { label: "Self check-in", icon: "key" },
  { label: "Pool", icon: "pool" },
  { label: "Hot tub", icon: "pool" },
  { label: "Fireplace", icon: "fire" },
  { label: "BBQ grill", icon: "fire" },
  { label: "Ocean view", icon: "beach" },
  { label: "Mountain view", icon: "mountain" },
  { label: "Beach access", icon: "beach" },
  { label: "Pets allowed", icon: "heart" },
];

const STEPS = ["type", "location", "basics", "amenities", "photos", "describe", "price", "review"] as const;
type Step = (typeof STEPS)[number];

const TITLE_MAX = 120;
const DESC_MAX = 5000;

const parseUrls = (s: string) => s.split(/\s+/).map((x) => x.trim()).filter(Boolean);
const isHttps = (u: string) => /^https:\/\/\S+$/.test(u);

export function ListingForm() {
  const [state, action, pending] = useActionState<ListingFormState, FormData>(createListing, undefined);
  const [i, setI] = useState(0);
  const step: Step = STEPS[i];

  const [propertyType, setPropertyType] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [country, setCountry] = useState("");
  const [maxGuests, setMaxGuests] = useState(2);
  const [bedrooms, setBedrooms] = useState(1);
  const [beds, setBeds] = useState(1);
  const [bathrooms, setBathrooms] = useState(1);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [photoUrls, setPhotoUrls] = useState("");
  const [brokenPhotos, setBrokenPhotos] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [nightly, setNightly] = useState("120");
  const [cleaning, setCleaning] = useState("40");
  const [tax, setTax] = useState("0");
  const [minNights, setMinNights] = useState(1);

  const urls = parseUrls(photoUrls);
  const validUrls = urls.filter(isHttps);
  const exampleNights = Math.max(3, minNights);
  const preview = calculatePrice({
    nightlyPriceCents: Math.round(Number(nightly) * 100) || 0,
    cleaningFeeCents: Math.round(Number(cleaning) * 100) || 0,
    taxRateBps: Math.round(Number(tax) * 100) || 0,
    nights: exampleNights,
  });

  // Mirrors the server-side zod schema so "Next" is only enabled when the step is valid.
  const valid: Record<Step, boolean> = {
    type: propertyType !== "",
    location: city.trim().length >= 1 && country.trim().length >= 2,
    basics: maxGuests >= 1 && beds >= 1,
    amenities: true,
    photos: validUrls.length > 0,
    describe: title.trim().length >= 5 && title.length <= TITLE_MAX && description.trim().length >= 20 && description.length <= DESC_MAX,
    price: Number(nightly) >= 1 && Number(cleaning) >= 0 && Number(tax) >= 0 && Number(tax) <= 30,
    review: true,
  };
  const allValid = STEPS.every((s) => valid[s]);
  const isLast = i === STEPS.length - 1;

  const next = () => valid[step] && setI((n) => Math.min(STEPS.length - 1, n + 1));
  const back = () => setI((n) => Math.max(0, n - 1));
  const goTo = (s: Step) => setI(STEPS.indexOf(s));
  const toggleAmenity = (a: string) => setAmenities((cur) => (cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a]));

  return (
    <form
      action={action}
      onSubmit={(e) => {
        // Enter in a text field advances instead of publishing early.
        if (!isLast) {
          e.preventDefault();
          next();
        }
      }}
      className="flex min-h-[calc(100dvh-5rem)] flex-col"
    >
      {/* Every value is sent in one submit, with the field names createListing parses. */}
      <input type="hidden" name="propertyType" value={propertyType} />
      <input type="hidden" name="city" value={city} />
      <input type="hidden" name="region" value={region} />
      <input type="hidden" name="country" value={country} />
      <input type="hidden" name="maxGuests" value={maxGuests} />
      <input type="hidden" name="bedrooms" value={bedrooms} />
      <input type="hidden" name="beds" value={beds} />
      <input type="hidden" name="bathrooms" value={bathrooms} />
      <input type="hidden" name="amenities" value={amenities.join(", ")} />
      <input type="hidden" name="photoUrls" value={validUrls.join("\n")} />
      <input type="hidden" name="title" value={title} />
      <input type="hidden" name="description" value={description} />
      <input type="hidden" name="nightlyPriceCents" value={nightly} />
      <input type="hidden" name="cleaningFeeCents" value={cleaning} />
      <input type="hidden" name="taxRateBps" value={tax} />
      <input type="hidden" name="minNights" value={minNights} />

      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 pt-4 sm:px-6 lg:px-10">
        <span className="text-sm text-neutral-500">Step {i + 1} of {STEPS.length}</span>
        <Link href="/host" className="rounded-full border border-neutral-300 px-4 py-1.5 text-sm font-semibold hover:border-neutral-900">Exit</Link>
      </div>

      <div className="mx-auto w-full max-w-3xl flex-1 px-4 pb-12 pt-6 sm:px-6 sm:pt-10">
        {step === "type" && (
          <Section title="Which of these best describes your place?" sub="Free to list. No commission. You keep 100% of what you charge.">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {PROPERTY_TYPES.map((t) => {
                const on = propertyType === t.label;
                return (
                  <button
                    key={t.label}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setPropertyType(t.label)}
                    className={`flex flex-col items-start gap-6 rounded-xl border p-4 text-left transition sm:gap-8 ${
                      on ? "border-neutral-900 bg-neutral-50 ring-1 ring-neutral-900" : "border-neutral-200 hover:border-neutral-900"
                    }`}
                  >
                    <Icon name={t.icon} className="h-8 w-8" strokeWidth={1.5} />
                    <span className="font-semibold">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </Section>
        )}

        {step === "location" && (
          <Section title="Where's your place located?" sub="Your address is only shared with guests after they've made a reservation.">
            <div className="overflow-hidden rounded-xl border border-neutral-400 focus-within:border-neutral-900">
              <JoinedInput label="City" value={city} onChange={setCity} autoFocus placeholder="Asheville" />
              <JoinedInput label="State / region (optional)" value={region} onChange={setRegion} placeholder="North Carolina" />
              <JoinedInput label="Country" value={country} onChange={setCountry} placeholder="United States" last />
            </div>
            <div className="mt-6 flex aspect-[16/9] items-center justify-center rounded-xl bg-gradient-to-br from-brand-50 to-neutral-100">
              <div className="flex flex-col items-center text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg">
                  <Icon name="pin" className="h-7 w-7" />
                </span>
                <p className="mt-3 font-semibold">{[city, region, country].filter((s) => s.trim()).join(", ") || "Enter a location"}</p>
              </div>
            </div>
          </Section>
        )}

        {step === "basics" && (
          <Section title="Share some basics about your place" sub="You'll add more details later, like bed types.">
            <div className="divide-y divide-neutral-200">
              <Stepper label="Guests" value={maxGuests} set={setMaxGuests} min={1} max={50} />
              <Stepper label="Bedrooms" value={bedrooms} set={setBedrooms} min={0} max={50} />
              <Stepper label="Beds" value={beds} set={setBeds} min={1} max={100} />
              <Stepper label="Bathrooms" value={bathrooms} set={setBathrooms} min={0} max={50} step={0.5} />
            </div>
          </Section>
        )}

        {step === "amenities" && (
          <Section title="Tell guests what your place has to offer" sub="Pick everything that applies. You can change these later.">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {AMENITIES.map((a) => {
                const on = amenities.includes(a.label);
                return (
                  <button
                    key={a.label}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleAmenity(a.label)}
                    className={`flex flex-col items-start gap-3 rounded-xl border p-4 text-left transition ${
                      on ? "border-neutral-900 bg-neutral-50 ring-1 ring-neutral-900" : "border-neutral-200 hover:border-neutral-900"
                    }`}
                  >
                    <Icon name={a.icon} className="h-7 w-7" strokeWidth={1.5} />
                    <span className="text-sm font-semibold sm:text-base">{a.label}</span>
                  </button>
                );
              })}
            </div>
          </Section>
        )}

        {step === "photos" && (
          <Section title="Add some photos of your place" sub="Paste https image links, one per line. The first photo becomes your cover. Direct uploads are on the roadmap.">
            <textarea
              className="input min-h-36 rounded-xl p-4 font-mono text-xs"
              value={photoUrls}
              onChange={(e) => setPhotoUrls(e.target.value)}
              placeholder={"https://images.example.com/living-room.jpg\nhttps://images.example.com/bedroom.jpg"}
              aria-label="Photo URLs, one per line"
            />
            <p className="mt-2 text-sm text-neutral-600">
              {validUrls.length} photo{validUrls.length === 1 ? "" : "s"} added
              {urls.length > validUrls.length && <span className="text-red-600"> · {urls.length - validUrls.length} link{urls.length - validUrls.length === 1 ? " isn't" : "s aren't"} https and will be skipped</span>}
            </p>
            {validUrls.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {validUrls.slice(0, 20).map((u, n) => (
                  <div key={`${u}-${n}`} className={`relative overflow-hidden rounded-xl bg-neutral-100 ${n === 0 ? "col-span-2 aspect-[16/9] sm:col-span-3" : "aspect-square"}`}>
                    {brokenPhotos.has(u) ? (
                      <div className="flex h-full flex-col items-center justify-center gap-1 p-2 text-center text-xs text-neutral-500">
                        <Icon name="grid" className="h-6 w-6" strokeWidth={1.5} />
                        Preview unavailable
                      </div>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={u} alt="" className="h-full w-full object-cover" onError={() => setBrokenPhotos((s) => new Set(s).add(u))} />
                    )}
                    {n === 0 && <span className="absolute left-3 top-3 rounded-md bg-white px-2 py-1 text-xs font-semibold shadow">Cover photo</span>}
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}

        {step === "describe" && (
          <Section title="Now, let's give your place a title and description" sub="Short titles work best. Have fun with it; you can always change it later.">
            <label className="block">
              <span className="text-lg font-semibold">Title</span>
              <textarea
                className="input mt-2 rounded-xl p-4 text-xl"
                rows={2}
                maxLength={TITLE_MAX}
                value={title}
                onChange={(e) => setTitle(e.target.value.replace(/\n/g, " "))}
                placeholder="Sunny loft near the river"
              />
            </label>
            <Counter n={title.length} max={TITLE_MAX} min={5} />
            <label className="mt-6 block">
              <span className="text-lg font-semibold">Description</span>
              <textarea
                className="input mt-2 rounded-xl p-4 text-base"
                rows={7}
                maxLength={DESC_MAX}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What makes your place special? Light, quiet, walkable, the view from the porch..."
              />
            </label>
            <Counter n={description.length} max={DESC_MAX} min={20} />
          </Section>
        )}

        {step === "price" && (
          <Section title="Now, set your price" sub="You keep all of it. Fairbnb charges no host or guest fee.">
            <div className="flex items-center justify-center py-4">
              <label className="flex items-baseline text-6xl font-extrabold tracking-tight sm:text-8xl">
                <span>$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  aria-label="Nightly price in dollars"
                  value={nightly}
                  onChange={(e) => setNightly(e.target.value.replace(/[^\d.]/g, ""))}
                  style={{ width: `${Math.max(1, nightly.length) + 0.5}ch` }}
                  className="min-w-0 bg-transparent outline-none"
                />
              </label>
            </div>
            <p className="text-center text-neutral-600">per night</p>
            {Number(nightly) < 1 && <p className="mt-2 text-center text-sm text-red-600">Nightly price must be at least $1.</p>}

            <div className="mx-auto mt-8 max-w-xl rounded-xl border border-neutral-200 p-5">
              <p className="text-sm text-neutral-600">For a {exampleNights}-night stay</p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div><p className="text-xs text-neutral-500">Guest pays</p><p className="text-lg font-bold">{formatMoney(preview.totalCents)}</p></div>
                <div><p className="text-xs text-neutral-500">You earn</p><p className="text-lg font-bold text-brand-700">{formatMoney(preview.hostPayoutCents)}</p></div>
                <div><p className="text-xs text-neutral-500">Fairbnb takes</p><p className="text-lg font-bold text-brand-700">$0</p></div>
              </div>
              <p className="mt-3 text-xs text-neutral-500">Guest total includes card processing by Stripe at cost{Number(tax) > 0 ? " and lodging tax" : ""}. Fairbnb keeps none of it.</p>
            </div>

            <div className="mx-auto mt-6 grid max-w-xl gap-4 sm:grid-cols-2">
              <MoneyField label="Cleaning fee" prefix="$" value={cleaning} onChange={setCleaning} />
              <MoneyField label="Lodging tax" suffix="%" value={tax} onChange={setTax} />
              <div className="sm:col-span-2">
                <div className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 px-4">
                  <Stepper label="Minimum nights" value={minNights} set={setMinNights} min={1} max={90} />
                </div>
              </div>
              {Number(tax) > 30 && <p className="text-sm text-red-600 sm:col-span-2">Tax rate must be 30% or less.</p>}
              <p className="text-xs text-neutral-500 sm:col-span-2">Lodging tax: enter the occupancy tax your city or state requires you to collect. You are responsible for remitting it.</p>
            </div>
          </Section>
        )}

        {step === "review" && (
          <Section title="Review your listing" sub="Here's what guests will see. Make sure everything looks good.">
            <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="overflow-hidden rounded-xl border border-neutral-200 shadow-lg">
                <div className="aspect-square bg-neutral-100">
                  {validUrls[0] && !brokenPhotos.has(validUrls[0]) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={validUrls[0]} alt="" className="h-full w-full object-cover" onError={() => setBrokenPhotos((s) => new Set(s).add(validUrls[0]))} />
                  ) : (
                    <div className="flex h-full items-center justify-center text-neutral-400"><Icon name="grid" className="h-10 w-10" strokeWidth={1.5} /></div>
                  )}
                </div>
                <div className="p-4">
                  <p className="font-semibold">{title || "Untitled listing"}</p>
                  <p className="text-sm text-neutral-600">{[city, country].filter(Boolean).join(", ")}</p>
                  <p className="mt-1"><span className="font-semibold">{formatMoney(Math.round(Number(nightly) * 100) || 0)}</span> night</p>
                </div>
              </div>
              <dl className="divide-y divide-neutral-200 text-sm">
                <ReviewRow label="Property type" value={propertyType} onEdit={() => goTo("type")} />
                <ReviewRow label="Location" value={[city, region, country].filter((s) => s.trim()).join(", ")} onEdit={() => goTo("location")} />
                <ReviewRow
                  label="Basics"
                  value={`${maxGuests} guest${maxGuests === 1 ? "" : "s"} · ${bedrooms} bedroom${bedrooms === 1 ? "" : "s"} · ${beds} bed${beds === 1 ? "" : "s"} · ${bathrooms} bath${bathrooms === 1 ? "" : "s"}`}
                  onEdit={() => goTo("basics")}
                />
                <ReviewRow label="Amenities" value={amenities.join(", ") || "None selected"} onEdit={() => goTo("amenities")} />
                <ReviewRow label="Photos" value={`${validUrls.length} photo${validUrls.length === 1 ? "" : "s"}`} onEdit={() => goTo("photos")} />
                <ReviewRow
                  label="Pricing"
                  value={`${formatMoney(Math.round(Number(nightly) * 100) || 0)}/night · ${formatMoney(Math.round(Number(cleaning) * 100) || 0)} cleaning · ${Number(tax) || 0}% tax · ${minNights} night min`}
                  onEdit={() => goTo("price")}
                />
              </dl>
            </div>
            <div className="mt-8 flex items-start gap-4 rounded-xl bg-brand-50 p-5 text-brand-900">
              <Icon name="leaf" className="mt-0.5 h-6 w-6 shrink-0" />
              <div>
                <p className="font-semibold">Free to list. No commission.</p>
                <p className="text-sm">You keep 100% of what you charge. Your listing goes live as soon as you publish.</p>
              </div>
            </div>
            {!allValid && <p className="mt-4 text-sm text-red-600">Some steps still need attention. Use Edit to go back and finish them.</p>}
            {state?.error && <p className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{state.error}</p>}
          </Section>
        )}
      </div>

      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-neutral-200 bg-white md:bottom-0">
        <div className="flex h-1.5 gap-1.5 bg-white" aria-hidden="true">
          {STEPS.map((s, n) => (
            <div key={s} className="h-full flex-1 bg-neutral-200">
              <div className={`h-full bg-neutral-900 transition-all duration-500 ${n <= i ? "w-full" : "w-0"}`} />
            </div>
          ))}
        </div>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-10">
          <button
            type="button"
            onClick={back}
            disabled={i === 0}
            className="rounded-lg px-2 py-2 font-semibold underline underline-offset-2 hover:bg-neutral-100 disabled:invisible"
          >
            Back
          </button>
          {isLast ? (
            <button key="publish" type="submit" className="btn-primary px-8 py-3 text-base" disabled={pending || !allValid}>
              {pending ? "Publishing…" : "Publish listing"}
            </button>
          ) : (
            <button key="next" type="button" onClick={next} disabled={!valid[step]} className="btn-primary px-8 py-3 text-base">
              Next
            </button>
          )}
        </div>
      </div>
    </form>
  );
}

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
      {sub && <p className="mt-2 text-neutral-600 sm:text-lg">{sub}</p>}
      <div className="mt-8">{children}</div>
    </section>
  );
}

function JoinedInput({ label, value, onChange, placeholder, autoFocus, last }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean; last?: boolean }) {
  return (
    <label className={`block px-4 py-2.5 focus-within:relative focus-within:z-10 focus-within:rounded-lg focus-within:ring-2 focus-within:ring-neutral-900 ${last ? "" : "border-b border-neutral-400"}`}>
      <span className="block text-xs text-neutral-600">{label}</span>
      <input className="w-full bg-transparent text-base outline-none" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoFocus={autoFocus} maxLength={80} />
    </label>
  );
}

function Stepper({ label, value, set, min, max, step = 1 }: { label: string; value: number; set: (n: number) => void; min: number; max: number; step?: number }) {
  const btn = "flex h-8 w-8 items-center justify-center rounded-full border border-neutral-400 text-neutral-700 transition hover:border-neutral-900 hover:text-neutral-900 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:text-neutral-200";
  return (
    <div className="flex items-center justify-between py-5">
      <span className="text-lg">{label}</span>
      <div className="flex items-center gap-4">
        <button type="button" className={btn} onClick={() => set(Math.max(min, value - step))} disabled={value <= min} aria-label={`Decrease ${label.toLowerCase()}`}>
          <Icon name="minus" className="h-4 w-4" />
        </button>
        <span className="w-8 text-center tabular-nums" aria-live="polite">{value}</span>
        <button type="button" className={btn} onClick={() => set(Math.min(max, value + step))} disabled={value >= max} aria-label={`Increase ${label.toLowerCase()}`}>
          <Icon name="plus" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function Counter({ n, max, min }: { n: number; max: number; min: number }) {
  return (
    <p className={`mt-1 text-sm ${n > 0 && n < min ? "text-red-600" : "text-neutral-500"}`}>
      {n}/{max}
      {n > 0 && n < min && ` · at least ${min} characters`}
    </p>
  );
}

function MoneyField({ label, value, onChange, prefix, suffix }: { label: string; value: string; onChange: (v: string) => void; prefix?: string; suffix?: string }) {
  return (
    <label className="block rounded-xl border border-neutral-400 px-4 py-2.5 focus-within:ring-2 focus-within:ring-neutral-900">
      <span className="block text-xs text-neutral-600">{label}</span>
      <span className="flex items-center gap-1 text-lg">
        {prefix && <span>{prefix}</span>}
        <input
          type="text"
          inputMode="decimal"
          className="w-full min-w-0 bg-transparent outline-none"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))}
        />
        {suffix && <span>{suffix}</span>}
      </span>
    </label>
  );
}

function ReviewRow({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <dt className="font-semibold">{label}</dt>
        <dd className="text-neutral-600">{value || <span className="text-red-600">Missing</span>}</dd>
      </div>
      <button type="button" onClick={onEdit} className="shrink-0 font-semibold underline underline-offset-2">Edit</button>
    </div>
  );
}
