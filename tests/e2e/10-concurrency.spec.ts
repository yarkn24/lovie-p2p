import { test, expect } from '@playwright/test';
import {
  DEMO,
  login,
  createRequestAPI,
  setBalance,
  getBalanceCents,
  recordingContext,
} from './fixtures';

test.describe('Concurrency / race conditions', () => {
  test('double-pay same request from two tabs — exactly one succeeds', async ({ browser }, testInfo) => {
    const senderCtx = await recordingContext(browser, testInfo);
    const payerCtxA = await recordingContext(browser, testInfo);
    const payerCtxB = await recordingContext(browser, testInfo);
    const senderPage = await senderCtx.newPage();
    const payerA = await payerCtxA.newPage();
    const payerB = await payerCtxB.newPage();

    await login(senderPage, DEMO.david);
    await login(payerA, DEMO.michael);
    await login(payerB, DEMO.michael);

    await setBalance(payerA, 100_000);
    const startBalance = await getBalanceCents(payerA);

    const { id } = await createRequestAPI(senderPage, {
      recipientEmail: DEMO.michael.email,
      amountUsd: '5.00',
    });

    const [resA, resB] = await Promise.all([
      payerA.request.post(`/api/payment-requests/${id}/pay`),
      payerB.request.post(`/api/payment-requests/${id}/pay`),
    ]);

    const results = [resA.ok(), resB.ok()];
    const successes = results.filter(Boolean).length;
    expect(successes).toBe(1);

    const endBalance = await getBalanceCents(payerA);
    expect(startBalance - endBalance).toBe(500);
    await senderCtx.close();
    await payerCtxA.close();
    await payerCtxB.close();
  });

  test('simultaneous pay + decline — exactly one wins, status deterministic', async ({ browser }, testInfo) => {
    const senderCtx = await recordingContext(browser, testInfo);
    const payerCtx = await recordingContext(browser, testInfo);
    const senderPage = await senderCtx.newPage();
    const payerPage = await payerCtx.newPage();

    await login(senderPage, DEMO.david);
    await login(payerPage, DEMO.michael);

    await setBalance(payerPage, 50_000_00);
    const { id } = await createRequestAPI(senderPage, {
      recipientEmail: DEMO.michael.email,
      amountUsd: '1.00',
    });

    const [payRes, declineRes] = await Promise.all([
      payerPage.request.post(`/api/payment-requests/${id}/pay`),
      payerPage.request.post(`/api/payment-requests/${id}/decline`),
    ]);

    const successes = [payRes.ok(), declineRes.ok()].filter(Boolean).length;
    expect(successes).toBe(1);

    const view = await senderPage.request.get(`/api/payment-requests/${id}`);
    const body = await view.json();
    expect([2, 3]).toContain(body.status);
    await senderCtx.close();
    await payerCtx.close();
  });

  test('simultaneous pay + cancel — exactly one wins', async ({ browser }, testInfo) => {
    const senderCtx = await recordingContext(browser, testInfo);
    const payerCtx = await recordingContext(browser, testInfo);
    const senderPage = await senderCtx.newPage();
    const payerPage = await payerCtx.newPage();

    await login(senderPage, DEMO.david);
    await login(payerPage, DEMO.michael);
    await setBalance(payerPage, 50_000_00);

    const { id } = await createRequestAPI(senderPage, {
      recipientEmail: DEMO.michael.email,
      amountUsd: '1.00',
    });

    const [payRes, cancelRes] = await Promise.all([
      payerPage.request.post(`/api/payment-requests/${id}/pay`),
      senderPage.request.post(`/api/payment-requests/${id}/cancel`),
    ]);

    const successes = [payRes.ok(), cancelRes.ok()].filter(Boolean).length;
    expect(successes).toBe(1);

    const view = await senderPage.request.get(`/api/payment-requests/${id}`);
    const body = await view.json();
    expect([2, 6]).toContain(body.status);
    await senderCtx.close();
    await payerCtx.close();
  });

  test('simultaneous decline + cancel — exactly one wins', async ({ browser }, testInfo) => {
    const senderCtx = await recordingContext(browser, testInfo);
    const recipCtx = await recordingContext(browser, testInfo);
    const senderPage = await senderCtx.newPage();
    const recipPage = await recipCtx.newPage();

    await login(senderPage, DEMO.david);
    await login(recipPage, DEMO.michael);

    const { id } = await createRequestAPI(senderPage, {
      recipientEmail: DEMO.michael.email,
      amountUsd: '1.00',
    });

    const [declineRes, cancelRes] = await Promise.all([
      recipPage.request.post(`/api/payment-requests/${id}/decline`),
      senderPage.request.post(`/api/payment-requests/${id}/cancel`),
    ]);

    const successes = [declineRes.ok(), cancelRes.ok()].filter(Boolean).length;
    expect(successes).toBe(1);

    const view = await senderPage.request.get(`/api/payment-requests/${id}`);
    const body = await view.json();
    expect([3, 6]).toContain(body.status);
    await senderCtx.close();
    await recipCtx.close();
  });

  test('simultaneous schedule + decline — exactly one wins', async ({ browser }, testInfo) => {
    const senderCtx = await recordingContext(browser, testInfo);
    const recipCtx = await recordingContext(browser, testInfo);
    const senderPage = await senderCtx.newPage();
    const recipPage = await recipCtx.newPage();

    await login(senderPage, DEMO.david);
    await login(recipPage, DEMO.michael);

    const { id } = await createRequestAPI(senderPage, {
      recipientEmail: DEMO.michael.email,
      amountUsd: '1.00',
    });

    const future = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const [scheduleRes, declineRes] = await Promise.all([
      recipPage.request.post(`/api/payment-requests/${id}/schedule`, {
        data: { scheduled_payment_date: future },
      }),
      recipPage.request.post(`/api/payment-requests/${id}/decline`),
    ]);

    const successes = [scheduleRes.ok(), declineRes.ok()].filter(Boolean).length;
    expect(successes).toBe(1);

    const view = await senderPage.request.get(`/api/payment-requests/${id}`);
    const body = await view.json();
    expect([3, 5]).toContain(body.status);
    await senderCtx.close();
    await recipCtx.close();
  });

  test('balance integrity: N sequential pay/decline cycles net to correct totals', async ({ browser }, testInfo) => {
    const senderCtx = await recordingContext(browser, testInfo);
    const payerCtx = await recordingContext(browser, testInfo);
    const senderPage = await senderCtx.newPage();
    const payerPage = await payerCtx.newPage();

    await login(senderPage, DEMO.david);
    await login(payerPage, DEMO.michael);

    await setBalance(payerPage, 10_000_00);
    const payerStart = await getBalanceCents(payerPage);
    const senderStart = await getBalanceCents(senderPage);

    const PAID_COUNT = 3;
    const AMOUNT_USD = '2.50';
    const AMOUNT_CENTS = 250;

    for (let i = 0; i < PAID_COUNT; i++) {
      const { id } = await createRequestAPI(senderPage, {
        recipientEmail: DEMO.michael.email,
        amountUsd: AMOUNT_USD,
      });
      const res = await payerPage.request.post(`/api/payment-requests/${id}/pay`);
      expect(res.ok()).toBeTruthy();
    }

    // Declined request does not move money
    const { id: declinedId } = await createRequestAPI(senderPage, {
      recipientEmail: DEMO.michael.email,
      amountUsd: AMOUNT_USD,
    });
    const dres = await payerPage.request.post(`/api/payment-requests/${declinedId}/decline`);
    expect(dres.ok()).toBeTruthy();

    const payerEnd = await getBalanceCents(payerPage);
    const senderEnd = await getBalanceCents(senderPage);
    expect(payerStart - payerEnd).toBe(PAID_COUNT * AMOUNT_CENTS);
    expect(senderEnd - senderStart).toBe(PAID_COUNT * AMOUNT_CENTS);

    await senderCtx.close();
    await payerCtx.close();
  });
});
