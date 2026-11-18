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
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-extrabold">Open books</h1>
      <p className="mt-3 max-w-3xl text-lg text-neutral-600">Live numbers straight from our database. Nothing rounded, nothing hidden.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-4">
        <Stat label="Bookings" value={bookingAgg._count.toLocaleString()} />
        <Stat label="Paid to hosts" value={formatMoney(bookingAgg._sum.hostPayoutCents ?? 0)} />
        <Stat label="Platform fees collected" value={formatMoney(bookingAgg._sum.platformFeeCents ?? 0)} accent />
        <Stat label="Donations received" value={`${formatMoney(raised)} (${donations._count})`} />
      </div>

      <div className="mt-10 grid gap-8 md:grid-cols-2">
        <section>
          <h2 className="text-xl font-bold">Where donations go</h2>
          <p className="mt-1 text-sm text-neutral-600">Raised {formatMoney(raised)} · Spent {formatMoney(spent)} · Balance {formatMoney(raised - spent)}</p>
          <ul className="mt-4 space-y-3">
            {expenseByCat.map((c) => {
              const amt = c._sum.amountCents ?? 0;
              const pct = spent ? (amt / spent) * 100 : 0;
              return (
                <li key={c.category}>
                  <div className="flex justify-between text-sm"><span className="capitalize">{c.category}</span><span>{formatMoney(amt)}</span></div>
                  <div className="mt-1 h-2 rounded-full bg-neutral-100"><div className="h-2 rounded-full bg-brand-500" style={{ width: `${pct}%` }} /></div>
                </li>
              );
            })}
          </ul>
        </section>
        <section>
          <h2 className="text-xl font-bold">Every expense</h2>
          <table className="mt-4 w-full text-sm">
            <tbody className="divide-y divide-neutral-200">
              {recentExpenses.map((e) => (
                <tr key={e.id}>
                  <td className="py-2 text-neutral-500">{e.incurredOn.toISOString().slice(0, 10)}</td>
                  <td className="py-2">{e.description}</td>
                  <td className="py-2 text-right">{formatMoney(e.amountCents, e.currency)}</td>
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
    <div className="rounded-xl border border-neutral-200 p-4">
      <p className="text-xs uppercase tracking-wide text-neutral-500">{label}</p>
      <p className={`mt-1 text-xl font-bold ${accent ? "text-brand-700" : ""}`}>{value}</p>
    </div>
  );
}
