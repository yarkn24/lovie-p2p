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
- [x] Init Next.js 15 project (App Router, TypeScript, Tailwind)
- [x] Install dependencies (Supabase SSR, sharp)
- [x] Configure Supabase client (server + browser)

## Phase 3: Auth
- [x] Magic link login page
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
- [x] Rate limit on payment-requests POST (20/user/hour)

## Phase 7: Testing
- [ ] Playwright setup + test user seed
- [ ] Test: create request (registered recipient)
- [ ] Test: create request (unregistered → email)
- [ ] Test: pay now → balance updated
- [ ] Test: schedule → execute → balance updated
- [ ] Test: scheduled fails (insufficient balance) → retry
- [ ] Test: expiration → pay blocked
- [ ] Test: repeat after decline → new request
- [ ] Test: repeat twice → button disabled
- [ ] Test: shareable link (unregistered) → sign up flow
- [ ] Test: decline → repeat available
- [ ] Test: cancel (sender) → status cancelled
- [ ] Test: countdown timer
- [ ] Test: bad words memo validation
- [ ] Test: dashboard filters

## Phase 8: Deploy
- [x] Deploy to Vercel
- [x] Set environment variables
- [x] Configure Vercel Cron
- [x] Smoke test on production URL
- [x] Write README
