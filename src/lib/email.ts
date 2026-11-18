import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Transactional email. Sends via Resend (https://resend.com) when RESEND_API_KEY is set.
 * Without a key it logs the message instead, and if EMAIL_OUTBOX_DIR is set it also writes
 * each message to that folder as JSON (handy for tests and local development).
 */
export type Email = { to: string; subject: string; text: string; html?: string };

export function emailMode(): "resend" | "log" {
  return process.env.RESEND_API_KEY ? "resend" : "log";
}

export async function sendEmail(msg: Email): Promise<void> {
  const html = msg.html ?? layout(escapeHtml(msg.text).replace(/\n/g, "<br>"));
  if (emailMode() === "resend") {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM ?? "Fairbnb <hello@fairbnb.app>", to: [msg.to], subject: msg.subject, text: msg.text, html }),
    });
    if (!res.ok) throw new Error(`Email send failed (${res.status}): ${await res.text()}`);
    return;
  }
  console.info(`[email] to=${msg.to} subject=${JSON.stringify(msg.subject)}\n${msg.text}`);
  const dir = process.env.EMAIL_OUTBOX_DIR;
  if (dir) {
    await mkdir(dir, { recursive: true });
    const file = path.join(dir, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`);
    await writeFile(file, JSON.stringify({ ...msg, html, sentAt: new Date().toISOString() }, null, 2));
  }
}

/** Never let a failed email break the user's action; report it instead. */
export async function sendEmailSafely(msg: Email): Promise<boolean> {
  try {
    await sendEmail(msg);
    return true;
  } catch (e) {
    console.error("[email] failed", e);
    return false;
  }
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Minimal branded wrapper. `inner` must already be safe HTML. */
export function layout(inner: string) {
  return `<!doctype html><html><body style="margin:0;background:#f5f5f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#171717">
<div style="max-width:560px;margin:0 auto;padding:32px 16px">
<p style="font-size:22px;font-weight:800;color:#059669;margin:0 0 24px">fairbnb</p>
<div style="background:#fff;border-radius:12px;padding:28px;line-height:1.55;font-size:15px">${inner}</div>
<p style="font-size:12px;color:#737373;margin-top:24px">Fairbnb · 0% platform fees, funded by donations.</p>
</div></body></html>`;
}

export function button(href: string, label: string) {
  return `<p style="margin:24px 0"><a href="${escapeHtml(href)}" style="background:#059669;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;display:inline-block">${escapeHtml(label)}</a></p>`;
}

/**
 * Booking requires a confirmed email only when we can actually send one (RESEND_API_KEY set),
 * or when REQUIRE_EMAIL_VERIFICATION=1 forces it (CI does this; emails go to EMAIL_OUTBOX_DIR).
 * Without an email provider, requiring it would lock every new user out of booking.
 */
export function emailVerificationRequired(): boolean {
  return emailMode() === "resend" || process.env.REQUIRE_EMAIL_VERIFICATION === "1";
}
