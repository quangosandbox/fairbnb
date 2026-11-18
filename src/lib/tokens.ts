import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { db } from "./db";

/**
 * Single-use emailed tokens (email verification, password reset). Only a SHA-256 hash of the
 * token is stored, so a database leak does not hand out working links.
 */
export type TokenType = "verify_email" | "reset_password";

export const TOKEN_TTL_MS: Record<TokenType, number> = {
  verify_email: 48 * 60 * 60 * 1000,
  reset_password: 60 * 60 * 1000,
};

/** 32 random bytes, base64url encoded (43 chars, URL safe, no padding). */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function tokenExpiry(type: TokenType, now = new Date()): Date {
  return new Date(now.getTime() + TOKEN_TTL_MS[type]);
}

/** Cheap shape check so junk input never reaches the database. */
export function isWellFormedToken(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
}

/**
 * Creates a token and returns the raw value (to put in the emailed link).
 * A new reset token invalidates the user's older unused reset tokens.
 */
export async function createAuthToken(userId: string, type: TokenType): Promise<string> {
  const token = generateToken();
  const now = new Date();
  if (type === "reset_password") {
    await db.authToken.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: now } });
  }
  await db.authToken.create({ data: { userId, type, tokenHash: hashToken(token), expiresAt: tokenExpiry(type, now) } });
  return token;
}

type TokenClient = Pick<typeof db, "authToken">;

/** Returns the owner of a valid (unused, unexpired) token without using it up. */
export async function peekAuthToken(token: unknown, type: TokenType): Promise<{ userId: string } | null> {
  if (!isWellFormedToken(token)) return null;
  const row = await db.authToken.findFirst({
    where: { tokenHash: hashToken(token), type, usedAt: null, expiresAt: { gt: new Date() } },
    select: { userId: true },
  });
  return row;
}

/**
 * Uses up a token exactly once. The "mark used" and the validity check are one conditional
 * UPDATE, so two concurrent requests cannot both succeed. Pass a transaction client to tie it
 * to other writes.
 */
export async function consumeAuthToken(token: unknown, type: TokenType, client: TokenClient = db): Promise<{ userId: string } | null> {
  if (!isWellFormedToken(token)) return null;
  const tokenHash = hashToken(token);
  const now = new Date();
  const { count } = await client.authToken.updateMany({
    where: { tokenHash, type, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  });
  if (count !== 1) return null;
  const row = await client.authToken.findUnique({ where: { tokenHash }, select: { userId: true } });
  return row ? { userId: row.userId } : null;
}
