# fairbnb

Airbnb-style short-stay marketplace with **zero platform fees** for guests and hosts, funded Wikipedia-style by optional donations.

- The price in search results is the total the guest pays.
- Hosts get 100% of their nightly rate + cleaning fee (+ any lodging tax they must remit).
- The only add-on is card processing (Stripe's 2.9% + 30¢), passed through at cost and shown as its own line.
- Optional donation at checkout and on `/donate`. All money in/out is public on `/transparency`.

See [LAUNCH.md](./LAUNCH.md) for what's needed to run this for real (accounts, legal, trust & safety).

## Stack
Next.js 15 (App Router, server actions) · TypeScript · Tailwind v4 · Prisma 6 + Postgres · Stripe Connect (Standard accounts, direct charges).

## Run locally
```bash
cp .env.example .env          # edit DATABASE_URL if needed
npm install
npx prisma migrate dev        # create tables
npm run db:seed               # demo data
npm run dev                   # http://localhost:3000
```
Demo logins: `guest@fairbnb.test` / `password123`, `host@fairbnb.test` / `password123`.

With `STRIPE_SECRET_KEY` empty the app runs in **mock payment mode**: bookings confirm instantly, no money moves.
Add Stripe test keys to exercise real Checkout + Connect onboarding (use `stripe listen --forward-connect-to localhost:3000/api/stripe/webhook --forward-to localhost:3000/api/stripe/webhook` for webhooks).

## Where things are
- `src/lib/pricing.ts`: the fee math. One source of truth for every price on the site.
- `src/lib/payments.ts` / `src/lib/stripe.ts`: mock vs. Stripe payments.
- `src/app/actions/*`: server actions (auth, bookings, listings, reviews, donations).
- `src/app/api/stripe/*`: Connect onboarding return + webhooks.
- `prisma/schema.prisma`: data model. `prisma/seed.ts`: demo data.
