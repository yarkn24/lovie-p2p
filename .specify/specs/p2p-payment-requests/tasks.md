# Tasks: P2P Payment Requests

## Phase 1: Database
- [x] Create Supabase project
- [x] Write migration: users table
- [x] Write migration: payment_requests table + indexes
- [x] Write migration: payment_transactions table
- [x] Write RLS policies (payment_requests, payment_transactions)
- [x] Write RPC: execute_payment()
- [x] Write RPC: repeat_payment_request()
- [x] Write trigger: handle_new_user() → backfill recipient_id on signup

## Phase 2: Next.js Setup
- [x] Init Next.js 16 project (App Router, TypeScript, Tailwind)
- [x] Install dependencies (Supabase SSR, sharp)
- [x] Configure Supabase client (server + browser)

## Phase 3: Auth
- [x] Email + password login page
- [x] Auth callback handler
- [x] Sign-up page (first_name, last_name collection)
- [x] Auth middleware (protected routes)

## Phase 4: API Endpoints
- [x] POST /api/payment-requests (create + bad words validation)
- [x] GET /api/payment-requests (list with filters)
- [x] GET /api/payment-requests/:id (detail + expiry check on load)
- [x] POST /api/payment-requests/:id/pay
- [x] POST /api/payment-requests/:id/schedule
- [x] POST /api/payment-requests/:id/decline
- [x] POST /api/payment-requests/:id/cancel
- [x] POST /api/payment-requests/:id/retry
- [x] POST /api/payment-requests/:id/repeat
- [x] GET /api/cron/expire
- [x] GET /api/cron/execute-scheduled

## Phase 5: Frontend
- [x] Dashboard layout (incoming/outgoing tabs)
- [x] Balance widget (display + add/subtract input)
- [x] Request list with status badges + filters (status, name search)
- [x] Create request form
- [x] Request detail page (all action buttons)
- [x] Shareable link page (gated, shows login prompt if not authenticated)
- [x] Real-time countdown timer component
- [x] Loading states + error handling
- [x] Payment success confirmation modal (2-3s delay per spec)

## Phase 6: Cron + Email
- [x] Vercel cron config (vercel.json)
- [x] Email template: payment request notification (with/without note)
- [x] Email trigger on request creation for unregistered recipients
- [x] Email suite: 7 templated scenarios (new request × 2, paid, declined, scheduled, cancelled, scheduled-failed) via Resend, HTML-escaped
- [x] Atomic payment RPC (`execute_payment_v2`) — single Postgres transaction
- [x] Column-immutability trigger on `payment_requests` (amount, sender_id, note, recipient_email, created_at)

## Phase 7: Testing
- [x] Playwright setup + test user seed
- [x] Test: create request (registered recipient)
- [x] Test: create request (unregistered → email)
- [x] Test: pay now → balance updated
- [x] Test: schedule → execute → balance updated
- [x] Test: scheduled fails (insufficient balance) → retry
- [x] Test: expiration → pay blocked
- [x] Test: repeat after decline → new request
- [x] Test: repeat twice → button disabled
- [x] Test: shareable link (unregistered) → sign up flow
- [x] Test: decline → repeat available
- [x] Test: cancel (sender) → status cancelled
- [x] Test: countdown timer
- [x] Test: bad words memo validation
- [x] Test: dashboard filters

## Phase 8: Deploy
- [x] Deploy to Vercel
- [x] Set environment variables
- [x] Configure Vercel Cron
- [x] Smoke test on production URL
- [x] Write README

## Phase 9: Post-v1 Polish
- [x] Dashboard success banner (pay/decline/schedule) with 3s auto-dismiss
- [x] `View details` pill on every dashboard row
- [x] `Share` button on request detail (copy URL → `Copied` 2s feedback)
- [x] Anonymous landing at `/requests/[id]` with preview card + sign-in / sign-up CTAs
- [x] `GET /api/payment-requests/[id]/preview` — public preview endpoint returning minimal fields (id, amount, status, expires_at, sender_name, recipient_email)
- [x] Middleware: signed-in users whose `public.users` row was deleted get `signOut()` + redirect to `/auth/login`
- [x] Signup form pre-checks email → "You already have an account" before calling Supabase
- [x] `/auth/complete-profile` page for users whose auth row exists but profile row is missing (e.g. magic-link into a stale session)
- [x] Pay on already-expired row returns `REQUEST_EXPIRED` instead of cryptic `INVALID_STATUS`
- [x] Third-party brand mentions (Stripe / PayPal / Venmo / Wise / Cash App) removed from repo
- [x] 30-variant Lovie splash on `/auth/confirmed`
- [x] Regression tests: `tests/e2e/14-new-features.spec.ts` (9 tests: preview endpoint shape + anon page + 404, view-details pill, share button, expired-pay error code, signup-exists, deleted-profile kickout, complete-profile render)
