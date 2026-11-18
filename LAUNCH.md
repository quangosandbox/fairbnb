# Launch checklist: what it takes to run Fairbnb for real

The code is the easy part. These are the things that need a human (you) and real-world accounts.

## 1. Accounts & keys you need to create
| What | Why | Cost |
|---|---|---|
| **Stripe account** (enable Connect → Standard accounts) | Guests pay hosts directly; donations come to you. | No monthly fee. 2.9% + 30¢ per card charge, passed through to guests at cost. Standard accounts have no Connect platform fees. |
| **Postgres host** (Neon, Supabase, Railway, RDS…) | The database. | Free tier → ~$20/mo early on. |
| **App hosting** (Vercel, Fly, Render) | Runs the Next.js app. | Free → ~$20/mo early on. |
| **Domain** | fairbnb.something (check trademark first). | ~$15/yr. |
| **Transactional email** (Postmark, Resend, SES) | Booking confirmations, password resets. Not built yet. | ~$0–15/mo. |
| **Image storage** (S3/R2/Cloudinary) | Host photo uploads. Hosts paste URLs for now. | ~$0–5/mo. |

Then set in your environment: `DATABASE_URL`, `SESSION_SECRET` (random 32+ chars), `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_APP_URL`. Point a Stripe webhook at `/api/stripe/webhook` with
**"Listen to events on Connected accounts"** enabled (the booking events fire on hosts' accounts),
plus a second endpoint (or the same one) for platform events (donations).

## 2. Legal & structure (talk to a lawyer; this is not legal advice)
- **Entity**: to take tax-deductible donations "like Wikipedia" you need a non-profit (US 501(c)(3), which takes months,
  or start under a **fiscal sponsor** like Open Collective Foundation / Hack Club Bank equivalents to accept donations on day one).
- **Terms of Service & Privacy Policy**: mandatory before real users.
- **Short-term rental law** varies by city (NYC, Barcelona, Amsterdam, etc. heavily restrict or ban it). Many cities now
  require platforms to verify host registration numbers and/or share data. Start in a few friendly markets.
- **Occupancy/lodging tax**: many US states make the *platform* a "marketplace facilitator" required to collect and remit tax.
  Today Fairbnb puts that on hosts (they enter their rate). That will not survive scale. Plan to integrate a tax engine
  (e.g. Avalara MyLodgeTax) or restrict to jurisdictions where hosts remit.
- **Money transmission**: we use Stripe Connect direct charges so Fairbnb never holds host money. That's a deliberate
  choice to stay out of money-transmitter licensing. Keep it that way.
- **Insurance**: big platforms bundle host liability/damage cover. We have none. Either tell hosts clearly to carry their
  own short-term-rental insurance, or partner with an insurer (Proper, Safely, etc.).

## 3. Trust & safety (the real cost of a marketplace)
- Identity verification for hosts (Stripe Identity, ~$1.50/check) and maybe guests.
- Listing review / fraud detection (fake listings are the #1 scam).
- Dispute handling & cancellation policy. Right now: direct charges mean refunds come out of the host's Stripe balance,
  and there's no escrow-until-check-in. Decide a cancellation policy and automate refunds.
- A human support channel. Budget for this; it's where most of the money goes at scale.

## 4. Not built yet (engineering roadmap)
- [ ] Automated refunds on cancellation (Stripe refunds on connected account)
- [ ] Email notifications + password reset
- [ ] Photo uploads
- [ ] Host calendar / blocked dates, per-night pricing
- [ ] Guest↔host messaging
- [ ] Map search
- [ ] Host identity verification
- [ ] Admin tools: moderation, expense ledger entry
- [ ] Multi-currency (pricing assumes US Stripe rates)
