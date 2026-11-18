import "server-only";
import { db } from "./db";
import { button, escapeHtml, layout, sendEmailSafely, type Email } from "./email";
import { formatMoney } from "./pricing";
import { appUrl } from "./payments";

/**
 * Booking lifecycle emails: confirmed (guest + host) and cancelled (guest + host).
 * The builders are pure (unit tested); the senders load the booking and send via
 * sendEmailSafely so a failed email never breaks a booking or a refund.
 */

export type EmailBooking = {
  id: string;
  paymentMode?: string;
  checkIn: Date;
  checkOut: Date;
  guests: number;
  nights: number;
  subtotalCents: number;
  cleaningFeeCents: number;
  taxCents: number;
  processingCents: number;
  platformFeeCents: number;
  donationCents: number;
  totalCents: number;
  hostPayoutCents: number;
  refundCents: number;
  currency: string;
  cancelledBy: string | null;
  listing: { id: string; title: string; city: string; region: string; country: string; host: { name: string; email: string } };
  guest: { name: string; email: string };
};

const fmtDay = (d: Date) =>
  d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const first = (name: string) => name.split(" ")[0] || name;
const place = (l: EmailBooking["listing"]) => [l.city, l.region, l.country].filter(Boolean).join(", ");
const code = (id: string) => id.slice(-8).toUpperCase();

function itemized(b: EmailBooking): [string, number][] {
  const rows: [string, number][] = [
    [`${b.nights} night${b.nights === 1 ? "" : "s"} × ${formatMoney(Math.round(b.subtotalCents / b.nights), b.currency)}`, b.subtotalCents],
  ];
  if (b.cleaningFeeCents > 0) rows.push(["Cleaning fee", b.cleaningFeeCents]);
  if (b.taxCents > 0) rows.push(["Lodging tax", b.taxCents]);
  rows.push(["Card processing (Stripe, at cost)", b.processingCents]);
  rows.push(["Fairbnb fee", b.platformFeeCents]);
  if (b.donationCents > 0) rows.push(["Your donation to Fairbnb", b.donationCents]);
  return rows;
}

function table(rows: [string, number][], currency: string, totalLabel: string, total: number) {
  const tr = (l: string, c: number, bold = false) =>
    `<tr><td style="padding:4px 0${bold ? ";font-weight:700;border-top:1px solid #e5e5e5;padding-top:8px" : ""}">${escapeHtml(l)}</td><td style="padding:4px 0;text-align:right${bold ? ";font-weight:700;border-top:1px solid #e5e5e5;padding-top:8px" : ""}">${escapeHtml(formatMoney(c, currency))}</td></tr>`;
  return `<table style="width:100%;border-collapse:collapse;font-size:14px">${rows.map(([l, c]) => tr(l, c)).join("")}${tr(totalLabel, total, true)}</table>`;
}

const textRows = (rows: [string, number][], currency: string) => rows.map(([l, c]) => `  ${l}: ${formatMoney(c, currency)}`).join("\n");

export function bookingConfirmedEmails(b: EmailBooking, baseUrl = appUrl()): Email[] {
  const tripUrl = `${baseUrl}/trips/${b.id}`;
  const hostUrl = `${baseUrl}/host`;
  const dates = `${fmtDay(b.checkIn)} – ${fmtDay(b.checkOut)}`;
  const where = place(b.listing);
  const host = b.listing.host;
  const rows = itemized(b);

  const guestText = [
    `Hi ${first(b.guest.name)},`,
    ``,
    `You're booked! ${b.listing.title} in ${where}.`,
    `Dates: ${dates} (check-in 3:00 PM, checkout 11:00 AM)`,
    `Guests: ${b.guests}`,
    `Host: ${host.name}`,
    `Confirmation code: ${code(b.id)}`,
    ``,
    `What you paid:`,
    textRows(rows, b.currency),
    `  Total: ${formatMoney(b.totalCents, b.currency)}`,
    ``,
    `Fairbnb charged you $0 in fees. Your host receives ${formatMoney(b.hostPayoutCents, b.currency)}.`,
    ``,
    `Cancellation: free cancellation (everything except card processing) until 24 hours before check-in.`,
    ``,
    `View your trip: ${tripUrl}`,
  ].join("\n");
  const guestHtml = layout(
    `<p>Hi ${escapeHtml(first(b.guest.name))},</p>
<p style="font-size:18px;font-weight:700;margin:0 0 4px">You're booked!</p>
<p style="margin:0">${escapeHtml(b.listing.title)} · ${escapeHtml(where)}</p>
<p><strong>${escapeHtml(dates)}</strong><br>Check-in 3:00 PM · Checkout 11:00 AM<br>${b.guests} guest${b.guests === 1 ? "" : "s"} · Host: ${escapeHtml(host.name)}<br>Confirmation code: <span style="font-family:monospace">${code(b.id)}</span></p>
${table(rows, b.currency, "Total", b.totalCents)}
<p style="font-size:13px;color:#525252">Fairbnb charged you $0 in fees. Your host receives ${escapeHtml(formatMoney(b.hostPayoutCents, b.currency))}. Free cancellation (everything except card processing) until 24 hours before check-in.</p>
${button(tripUrl, "View your trip")}`,
  );

  const hostText = [
    `Hi ${first(host.name)},`,
    ``,
    `New reservation: ${b.guest.name} booked ${b.listing.title}.`,
    `Dates: ${dates}`,
    `Guests: ${b.guests} · ${b.nights} night${b.nights === 1 ? "" : "s"}`,
    `Confirmation code: ${code(b.id)}`,
    ``,
    `Your payout: ${formatMoney(b.hostPayoutCents, b.currency)} (nightly price + cleaning + tax). Fairbnb takes $0.`,
    ``,
    `Manage reservations: ${hostUrl}`,
  ].join("\n");
  const hostHtml = layout(
    `<p>Hi ${escapeHtml(first(host.name))},</p>
<p style="font-size:18px;font-weight:700;margin:0 0 4px">New reservation</p>
<p>${escapeHtml(b.guest.name)} booked <strong>${escapeHtml(b.listing.title)}</strong>.<br>${escapeHtml(dates)}<br>${b.guests} guest${b.guests === 1 ? "" : "s"} · ${b.nights} night${b.nights === 1 ? "" : "s"} · Code <span style="font-family:monospace">${code(b.id)}</span></p>
<p style="font-size:16px">Your payout: <strong>${escapeHtml(formatMoney(b.hostPayoutCents, b.currency))}</strong></p>
<p style="font-size:13px;color:#525252">Nightly price + cleaning + tax, paid straight to your Stripe account. Fairbnb takes $0.</p>
${button(hostUrl, "Manage reservations")}`,
  );

  return [
    { to: b.guest.email, subject: `Booking confirmed: ${b.listing.title}, ${fmtDay(b.checkIn)}`, text: guestText, html: guestHtml },
    { to: host.email, subject: `New reservation: ${b.guest.name}, ${fmtDay(b.checkIn)}`, text: hostText, html: hostHtml },
  ];
}

export function bookingCancelledEmails(b: EmailBooking, baseUrl = appUrl()): Email[] {
  const tripUrl = `${baseUrl}/trips/${b.id}`;
  const dates = `${fmtDay(b.checkIn)} – ${fmtDay(b.checkOut)}`;
  const host = b.listing.host;
  const refund = formatMoney(b.refundCents, b.currency);
  const by =
    b.cancelledBy === "host" ? `${host.name} (your host)` : b.cancelledBy === "guest" ? "you" : "Fairbnb, because payment didn't complete in time";
  const refundSentence =
    b.refundCents > 0
      ? `${refund} has been refunded to your card. It can take 5–10 days to appear.`
      : "No payment was taken, so there's nothing to refund.";

  const guestText = [
    `Hi ${first(b.guest.name)},`,
    ``,
    `Your reservation at ${b.listing.title} (${dates}, code ${code(b.id)}) was cancelled by ${by}.`,
    ``,
    refundSentence,
    ``,
    `Details: ${tripUrl}`,
  ].join("\n");
  const guestHtml = layout(
    `<p>Hi ${escapeHtml(first(b.guest.name))},</p>
<p>Your reservation at <strong>${escapeHtml(b.listing.title)}</strong> (${escapeHtml(dates)}, code <span style="font-family:monospace">${code(b.id)}</span>) was cancelled by ${escapeHtml(by)}.</p>
<p style="font-size:16px">${escapeHtml(refundSentence)}</p>
${button(tripUrl, "View details")}`,
  );

  const hostBy = b.cancelledBy === "host" ? "you" : b.cancelledBy === "guest" ? `${b.guest.name} (the guest)` : "Fairbnb (payment didn't complete)";
  const kept = b.totalCents - b.refundCents;
  const hostRefundLine =
    b.refundCents > 0
      ? `${refund} was refunded to the guest${b.paymentMode === "stripe" ? " from your Stripe balance" : ""}.` +
        (kept > 0
          ? ` ${formatMoney(kept, b.currency)} of the payment was non-refundable under the cancellation policy` +
            (kept > b.processingCents
              ? ` (${formatMoney(kept - b.processingCents, b.currency)} stays with you; ${formatMoney(b.processingCents, b.currency)} card processing is kept by Stripe).`
              : " (card processing, which Stripe keeps).")
          : "")
      : "No payment had been taken.";
  const hostText = [
    `Hi ${first(host.name)},`,
    ``,
    `The reservation by ${b.guest.name} for ${b.listing.title} (${dates}, code ${code(b.id)}) was cancelled by ${hostBy}. The dates are open again.`,
    ``,
    hostRefundLine,
    ``,
    `Manage reservations: ${baseUrl}/host`,
  ].join("\n");
  const hostHtml = layout(
    `<p>Hi ${escapeHtml(first(host.name))},</p>
<p>The reservation by ${escapeHtml(b.guest.name)} for <strong>${escapeHtml(b.listing.title)}</strong> (${escapeHtml(dates)}, code <span style="font-family:monospace">${code(b.id)}</span>) was cancelled by ${escapeHtml(hostBy)}. The dates are open again.</p>
<p>${escapeHtml(hostRefundLine)}</p>
${button(`${baseUrl}/host`, "Manage reservations")}`,
  );

  return [
    { to: b.guest.email, subject: `Reservation cancelled: ${b.listing.title}`, text: guestText, html: guestHtml },
    { to: host.email, subject: `Reservation cancelled: ${b.guest.name}, ${fmtDay(b.checkIn)}`, text: hostText, html: hostHtml },
  ];
}

const emailInclude = {
  listing: { select: { id: true, title: true, city: true, region: true, country: true, host: { select: { name: true, email: true } } } },
  guest: { select: { name: true, email: true } },
} as const;

/**
 * Sends the confirmation emails exactly once per booking: whoever flips
 * confirmationEmailSentAt from null wins (mock checkout and duplicate webhook
 * deliveries can race). If every send fails, the flag is cleared so a later
 * attempt can retry.
 */
export async function sendBookingConfirmedEmails(bookingId: string): Promise<boolean> {
  const { count } = await db.booking.updateMany({
    where: { id: bookingId, status: "CONFIRMED", confirmationEmailSentAt: null },
    data: { confirmationEmailSentAt: new Date() },
  });
  if (count === 0) return false;
  try {
    const b = await db.booking.findUniqueOrThrow({ where: { id: bookingId }, include: emailInclude });
    const results = await Promise.all(bookingConfirmedEmails(b).map(sendEmailSafely));
    if (!results.some(Boolean)) {
      await db.booking.update({ where: { id: bookingId }, data: { confirmationEmailSentAt: null } });
      return false;
    }
    return true;
  } catch (e) {
    console.error(`[booking-emails] confirmation for ${bookingId} failed`, e);
    await db.booking.update({ where: { id: bookingId }, data: { confirmationEmailSentAt: null } }).catch(() => {});
    return false;
  }
}

/** Callers must only invoke this once per cancellation (after their conditional update succeeded). */
export async function sendBookingCancelledEmails(bookingId: string): Promise<void> {
  try {
    const b = await db.booking.findUniqueOrThrow({ where: { id: bookingId }, include: emailInclude });
    await Promise.all(bookingCancelledEmails(b).map(sendEmailSafely));
  } catch (e) {
    console.error(`[booking-emails] cancellation for ${bookingId} failed`, e);
  }
}
