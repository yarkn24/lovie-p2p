import { test, expect } from '@playwright/test';
import { DEMO, login, createRequestAPI } from './fixtures';

test.describe('Security: XSS, injection, unicode, input bounds', () => {
  test('XSS payload in note is rendered as text, not executed', async ({ page }) => {
    await login(page, DEMO.michael);
    const xss = '<script>window.__xss=1</script>';
    const { id } = await createRequestAPI(page, {
      recipientEmail: DEMO.david.email,
      amountUsd: '1.00',
      note: xss,
    });

    await page.goto(`/requests/${id}`);
    const injected = await page.evaluate(() => (window as unknown as { __xss?: number }).__xss);
    expect(injected).toBeUndefined();
    await expect(page.getByText('<script>', { exact: false })).toBeVisible();
  });

  test('SQL-injection-like note is stored verbatim, not executed', async ({ page }) => {
    await login(page, DEMO.michael);
    const sqli = "Robert'); DROP TABLE payment_requests; --";
    const { id } = await createRequestAPI(page, {
      recipientEmail: DEMO.david.email,
      amountUsd: '1.00',
      note: sqli,
    });

    const res = await page.request.get(`/api/payment-requests/${id}`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.note).toBe(sqli);
  });

  test('unicode/emoji in note preserved end-to-end', async ({ page }) => {
    await login(page, DEMO.michael);
    const note = '☕️ café — 🍕 ñ 日本語 💸';
    const { id } = await createRequestAPI(page, {
      recipientEmail: DEMO.david.email,
      amountUsd: '1.00',
      note,
    });
    const res = await page.request.get(`/api/payment-requests/${id}`);
    const body = await res.json();
    expect(body.note).toBe(note);
  });

  test('note > 500 chars rejected', async ({ page }) => {
    await login(page, DEMO.david);
    const note = 'a'.repeat(501);
    const res = await page.request.post('/api/payment-requests', {
      data: { recipient_email: DEMO.michael.email, amount: 1, note },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test('invalid email format rejected', async ({ page }) => {
    await login(page, DEMO.david);
    const res = await page.request.post('/api/payment-requests', {
      data: { recipient_email: 'not-an-email', amount: 1 },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test('self-request via API blocked', async ({ page }) => {
    await login(page, DEMO.david);
    const res = await page.request.post('/api/payment-requests', {
      data: { recipient_email: DEMO.david.email, amount: 1 },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });
});
