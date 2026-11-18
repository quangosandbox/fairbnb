import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { db } from "./db";

const COOKIE = "fairbnb_session";
const MAX_AGE = 60 * 60 * 24 * 30;
const BCRYPT_COST = 12;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be set (32+ chars)");
  return new TextEncoder().encode(s);
}

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, BCRYPT_COST);
}

export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

let dummyHash: Promise<string> | undefined;
/**
 * Burns the same bcrypt time as a real check, for logins with an unknown email, so response
 * timing does not reveal which emails have accounts. Always returns false.
 */
export async function verifyPasswordAgainstDummy(pw: string): Promise<false> {
  dummyHash ??= bcrypt.hash("fairbnb-dummy-password", BCRYPT_COST);
  await bcrypt.compare(pw, await dummyHash);
  return false;
}

/**
 * Signs the user in. The JWT carries the user's sessionVersion (`sv`); bumping the version
 * (password reset) invalidates every session issued before it.
 */
export async function createSession(userId: string, sessionVersion?: number) {
  const sv =
    sessionVersion ?? (await db.user.findUniqueOrThrow({ where: { id: userId }, select: { sessionVersion: true } })).sessionVersion;
  const token = await new SignJWT({ sub: userId, sv })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export async function getCurrentUser() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub) return null;
    const user = await db.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        stripeAccountId: true,
        payoutsEnabled: true,
        emailVerifiedAt: true,
        sessionVersion: true,
      },
    });
    if (!user) return null;
    // Sessions issued before `sv` existed count as version 0 (the default), so they survive
    // the rollout but are still cut off by the first password reset.
    const sv = typeof payload.sv === "number" ? payload.sv : 0;
    if (sv !== user.sessionVersion) return null;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { sessionVersion, ...rest } = user;
    return rest;
  } catch {
    return null;
  }
}

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export function isEmailVerified(user: { emailVerifiedAt: Date | null } | null | undefined): boolean {
  return !!user?.emailVerifiedAt;
}

/* ---------- One-shot notices shown after a redirect ("flash" messages) ---------- */

const FLASH_COOKIE = "fairbnb_flash";
export const FLASH_MESSAGES = {
  password_reset: "Your password has been changed. You're logged in, and any other sessions were signed out.",
  check_inbox: "Welcome to Fairbnb! We sent you an email to confirm your address.",
} as const;
export type FlashCode = keyof typeof FLASH_MESSAGES;
export const FLASH_COOKIE_NAME = FLASH_COOKIE;

/** Only a known code is stored, never user text; it is cleared client-side once shown. */
export async function setFlash(code: FlashCode) {
  (await cookies()).set(FLASH_COOKIE, code, { httpOnly: false, sameSite: "lax", path: "/", maxAge: 60 });
}

export async function readFlash(): Promise<string | null> {
  const code = (await cookies()).get(FLASH_COOKIE)?.value;
  return code && code in FLASH_MESSAGES ? FLASH_MESSAGES[code as FlashCode] : null;
}
