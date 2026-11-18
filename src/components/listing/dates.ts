/** Date helpers for "YYYY-MM-DD" strings (UTC calendar days). Safe on server and client. */

const d = (s: string) => new Date(`${s}T00:00:00Z`);

export function nightsCount(checkIn?: string, checkOut?: string) {
  if (!checkIn || !checkOut) return 0;
  return Math.round((d(checkOut).getTime() - d(checkIn).getTime()) / 86_400_000);
}

/** "Mar 3, 2027" */
export function formatLong(s?: string) {
  if (!s) return "";
  return d(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** "3/3/2027" */
export function formatSlash(s?: string) {
  if (!s) return "";
  const x = d(s);
  return `${x.getUTCMonth() + 1}/${x.getUTCDate()}/${x.getUTCFullYear()}`;
}

/** "Mar 3 – 8" or "Mar 30 – Apr 2" */
export function formatRangeShort(a?: string, b?: string) {
  if (!a || !b) return "";
  const A = d(a);
  const B = d(b);
  const ma = A.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  const mb = B.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  return ma === mb ? `${ma} ${A.getUTCDate()} – ${B.getUTCDate()}` : `${ma} ${A.getUTCDate()} – ${mb} ${B.getUTCDate()}`;
}
