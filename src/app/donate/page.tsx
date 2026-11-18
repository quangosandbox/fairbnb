import Link from "next/link";
import { donate } from "@/app/actions/donations";

export const metadata = { title: "Donate — Fairbnb" };

export default async function DonatePage({ searchParams }: { searchParams: Promise<{ thanks?: string; error?: string }> }) {
  const { thanks, error } = await searchParams;
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      {thanks ? (
        <div className="rounded-2xl bg-brand-50 p-8 text-center">
          <h1 className="text-2xl font-bold text-brand-900">Thank you 💚</h1>
          <p className="mt-2 text-brand-900">You&apos;re keeping Fairbnb free for everyone. See where it goes on our <Link href="/transparency" className="underline">transparency page</Link>.</p>
        </div>
      ) : (
        <>
          <h1 className="text-3xl font-extrabold">Keep Fairbnb free</h1>
          <p className="mt-3 text-neutral-600">
            We don&apos;t charge fees or sell ads. Servers, payments infrastructure, support and safety are paid for by people like you.
            Every dollar is published on our <Link href="/transparency" className="text-brand-700 underline">open books</Link>.
          </p>
          <form action={donate} className="mt-8 space-y-4">
            <div className="grid grid-cols-4 gap-2">
              {[5, 10, 25, 50].map((a) => (
                <label key={a} className="cursor-pointer">
                  <input type="radio" name="amount" value={a} defaultChecked={a === 10} className="peer sr-only" />
                  <span className="block rounded-lg border border-neutral-300 py-3 text-center font-semibold peer-checked:border-brand-600 peer-checked:bg-brand-50 peer-checked:text-brand-700">${a}</span>
                </label>
              ))}
            </div>
            {error && <p className="text-sm text-red-600">Donations must be between $1 and $10,000.</p>}
            <button className="btn-primary w-full">Donate</button>
          </form>
        </>
      )}
    </div>
  );
}
