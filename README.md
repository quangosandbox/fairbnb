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

## Deploy (Vercel + Neon)
1. Neon: create a project (Postgres 16, region AWS US East / N. Virginia). Copy two connection strings from **Connect**:
   pooled (host contains `-pooler`) and direct (pooling toggle off).
2. Vercel: import this repo and set environment variables:
   - `DATABASE_URL` = pooled string
   - `DATABASE_URL_UNPOOLED` = direct string (used only by migrations)
   - `SESSION_SECRET` = 32+ random characters (`openssl rand -hex 32`)
   - `NEXT_PUBLIC_APP_URL` = your site URL
   - `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` (optional; leave unset for demo mode)
3. Deploy. The `vercel-build` script applies migrations before building.
4. Optional demo data: `DATABASE_URL=<direct> DATABASE_URL_UNPOOLED=<direct> npm run db:seed` from your machine. This wipes the database, so never run it once real users exist.
