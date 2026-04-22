import { test, expect } from '@playwright/test';
import { DEMO, login, createRequestAPI, recordingContext } from './fixtures';

test.describe('Paths 8, 11: Sender actions', () => {
  test('Path 11 — Cancel pending request → status becomes Cancelled', async ({ page }) => {
    // Sender: michael (keeps sarah's quota free)
    await login(page, DEMO.michael);

    const { id } = await createRequestAPI(page, {
      recipientEmail: DEMO.david.email,
      amountUsd: '4.00',
      note: 'E2E cancel',
    });

    await page.goto(`/requests/${id}`);
    await expect(page.locator('.chip.chip-pending')).toBeVisible();

    await page.getByRole('button', { name: 'Cancel request' }).click();

    await expect(page.locator('.chip.chip-cancelled')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('No actions available for this status.')).toBeVisible();
  });

  test('Path 8 — Repeat declined once, second repeat disabled', async ({ browser }, testInfo) => {
    // Sender: david (repeat inserts a 2nd row, counting 2 against david's hourly quota)
    const senderCtx = await recordingContext(browser, testInfo);
    const payerCtx = await recordingContext(browser, testInfo);
    const senderPage = await senderCtx.newPage();
    const payerPage = await payerCtx.newPage();

    await login(senderPage, DEMO.david);
    await login(payerPage, DEMO.michael);

    const { id: a1 } = await createRequestAPI(senderPage, {
      recipientEmail: DEMO.michael.email,
      amountUsd: '1.75',
      note: 'E2E repeat-once A1',
    });
    const dec1 = await payerPage.request.post(`/api/payment-requests/${a1}/decline`);
    expect(dec1.ok()).toBeTruthy();

    await senderPage.goto(`/requests/${a1}`);
    await senderPage.getByRole('button', { name: /Request again/i }).click();
    await senderPage.waitForURL(
      (url) =>
        /\/requests\/[0-9a-f-]{36}$/.test(url.pathname) && !url.pathname.endsWith(a1),
      { timeout: 15000 }
    );
    const a2 = senderPage.url().split('/').pop()!;
    expect(a2).not.toBe(a1);

    // A1 no longer offers repeat (repeated=1 is immutable per spec)
    await senderPage.goto(`/requests/${a1}`);
    await expect(
      senderPage.getByRole('button', { name: /Request again/i })
    ).toHaveCount(0);

    await senderPage.goto(`/requests/${a2}`);
    await expect(senderPage.locator('.chip.chip-pending')).toBeVisible();

    await senderCtx.close();
    await payerCtx.close();
  });
});
