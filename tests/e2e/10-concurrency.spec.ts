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
});
