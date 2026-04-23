import { test, expect } from '@playwright/test';
import {
  DEMO,
  login,
  createRequestAPI,
  setBalance,
  forceFailScheduled,
  recordingContext,
} from './fixtures';

test.describe('Payment validation + status transition edge cases', () => {
  test('amount = 0 rejected', async ({ page }) => {
    await login(page, DEMO.david);
    const res = await page.request.post('/api/payment-requests', {
      data: { recipient_email: DEMO.michael.email, amount: 0 },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test('negative amount rejected', async ({ page }) => {
    await login(page, DEMO.david);
    const res = await page.request.post('/api/payment-requests', {
      data: { recipient_email: DEMO.michael.email, amount: -10 },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test('amount > $10,000 rejected', async ({ page }) => {
    await login(page, DEMO.michael);
    const res = await page.request.post('/api/payment-requests', {
      data: { recipient_email: DEMO.david.email, amount: 10000.01 },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test('amount with > 2 decimal places rejected', async ({ page }) => {
    await login(page, DEMO.michael);
    const res = await page.request.post('/api/payment-requests', {
      data: { recipient_email: DEMO.david.email, amount: 1.234 },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test('insufficient balance blocks pay', async ({ browser }, testInfo) => {
    const senderCtx = await recordingContext(browser, testInfo);
    const payerCtx = await recordingContext(browser, testInfo);
    const senderPage = await senderCtx.newPage();
    const payerPage = await payerCtx.newPage();

    await login(senderPage, DEMO.michael);
    await login(payerPage, DEMO.david);

    await setBalance(payerPage, 50);
    const { id } = await createRequestAPI(senderPage, {
      recipientEmail: DEMO.david.email,
      amountUsd: '1.00',
    });

    const res = await payerPage.request.post(`/api/payment-requests/${id}/pay`);
    expect(res.status()).toBeGreaterThanOrEqual(400);
    const body = await res.text();
    expect(body.toLowerCase()).toMatch(/insufficient|balance/);

    await setBalance(payerPage, 50_000_00);
    await senderCtx.close();
    await payerCtx.close();
  });

  test('cannot pay a cancelled request', async ({ browser }, testInfo) => {
    const senderCtx = await recordingContext(browser, testInfo);
    const payerCtx = await recordingContext(browser, testInfo);
    const senderPage = await senderCtx.newPage();
    const payerPage = await payerCtx.newPage();

    await login(senderPage, DEMO.michael);
    await login(payerPage, DEMO.david);

    const { id } = await createRequestAPI(senderPage, {
      recipientEmail: DEMO.david.email,
      amountUsd: '1.00',
    });

    const cancel = await senderPage.request.post(`/api/payment-requests/${id}/cancel`);
    expect(cancel.ok()).toBeTruthy();

    const pay = await payerPage.request.post(`/api/payment-requests/${id}/pay`);
    expect(pay.status()).toBeGreaterThanOrEqual(400);
    await senderCtx.close();
    await payerCtx.close();
  });

  test('cannot decline an already paid request', async ({ browser }, testInfo) => {
    const senderCtx = await recordingContext(browser, testInfo);
    const payerCtx = await recordingContext(browser, testInfo);
    const senderPage = await senderCtx.newPage();
    const payerPage = await payerCtx.newPage();

    await login(senderPage, DEMO.michael);
    await login(payerPage, DEMO.david);

    await setBalance(payerPage, 50_000_00);
    const { id } = await createRequestAPI(senderPage, {
      recipientEmail: DEMO.david.email,
      amountUsd: '1.00',
    });

    const pay = await payerPage.request.post(`/api/payment-requests/${id}/pay`);
    expect(pay.ok()).toBeTruthy();

    const decline = await payerPage.request.post(`/api/payment-requests/${id}/decline`);
    expect(decline.status()).toBeGreaterThanOrEqual(400);
    await senderCtx.close();
    await payerCtx.close();
  });

  test('scheduled date in the past rejected', async ({ browser }, testInfo) => {
    const senderCtx = await recordingContext(browser, testInfo);
    const payerCtx = await recordingContext(browser, testInfo);
    const senderPage = await senderCtx.newPage();
    const payerPage = await payerCtx.newPage();

    await login(senderPage, DEMO.michael);
    await login(payerPage, DEMO.david);

    const { id } = await createRequestAPI(senderPage, {
      recipientEmail: DEMO.david.email,
      amountUsd: '1.00',
    });

    const pastDate = new Date(Date.now() - 86_400_000).toISOString();
    const res = await payerPage.request.post(`/api/payment-requests/${id}/schedule`, {
      data: { scheduled_payment_date: pastDate },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
    await senderCtx.close();
    await payerCtx.close();
  });

  test('retry reschedule with past date rejected', async ({ browser }, testInfo) => {
    const senderCtx = await recordingContext(browser, testInfo);
    const payerCtx = await recordingContext(browser, testInfo);
    const senderPage = await senderCtx.newPage();
    const payerPage = await payerCtx.newPage();

    await login(senderPage, DEMO.michael);
    await login(payerPage, DEMO.david);

    const { id } = await createRequestAPI(senderPage, {
      recipientEmail: DEMO.david.email,
      amountUsd: '1.00',
    });
    await forceFailScheduled(id);

    const pastDate = new Date(Date.now() - 86_400_000).toISOString();
    const res = await payerPage.request.post(`/api/payment-requests/${id}/retry`, {
      data: { action: 'reschedule', scheduled_payment_date: pastDate },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_SCHEDULE_DATE');

    await senderCtx.close();
    await payerCtx.close();
  });
});
