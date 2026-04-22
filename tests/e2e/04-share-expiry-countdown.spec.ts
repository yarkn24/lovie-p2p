import { test, expect } from '@playwright/test';
import { DEMO, login, createRequestAPI, uniqueUnregisteredEmail, recordingContext } from './fixtures';

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

  test('Path 6 — Expired request blocks payment server-side (skipped: needs seeded expired row)', async () => {
    test.skip(
      true,
      'Expiration is enforced by an hourly Vercel cron and the expiry check on fetch. ' +
        'Forcing expires_at into the past needs direct DB access or service-role writes, ' +
        'which is out of scope for the live production test account. Covered by unit/integration ' +
        'tests against the RPC `expire_pending_requests` and the UI branch at detail page line ' +
        '266 ("Expired" badge when countdown<=0).'
    );
  });

  test('Path 5 — Scheduled payment failure → retry UI (skipped: requires cron-triggered failure)', async () => {
    test.skip(
      true,
      'A scheduled payment only transitions to status=7 (Failed) after the hourly cron runs ' +
        '`execute_scheduled_payments` and hits INSUFFICIENT_BALANCE. Driving that in an E2E test ' +
        'means waiting for the cron or calling /api/cron/execute-scheduled with CRON_SECRET, which ' +
        'is a server secret we should not ship into a browser test. The retry UI is covered ' +
        'structurally by the detail page at lines 329-362 (btn-brand "Retry payment" + Reschedule input).'
    );
  });
});
