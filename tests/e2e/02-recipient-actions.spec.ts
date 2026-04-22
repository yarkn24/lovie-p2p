import { test, expect } from '@playwright/test';
import {
  DEMO,
  login,
  getBalanceCents,
  setBalance,
  createRequestUI,
  createRequestAPI,
  recordingContext,
} from './fixtures';

test.describe('Paths 3, 4, 7, 10: Recipient actions', () => {
  test('Path 3 — Pay now → both balances update atomically', async ({ browser }, testInfo) => {
    // Sender: david, Payer: michael (keep sarah off this test to spare her hourly quota)
    const senderCtx = await recordingContext(browser, testInfo);
    const payerCtx = await recordingContext(browser, testInfo);
    const senderPage = await senderCtx.newPage();
    const payerPage = await payerCtx.newPage();

    await login(senderPage, DEMO.david);
    await login(payerPage, DEMO.michael);

    await setBalance(senderPage, 500_000);
    await setBalance(payerPage, 500_000);

    const senderStart = await getBalanceCents(senderPage);
    const payerStart = await getBalanceCents(payerPage);

    const id = await createRequestUI(senderPage, {
      recipientEmail: DEMO.michael.email,
      amountUsd: '3.00',
      note: 'E2E pay test',
    });

    await payerPage.goto(`/requests/${id}`);
    await payerPage.getByRole('button', { name: /^Pay now$/ }).click();

    await expect(payerPage.getByText('Payment successful!')).toBeVisible({ timeout: 15000 });
    await payerPage.getByRole('button', { name: 'Done' }).click();

    const payerEnd = await getBalanceCents(payerPage);
    expect(payerEnd).toBe(payerStart - 300);

    const senderEnd = await getBalanceCents(senderPage);
    expect(senderEnd).toBe(senderStart + 300);

    await payerPage.reload();
    await expect(payerPage.locator('.chip.chip-paid')).toBeVisible();

    await senderCtx.close();
    await payerCtx.close();
  });

  test('Path 4 — Schedule payment → status becomes Scheduled', async ({ browser }, testInfo) => {
    const senderCtx = await recordingContext(browser, testInfo);
    const payerCtx = await recordingContext(browser, testInfo);
    const senderPage = await senderCtx.newPage();
    const payerPage = await payerCtx.newPage();

    await login(senderPage, DEMO.michael);
    await login(payerPage, DEMO.sarah);

    const { id } = await createRequestAPI(senderPage, {
      recipientEmail: DEMO.sarah.email,
      amountUsd: '2.00',
      note: 'E2E schedule',
    });

    await payerPage.goto(`/requests/${id}`);

    const tomorrow = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await payerPage.locator('input[type="date"]').fill(tomorrow);
    await payerPage.getByRole('button', { name: 'Schedule' }).click();

    await expect(payerPage.locator('.chip.chip-scheduled')).toBeVisible({ timeout: 15000 });
    await expect(payerPage.getByText(/Scheduled to run on/i)).toBeVisible();

    await senderCtx.close();
    await payerCtx.close();
  });

  test('Path 10 — Decline → status becomes Declined', async ({ browser }, testInfo) => {
    // Sender: david, Payer: michael
    const senderCtx = await recordingContext(browser, testInfo);
    const payerCtx = await recordingContext(browser, testInfo);
    const senderPage = await senderCtx.newPage();
    const payerPage = await payerCtx.newPage();

    await login(senderPage, DEMO.david);
    await login(payerPage, DEMO.michael);

    const { id } = await createRequestAPI(senderPage, {
      recipientEmail: DEMO.michael.email,
      amountUsd: '1.50',
      note: 'E2E decline',
    });

    await payerPage.goto(`/requests/${id}`);
    await payerPage.getByRole('button', { name: 'Decline' }).click();

    await expect(payerPage.locator('.chip.chip-declined')).toBeVisible({ timeout: 15000 });

    await senderCtx.close();
    await payerCtx.close();
  });

  test('Path 7 — After decline, sender sees “Request again” (repeat available)', async ({ browser }, testInfo) => {
    // Sender: david, Payer: sarah (sarah just declines via API, no create)
    const senderCtx = await recordingContext(browser, testInfo);
    const payerCtx = await recordingContext(browser, testInfo);
    const senderPage = await senderCtx.newPage();
    const payerPage = await payerCtx.newPage();

    await login(senderPage, DEMO.david);
    await login(payerPage, DEMO.sarah);

    const { id } = await createRequestAPI(senderPage, {
      recipientEmail: DEMO.sarah.email,
      amountUsd: '1.25',
      note: 'E2E repeat-available',
    });

    const decRes = await payerPage.request.post(`/api/payment-requests/${id}/decline`);
    expect(decRes.ok()).toBeTruthy();

    await senderPage.goto(`/requests/${id}`);
    await expect(senderPage.locator('.chip.chip-declined')).toBeVisible();
    await expect(senderPage.getByRole('button', { name: /Request again/i })).toBeVisible();

    await senderCtx.close();
    await payerCtx.close();
  });
});
