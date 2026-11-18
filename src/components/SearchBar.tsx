export function SearchBar({ q, checkIn, checkOut, guests }: { q?: string; checkIn?: string; checkOut?: string; guests?: string }) {
  return (
    <form action="/" className="grid gap-2 rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm sm:grid-cols-[2fr_1fr_1fr_0.7fr_auto] sm:items-end">
      <div>
        <label className="label" htmlFor="q">Where</label>
        <input className="input" id="q" name="q" placeholder="City, region or country" defaultValue={q} />
      </div>
      <div>
        <label className="label" htmlFor="checkIn">Check in</label>
        <input className="input" id="checkIn" name="checkIn" type="date" defaultValue={checkIn} />
      </div>
      <div>
        <label className="label" htmlFor="checkOut">Check out</label>
        <input className="input" id="checkOut" name="checkOut" type="date" defaultValue={checkOut} />
      </div>
      <div>
        <label className="label" htmlFor="guests">Guests</label>
        <input className="input" id="guests" name="guests" type="number" min={1} defaultValue={guests ?? "1"} />
      </div>
      <button className="btn-primary h-[38px]">Search</button>
    </form>
  );
}
