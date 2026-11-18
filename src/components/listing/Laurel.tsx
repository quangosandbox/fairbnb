/** Original leafy branch used to frame the "Guest favorite" badge. Mirror it with `flip`. */
export function Laurel({ flip = false, className = "h-9 w-5" }: { flip?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 20 36" className={`${className} text-brand-700 ${flip ? "-scale-x-100" : ""}`} fill="currentColor" aria-hidden>
      <path d="M15 34C7 30 4 22 5 13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <ellipse cx="4.6" cy="10" rx="1.8" ry="3.6" transform="rotate(-10 4.6 10)" />
      <ellipse cx="9" cy="14.5" rx="1.6" ry="3.4" transform="rotate(-55 9 14.5)" />
      <ellipse cx="2.8" cy="17" rx="1.6" ry="3.4" transform="rotate(35 2.8 17)" />
      <ellipse cx="9.6" cy="21.5" rx="1.6" ry="3.4" transform="rotate(-60 9.6 21.5)" />
      <ellipse cx="3.6" cy="24" rx="1.6" ry="3.4" transform="rotate(45 3.6 24)" />
      <ellipse cx="11.6" cy="27.5" rx="1.5" ry="3.2" transform="rotate(-65 11.6 27.5)" />
      <ellipse cx="6.6" cy="30" rx="1.5" ry="3.2" transform="rotate(55 6.6 30)" />
    </svg>
  );
}
