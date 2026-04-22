# 🧪 E2E Test Report — Lovie P2P

- Target: https://lovie-p2p-gules.vercel.app
- Runner: Playwright 1.59.1 (chromium + Mobile Chrome / Pixel 5, 1 worker, fullyParallel=false)
- Run date: 2026-04-22
- **Core suite**: 13/13 executable paths pass · 2/15 skipped by design (cron-dependent) · 1 bonus guardrail
- **Extensive suite**: 35/35 pass across 7 new spec files (auth negatives, validation, authz, security, concurrency, API contract, responsive)
- Video: `video: 'on'` in config for `page`-fixture tests; manually-created contexts use `recordingContext()` helper ([fixtures.ts:10-18](fixtures.ts#L10-L18)).
- **Drive (public)**: extensive-suite videos → https://drive.google.com/drive/folders/16bG4spJodfVzBeGS76KPIzssbEOsAh48

## Part 1 — Core assignment paths (15)

| #   | Path                                    | Status  | Video                                                                                                                                                                                                                                                                                                                                                                                                                | Notes                                                                                                                         |
| --- | --------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1   | Create request (registered recipient)   | ✅ Pass | [video](../../test-results/01-create-request-Path-1-2-8403c-est-to-registered-recipient-chromium/video.webm)                                                                                                                                                                                                                                                                                                        | UI form → UUID detail page, chip=Pending, recipient name/amount/note visible.                                                 |
| 2   | Create request (unregistered → email)   | ✅ Pass | [video](../../test-results/01-create-request-Path-1-2-7a5c6-red-recipient-email-queued--chromium/video.webm)                                                                                                                                                                                                                                                                                                        | Detail page shows raw email; row surfaces on Outgoing dashboard.                                                              |
| 3   | Pay now → balance updated               | ✅ Pass | [sender](../../test-results/02-recipient-actions-Paths-283b7--balances-update-atomically-chromium/page@2b5a9b823c1d8ada62c6438791326777.webm) · [payer](../../test-results/02-recipient-actions-Paths-283b7--balances-update-atomically-chromium/page@6a87b03425fac60c7f85602929f19a43.webm)                                                                                                                         | Atomic debit/credit verified via `/api/auth/user`: payer −$3.00, sender +$3.00.                                               |
| 4   | Schedule → status Scheduled             | ✅ Pass | [sender](../../test-results/02-recipient-actions-Paths-97c20--→-status-becomes-Scheduled-chromium/page@391e414893253fc7a98e45a91025d09d.webm) · [payer](../../test-results/02-recipient-actions-Paths-97c20--→-status-becomes-Scheduled-chromium/page@edf72284e56d4d9b2926dfd441f99880.webm)                                                                                                                         | Picks T+2d, submits, chip=Scheduled + "Scheduled to run on…" banner.                                                          |
| 5   | Schedule fails (insufficient) → retry   | ⏭ Skip | —                                                                                                                                                                                                                                                                                                                                                                                                                   | Status 7 (Failed) only arises after hourly `execute_scheduled_payments` cron hits INSUFFICIENT_BALANCE. Needs `CRON_SECRET` (server-only).                                                                                                                         |
| 6   | Expiration → 7d → pay blocked           | ⏭ Skip | —                                                                                                                                                                                                                                                                                                                                                                                                                   | Needs DB write to push `expires_at` into the past; blocked by RLS.                                                             |
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

**Core summary: 13/13 executable paths passed (100%). Paths 5, 6 skipped by design. Path 13b is a bonus self-request guardrail.**

## Part 2 — Extensive test suite (35)

Added to exercise the evaluation rubric: edge cases, fintech correctness, security, concurrency, API contract, responsive design. Runs on chromium; core flows also run on Mobile Chrome (Pixel 5).

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

### 10 — Concurrency / race conditions (2/2)

| #    | Test                                                                | Status  |
| ---- | ------------------------------------------------------------------- | ------- |
| 10.1 | double-pay same request from two tabs — exactly one succeeds         | ✅ Pass |
| 10.2 | simultaneous pay + decline — exactly one wins, status deterministic  | ✅ Pass |

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

**Extensive summary: 35/35 passed. Additionally, the 5 core-flow spec files (01-05) run on Mobile Chrome (Pixel 5) as a second project — same pass rate.**

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
