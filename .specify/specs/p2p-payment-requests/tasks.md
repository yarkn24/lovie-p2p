# Tasks: P2P Payment Requests

## Phase 1: Database
- [ ] Create Supabase project
- [ ] Write migration: users table
- [ ] Write migration: payment_requests table + indexes
- [ ] Write migration: payment_transactions table
- [ ] Write RLS policies (payment_requests, payment_transactions)
- [ ] Write RPC: execute_payment()
- [ ] Write RPC: repeat_payment_request()
- [ ] Write trigger: handle_new_user() → backfill recipient_id on signup

## Phase 2: Next.js Setup
- [ ] Init Next.js 14 project (App Router, TypeScript, Tailwind)
- [ ] Install dependencies (Supabase, TanStack Query, React Hook Form)
- [ ] Configure Supabase client (server + browser)
- [ ] Configure TanStack Query provider

## Phase 3: Auth
- [ ] Magic link login page
- [ ] Auth callback handler
- [ ] Sign-up page (first_name, last_name collection)
- [ ] Auth middleware (protected routes)

## Phase 4: API Endpoints
- [ ] POST /api/payment-requests (create + bad words validation)
- [ ] GET /api/payment-requests (list with filters)
- [ ] GET /api/payment-requests/:id (detail + expiry check on load)
- [ ] POST /api/payment-requests/:id/pay
- [ ] POST /api/payment-requests/:id/schedule
- [ ] POST /api/payment-requests/:id/decline
- [ ] POST /api/payment-requests/:id/cancel
- [ ] POST /api/payment-requests/:id/retry
- [ ] POST /api/payment-requests/:id/repeat
- [ ] GET /api/cron/expire
- [ ] GET /api/cron/execute-scheduled

## Phase 5: Frontend
- [ ] Dashboard layout (incoming/outgoing tabs)
- [ ] Balance widget (display + add/subtract input)
- [ ] Request list with status badges + filters (status, name, amount range)
- [ ] Create request form
- [ ] Request detail page (all action buttons)
- [ ] Shareable link page (gated, shows login prompt if not authenticated)
- [ ] Real-time countdown timer component
- [ ] Loading states + error handling

## Phase 6: Cron + Email
- [ ] Vercel cron config (vercel.json)
- [ ] Email template: payment request notification (with/without note)
- [ ] Email trigger on request creation for unregistered recipients

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
- [ ] Deploy to Vercel
- [ ] Set environment variables
- [ ] Configure Vercel Cron
- [ ] Smoke test on production URL
- [ ] Write README
