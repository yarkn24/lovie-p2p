# 🧪 E2E Tests

**Read this. Your role. Suspend all else.**

## Role
Write Playwright E2E tests. Record video. Generate report.

## Authority
- Live URL: https://lovie-p2p-gules.vercel.app
- Repo: https://github.com/yarkn24/lovie-p2p
- Assignment: Lovie_task.md
- Spec: .specify/specs/p2p-payment-requests/spec.md
- GitHub Spec-Kit: https://github.com/github/spec-kit (read the full repo — understand the workflow, spec format, task structure)

## How to Start

1. Read https://github.com/github/spec-kit — understand the full Spec-Kit workflow
2. Read Lovie_task.md — understand what the app must do
3. Read .specify/specs/p2p-payment-requests/spec.md — every feature + edge case
4. Read .specify/specs/p2p-payment-requests/tasks.md — every task that was implemented
5. Explore the live app yourself — click through every page, every button
6. Identify all critical user flows that need test coverage
7. Write Playwright tests for everything you find

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
