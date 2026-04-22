import { test, expect } from '@playwright/test';
import { DEMO, login, createRequestUI, uniqueUnregisteredEmail } from './fixtures';

test.describe('Path 1, 2, 13: Create request', () => {
  test('Path 1 — create request to registered recipient', async ({ page }) => {
    await login(page, DEMO.david);

    const id = await createRequestUI(page, {
      recipientEmail: DEMO.michael.email,
      amountUsd: '12.34',
      note: 'lunch tab',
    });

    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    await expect(page.getByText('$12.34').first()).toBeVisible();
    await expect(page.getByText('“lunch tab”')).toBeVisible();
    await expect(page.getByText('Pending').first()).toBeVisible();
    await expect(
      page.getByText(`${DEMO.michael.first} ${DEMO.michael.last}`).first()
    ).toBeVisible();
  });

  test('Path 2 — create request to unregistered recipient (email queued)', async ({ page }) => {
    await login(page, DEMO.david);

    const anon = await uniqueUnregisteredEmail();
    const id = await createRequestUI(page, {
      recipientEmail: anon,
      amountUsd: '7.50',
      note: 'movie night',
    });

    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    await expect(page.getByText('$7.50').first()).toBeVisible();
    await expect(page.getByText(anon).first()).toBeVisible();

    // Outgoing dashboard should surface the new unregistered request by email
    await page.goto('/');
    await page.getByRole('button', { name: 'Outgoing' }).click();
    await page.getByPlaceholder('Search name or note…').fill(anon);
    await expect(page.getByText(anon).first()).toBeVisible();
  });

  test('Path 13 — memo validation: bad words rejected', async ({ page }) => {
    await login(page, DEMO.michael);

    await page.goto('/requests/new');
    const form = page.locator('form');
    await form.locator('input[type="email"]').fill(DEMO.david.email);
    await form.locator('input[inputmode="decimal"]').fill('5.00');
    await form.locator('textarea').fill('you fuck owe me');
    await page.getByRole('button', { name: 'Send request' }).click();

    await expect(page).toHaveURL(/\/requests\/new$/);
    await expect(page.getByText(/prohibited word|inappropriate language/i)).toBeVisible();
  });

  test('Path 13b — cannot request money from yourself', async ({ page }) => {
    await login(page, DEMO.michael);

    await page.goto('/requests/new');
    const form = page.locator('form');
    await form.locator('input[type="email"]').fill(DEMO.michael.email);
    await form.locator('input[inputmode="decimal"]').fill('5.00');
    await page.getByRole('button', { name: 'Send request' }).click();

    await expect(page).toHaveURL(/\/requests\/new$/);
    await expect(page.getByText(/cannot request money from yourself/i)).toBeVisible();
  });
});
