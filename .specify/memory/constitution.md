# Lovie P2P Constitution

## Core Principles

### I. Financial Integrity (NON-NEGOTIABLE)
All monetary amounts stored as INTEGER (cents). Never floats. Never strings.
Display layer only converts cents → dollars on render. All calculations in cents.
Every payment operation runs within a single atomic database transaction — "all or nothing."

### II. Security by Default
Supabase RLS enforced on every table. Users can access only their own rows.
Every action endpoint validates in order: authentication → authorization → business rules.
No auto-pay: all payments require an authenticated session and explicit user confirmation.

### III. Idempotency & Auditability
All state-changing operations are safe to retry without side effects.
Immutable flags: `expired` and `repeated` never revert once set to 1 (enforced by DB trigger).
Payment transactions table provides complete audit trail and duplicate-prevention proof.

### IV. Expiration Integrity — Double Layer
Layer 1: Page load checks `expires_at < NOW()` → sets `expired = 1`.
Layer 2: Daily cron job bulk-updates all overdue requests (Vercel Hobby plan — daily maximum).
Both layers use `AND expired = 0` guard to stay idempotent.

### V. Test Coverage & Observability
E2E tests (Playwright, 91 tests) cover all happy paths and critical error cases.
Automated screen recording (video capture) for every test run — videos stored in Drive.
Each test resets balance via Supabase admin client before execution to ensure isolation.

## Technology Constraints

- **Framework:** Next.js (App Router)
- **Database:** Supabase (PostgreSQL + RLS)
- **Auth:** Supabase email + password
- **Styling:** Tailwind CSS
- **Testing:** Playwright E2E
- **Deployment:** Vercel
- **Amounts:** INTEGER cents throughout — no exceptions

## Scope Boundaries

**Included:** Mock balance system, scheduled payments, expiration, repeat logic, unregistered recipients, email notifications, dashboard filters, E2E tests.

**Excluded:** Real payment gateway, admin panel, multi-currency, recurring payments, push notifications.

## Governance

Constitution supersedes all other decisions. Any deviation must be documented with justification.
All monetary edge cases default to the strictest safe behavior.

**Version**: 1.0.0 | **Ratified**: 2026-04-19 | **Last Amended**: 2026-04-19
