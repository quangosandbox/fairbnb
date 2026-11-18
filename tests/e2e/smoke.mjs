// End-to-end smoke test against a running server with seeded demo data.
// Usage: BASE_URL=http://localhost:3000 node tests/e2e/smoke.mjs
import { chromium } from "playwright";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const launch = process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {};
const fail = (msg) => { console.error("FAIL:", msg); process.exitCode = 1; };

const browser = await chromium.launch(launch);
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

try {
  for (const path of ["/", "/fees", "/transparency", "/donate", "/login", "/signup"]) {
    const res = await page.goto(base + path);
    if (!res || res.status() !== 200) fail(`${path} returned ${res?.status()}`);
  }

  await page.goto(base + "/");
  const cards = await page.locator('a[href^="/listings/c"]').count();
  if (cards < 10) fail(`expected seeded listings on home page, found ${cards}`);

  const email = `smoke-${Date.now()}@fairbnb.test`;
  await page.goto(base + "/signup");
  await page.fill("input[name=name]", "Smoke Test");
  await page.fill("input[name=email]", email);
  await page.fill("input[name=password]", "password123");
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/signup"), { timeout: 20000 }), page.locator("form button").last().click()]);

  // Confirm the email using the link from the outbox (server must run with EMAIL_OUTBOX_DIR set).
  const outbox = process.env.EMAIL_OUTBOX_DIR;
  if (outbox) {
    let link;
    for (let i = 0; i < 20 && !link; i++) {
      for (const f of (await readdir(outbox).catch(() => [])).sort().reverse()) {
        const m = JSON.parse(await readFile(path.join(outbox, f), "utf8"));
        if (m.to === email) { link = m.text.match(/https?:\/\/\S+verify-email\?token=[\w-]+/)?.[0]; if (link) break; }
      }
      if (!link) await new Promise((r) => setTimeout(r, 250));
    }
    if (!link) fail("no verification email found in outbox");
    else {
      await page.goto(link.replace(/^https?:\/\/[^/]+/, base));
      if (!/confirmed/i.test(await page.locator("main").innerText())) fail("verification link did not confirm the email");
    }
  }

  // Far-future dates so they never collide with seeded bookings.
  const d = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
  await page.goto(`${base}/?checkIn=${d(400)}&checkOut=${d(403)}&guests=2`);
  const total = await page.locator('a[href^="/listings/"] .underline').first().innerText();
  await page.locator('a[href^="/listings/c"]').first().click();
  await page.waitForLoadState("networkidle");
  const reserve = page.locator("button:visible", { hasText: /^Reserve/ }).first();
  if (await reserve.isDisabled()) {
    fail("Reserve button is disabled (email verification may be required — verify the test user first)");
  } else {
    await Promise.all([page.waitForURL(/\/trips\//, { timeout: 20000 }), reserve.click()]);
    const body = await page.locator("main").innerText();
    if (!body.includes(total)) fail(`trip page does not show the quoted total ${total}`);
    console.log("booked", page.url(), "total", total);
  }
  if (errors.length) fail(`page errors: ${errors.join("; ")}`);
} catch (e) {
  fail(e.stack ?? String(e));
} finally {
  await browser.close();
}
if (!process.exitCode) console.log("smoke test passed");
