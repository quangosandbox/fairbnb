import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { logout } from "@/app/actions/auth";
import { Header, MobileNav } from "@/components/Header";
import { VerifyEmailBanner } from "@/components/VerifyEmailBanner";

export const metadata: Metadata = {
  title: "Fairbnb — stays with zero platform fees",
  description: "Book homes directly from hosts. No service fees for guests or hosts. Funded by donations.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [user, destinations] = await Promise.all([
    getCurrentUser(),
    db.listing.findMany({ where: { published: true }, distinct: ["city", "country"], select: { city: true, region: true, country: true }, orderBy: { city: "asc" } }),
  ]);
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col pb-16 antialiased md:pb-0">
        <Header user={user ? { name: user.name, avatarUrl: user.avatarUrl } : null} destinations={destinations} logout={logout} />
        <VerifyEmailBanner />
        <main className="flex-1">{children}</main>
        <Footer />
        <MobileNav loggedIn={!!user} />
      </body>
    </html>
  );
}

function Footer() {
  const col = (title: string, links: [string, string][]) => (
    <div>
      <p className="mb-3 text-sm font-semibold">{title}</p>
      <ul className="space-y-3 text-sm text-neutral-700">
        {links.map(([href, label]) => <li key={label}><Link href={href} className="hover:underline">{label}</Link></li>)}
      </ul>
    </div>
  );
  return (
    <footer className="mt-16 border-t border-neutral-200 bg-neutral-50">
      <div className="mx-auto grid max-w-[1760px] gap-8 px-6 py-12 md:grid-cols-3 lg:px-10">
        {col("Support", [["/fees", "How pricing works"], ["/trips", "Cancellation options"], ["/transparency", "Open books"]])}
        {col("Hosting", [["/listings/new", "Fairbnb your home"], ["/host", "Hosting dashboard"], ["/fees", "Why hosts keep 100%"]])}
        {col("Fairbnb", [["/donate", "Donate"], ["/transparency", "Where the money goes"], ["/fees", "Our zero-fee promise"]])}
      </div>
      <div className="mx-auto flex max-w-[1760px] flex-wrap justify-between gap-2 border-t border-neutral-200 px-6 py-6 text-sm text-neutral-600 lg:px-10">
        <p>© {new Date().getFullYear()} Fairbnb · A non-profit, donation-funded marketplace</p>
        <p className="font-semibold text-brand-700">0% platform fee, always</p>
      </div>
    </footer>
  );
}
