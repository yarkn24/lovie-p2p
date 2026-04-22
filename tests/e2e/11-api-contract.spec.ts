import { test, expect } from '@playwright/test';
import { DEMO, login } from './fixtures';

test.describe('API contract — shape, types, status codes', () => {
  test('missing amount field rejected', async ({ page }) => {
    await login(page, DEMO.david);
    const res = await page.request.post('/api/payment-requests', {
      data: { recipient_email: DEMO.michael.email },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test('missing recipient_email field rejected', async ({ page }) => {
    await login(page, DEMO.michael);
    const res = await page.request.post('/api/payment-requests', {
      data: { amount: 1 },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test('amount as string rejected', async ({ page }) => {
    await login(page, DEMO.david);
    const res = await page.request.post('/api/payment-requests', {
      data: { recipient_email: DEMO.michael.email, amount: '1.00' },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test('GET /api/payment-requests returns an array', async ({ page }) => {
    await login(page, DEMO.sarah);
    const res = await page.request.get('/api/payment-requests');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body) || Array.isArray(body.data) || Array.isArray(body.requests)).toBeTruthy();
  });

  test('balance POST with invalid action rejected', async ({ page }) => {
    await login(page, DEMO.sarah);
    const res = await page.request.post('/api/user/balance', {
      data: { action: 'teleport', amount: 10 },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });
});
