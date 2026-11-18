import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

const authToken = {
  updateMany: vi.fn(),
  create: vi.fn(),
  findFirst: vi.fn(),
  findUnique: vi.fn(),
};
vi.mock("@/lib/db", () => ({ db: { authToken } }));

const { TOKEN_TTL_MS, consumeAuthToken, createAuthToken, generateToken, hashToken, isWellFormedToken, peekAuthToken, tokenExpiry } =
  await import("@/lib/tokens");

beforeEach(() => {
  for (const fn of Object.values(authToken)) fn.mockReset();
});

describe("generateToken / hashToken", () => {
  it("makes 32-byte base64url tokens that are unique", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(a, "base64url")).toHaveLength(32);
    expect(a).not.toBe(b);
    expect(isWellFormedToken(a)).toBe(true);
  });

  it("hashes with sha256 hex, deterministically, and never equals the token", () => {
    const t = generateToken();
    expect(hashToken(t)).toBe(createHash("sha256").update(t).digest("hex"));
    expect(hashToken(t)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(t)).toBe(hashToken(t));
    expect(hashToken(t)).not.toBe(t);
  });

  it("rejects malformed tokens", () => {
    for (const bad of [undefined, null, "", "short", "x".repeat(44), "a".repeat(42) + "=", "a".repeat(42) + "/", 42]) {
      expect(isWellFormedToken(bad)).toBe(false);
    }
  });
});

describe("expiry", () => {
  it("verify_email lasts 48h, reset_password 1h", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    expect(tokenExpiry("verify_email", now).toISOString()).toBe("2026-01-03T00:00:00.000Z");
    expect(tokenExpiry("reset_password", now).toISOString()).toBe("2026-01-01T01:00:00.000Z");
    expect(TOKEN_TTL_MS.reset_password).toBe(3_600_000);
  });
});

describe("createAuthToken", () => {
  it("stores only the hash and invalidates older reset tokens", async () => {
    authToken.updateMany.mockResolvedValue({ count: 2 });
    authToken.create.mockResolvedValue({});
    const token = await createAuthToken("u1", "reset_password");
    expect(authToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "u1", type: "reset_password", usedAt: null } }),
    );
    const data = authToken.create.mock.calls[0][0].data;
    expect(data.tokenHash).toBe(hashToken(token));
    expect(JSON.stringify(data)).not.toContain(token);
    expect(data.expiresAt.getTime() - Date.now()).toBeGreaterThan(TOKEN_TTL_MS.reset_password - 5_000);
  });

  it("does not invalidate older verification tokens", async () => {
    authToken.create.mockResolvedValue({});
    await createAuthToken("u1", "verify_email");
    expect(authToken.updateMany).not.toHaveBeenCalled();
  });
});

describe("consumeAuthToken", () => {
  it("marks used with one conditional update (unused, unexpired, same type) and returns the owner", async () => {
    const t = generateToken();
    authToken.updateMany.mockResolvedValue({ count: 1 });
    authToken.findUnique.mockResolvedValue({ userId: "u9" });
    await expect(consumeAuthToken(t, "verify_email")).resolves.toEqual({ userId: "u9" });
    const arg = authToken.updateMany.mock.calls[0][0];
    expect(arg.where).toMatchObject({ tokenHash: hashToken(t), type: "verify_email", usedAt: null });
    expect(arg.where.expiresAt.gt).toBeInstanceOf(Date);
    expect(arg.data.usedAt).toBeInstanceOf(Date);
  });

  it("returns null when the token was already used, expired or of another type", async () => {
    authToken.updateMany.mockResolvedValue({ count: 0 });
    await expect(consumeAuthToken(generateToken(), "reset_password")).resolves.toBeNull();
    expect(authToken.findUnique).not.toHaveBeenCalled();
  });

  it("never queries for malformed tokens", async () => {
    await expect(consumeAuthToken("../../etc", "reset_password")).resolves.toBeNull();
    await expect(peekAuthToken(undefined, "reset_password")).resolves.toBeNull();
    expect(authToken.updateMany).not.toHaveBeenCalled();
    expect(authToken.findFirst).not.toHaveBeenCalled();
  });
});
