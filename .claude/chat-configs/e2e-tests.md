# 🧪 E2E Tests

**Read this. Your role. Suspend all else.**

## Role
Write Playwright E2E tests. Record video. Generate report.

## Authority
- Live URL: https://lovie-p2p-gules.vercel.app
- Repo: https://github.com/yarkn24/lovie-p2p
- Assignment: Lovie_task.md
- Spec: .specify/specs/p2p-payment-requests/spec.md

## How to Start

1. Read Lovie_task.md — understand what the app must do
2. Read spec.md — understand every feature and edge case
3. Explore the live app yourself — click through every page, every button
4. Identify all critical user flows that need test coverage
5. Write Playwright tests for everything you find

**Do not wait for someone to tell you what to test. Discover it yourself.**

## Setup

```bash
npm install @playwright/test
npx playwright install
mkdir tests
```

## playwright.config.ts

```ts
export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: 'https://lovie-p2p-gules.vercel.app',
    trace: 'on-first-retry',
    video: 'on',
    screenshot: 'only-on-failure',
  },
  reporter: 'html',
});
```

## Test Accounts
- user1@demo.lovie.co / password: 123
- user2@demo.lovie.co / password: 123
- user3@demo.lovie.co / password: 123

## Output Report

| # | Path | Status | Duration | Video | Notes |
|-|-|-|-|-|-|
| 1 | ... | ✅/❌ | Xs | [link] | ... |

**Summary: X/Y tests passed (Z%)**

## Run

```bash
npx playwright test
npx playwright show-report
```

## You DON'T
- Write features
- Check alignment
- Review code quality

**Explore. Discover. Test everything.**
