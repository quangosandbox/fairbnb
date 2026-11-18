import { FeeCalculator } from "@/components/FeeCalculator";
import { Icon } from "@/components/Icons";

export const metadata = { title: "How pricing works — Fairbnb" };

export default function FeesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-10">
      <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">How pricing works</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">Every dollar, accounted for</h1>
      <p className="mt-4 max-w-3xl text-lg text-neutral-600 sm:text-xl">
        Fairbnb takes no cut. Not from guests, not from hosts. Here&apos;s exactly what makes up a booking total.
      </p>
      <div className="mt-10 grid gap-4 sm:grid-cols-3 sm:gap-6">
        <Card icon="key" title="Host's price → host" body="Nightly rate and cleaning fee are set by the host and go to the host in full." />
        <Card icon="city" title="Tax → the government" body="If local law requires lodging or occupancy tax, it's shown as its own line. The host collects and remits it." />
        <Card icon="sliders" title="Card processing → Stripe" body="Moving money by card costs 2.9% + 30¢. We pass it through at cost so hosts aren't shortchanged. We earn nothing on it." />
      </div>
      <h2 className="mt-16 text-2xl font-semibold sm:text-3xl">Try it</h2>
      <p className="mt-2 text-neutral-600">Change the numbers to see where every cent goes.</p>
      <div className="mt-6"><FeeCalculator /></div>
      <section className="mt-16 rounded-xl bg-brand-50 p-6 sm:p-10">
        <h2 className="text-2xl font-semibold text-brand-900 sm:text-3xl">So how does Fairbnb pay its bills?</h2>
        <p className="mt-3 max-w-3xl text-lg text-brand-900/80">
          The same way Wikipedia does: donations. When you book you can add an optional donation, and you can{" "}
          <a href="/donate" className="font-semibold text-brand-900 underline">donate any time</a>. Skipping it changes nothing. Everything we
          receive and spend is published on our <a href="/transparency" className="font-semibold text-brand-900 underline">transparency page</a>.
        </p>
      </section>
    </div>
  );
}

function Card({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 p-6 shadow-sm">
      <Icon name={icon} className="h-8 w-8 text-brand-600" strokeWidth={1.5} />
      <p className="mt-4 text-lg font-semibold">{title}</p>
      <p className="mt-2 text-neutral-600">{body}</p>
    </div>
  );
}
