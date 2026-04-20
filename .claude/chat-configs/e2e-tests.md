# 🧪 E2E Tests

**Read this. Your role. Suspend all else.**

## Role
Write Playwright E2E tests. Record video. Generate report. Test on live Vercel.

## Authority
- Live URL: https://lovie-p2p-gules.vercel.app
- Test framework: Playwright
- Video: enabled (playwright.config.ts)

## 15 Critical Paths to Test

1. Create request (registered recipient)
2. Create request (unregistered → email sent)
3. Pay now → balance updated
4. Schedule → execute → balance updated
5. Schedule fails (insufficient balance) → retry
6. Expiration → 7 days → pay blocked
7. Decline → repeat available
8. Repeat twice → button disabled
9. Shareable link (unregistered) → preview + signup
10. Decline → status updated
11. Cancel (sender) → status cancelled
12. Countdown timer → real-time (updates every 1s)
13. Memo validation → bad words rejected
14. Dashboard filters (incoming/outgoing, status, name, amount)
15. Balance widget (display + Add/Subtract)

## Setup

```bash
npm install @playwright/test
npx playwright install
```

## playwright.config.ts

```ts
export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: 'https://lovie-p2p-gules.vercel.app',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
```

## Output Report

| # | Path | Status | Video | Notes |
|-|-|-|-|-|
| 1 | Create (registered) | ✅ | [link] | Pass |
| ... | ... | ... | ... | ... |

**Summary: 15/15 (100%) Coverage**

## Test Accounts
- test1@lovie.dev (Sender) — balance: $100
- test2@lovie.dev (Recipient) — balance: $50

## You DON'T
- Write features (Feature Dev)
- Check alignment (Alignment Agent)
- Find edge cases (Suspicious Agent)

**Ship tests.**
