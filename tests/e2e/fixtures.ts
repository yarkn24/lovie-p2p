import { Browser, BrowserContext, Page, TestInfo, expect } from '@playwright/test';

/**
 * Manual `browser.newContext()` calls do NOT inherit `video: 'on'` from the
 * Playwright config — only contexts built by the `page`/`context` fixtures do.
 * Tests that need two sides of the interaction (sender + payer) must therefore
 * opt in explicitly, with `testInfo.outputDir` so the clip lands in the same
 * per-test folder Playwright uses for all other artifacts.
 */
export async function recordingContext(
  browser: Browser,
  testInfo: TestInfo
): Promise<BrowserContext> {
  return browser.newContext({
    recordVideo: { dir: testInfo.outputDir },
    viewport: { width: 1280, height: 720 },
  });
}

export const DEMO = {
  sarah: { email: 'sarah.demo@lovie.co', password: '123', first: 'Sarah', last: 'Johnson' },
  michael: { email: 'michael.demo@lovie.co', password: '123', first: 'Michael', last: 'Rodriguez' },
  david: { email: 'david.demo@lovie.co', password: '123', first: 'David', last: 'Chen' },
} as const;

export type DemoUser = typeof DEMO[keyof typeof DEMO];

export async function login(page: Page, user: DemoUser) {
  await page.goto('/auth/login');
  await page.locator('input[type="email"]').first().fill(user.email);
  await page.locator('input[type="password"]').first().fill(user.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => url.pathname === '/', { timeout: 20000 });
  await expect(page.getByText('Available balance')).toBeVisible();
}

export async function logout(page: Page) {
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL((url) => url.pathname.startsWith('/auth/login'));
}

export async function getBalanceCents(page: Page): Promise<number> {
  const res = await page.request.get('/api/auth/user');
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return body.balance as number;
}

export async function setBalance(page: Page, target: number) {
  const current = await getBalanceCents(page);
  const delta = target - current;
  if (delta === 0) return;
  const action = delta > 0 ? 'add' : 'subtract';
  const amount = Math.abs(delta) / 100;
  const res = await page.request.post('/api/user/balance', {
    data: { action, amount },
  });
  expect(res.ok()).toBeTruthy();
}

export type CreateRequestInput = {
  recipientEmail: string;
  amountUsd: string;
  note?: string;
};

export async function createRequestUI(page: Page, input: CreateRequestInput): Promise<string> {
  await page.goto('/requests/new');
  const form = page.locator('form');
  await form.locator('input[type="email"]').fill(input.recipientEmail);
  await form.locator('input[inputmode="decimal"]').fill(input.amountUsd);
  if (input.note !== undefined) {
    await form.locator('textarea').fill(input.note);
  }
  await page.getByRole('button', { name: 'Send request' }).click();
  await page.waitForURL(/\/requests\/[0-9a-f-]{36}$/, { timeout: 20000 });
  const url = new URL(page.url());
  return url.pathname.split('/').pop()!;
}

export async function createRequestAPI(
  page: Page,
  input: CreateRequestInput
): Promise<{ id: string; amount: number }> {
  const amount = Number(input.amountUsd);
  const res = await page.request.post('/api/payment-requests', {
    data: {
      recipient_email: input.recipientEmail,
      amount,
      note: input.note ?? null,
    },
  });
  expect(res.ok(), `create request failed: ${res.status()} ${await res.text()}`).toBeTruthy();
  const body = await res.json();
  return { id: body.id, amount: body.amount };
}

export async function uniqueUnregisteredEmail(suffix = ''): Promise<string> {
  const stamp = Date.now().toString(36);
  return `nobody+${stamp}${suffix}@lovie-test.invalid`;
}

export function centsToUsd(c: number): string {
  return (c / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}
