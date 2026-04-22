import { test, expect } from '@playwright/test';
import {
  DEMO,
  login,
  createRequestAPI,
  recordingContext,
} from './fixtures';

test.describe('Authorization / RLS boundaries', () => {
  test('third party cannot GET a request they are not part of', async ({ browser }, testInfo) => {
    const senderCtx = await recordingContext(browser, testInfo);
    const intruderCtx = await recordingContext(browser, testInfo);
    const senderPage = await senderCtx.newPage();
    const thirdParty = await intruderCtx.newPage();

    await login(senderPage, DEMO.david);
    await login(thirdParty, DEMO.sarah);

    const { id } = await createRequestAPI(senderPage, {
      recipientEmail: DEMO.michael.email,
      amountUsd: '1.00',
    });

    const res = await thirdParty.request.get(`/api/payment-requests/${id}`);
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
    await senderCtx.close();
    await intruderCtx.close();
  });

  test('non-sender cannot cancel', async ({ browser }, testInfo) => {
    const senderCtx = await recordingContext(browser, testInfo);
    const intruderCtx = await recordingContext(browser, testInfo);
    const senderPage = await senderCtx.newPage();
    const intruder = await intruderCtx.newPage();

    await login(senderPage, DEMO.michael);
    await login(intruder, DEMO.sarah);

    const { id } = await createRequestAPI(senderPage, {
      recipientEmail: DEMO.david.email,
      amountUsd: '1.00',
    });

    const res = await intruder.request.post(`/api/payment-requests/${id}/cancel`);
    expect(res.status()).toBeGreaterThanOrEqual(400);
    await senderCtx.close();
    await intruderCtx.close();
  });

  test('non-recipient cannot pay', async ({ browser }, testInfo) => {
    const senderCtx = await recordingContext(browser, testInfo);
    const intruderCtx = await recordingContext(browser, testInfo);
    const senderPage = await senderCtx.newPage();
    const intruder = await intruderCtx.newPage();

    await login(senderPage, DEMO.david);
    await login(intruder, DEMO.sarah);

    const { id } = await createRequestAPI(senderPage, {
      recipientEmail: DEMO.michael.email,
      amountUsd: '1.00',
    });

    const res = await intruder.request.post(`/api/payment-requests/${id}/pay`);
    expect(res.status()).toBeGreaterThanOrEqual(400);
    await senderCtx.close();
    await intruderCtx.close();
  });

  test('non-recipient cannot decline', async ({ browser }, testInfo) => {
    const senderCtx = await recordingContext(browser, testInfo);
    const intruderCtx = await recordingContext(browser, testInfo);
    const senderPage = await senderCtx.newPage();
    const intruder = await intruderCtx.newPage();

    await login(senderPage, DEMO.michael);
    await login(intruder, DEMO.sarah);

    const { id } = await createRequestAPI(senderPage, {
      recipientEmail: DEMO.david.email,
      amountUsd: '1.00',
    });

    const res = await intruder.request.post(`/api/payment-requests/${id}/decline`);
    expect(res.status()).toBeGreaterThanOrEqual(400);
    await senderCtx.close();
    await intruderCtx.close();
  });

  test('unauthenticated requests to payment-requests API return 401', async ({ request }) => {
    const res = await request.get('/api/payment-requests');
    expect(res.status()).toBe(401);
  });
});
