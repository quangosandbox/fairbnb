"use client";

import { Suspense, useCallback, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";
import { Icon } from "./Icons";
import { CompactSearch, MobileSearch, SearchBar, type Destination } from "./SearchBar";
import { useClickOutside } from "./DateRangeCalendar";

type User = { name: string; avatarUrl: string | null } | null;

export function Header({ user, destinations, logout }: { user: User; destinations: Destination[]; logout: () => Promise<void> }) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const wide = isHome || pathname === "/wishlists";
  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white">
      {/* Desktop */}
      <div className={`mx-auto hidden px-6 md:block lg:px-10 ${wide ? "max-w-[1760px]" : "max-w-6xl"}`}>
        <div className="flex h-20 items-center justify-between gap-4">
          <div className="flex-1"><Logo /></div>
          {!isHome && (
            <div className="hidden lg:block">
              <Suspense><CompactSearch destinations={destinations} /></Suspense>
            </div>
          )}
          {isHome && <p className="hidden text-sm font-semibold lg:block">Stays · <span className="text-brand-700">0% fees</span></p>}
          <div className="flex flex-1 items-center justify-end gap-1">
            <Link href={user ? "/host" : "/listings/new"} className="hidden rounded-full px-4 py-3 text-sm font-semibold hover:bg-neutral-100 lg:block">
              {user ? "Switch to hosting" : "Fairbnb your home"}
            </Link>
            <Link href="/fees" aria-label="How fees work" className="rounded-full p-3 hover:bg-neutral-100"><Icon name="globe" className="h-4 w-4" /></Link>
            <UserMenu user={user} logout={logout} />
          </div>
        </div>
        {isHome && (
          <div className="pb-5">
            <Suspense><SearchBar destinations={destinations} /></Suspense>
          </div>
        )}
      </div>
      {/* Mobile */}
      <div className="px-4 py-3 md:hidden">
        <Suspense><MobileSearch destinations={destinations} /></Suspense>
      </div>
    </header>
  );
}

function UserMenu({ user, logout }: { user: User; logout: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close, open);
  const item = (href: string, label: string, bold = false) => (
    <Link href={href} onClick={close} className={`block px-4 py-3 text-sm hover:bg-neutral-50 ${bold ? "font-semibold" : ""}`}>{label}</Link>
  );
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-label="Account menu" className="flex items-center gap-3 rounded-full border border-neutral-300 py-1.5 pl-3 pr-1.5 transition hover:shadow-md">
        <Icon name="menu" className="h-4 w-4" />
        <Avatar user={user} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-xl bg-white py-2 shadow-[0_2px_16px_rgba(0,0,0,0.15)]">
          {user ? (
            <>
              {item("/trips", "Trips", true)}
              {item("/wishlists", "Wishlists", true)}
              <hr className="my-2 border-neutral-200" />
              {item("/host", "Manage listings")}
              {item("/listings/new", "Create a listing")}
              <hr className="my-2 border-neutral-200" />
              {item("/fees", "How pricing works")}
              {item("/transparency", "Open books")}
              {item("/donate", "Donate")}
              <hr className="my-2 border-neutral-200" />
              <form action={logout}><button className="w-full px-4 py-3 text-left text-sm hover:bg-neutral-50">Log out</button></form>
            </>
          ) : (
            <>
              {item("/signup", "Sign up", true)}
              {item("/login", "Log in")}
              <hr className="my-2 border-neutral-200" />
              {item("/listings/new", "Fairbnb your home")}
              {item("/fees", "How pricing works")}
              {item("/donate", "Donate")}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Avatar({ user }: { user: User }) {
  if (user?.avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={user.avatarUrl} alt="" className="h-8 w-8 rounded-full bg-neutral-700 object-cover" />;
  }
  if (user) {
    return <span className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-900 text-sm font-semibold text-white">{user.name[0]?.toUpperCase()}</span>;
  }
  return <span className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-500 text-white"><Icon name="user" className="h-5 w-5" /></span>;
}

/** Bottom tab bar on phones. Hidden on listing pages, which have their own reserve bar. */
export function MobileNav({ loggedIn }: { loggedIn: boolean }) {
  const pathname = usePathname();
  if (pathname.startsWith("/listings/") && pathname !== "/listings/new") return null;
  const tab = (href: string, icon: string, label: string, active: boolean) => (
    <Link href={href} className={`flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-semibold ${active ? "text-brand-600" : "text-neutral-500"}`}>
      <Icon name={icon} className="h-6 w-6" strokeWidth={active ? 2.4 : 1.8} />
      {label}
    </Link>
  );
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-neutral-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
      {tab("/", "search", "Explore", pathname === "/")}
      {tab("/wishlists", "heart", "Wishlists", pathname.startsWith("/wishlists"))}
      {loggedIn ? (
        <>
          {tab("/trips", "cabin", "Trips", pathname.startsWith("/trips"))}
          {tab("/host", "user", "Hosting", pathname.startsWith("/host"))}
        </>
      ) : (
        tab("/login", "user", "Log in", pathname === "/login")
      )}
    </nav>
  );
}
