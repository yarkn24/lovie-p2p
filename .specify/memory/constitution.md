# Lovie P2P Constitution

## Core Principles

### I. Financial Integrity (NON-NEGOTIABLE)
All monetary amounts stored as INTEGER (cents). Never floats. Never strings.
Display only converts cents → dollars on UI layer. All calculations in cents.
Every payment operation wrapped in a single database transaction — "all or nothing."

### II. Security by Default
Supabase RLS enforced on every table. Users see only their own data.
Every action endpoint validates: authentication → authorization → business rules.
No auto-pay: payment requires logged-in session + explicit user action.

### III. Idempotency
All state-changing operations must be safe to retry.
Immutable flags: `expired` and `repeated` never revert once set to 1.
Payment transactions table provides audit log and duplicate prevention.

### IV. Expiration Integrity — Double Layer
Layer 1: Page load checks `expires_at < NOW()` → sets `expired = 1`.
Layer 2: Hourly cron job bulk-updates all overdue requests.
Both layers use `AND expired = 0` guard to stay idempotent.

### V. Test Coverage
E2E tests (Playwright) cover all happy paths and critical error cases.
Automated screen recording via Playwright video capture.
Each test resets balance via Supabase admin client before running.

## Technology Constraints

- **Framework:** Next.js (App Router)
- **Database:** Supabase (PostgreSQL + RLS)
- **Auth:** Supabase magic link (email-based)
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
