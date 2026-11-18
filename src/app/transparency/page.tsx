import { db } from "@/lib/db";
import { formatMoney } from "@/lib/pricing";

export const dynamic = "force-dynamic";
export const metadata = { title: "Transparency — Fairbnb" };

export default async function TransparencyPage() {
  const [donations, expenses, expenseByCat, bookingAgg, recentExpenses] = await Promise.all([
    db.donation.aggregate({ _sum: { amountCents: true }, _count: true }),
    db.expense.aggregate({ _sum: { amountCents: true } }),
    db.expense.groupBy({ by: ["category"], _sum: { amountCents: true }, orderBy: { _sum: { amountCents: "desc" } } }),
    db.booking.aggregate({
      where: { status: { in: ["CONFIRMED", "COMPLETED"] } },
      _sum: { hostPayoutCents: true, platformFeeCents: true, totalCents: true },
      _count: true,
    }),
    db.expense.findMany({ orderBy: { incurredOn: "desc" }, take: 25 }),
  ]);
  const raised = donations._sum.amountCents ?? 0;
  const spent = expenses._sum.amountCents ?? 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-10">
      <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Transparency</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">Open books</h1>
      <p className="mt-4 max-w-3xl text-lg text-neutral-600 sm:text-xl">Live numbers straight from our database. Nothing rounded, nothing hidden.</p>

      <div className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Bookings" value={bookingAgg._count.toLocaleString()} />
        <Stat label="Paid to hosts" value={formatMoney(bookingAgg._sum.hostPayoutCents ?? 0)} />
        <Stat label="Platform fees collected" value={formatMoney(bookingAgg._sum.platformFeeCents ?? 0)} accent />
        <Stat label="Donations received" value={`${formatMoney(raised)} (${donations._count})`} />
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <section className="rounded-xl border border-neutral-200 p-6 shadow-sm">
          <h2 className="text-2xl font-semibold">Where donations go</h2>
          <p className="mt-2 text-neutral-600">Raised {formatMoney(raised)} · Spent {formatMoney(spent)} · Balance {formatMoney(raised - spent)}</p>
          <ul className="mt-4 space-y-3">
            {expenseByCat.map((c) => {
              const amt = c._sum.amountCents ?? 0;
              const pct = spent ? (amt / spent) * 100 : 0;
              return (
                <li key={c.category}>
                  <div className="flex justify-between"><span className="capitalize">{c.category}</span><span className="font-semibold">{formatMoney(amt)}</span></div>
                  <div className="mt-1.5 h-2.5 rounded-full bg-neutral-100"><div className="h-2.5 rounded-full bg-brand-500" style={{ width: `${pct}%` }} /></div>
                </li>
              );
            })}
          </ul>
        </section>
        <section className="rounded-xl border border-neutral-200 p-6 shadow-sm">
          <h2 className="text-2xl font-semibold">Every expense</h2>
          <table className="mt-4 w-full text-sm">
            <tbody className="divide-y divide-neutral-200">
              {recentExpenses.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap py-3 pr-3 text-neutral-500">{e.incurredOn.toISOString().slice(0, 10)}</td>
                  <td className="py-3">{e.description}</td>
                  <td className="whitespace-nowrap py-3 pl-3 text-right font-medium">{formatMoney(e.amountCents, e.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-neutral-200 p-5 shadow-sm">
      <p className="text-sm text-neutral-600">{label}</p>
      <p className={`mt-1 break-words text-2xl font-semibold sm:text-3xl ${accent ? "text-brand-700" : ""}`}>{value}</p>
    </div>
  );
}
