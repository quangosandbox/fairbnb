import Link from "next/link";
import { donate } from "@/app/actions/donations";
import { Icon } from "@/components/Icons";

export const metadata = { title: "Donate — Fairbnb" };

export default async function DonatePage({ searchParams }: { searchParams: Promise<{ thanks?: string; error?: string }> }) {
  const { thanks, error } = await searchParams;
  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:py-16">
      {thanks ? (
        <div className="rounded-xl border border-brand-100 bg-brand-50 p-8 text-center sm:p-10">
          <Icon name="heart" className="mx-auto h-10 w-10 fill-brand-600 text-brand-600" />
          <h1 className="mt-4 text-3xl font-semibold text-brand-900">Thank you</h1>
          <p className="mt-3 text-lg text-brand-900">You&apos;re keeping Fairbnb free for everyone. See where it goes on our <Link href="/transparency" className="font-semibold underline">transparency page</Link>.</p>
        </div>
      ) : (
        <>
          <Icon name="heart" className="h-10 w-10 text-brand-600" strokeWidth={1.5} />
          <h1 className="mt-4 text-4xl font-semibold tracking-tight">Keep Fairbnb free</h1>
          <p className="mt-4 text-lg text-neutral-600">
            We don&apos;t charge fees or sell ads. Servers, payments infrastructure, support and safety are paid for by people like you.
            Every dollar is published on our <Link href="/transparency" className="font-semibold text-neutral-900 underline">open books</Link>.
          </p>
          <form action={donate} className="mt-8 rounded-xl border border-neutral-200 p-6 shadow-sm">
            <p className="font-semibold">Choose an amount</p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[5, 10, 25, 50].map((a) => (
                <label key={a} className="cursor-pointer">
                  <input type="radio" name="amount" value={a} defaultChecked={a === 10} className="peer sr-only" />
                  <span className="block rounded-xl border border-neutral-300 py-4 text-center text-lg font-semibold transition hover:border-neutral-900 peer-checked:border-neutral-900 peer-checked:bg-neutral-50 peer-checked:ring-1 peer-checked:ring-neutral-900 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500">${a}</span>
                </label>
              ))}
            </div>
            {error && <p className="mt-3 text-sm text-red-600">Donations must be between $1 and $10,000.</p>}
            <button className="btn-primary mt-6 w-full py-3.5 text-base">Donate</button>
            <p className="mt-3 text-center text-xs text-neutral-500">Optional, always. Booking on Fairbnb never requires a donation.</p>
          </form>
        </>
      )}
    </div>
  );
}
