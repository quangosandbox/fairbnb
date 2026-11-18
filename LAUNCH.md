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
- Dispute handling. Cancellations and refunds are automated (see "Cancellations & refunds" below), but there's no
  escrow-until-check-in: direct charges mean refunds come out of the host's Stripe balance, so a host who has already
  paid out could have a negative balance (Stripe then debits their bank account).
- A human support channel. Budget for this; it's where most of the money goes at scale.

## 4. Not built yet (engineering roadmap)
- [x] Automated refunds on cancellation (Stripe refunds on connected account), see "Cancellations & refunds"
- [ ] Email notifications + password reset
- [ ] Photo uploads
- [ ] Host calendar / blocked dates, per-night pricing
- [ ] Guest↔host messaging
- [ ] Map search
- [ ] Host identity verification
- [ ] Admin tools: moderation, expense ledger entry
- [ ] Multi-currency (pricing assumes US Stripe rates)

## Cancellations & refunds
Policy ("Flexible", shown to guests on the trip page and in the confirmation email; code: `src/lib/cancellation.ts`):

| Who cancels / when | Guest gets back | Not refunded |
|---|---|---|
| Guest, 24 h or more before check-in (check-in = 3:00 PM UTC) | Nights + cleaning + tax + donation | Card processing (Stripe keeps its fee on refunds; neither host nor Fairbnb gets it) |
| Guest, less than 24 h before check-in | Every night except the first + cleaning + tax + donation | First night, card processing |
| Guest, after check-in | Can't cancel online; contact the host | |
| Host, any time before checkout | **Everything**, card processing included (the host absorbs Stripe's fee) | Nothing |
| Unpaid (awaiting payment) | Nothing was charged | |

How it works:
- `cancelBooking` server action → `cancelAndRefund` (`src/lib/payments.ts`). The guest/host sees the exact refund before
  confirming; if the amount changed in the meantime (e.g. the 24 h mark passed) nothing happens and they're asked to review.
- Stripe mode: `refunds.create` on the host's connected account with idempotency key `refund-<bookingId>`. Full refunds set
  `refund_application_fee: true`; partial refunds return exactly the donation via an application-fee refund (Stripe would
  otherwise return the fee only proportionally). If the refund fails, the booking stays confirmed and the user sees an error.
- The booking is marked `CANCELLED` with a conditional update (double-submit safe), `refundCents`/`stripeRefundId` recorded,
  the booking's `Donation` row deleted (so /transparency only counts donations we kept), and both parties are emailed.
- Webhooks (enable on the Connect endpoint): `charge.refunded`, `refund.created`, `refund.updated`, `refund.failed` keep
  `refundCents` in sync with Stripe (including refunds a host makes from their own Stripe dashboard; a full dashboard refund
  cancels the booking). A payment that arrives for an already-cancelled booking is refunded in full automatically.
- Abandoned checkouts: `GET /api/cron/expire-pending` cancels `PENDING_PAYMENT` bookings older than 45 minutes. Set
  `CRON_SECRET` in Vercel (Vercel Cron sends it as `Authorization: Bearer …`; without it the route always returns 401).
  `vercel.json` runs it daily at 04:00 UTC because the Hobby plan only allows daily crons; on Pro, use `*/15 * * * *`.
  (Pending bookings already stop blocking dates after 30 minutes, so the daily run is cleanup, not correctness.)
- Not handled automatically: disputes/chargebacks, refunds when the host's Stripe balance can't cover them (Stripe returns
  an error; the guest is told to try again / contact the host), and a failed application-fee refund (logged as
  `ACTION NEEDED`; refund the donation to the host by hand in the Stripe dashboard).
