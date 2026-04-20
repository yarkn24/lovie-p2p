# Lovie P2P — Payment Requests

A Venmo-style peer-to-peer payment request feature, built for the Lovie Feature
Engineer interview. Users request money from each other by email; recipients can
pay, decline, or schedule payment. Requests expire after 7 days.

Built spec-first using [GitHub Spec-Kit](https://github.com/github/spec-kit),
implemented with Claude Code, deployed on Vercel + Supabase.

- **Live demo**: https://lovie-p2p-gules.vercel.app
- **Spec**: [`.specify/specs/p2p-payment-requests/spec.md`](../.specify/specs/p2p-payment-requests/spec.md)

---

## Demo accounts

Three pre-seeded users with 30 mock payment requests spread across them:

| Email                  | Password |
| ---------------------- | -------- |
| `user1@demo.lovie.co`  | `123`    |
| `user2@demo.lovie.co`  | `123`    |
| `user3@demo.lovie.co`  | `123`    |

Each user has 5 incoming pending requests and 5 outgoing paid requests
(~$10 – $250 each). The dashboard also exposes **Admin: Add / Subtract** so a
reviewer can top up or drain a balance and exercise the `INSUFFICIENT_BALANCE`
path end-to-end.

## Feature list

- Create payment request (email, amount in cents, optional note, bad-words filter, 500-char cap)
- Incoming / outgoing dashboard with status filter + name/note search
- Request detail view with role-aware actions
- **Recipient** actions: Pay now · Decline · Schedule for a future date
- **Sender** actions: Cancel pending · Request again (declined or failed, once)
- Retry on failed scheduled payments: Pay now or Reschedule
- 7-day expiry with live countdown, enforced server-side
- Daily cron jobs (Vercel, Hobby plan) for expiry + scheduled execution
- Balance top-up / subtract (admin convenience for the demo)
- Stripe/PayPal-style structured error envelope (`error.type` / `code` / `details[]`)

## Tech stack

- **Next.js 16** (App Router, Turbopack, React 19)
- **TypeScript strict**, Tailwind CSS v4, Instrument Sans
- **Supabase** Postgres + Auth + RLS + RPC (`execute_payment`, `execute_scheduled_payments`, `repeat_payment_request`, `expire_pending_requests`)
- Vercel cron for scheduled + expiry jobs
- Built with Claude Code (spec-driven, `/specify → /plan → /tasks → implement`)

## Run locally

```bash
git clone https://github.com/yarkn24/lovie-p2p
cd lovie-p2p/app
npm install
cp .env.local.example .env.local   # fill in Supabase URL + keys
npm run dev
```

Open http://localhost:3000. The login page lists the 3 demo accounts.

### Environment variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # server-only (seed + counterparty reads)
CRON_SECRET=                         # bearer token for Vercel cron routes
```

### Apply migrations

```bash
supabase link --project-ref <your-project>
supabase db push
```

### Seed demo users + payments

```bash
npm run seed
```

Safe to re-run. Wipes existing demo payment rows and re-creates 30 requests.

## E2E tests

Not yet included — this submission covers everything up to the E2E / automated
screen-recording step (which is the next branch of work).

## Project structure

```
app/
├── app/                 # Next.js App Router
│   ├── api/             # REST endpoints (payment-requests, auth, cron, balance)
│   ├── auth/            # login, signup, callback
│   └── requests/        # new, [id], [id]/share
├── components/          # Shell (nav)
├── lib/
│   ├── errors.ts        # Structured error helpers (Stripe/PayPal-style)
│   ├── validation.ts    # Email, bad-words, note length
│   └── supabase/        # server, client, admin (service-role)
├── scripts/seed.mjs     # Demo users + mock payments
├── supabase/migrations/ # 4 migrations (schema, rpcs, failure_reason, profile-read RLS)
└── vercel.json          # Cron schedules
```

## API error format

All mutating endpoints return a consistent error envelope:

```json
{
  "error": {
    "type": "invalid_request_error",
    "code": "INSUFFICIENT_BALANCE",
    "message": "Your balance is insufficient to complete this payment.",
    "details": [{ "field": "amount", "issue": "must be greater than zero" }]
  }
}
```

Informed by Stripe (`error.code` + `type`) and PayPal (`details[]`).
