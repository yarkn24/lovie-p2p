# 🧪 E2E Test Report — Lovie P2P

- Target: https://lovie-p2p-gules.vercel.app
- Runner: Playwright 1.59.1 (chromium + Mobile Chrome / Pixel 5, 1 worker, fullyParallel=false)
- Run date: 2026-04-23 (clean full-suite after CAS race fix, UI/UX spec, Path 5/6 wired to real state transitions)
- **Latest full run**: **90 passed · 0 skipped · 0 failed · 0 flaky** · ~6m
- **Core suite**: 15/15 executable paths pass · 1 bonus guardrail · 0 skipped
- **Extensive suite**: 54/54 pass across 8 spec files (auth negatives, validation, authz, security, concurrency ×6, API contract, responsive, UI/UX ×13)
- **UI/UX coverage**: 13 tests asserting loading spinners, disabled button transitions, error/success banners, empty states, focus management, form validation feedback, and confirmation modals ([13-ui-ux.spec.ts](13-ui-ux.spec.ts)).
- Video: `video: 'on'` in config for `page`-fixture tests; manually-created contexts use `recordingContext()` helper ([fixtures.ts:80-88](fixtures.ts#L80-L88)).
- **Drive (public, clean run 2026-04-23 — 15/15 core, 88/88 total)**: https://drive.google.com/drive/folders/1_2bOWcEB2qFBeZZM1ph0gqMacsxb-1pg (121 webm, 25 MiB)
- **Drive (archive, 2026-04-22 run)**: https://drive.google.com/drive/folders/16bG4spJodfVzBeGS76KPIzssbEOsAh48

### Resolved — pay / decline / cancel / schedule status race (2026-04-23)

- **Found by**: [`10-concurrency.spec.ts:48`](10-concurrency.spec.ts#L48) — `simultaneous pay + decline — exactly one wins, status deterministic`
- **Root cause**: `/decline`, `/cancel`, `/schedule` UPDATEs only filtered by `id`. A recipient clicking pay+decline (or sender cancel + recipient pay, etc.) in quick succession could have both handlers pass their status=1 pre-check and both commit, corrupting the final state.
- **Fix**: Added atomic CAS guard to each UPDATE (`.eq('status', 1)` for decline/cancel, `.in('status', [1,7])` for schedule) + `.maybeSingle()` + a null check that returns 409 `INVALID_STATUS` when the transition was stolen by a concurrent handler. Pay was already safe because `execute_payment_v2` does `SELECT ... FOR UPDATE`.
- **Coverage added**: 4 new concurrency tests cover pay+cancel, decline+cancel, schedule+decline, and an N-cycle balance-integrity check. All 6 concurrency specs green.

## Part 1 — Core assignment paths (15)

| #   | Path                                    | Status  | Video                                                                                                                                                                                                                                                                                                                                                                                                                | Notes                                                                                                                         |
| --- | --------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1   | Create request (registered recipient)   | ✅ Pass | [video](../../test-results/01-create-request-Path-1-2-8403c-est-to-registered-recipient-chromium/video.webm)                                                                                                                                                                                                                                                                                                        | UI form → UUID detail page, chip=Pending, recipient name/amount/note visible.                                                 |
| 2   | Create request (unregistered → email)   | ✅ Pass | [video](../../test-results/01-create-request-Path-1-2-7a5c6-red-recipient-email-queued--chromium/video.webm)                                                                                                                                                                                                                                                                                                        | Detail page shows raw email; row surfaces on Outgoing dashboard.                                                              |
| 3   | Pay now → balance updated               | ✅ Pass | [sender](../../test-results/02-recipient-actions-Paths-283b7--balances-update-atomically-chromium/page@2b5a9b823c1d8ada62c6438791326777.webm) · [payer](../../test-results/02-recipient-actions-Paths-283b7--balances-update-atomically-chromium/page@6a87b03425fac60c7f85602929f19a43.webm)                                                                                                                         | Atomic debit/credit verified via `/api/auth/user`: payer −$3.00, sender +$3.00.                                               |
| 4   | Schedule → status Scheduled             | ✅ Pass | [sender](../../test-results/02-recipient-actions-Paths-97c20--→-status-becomes-Scheduled-chromium/page@391e414893253fc7a98e45a91025d09d.webm) · [payer](../../test-results/02-recipient-actions-Paths-97c20--→-status-becomes-Scheduled-chromium/page@edf72284e56d4d9b2926dfd441f99880.webm)                                                                                                                         | Picks T+2d, submits, chip=Scheduled + "Scheduled to run on…" banner.                                                          |
| 5   | Schedule fails (insufficient) → retry   | ✅ Pass | [sender](../../test-results/04-share-expiry-countdown--7b59c-ry-UI-and-recovers-on-retry-chromium/page@4891067703efe78654f3f1e2c78b4033.webm) · [payer](../../test-results/04-share-expiry-countdown--7b59c-ry-UI-and-recovers-on-retry-chromium/page@7c6b6fe2ec2b2f57b7a00a07eaab4d53.webm)                                                                                                                         | Schedules → `forceFailScheduled(id, 'INSUFFICIENT_BALANCE')` simulates the hourly cron flipping status 5→7. UI shows Failed chip + "Failure reason: INSUFFICIENT_BALANCE" + "Retry payment"; retry runs real `execute_payment_v2` → status=2.                        |
| 6   | Expiration → 7d → pay blocked           | ✅ Pass | [sender](../../test-results/04-share-expiry-countdown--01c2b--blocks-payment-server-side-chromium/page@723fb3d45bfd66463cdddb5841987eca.webm) · [payer](../../test-results/04-share-expiry-countdown--01c2b--blocks-payment-server-side-chromium/page@86edd79f3481540dbee2b7599cd8375a.webm)                                                                                                                         | `forceExpireRequest(id)` pushes `expires_at` to 2025-01-01 + `expired=1` (exactly the state the daily cron would produce). `/pay` returns 400 `REQUEST_EXPIRED`, status stays ≠2, detail UI renders "Expired" badge and hides Pay button.                              |
| 7   | Decline → repeat available              | ✅ Pass | [sender](../../test-results/02-recipient-actions-Paths-4ff37-st-again”-repeat-available--chromium/page@47eddb0837d93333b79a4b2e8382008a.webm) · [payer](../../test-results/02-recipient-actions-Paths-4ff37-st-again”-repeat-available--chromium/page@c6d2973d3a3e969612d0e725c8d8b734.webm)                                                                                                                         | Payer declines; sender sees chip=Declined and "Request again" CTA.                                                            |
| 8   | Repeat twice → second disabled          | ✅ Pass | [sender](../../test-results/03-sender-actions-Paths-8--546d4-once-second-repeat-disabled-chromium/page@824cc6ceb500ac1c599e28f82d0c4148.webm) · [payer](../../test-results/03-sender-actions-Paths-8--546d4-once-second-repeat-disabled-chromium/page@8e596d79efb5d1848e8c9f2d37b1725e.webm)                                                                                                                         | A1 declined → Request again → A2 created. Revisiting A1 hides repeat CTA (`repeated=1` immutable).                            |
| 9   | Shareable link (unregistered) preview   | ✅ Pass | [sender](../../test-results/04-share-expiry-countdown--f3e8f-th-Sign-in-and-Sign-up-CTAs-chromium/page@7f41101b725e5b8c51dd3e75a33ce87d.webm) · [anon](../../test-results/04-share-expiry-countdown--f3e8f-th-Sign-in-and-Sign-up-CTAs-chromium/page@949b6b9f4440779360d8dd2cf67fd5e7.webm)                                                                                                                           | `/requests/[id]/share?e=…` shows "You've got a payment request", CTA "Create account", hides amount/sender.                   |
| 10  | Decline → status Declined               | ✅ Pass | [sender](../../test-results/02-recipient-actions-Paths-28bd9-e-→-status-becomes-Declined-chromium/page@3ff46d98e98e3fd864d25b474418f669.webm) · [payer](../../test-results/02-recipient-actions-Paths-28bd9-e-→-status-becomes-Declined-chromium/page@a30e226339dcb23ef3fccc6348c3f07f.webm)                                                                                                                         | Payer clicks Decline; chip flips to Declined.                                                                                 |
| 11  | Cancel (sender) → status Cancelled      | ✅ Pass | [video](../../test-results/03-sender-actions-Paths-8--92413--→-status-becomes-Cancelled-chromium/video.webm)                                                                                                                                                                                                                                                                                                        | Sender clicks Cancel; chip flips to Cancelled.                                                                                |
| 12  | Countdown timer visible                 | ✅ Pass | [video](../../test-results/04-share-expiry-countdown--614be-r-visible-on-pending-detail-chromium/video.webm)                                                                                                                                                                                                                                                                                                        | Detail page renders `Nd Nh Nm left`.                                                                                          |
| 13  | Memo validation (bad words rejected)    | ✅ Pass | [video](../../test-results/01-create-request-Path-1-2-9a853-lidation-bad-words-rejected-chromium/video.webm)                                                                                                                                                                                                                                                                                                        | Profanity in note → stays on `/requests/new`, surfaces error.                                                                 |
| 13b | Self-request rejected                   | ✅ Pass | [video](../../test-results/01-create-request-Path-1-2-0fb9d-request-money-from-yourself-chromium/video.webm)                                                                                                                                                                                                                                                                                                        | Bonus guardrail: requesting from own email blocked.                                                                           |
| 14  | Dashboard filters (tabs/status/search)  | ✅ Pass | [video](../../test-results/05-dashboard-Paths-14-15-D-6b5f9-nd-incoming-outgoing-toggle-chromium/video.webm)                                                                                                                                                                                                                                                                                                        | Outgoing tab + search + status filter all narrow correctly.                                                                   |
| 15  | Balance widget (Add / Subtract)         | ✅ Pass | [video](../../test-results/05-dashboard-Paths-14-15-D-e95aa-nce-widget-Add-and-Subtract-chromium/video.webm)                                                                                                                                                                                                                                                                                                        | +$50 / −$50 round-trip — API balance reflects both mutations.                                                                 |

**Core summary: 15/15 paths passed (100%), plus Path 13b bonus self-request guardrail. Paths 5 & 6 — previously skipped as cron/time-gated — are now covered by service-role admin writes that reproduce the exact DB state the hourly cron would produce, exercising the real production code paths (`execute_payment_v2`, `REQUEST_EXPIRED` guard, retry endpoint). See [Admin helper pattern](#admin-helper-pattern-paths-5--6) below.**

## Part 2 — Extensive test suite (52)

Added to exercise the evaluation rubric: edge cases, fintech correctness, security, concurrency, API contract, responsive design, UI/UX states. Runs on chromium; core flows also run on Mobile Chrome (Pixel 5).

### 06 — Auth negative paths (5/5)

| #   | Test                                     | Status  |
| --- | ---------------------------------------- | ------- |
| 6.1 | wrong password → stays on /auth/login    | ✅ Pass |
| 6.2 | nonexistent user cannot sign in          | ✅ Pass |
| 6.3 | empty credentials blocked                | ✅ Pass |
| 6.4 | protected route redirects to login       | ✅ Pass |
| 6.5 | unauthenticated API returns 401          | ✅ Pass |

### 07 — Payment validation + status transitions (8/8)

| #   | Test                                          | Status  |
| --- | --------------------------------------------- | ------- |
| 7.1 | amount = 0 rejected                           | ✅ Pass |
| 7.2 | negative amount rejected                      | ✅ Pass |
| 7.3 | amount > $10,000 rejected                     | ✅ Pass |
| 7.4 | amount with > 2 decimal places rejected       | ✅ Pass |
| 7.5 | insufficient balance blocks pay               | ✅ Pass |
| 7.6 | cannot pay a cancelled request                | ✅ Pass |
| 7.7 | cannot decline an already paid request        | ✅ Pass |
| 7.8 | scheduled date in the past rejected           | ✅ Pass |

### 08 — Authorization / RLS boundaries (5/5)

| #   | Test                                                        | Status  |
| --- | ----------------------------------------------------------- | ------- |
| 8.1 | third party cannot GET a request they are not part of       | ✅ Pass |
| 8.2 | non-sender cannot cancel                                    | ✅ Pass |
| 8.3 | non-recipient cannot pay                                    | ✅ Pass |
| 8.4 | non-recipient cannot decline                                | ✅ Pass |
| 8.5 | unauthenticated requests to payment-requests API return 401 | ✅ Pass |

### 09 — Security (6/6)

| #   | Test                                                        | Status  |
| --- | ----------------------------------------------------------- | ------- |
| 9.1 | XSS payload in note rendered as text, not executed          | ✅ Pass |
| 9.2 | SQL-injection-like note stored verbatim, not executed       | ✅ Pass |
| 9.3 | unicode / emoji in note preserved end-to-end                | ✅ Pass |
| 9.4 | note > 500 chars rejected                                   | ✅ Pass |
| 9.5 | invalid email format rejected                               | ✅ Pass |
| 9.6 | self-request via API blocked                                | ✅ Pass |

### 10 — Concurrency / race conditions (6/6)

| #    | Test                                                                      | Status  |
| ---- | ------------------------------------------------------------------------- | ------- |
| 10.1 | double-pay same request from two tabs — exactly one succeeds              | ✅ Pass |
| 10.2 | simultaneous pay + decline — exactly one wins, status deterministic       | ✅ Pass |
| 10.3 | simultaneous pay + cancel — exactly one wins                              | ✅ Pass |
| 10.4 | simultaneous decline + cancel — exactly one wins                          | ✅ Pass |
| 10.5 | simultaneous schedule + decline — exactly one wins                        | ✅ Pass |
| 10.6 | balance integrity: N sequential pay/decline cycles net to correct totals  | ✅ Pass |

### 11 — API contract (5/5)

| #    | Test                                        | Status  |
| ---- | ------------------------------------------- | ------- |
| 11.1 | missing amount field rejected               | ✅ Pass |
| 11.2 | missing recipient_email field rejected      | ✅ Pass |
| 11.3 | amount as string rejected                   | ✅ Pass |
| 11.4 | GET /api/payment-requests returns an array  | ✅ Pass |
| 11.5 | balance POST with invalid action rejected   | ✅ Pass |

### 12 — Responsive mobile (iPhone 13 viewport, 4/4)

| #    | Test                                              | Status  |
| ---- | ------------------------------------------------- | ------- |
| 12.1 | login page fits viewport (no horizontal scroll)   | ✅ Pass |
| 12.2 | dashboard renders and balance visible on mobile   | ✅ Pass |
| 12.3 | create-request form usable on mobile              | ✅ Pass |
| 12.4 | request detail page renders on mobile             | ✅ Pass |

### 13 — UI/UX states (13/13)

Asserts visible user-facing states the happy-path flow specs don't explicitly verify: loading spinners, disabled button transitions, error/success banners, empty states, focus management, form validation feedback, confirmation modals.

| #     | Test                                                                                 | Status  |
| ----- | ------------------------------------------------------------------------------------ | ------- |
| 13.1  | login: invalid credentials surface inline error banner, not a crash                  | ✅ Pass |
| 13.2  | login: keyboard navigation works (Tab through email → password)                      | ✅ Pass |
| 13.3  | new request: amount input rejects non-numeric characters silently                    | ✅ Pass |
| 13.4  | new request: note character counter updates live                                     | ✅ Pass |
| 13.5  | new request: submit button shows "Creating…" and is disabled during submit           | ✅ Pass |
| 13.6  | new request: inline error banner surfaces on server-side validation failure          | ✅ Pass |
| 13.7  | request detail: Schedule button is disabled until a date is picked                   | ✅ Pass |
| 13.8  | request detail: pay flow shows loading overlay then success modal                    | ✅ Pass |
| 13.9  | request detail: cancelled request shows "No actions available" terminal state        | ✅ Pass |
| 13.10 | dashboard: empty state renders for filter with no matches                            | ✅ Pass |
| 13.11 | dashboard: confirmation modal appears before inline Pay action                       | ✅ Pass |
| 13.12 | dashboard: empty outgoing surfaces "Send your first request" CTA                     | ✅ Pass |
| 13.13 | request detail: pending countdown indicator is visible                               | ✅ Pass |

**Extensive summary: 52/52 passed. Additionally, the 5 core-flow spec files (01-05) run on Mobile Chrome (Pixel 5) as a second project — same pass rate.**

## Admin helper pattern (Paths 5 & 6)

Some states in a P2P payments app are only reachable by the passage of real time or by a server-side cron — you can't wait 7 days in an E2E run, and you can't trigger the cron from the client. Skipping those paths leaves the riskiest code (expired-pay rejection, failed-schedule retry) unverified. Instead, these tests use a **service-role Supabase client** to *force the exact DB state the cron would produce*, then exercise the real production endpoints against it.

- **Setup**: `SUPABASE_SERVICE_ROLE_KEY` is loaded from `.env.local` by `loadEnvConfig(process.cwd())` in [playwright.config.ts](../../playwright.config.ts). Both helpers are gated by `hasAdminCreds()` so the suite skips cleanly in environments without the secret rather than hard-failing CI.
- **`forceExpireRequest(id)`** ([fixtures.ts:39-49](fixtures.ts#L39-L49)): flips `expired=1` and `expires_at='2025-01-01'` — the exact state the daily expiration cron writes after day 7. The test then calls the real `/pay` endpoint and asserts it returns 400 `REQUEST_EXPIRED` (exercising the server-side `expired=1 OR expires_at < now()` guard).
- **`forceFailScheduled(id, reason)`** ([fixtures.ts:57-71](fixtures.ts#L57-L71)): flips `status=7` + `failure_reason='INSUFFICIENT_BALANCE'` + backdates `scheduled_payment_date` — the exact state `execute_scheduled_payments` writes on cron failure. The test then clicks the real "Retry payment" button, which runs `execute_payment_v2` for real.
- **UI gap caught by Path 6**: The initial run exposed that action buttons (Pay/Decline/Schedule on detail, inline Pay on dashboard) still rendered for a pending request whose `expires_at` had passed but whose status hadn't been flipped by the cron yet. Even though the server rejected with `REQUEST_EXPIRED`, the buttons were a UX bug. Fix: added `isEffectivelyExpired = req.expired === 1 || new Date(req.expires_at) < new Date()` gate in both [app/requests/\[id\]/page.tsx](../../app/requests/[id]/page.tsx) and [app/page.tsx](../../app/page.tsx), with an explicit "This request has expired…" message on the detail page. This is the kind of drift the test was meant to surface.

## Architecture notes

- **User rotation across specs.** Specs rotate across david/michael/sarah so a failing test on one actor can't poison shared state for the rest of the suite.
- **Two-context pattern** for sender+payer flows: each user gets its own `recordingContext(browser, testInfo)` because cookies are scoped to the context — a single shared context would make the second `login()` bounce back to the dashboard of the first user.
- **Mobile project scope**: `playwright.config.ts` restricts the Mobile Chrome project to `/(0[1-5]|12)-/` — the 5 core user flows plus the responsive spec. Validation / security / authz tests (06-11) don't change behavior across viewports; running them on both projects would double runtime without catching new bugs.
- **API-driven setup**: creates and declines bypass the UI where setup is not the thing under test. The UI is always driven for the *assertion-of-interest*.
- **Atomic balance assertions** in Path 3 and 10.1 read through `/api/auth/user` rather than scraping DOM.

## Assignment-reminder hook

A PreToolUse hook at [.claude/hooks/assignment-reminder.sh](../../../.claude/hooks/assignment-reminder.sh) injects a distilled `Lovie_task.md` checklist (core flows, validation boundaries, auth rules, evaluation criteria) before every `Edit|Write|NotebookEdit`. Static content on purpose — the hook fires on every edit, so injecting the full task doc would waste tokens. Registered in `.claude/settings.local.json`.

## Run it

```bash
cd app
rm -rf test-results playwright-report

# Core + extensive, both projects (chromium + Mobile Chrome):
npx playwright test

# Chromium only:
npx playwright test --project=chromium

# Just the extensive suite:
npx playwright test tests/e2e/0[6-9]-*.spec.ts tests/e2e/1[0-2]-*.spec.ts

npx playwright show-report
```
