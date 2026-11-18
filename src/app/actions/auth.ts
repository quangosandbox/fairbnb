"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  createSession,
  destroySession,
  getCurrentUser,
  hashPassword,
  setFlash,
  verifyPassword,
  verifyPasswordAgainstDummy,
} from "@/lib/auth";
import { checkRateLimit, clearHits, clientIp, rateLimit, recordHit, tooManyAttemptsMessage } from "@/lib/ratelimit";
import { consumeAuthToken, createAuthToken } from "@/lib/tokens";
import { button, escapeHtml, layout, sendEmailSafely } from "@/lib/email";
import { appUrl } from "@/lib/payments";

export type FormState = { error?: string; message?: string } | undefined;

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const LIMITS = {
  loginIp: { limit: 10, windowMs: 15 * MIN },
  loginEmail: { limit: 5, windowMs: 15 * MIN },
  signupIp: { limit: 5, windowMs: HOUR },
  forgotEmail: { limit: 3, windowMs: HOUR },
  forgotIp: { limit: 10, windowMs: HOUR },
  resendUser: { limit: 3, windowMs: HOUR },
};

const emailField = z.string().trim().toLowerCase().email("Enter a valid email");
const passwordField = z.string().min(8, "Password must be at least 8 characters").max(200, "Password is too long");

const signupSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  email: emailField,
  password: passwordField,
});

function safeNext(v: FormDataEntryValue | null) {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/\\") ? s : "/";
}

async function sendVerificationEmail(user: { id: string; email: string; name: string }) {
  const token = await createAuthToken(user.id, "verify_email");
  const link = `${appUrl()}/verify-email?token=${token}`;
  return sendEmailSafely({
    to: user.email,
    subject: "Confirm your email for Fairbnb",
    text: `Hi ${user.name},\n\nConfirm your email address to start booking stays on Fairbnb:\n${link}\n\nThis link expires in 48 hours. If you didn't create a Fairbnb account, you can ignore this email.`,
    html: layout(
      `<p>Hi ${escapeHtml(user.name)},</p><p>Confirm your email address to start booking stays on Fairbnb.</p>${button(link, "Confirm email")}<p style="font-size:13px;color:#737373">This link expires in 48 hours. If you didn't create a Fairbnb account, you can ignore this email.</p>`,
    ),
  });
}

async function sendResetEmail(user: { id: string; email: string; name: string }) {
  const token = await createAuthToken(user.id, "reset_password");
  const link = `${appUrl()}/reset-password?token=${token}`;
  return sendEmailSafely({
    to: user.email,
    subject: "Reset your Fairbnb password",
    text: `Hi ${user.name},\n\nSomeone (hopefully you) asked to reset your Fairbnb password. Choose a new one here:\n${link}\n\nThis link expires in 1 hour and can be used once. If you didn't ask for this, you can ignore this email; your password won't change.`,
    html: layout(
      `<p>Hi ${escapeHtml(user.name)},</p><p>Someone (hopefully you) asked to reset your Fairbnb password.</p>${button(link, "Choose a new password")}<p style="font-size:13px;color:#737373">This link expires in 1 hour and can be used once. If you didn't ask for this, you can ignore this email; your password won't change.</p>`,
    ),
  });
}

export async function signup(_: FormState, form: FormData): Promise<FormState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, email, password } = parsed.data;

  const limited = await rateLimit(`signup:ip:${await clientIp()}`, LIMITS.signupIp);
  if (!limited.ok) return { error: tooManyAttemptsMessage(limited.retryAfterSeconds) };

  if (await db.user.findUnique({ where: { email }, select: { id: true } })) return { error: "An account with that email already exists" };
  let user;
  try {
    user = await db.user.create({ data: { name, email, passwordHash: await hashPassword(password) } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { error: "An account with that email already exists" };
    throw e;
  }
  await sendVerificationEmail(user);
  await createSession(user.id, user.sessionVersion);
  await setFlash("check_inbox");
  redirect(safeNext(form.get("next")));
}

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Wrong email or password" };

  // Only failed attempts are recorded; both counters must have room before we even check.
  const ipKey = `login:ip:${await clientIp()}`;
  const emailKey = `login:email:${email}`;
  const [byIp, byEmail] = await Promise.all([checkRateLimit(ipKey, LIMITS.loginIp), checkRateLimit(emailKey, LIMITS.loginEmail)]);
  if (!byIp.ok || !byEmail.ok) {
    return { error: tooManyAttemptsMessage(Math.max(byIp.retryAfterSeconds, byEmail.retryAfterSeconds)) };
  }

  const user = await db.user.findUnique({ where: { email }, select: { id: true, passwordHash: true, sessionVersion: true } });
  // Same message and (roughly) the same bcrypt work whether or not the account exists.
  const ok = user ? await verifyPassword(password, user.passwordHash) : await verifyPasswordAgainstDummy(password);
  if (!user || !ok) {
    await Promise.all([recordHit(ipKey), recordHit(emailKey)]);
    return { error: "Wrong email or password" };
  }
  await clearHits(emailKey);
  await createSession(user.id, user.sessionVersion);
  redirect(safeNext(form.get("next")));
}

export async function logout() {
  await destroySession();
  redirect("/");
}

const FORGOT_RESPONSE = "If an account exists for that email, we've emailed a link to reset your password. It expires in 1 hour.";

export async function requestPasswordReset(_: FormState, form: FormData): Promise<FormState> {
  const parsed = emailField.safeParse(form.get("email") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const email = parsed.data;

  const [byIp, byEmail] = await Promise.all([
    rateLimit(`forgot:ip:${await clientIp()}`, LIMITS.forgotIp),
    rateLimit(`forgot:email:${email}`, LIMITS.forgotEmail),
  ]);
  if (!byIp.ok || !byEmail.ok) {
    return { error: tooManyAttemptsMessage(Math.max(byIp.retryAfterSeconds, byEmail.retryAfterSeconds)) };
  }

  const user = await db.user.findUnique({ where: { email }, select: { id: true, email: true, name: true } });
  if (user) await sendResetEmail(user);
  // Identical answer either way: no account enumeration.
  return { message: FORGOT_RESPONSE };
}

const resetSchema = z
  .object({ token: z.string().min(1, "This reset link is invalid"), password: passwordField, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "Passwords don't match", path: ["confirm"] });

export async function resetPassword(_: FormState, form: FormData): Promise<FormState> {
  const parsed = resetSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { token, password } = parsed.data;
  const passwordHash = await hashPassword(password);

  const updated = await db.$transaction(async (tx) => {
    const owner = await consumeAuthToken(token, "reset_password", tx);
    if (!owner) return null;
    const current = await tx.user.findUniqueOrThrow({ where: { id: owner.userId }, select: { emailVerifiedAt: true } });
    const user = await tx.user.update({
      where: { id: owner.userId },
      data: {
        passwordHash,
        // Logs out every existing session.
        sessionVersion: { increment: 1 },
        // Following the emailed link proves they control the inbox.
        emailVerifiedAt: current.emailVerifiedAt ?? new Date(),
      },
      select: { id: true, email: true, sessionVersion: true },
    });
    // Any other outstanding reset links for this account are now void.
    await tx.authToken.updateMany({ where: { userId: user.id, type: "reset_password", usedAt: null }, data: { usedAt: new Date() } });
    return user;
  });
  if (!updated) return { error: "This reset link is invalid or has expired. Request a new one below." };

  await clearHits(`login:email:${updated.email}`);
  await createSession(updated.id, updated.sessionVersion);
  await setFlash("password_reset");
  redirect("/");
}

export async function resendVerification(_: FormState, __: FormData): Promise<FormState> {
  void __;
  const user = await getCurrentUser();
  if (!user) return { error: "Log in to resend the confirmation email." };
  if (user.emailVerifiedAt) return { message: "Your email is already confirmed." };

  const limited = await rateLimit(`resend:user:${user.id}`, LIMITS.resendUser);
  if (!limited.ok) return { error: tooManyAttemptsMessage(limited.retryAfterSeconds) };

  const sent = await sendVerificationEmail(user);
  return sent ? { message: `Sent! Check ${user.email}.` } : { error: "We couldn't send the email right now. Try again shortly." };
}
