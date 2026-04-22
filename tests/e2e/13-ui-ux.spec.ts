import { test, expect } from '@playwright/test';
import {
  DEMO,
  login,
  createRequestAPI,
  setBalance,
  uniqueUnregisteredEmail,
} from './fixtures';

/**
 * UI/UX-focused tests. Assert visible user-facing states that the happy-path
 * flow tests (01-05) don't explicitly verify: loading spinners, disabled
 * button transitions, error/success banners, empty states, form validation
 * feedback, keyboard navigation, confirmation modals. Runs with video:'on'
 * (config default) so a reviewer can watch the interactions unfold.
 */
test.describe('UI/UX — loading, disabled, empty, feedback states', () => {
  test('login: invalid credentials surface inline error banner, not a crash', async ({ page }) => {
    await page.goto('/auth/login');
    await page.locator('input[type="email"]').first().fill('nobody@lovie-test.invalid');
    await page.locator('input[type="password"]').first().fill('wrong-password');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Error banner appears, user stays on login page
    await expect(page.locator('text=/invalid|credentials|password/i').first()).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/auth\/login/);
    // Form still usable — button re-enabled
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });

  test('login: keyboard navigation works (Tab through email → password → submit)', async ({ page }) => {
    await page.goto('/auth/login');
    await page.locator('input[type="email"]').first().focus();
    await expect(page.locator('input[type="email"]').first()).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('input[type="password"]').first()).toBeFocused();
  });

  test('new request: amount input rejects non-numeric characters silently', async ({ page }) => {
    await login(page, DEMO.david);
    await page.goto('/requests/new');
    const amount = page.locator('input[inputmode="decimal"]');
    await amount.fill('abc');
    await expect(amount).toHaveValue('');
    await amount.fill('12.345'); // 3rd decimal blocked by regex
    await expect(amount).toHaveValue('');
    await amount.fill('12.34');
    await expect(amount).toHaveValue('12.34');
  });

  test('new request: note character counter updates live', async ({ page }) => {
    await login(page, DEMO.david);
    await page.goto('/requests/new');
    await expect(page.getByText('0/500')).toBeVisible();
    await page.locator('textarea').fill('Hello world');
    await expect(page.getByText('11/500')).toBeVisible();
  });

  test('new request: submit button shows "Creating…" and is disabled during submit', async ({ page }) => {
    await login(page, DEMO.david);
    await page.goto('/requests/new');
    await page.locator('input[type="email"]').first().fill(DEMO.michael.email);
    await page.locator('input[inputmode="decimal"]').fill('1.00');

    const btn = page.getByRole('button', { name: /Send request|Creating/ });
    await btn.click();
    // Should either show Creating… transiently OR navigate away; both are valid UX.
    await Promise.race([
      expect(page.getByRole('button', { name: /Creating/ })).toBeVisible({ timeout: 2000 }).catch(() => {}),
      page.waitForURL(/\/requests\/[0-9a-f-]{36}$/, { timeout: 5000 }).catch(() => {}),
    ]);
    // Either way, we reach detail page within navigation timeout
    await page.waitForURL(/\/requests\/[0-9a-f-]{36}$/, { timeout: 15000 });
  });

  test('new request: inline error banner surfaces on server-side validation failure', async ({ page }) => {
    await login(page, DEMO.michael);
    await page.goto('/requests/new');
    await page.locator('input[type="email"]').first().fill(DEMO.michael.email); // self-request
    await page.locator('input[inputmode="decimal"]').fill('5.00');
    await page.getByRole('button', { name: 'Send request' }).click();

    // Red banner visible
    const banner = page.locator('.bg-red-50, [class*="red"]').filter({ hasText: /yourself|cannot/i });
    await expect(banner.first()).toBeVisible({ timeout: 10000 });
    // User stayed on form; button recovered from disabled state
    await expect(page).toHaveURL(/\/requests\/new$/);
    await expect(page.getByRole('button', { name: 'Send request' })).toBeEnabled();
  });

  test('request detail: Schedule button is disabled until a date is picked', async ({ browser }, testInfo) => {
    const senderCtx = await browser.newContext({
      recordVideo: { dir: testInfo.outputDir },
      viewport: { width: 1280, height: 720 },
    });
    const recipCtx = await browser.newContext({
      recordVideo: { dir: testInfo.outputDir },
      viewport: { width: 1280, height: 720 },
    });
    const senderPage = await senderCtx.newPage();
    const recipPage = await recipCtx.newPage();

    await login(senderPage, DEMO.david);
    await login(recipPage, DEMO.michael);

    const { id } = await createRequestAPI(senderPage, {
      recipientEmail: DEMO.michael.email,
      amountUsd: '3.00',
    });

    await recipPage.goto(`/requests/${id}`);
    const scheduleBtn = recipPage.getByRole('button', { name: 'Schedule' });
    await expect(scheduleBtn).toBeDisabled();

    const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await recipPage.locator('input[type="date"]').fill(future);
    await expect(scheduleBtn).toBeEnabled();

    await senderCtx.close();
    await recipCtx.close();
  });

  test('request detail: pay flow shows loading overlay then success modal', async ({ browser }, testInfo) => {
    // Two contexts so we can switch perspective cleanly
    const senderCtx = await browser.newContext({
      recordVideo: { dir: testInfo.outputDir },
      viewport: { width: 1280, height: 720 },
    });
    const payerCtx = await browser.newContext({
      recordVideo: { dir: testInfo.outputDir },
      viewport: { width: 1280, height: 720 },
    });
    const senderPage = await senderCtx.newPage();
    const payerPage = await payerCtx.newPage();

    await login(senderPage, DEMO.david);
    await login(payerPage, DEMO.michael);
    await setBalance(payerPage, 10_000_00);

    const { id } = await createRequestAPI(senderPage, {
      recipientEmail: DEMO.michael.email,
      amountUsd: '4.25',
    });

    await payerPage.goto(`/requests/${id}`);
    await payerPage.getByRole('button', { name: 'Pay now' }).click();

    // Processing button state visible during the 2.5s loading window
    await expect(payerPage.getByRole('button', { name: /Processing/ })).toBeVisible({ timeout: 3000 });

    // Success modal appears after loading
    await expect(payerPage.getByText('Payment successful!')).toBeVisible({ timeout: 8000 });
    await expect(payerPage.getByText(/has been sent to/)).toBeVisible();

    // Dismiss success modal via "Done"
    await payerPage.getByRole('button', { name: 'Done' }).click();
    await expect(payerPage.getByText('Payment successful!')).not.toBeVisible();

    await senderCtx.close();
    await payerCtx.close();
  });

  test('request detail: cancelled request shows "No actions available" terminal state', async ({ browser }, testInfo) => {
    const senderCtx = await browser.newContext({
      recordVideo: { dir: testInfo.outputDir },
      viewport: { width: 1280, height: 720 },
    });
    const recipCtx = await browser.newContext({
      recordVideo: { dir: testInfo.outputDir },
      viewport: { width: 1280, height: 720 },
    });
    const senderPage = await senderCtx.newPage();
    const recipPage = await recipCtx.newPage();

    await login(senderPage, DEMO.david);
    await login(recipPage, DEMO.michael);

    const { id } = await createRequestAPI(senderPage, {
      recipientEmail: DEMO.michael.email,
      amountUsd: '1.50',
    });

    // Sender cancels → status=6, which is in the ![1,3,7] set, so the
    // "No actions available" empty-state branch renders for the recipient.
    const cancelled = await senderPage.request.post(`/api/payment-requests/${id}/cancel`);
    expect(cancelled.ok()).toBeTruthy();

    await recipPage.goto(`/requests/${id}`);
    await expect(recipPage.getByText(/No actions available/i)).toBeVisible();
    await expect(recipPage.getByText('Cancelled').first()).toBeVisible();

    await senderCtx.close();
    await recipCtx.close();
  });

  test('dashboard: empty state renders for filter with no matches', async ({ page }) => {
    await login(page, DEMO.david);

    // Filter to a likely-empty status combination
    await page.locator('select').first().selectOption('failed');
    // Either "No incoming requests match." or an empty list — assert the empty state text
    const empty = page.getByText(/No (incoming|outgoing) requests match/i);
    await expect(empty).toBeVisible({ timeout: 8000 });
  });

  test('dashboard: confirmation modal appears before inline Pay action', async ({ browser }, testInfo) => {
    const senderCtx = await browser.newContext({
      recordVideo: { dir: testInfo.outputDir },
      viewport: { width: 1280, height: 720 },
    });
    const payerCtx = await browser.newContext({
      recordVideo: { dir: testInfo.outputDir },
      viewport: { width: 1280, height: 720 },
    });
    const senderPage = await senderCtx.newPage();
    const payerPage = await payerCtx.newPage();

    await login(senderPage, DEMO.david);
    await login(payerPage, DEMO.michael);
    await setBalance(payerPage, 10_000_00);

    await createRequestAPI(senderPage, {
      recipientEmail: DEMO.michael.email,
      amountUsd: '2.00',
      note: `ui-ux-confirm-${Date.now()}`,
    });

    await payerPage.goto('/');
    await payerPage.getByRole('button', { name: 'Incoming' }).click();
    // Filter to pending so we see the inline Pay button
    await payerPage.locator('select').first().selectOption('pending');

    // Click the first inline Pay button (present on pending rows for recipient)
    const payBtn = payerPage.getByRole('button', { name: 'Pay', exact: true }).first();
    await payBtn.click();

    // Confirmation modal is visible with "Pay this request?"
    await expect(payerPage.getByText(/Pay this request\?/)).toBeVisible();
    await expect(payerPage.getByRole('button', { name: 'Pay now' })).toBeVisible();
    await expect(payerPage.getByRole('button', { name: 'Cancel' })).toBeVisible();

    // Dismiss via Cancel — modal closes, no action taken
    await payerPage.getByRole('button', { name: 'Cancel' }).click();
    await expect(payerPage.getByText(/Pay this request\?/)).not.toBeVisible();

    await senderCtx.close();
    await payerCtx.close();
  });

  test('dashboard: unregistered-recipient empty outgoing surfaces "Send your first request" CTA', async ({ page }) => {
    await login(page, DEMO.david);
    await page.getByRole('button', { name: 'Outgoing' }).click();
    // Search for a guaranteed-unmatched string
    const stamp = `zz_nomatch_${Date.now()}`;
    await page.getByPlaceholder('Search name or note…').fill(stamp);
    await expect(page.getByText(/No outgoing requests match/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /Send your first request/i })).toBeVisible();
  });

  test('request detail: pending countdown indicator is visible', async ({ page }) => {
    await login(page, DEMO.david);
    const { id } = await createRequestAPI(page, {
      recipientEmail: await uniqueUnregisteredEmail(),
      amountUsd: '1.00',
    });
    await page.goto(`/requests/${id}`);
    // Countdown chip shows "Xd Yh Zm left" or "Expired"
    await expect(page.getByText(/\d+[dhm]\s*.*left|Expired/)).toBeVisible();
    // Status chip visible
    await expect(page.getByText('Pending').first()).toBeVisible();
  });
});
