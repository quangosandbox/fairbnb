import { FeeCalculator } from "@/components/FeeCalculator";

export const metadata = { title: "How pricing works — Fairbnb" };

export default function FeesPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-extrabold">Every dollar, accounted for</h1>
      <p className="mt-3 max-w-3xl text-lg text-neutral-600">
        Fairbnb takes no cut. Not from guests, not from hosts. Here&apos;s exactly what makes up a booking total.
      </p>
      <div className="mt-8 grid gap-6 sm:grid-cols-3">
        <Card title="Host's price → host" body="Nightly rate and cleaning fee are set by the host and go to the host in full." />
        <Card title="Tax → the government" body="If local law requires lodging or occupancy tax, it's shown as its own line. The host collects and remits it." />
        <Card title="Card processing → Stripe" body="Moving money by card costs 2.9% + 30¢. We pass it through at cost so hosts aren't shortchanged. We earn nothing on it." />
      </div>
      <h2 className="mt-12 text-xl font-bold">Try it</h2>
      <div className="mt-4"><FeeCalculator /></div>
      <h2 className="mt-12 text-xl font-bold">So how does Fairbnb pay its bills?</h2>
      <p className="mt-2 max-w-3xl text-neutral-700">
        The same way Wikipedia does: donations. When you book you can add an optional donation, and you can{" "}
        <a href="/donate" className="text-brand-700 underline">donate any time</a>. Skipping it changes nothing. Everything we
        receive and spend is published on our <a href="/transparency" className="text-brand-700 underline">transparency page</a>.
      </p>
    </div>
  );
}

function Card({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 p-5">
      <p className="font-semibold">{title}</p>
      <p className="mt-2 text-sm text-neutral-600">{body}</p>
    </div>
  );
}
