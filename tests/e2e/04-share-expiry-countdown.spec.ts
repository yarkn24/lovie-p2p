import { test, expect } from '@playwright/test';
import {
  DEMO,
  login,
  createRequestAPI,
  uniqueUnregisteredEmail,
  recordingContext,
  forceExpireRequest,
  forceFailScheduled,
  hasAdminCreds,
  setBalance,
} from './fixtures';

test.describe('Paths 5, 6, 9, 12: Share link / expiry / countdown', () => {
  test('Path 9 — Shareable link (unauthenticated): gated preview with Sign-in and Sign-up CTAs', async (
    { browser },
    testInfo
  ) => {
    // Step 1: logged-in sender creates a request to an unregistered email
    const senderCtx = await recordingContext(browser, testInfo);
    const senderPage = await senderCtx.newPage();
    await login(senderPage, DEMO.david);

    const anonEmail = await uniqueUnregisteredEmail('-share');
    const { id } = await createRequestAPI(senderPage, {
      recipientEmail: anonEmail,
      amountUsd: '6.00',
      note: 'E2E share',
    });

    // Step 2: fresh anonymous context visits the shareable link
    const anonCtx = await recordingContext(browser, testInfo);
    const anonPage = await anonCtx.newPage();
    await anonPage.goto(`/requests/${id}/share?e=${encodeURIComponent(anonEmail)}`);

    await expect(anonPage.getByText(/You.*got a payment request/i)).toBeVisible();
    await expect(
      anonPage.getByText(/Create a free account to pay, decline, or schedule\./i)
    ).toBeVisible();
    await expect(anonPage.getByText(anonEmail)).toBeVisible();
    await expect(anonPage.getByRole('link', { name: 'Create account' })).toBeVisible();

    // Never reveals amount or sender identity to anonymous visitors
    await expect(anonPage.getByText('$6.00')).toHaveCount(0);
    await expect(anonPage.getByText(DEMO.david.email)).toHaveCount(0);

    await senderCtx.close();
    await anonCtx.close();
  });

  test('Path 12 — Countdown timer visible on pending detail', async ({ page }) => {
    await login(page, DEMO.michael);
    const { id } = await createRequestAPI(page, {
      recipientEmail: DEMO.sarah.email,
      amountUsd: '1.00',
      note: 'E2E countdown',
    });

    await page.goto(`/requests/${id}`);
    // Expires in ~7 days → "6d Xh Ym left" format (7th day rounds down)
    await expect(page.getByText(/\d+d\s+\d+h\s+\d+m left|\d+h\s+\d+m left/i)).toBeVisible();
  });

  test('Path 6 — Expired request blocks payment server-side', async ({ browser }, testInfo) => {
    test.skip(!hasAdminCreds(), 'Requires SUPABASE_SERVICE_ROLE_KEY in .env.local to force expiry.');

    const senderCtx = await recordingContext(browser, testInfo);
    const payerCtx = await recordingContext(browser, testInfo);
    const senderPage = await senderCtx.newPage();
    const payerPage = await payerCtx.newPage();

    await login(senderPage, DEMO.david);
    await login(payerPage, DEMO.michael);
    await setBalance(payerPage, 10_000_00);

    const { id } = await createRequestAPI(senderPage, {
      recipientEmail: DEMO.michael.email,
      amountUsd: '2.00',
      note: 'E2E expired',
    });

    // Force the request into the past via service-role write — this is
    // exactly the state the hourly cron would produce after 7 days.
    await forceExpireRequest(id);

    // Server-side block: /pay must refuse with REQUEST_EXPIRED (400).
    const payRes = await payerPage.request.post(`/api/payment-requests/${id}/pay`);
    expect(payRes.ok()).toBeFalsy();
    expect(payRes.status()).toBe(400);
    const body = await payRes.json();
    expect(body?.error?.code).toBe('REQUEST_EXPIRED');

    // Status must not have changed to Paid. Fetch via sender who retains access.
    const view = await senderPage.request.get(`/api/payment-requests/${id}`);
    const state = await view.json();
    expect(state.status).not.toBe(2);

    // UI side: detail page shows "Expired" badge and no Pay button.
    await payerPage.goto(`/requests/${id}`);
    await expect(payerPage.getByText('Expired').first()).toBeVisible();
    await expect(payerPage.getByRole('button', { name: 'Pay now' })).toHaveCount(0);

    await senderCtx.close();
    await payerCtx.close();
  });

  test('Path 5 — Scheduled payment failure surfaces retry UI and recovers on retry', async ({
    browser,
  }, testInfo) => {
    test.skip(!hasAdminCreds(), 'Requires SUPABASE_SERVICE_ROLE_KEY in .env.local to simulate cron failure.');

    const senderCtx = await recordingContext(browser, testInfo);
    const payerCtx = await recordingContext(browser, testInfo);
    const senderPage = await senderCtx.newPage();
    const payerPage = await payerCtx.newPage();

    await login(senderPage, DEMO.david);
    await login(payerPage, DEMO.michael);

    // Give payer enough balance for the eventual retry, not for initial "cron".
    await setBalance(payerPage, 10_000_00);

    const { id } = await createRequestAPI(senderPage, {
      recipientEmail: DEMO.michael.email,
      amountUsd: '3.50',
      note: 'E2E failed-scheduled',
    });

    // Payer schedules first (status 1 → 5).
    const future = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const scheduleRes = await payerPage.request.post(
      `/api/payment-requests/${id}/schedule`,
      { data: { scheduled_payment_date: future } }
    );
    expect(scheduleRes.ok()).toBeTruthy();

    // Simulate the hourly cron running and hitting INSUFFICIENT_BALANCE
    // (status 5 → 7 with failure_reason set).
    await forceFailScheduled(id, 'INSUFFICIENT_BALANCE');

    await payerPage.goto(`/requests/${id}`);
    await expect(payerPage.getByText('Failed').first()).toBeVisible();
    await expect(payerPage.getByText(/Failure reason:\s*INSUFFICIENT_BALANCE/i)).toBeVisible();

    // Retry button visible for recipient on status=7
    const retryBtn = payerPage.getByRole('button', { name: 'Retry payment' });
    await expect(retryBtn).toBeVisible();

    // Click retry → status flips to 2 (Paid) and balances settle.
    await retryBtn.click();

    // Pay action runs through execute_payment_v2, with the 2.5s loading window.
    await expect(payerPage.getByText('Paid').first()).toBeVisible({ timeout: 12000 });

    const view = await senderPage.request.get(`/api/payment-requests/${id}`);
    const state = await view.json();
    expect(state.status).toBe(2);

    await senderCtx.close();
    await payerCtx.close();
  });
});
