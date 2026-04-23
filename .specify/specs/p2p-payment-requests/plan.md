# Implementation Plan: P2P Payment Requests

## Tech Stack
- **Framework:** Next.js 16 (App Router, Turbopack, React 19)
- **Database:** Supabase (PostgreSQL + RLS)
- **Auth:** Supabase email + password
- **Styling:** Tailwind CSS v4
- **Testing:** Playwright E2E
- **Deployment:** Vercel
- **Cron:** Vercel Cron Functions (Hobby plan — daily)

## API Endpoints
```
POST   /api/payment-requests              create
GET    /api/payment-requests              list (filtered)
GET    /api/payment-requests/:id          detail
POST   /api/payment-requests/:id/pay      pay now
POST   /api/payment-requests/:id/schedule schedule
POST   /api/payment-requests/:id/decline  decline
POST   /api/payment-requests/:id/cancel   cancel
POST   /api/payment-requests/:id/retry    retry failed
POST   /api/payment-requests/:id/repeat   repeat declined
GET    /api/cron/expire                   cron: expire requests
GET    /api/cron/execute-scheduled        cron: run scheduled payments
```

## Architecture Decisions

### Atomic Payments via Supabase RPC
All payment steps (deduct balance, credit balance, update status, log transaction)
run inside a single PostgreSQL function call. Never split across multiple API calls.

### Authorization Guards (every action endpoint)
1. auth.uid() present
2. sender_id or recipient_id matches auth.uid() (role-dependent)
3. Business rule check (status, expired, repeated flags)

### Cron Jobs (Vercel Cron, Hobby plan — daily maximum)
- Daily: expire pending/scheduled requests past expires_at
- Daily: execute scheduled payments at their scheduled_payment_date

### Shareable Link Privacy
/requests/[UUID]: gated by login.
After login: server validates recipient_email = session email → 403 otherwise.

### Balance Widget
Dashboard header: current balance + input field + Add/Subtract buttons.
Dev + production both have it (this is a mock/demo app).

## Implementation Order
1. Supabase schema + migrations + RLS + DB functions
2. Next.js project setup (Tailwind, TanStack Query, Supabase client)
3. Auth flow (magic link + sign-up name collection)
4. API endpoints (all 10)
5. Dashboard (incoming/outgoing tabs, filters, balance widget)
6. Create request page
7. Request detail page (pay/schedule/decline/cancel/retry/repeat)
8. Cron jobs
9. Email templates (Supabase email)
10. E2E tests (Playwright, 15 scenarios)
11. Deploy to Vercel
12. README
