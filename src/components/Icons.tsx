// Simple stroke icons (original, 24×24 grid). Usage: <Icon name="heart" className="h-5 w-5" />
const paths: Record<string, React.ReactNode> = {
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  heart: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" /></>,
  star: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z" />,
  share: <><path d="M12 15V3M8 7l4-4 4 4" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /></>,
  chevronLeft: <path d="m15 5-7 7 7 7" />,
  chevronRight: <path d="m9 5 7 7-7 7" />,
  chevronDown: <path d="m5 9 7 7 7-7" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  minus: <path d="M6 12h12" />,
  plus: <path d="M12 6v12M6 12h12" />,
  grid: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>,
  check: <path d="m5 12 5 5 9-10" />,
  sliders: <path d="M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4" />,
  sparkles: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />,
  cabin: <><path d="M3 11 12 4l9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-5h4v5" /><path d="M5 14h3M16 14h3" /></>,
  city: <><path d="M4 21V8l5-3v16M9 21V3h6v18M15 21V10l5 2v9" /><path d="M2 21h20" /></>,
  countryside: <><path d="M2 20c4-6 8-6 10-3s6 3 10-2" /><circle cx="17" cy="6" r="2.5" /><path d="M6 14V9M4 11l2-2 2 2" /></>,
  unique: <><path d="M12 3c-4 3-6 6-6 9a6 6 0 0 0 12 0c0-3-2-6-6-9Z" /><path d="M12 21v-6" /></>,
  room: <><path d="M3 18V8M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5" /><circle cx="7" cy="11" r="1.5" /></>,
  pool: <><path d="M2 18c2 1.5 4 1.5 6 0s4-1.5 6 0 4 1.5 6 0" /><path d="M8 15V5a2 2 0 0 1 4 0M16 15V5a2 2 0 0 0-4 0M8 9h8" /></>,
  beach: <><path d="M2 19c2 1.3 4 1.3 6 0s4-1.3 6 0 4 1.3 6 0" /><path d="M12 15 8 5M5 7c3-3 8-3 10 1L5 7Z" /></>,
  mountain: <><path d="m2 20 7-12 4 6 2-3 7 9Z" /><path d="m7.5 11 1.5 1 1.5-1.5" /></>,
  fire: <path d="M12 21a6 6 0 0 0 6-6c0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-3-2 2-3 4-3 7a6 6 0 0 0 6 6Z" />,
  wifi: <><path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0" /><circle cx="12" cy="19" r="1" /></>,
  kitchen: <><path d="M6 3v8a2 2 0 0 0 4 0V3M8 11v10M16 21V3c-2 1-3 4-3 8h3" /></>,
  car: <><path d="M5 17h14v-5l-2-5H7l-2 5Z" /><circle cx="8" cy="17" r="2" /><circle cx="16" cy="17" r="2" /></>,
  washer: <><rect x="4" y="3" width="16" height="18" rx="2" /><circle cx="12" cy="13" r="4" /><path d="M7 6h2" /></>,
  snow: <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9" />,
  desk: <><path d="M3 9h18M5 9v11M19 9v11M14 9v6h5" /><rect x="8" y="3" width="8" height="6" rx="1" /></>,
  tv: <><rect x="3" y="5" width="18" height="12" rx="2" /><path d="M8 21h8" /></>,
  medal: <><circle cx="12" cy="15" r="5" /><path d="m9 3 3 7 3-7" /></>,
  key: <><circle cx="8" cy="15" r="4" /><path d="m11 12 9-9M17 6l3 3" /></>,
  door: <><path d="M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17M3 21h18" /><circle cx="15" cy="12" r="1" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  pin: <><path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12Z" /><circle cx="12" cy="9" r="2.5" /></>,
  leaf: <path d="M5 19c0-9 5-14 15-14 0 10-5 15-14 15M5 19l7-7" />,
};

export type IconName = keyof typeof paths;

export function Icon({ name, className = "h-5 w-5", strokeWidth = 2 }: { name: string; className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {paths[name] ?? paths.check}
    </svg>
  );
}

/** Picks an icon for an amenity label. */
export function amenityIcon(label: string): string {
  const l = label.toLowerCase();
  if (l.includes("wifi")) return "wifi";
  if (l.includes("kitchen") || l.includes("oven") || l.includes("cook") || l.includes("coffee") || l.includes("espresso")) return "kitchen";
  if (l.includes("parking")) return "car";
  if (l.includes("washer") || l.includes("dryer")) return "washer";
  if (l.includes("air cond") || l.includes("fan")) return "snow";
  if (l.includes("workspace") || l.includes("desk")) return "desk";
  if (l.includes("pool") || l.includes("tub") || l.includes("onsen") || l.includes("sauna")) return "pool";
  if (l.includes("view")) return "mountain";
  if (l.includes("beach") || l.includes("ocean") || l.includes("surf") || l.includes("waterfront") || l.includes("kayak")) return "beach";
  if (l.includes("fire") || l.includes("stove") || l.includes("heat") || l.includes("bbq")) return "fire";
  if (l.includes("garden") || l.includes("vineyard") || l.includes("hiking") || l.includes("backyard") || l.includes("courtyard")) return "leaf";
  if (l.includes("tv")) return "tv";
  if (l.includes("entrance")) return "door";
  return "check";
}
