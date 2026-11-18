import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth";
import { logout } from "@/app/actions/auth";

export const metadata: Metadata = {
  title: "Fairbnb — stays with zero platform fees",
  description: "Book homes directly from hosts. No service fees for guests or hosts. Funded by donations.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col antialiased">
        <div className="bg-brand-900 px-4 py-2 text-center text-xs text-brand-50">
          0% platform fee for guests and hosts. Always.{" "}
          <Link href="/fees" className="underline">See exactly where every dollar goes →</Link>
        </div>
        <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/95 backdrop-blur">
          <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
            <Link href="/" className="text-xl font-extrabold tracking-tight text-brand-700">
              fair<span className="text-neutral-900">bnb</span>
            </Link>
            <div className="flex items-center gap-1 text-sm sm:gap-3">
              <Link href="/fees" className="hidden rounded-lg px-3 py-2 hover:bg-neutral-100 sm:block">Fees</Link>
              <Link href="/transparency" className="hidden rounded-lg px-3 py-2 hover:bg-neutral-100 md:block">Transparency</Link>
              <Link href="/donate" className="rounded-lg px-3 py-2 font-semibold text-brand-700 hover:bg-brand-50">Donate</Link>
              {user ? (
                <>
                  <Link href="/trips" className="rounded-lg px-3 py-2 hover:bg-neutral-100">Trips</Link>
                  <Link href="/host" className="rounded-lg px-3 py-2 hover:bg-neutral-100">Host</Link>
                  <form action={logout}>
                    <button className="rounded-lg px-3 py-2 text-neutral-500 hover:bg-neutral-100">Log out</button>
                  </form>
                </>
              ) : (
                <>
                  <Link href="/login" className="rounded-lg px-3 py-2 hover:bg-neutral-100">Log in</Link>
                  <Link href="/signup" className="btn-primary text-sm">Sign up</Link>
                </>
              )}
            </div>
          </nav>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="mt-16 border-t border-neutral-200 bg-neutral-50">
          <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 text-sm text-neutral-600 sm:grid-cols-3">
            <div>
              <p className="font-bold text-neutral-900">Fairbnb</p>
              <p className="mt-2">A non-profit marketplace for short stays. Hosts keep 100% of their price. Guests pay no service fee.</p>
            </div>
            <div className="flex flex-col gap-1">
              <Link href="/fees">How pricing works</Link>
              <Link href="/transparency">Where donations go</Link>
              <Link href="/host">Become a host</Link>
            </div>
            <div>
              <p>Run like Wikipedia: free for everyone, supported by people who find it useful.</p>
              <Link href="/donate" className="mt-2 inline-block font-semibold text-brand-700">Chip in →</Link>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
