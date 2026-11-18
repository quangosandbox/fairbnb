import Link from "next/link";

/** Fairbnb's own mark: a house outline with a leaf-shaped door. */
export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-1.5 text-brand-600" aria-label="Fairbnb home">
      <svg viewBox="0 0 32 32" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
        <path d="M4 15 16 4l12 11" />
        <path d="M7 13v14h18V13" />
        <path d="M16 27c-3.5-2-4-6.5 0-10 4 3.5 3.5 8 0 10Z" fill="currentColor" stroke="none" />
      </svg>
      <span className="hidden text-2xl font-extrabold tracking-tight lg:block">fairbnb</span>
    </Link>
  );
}
