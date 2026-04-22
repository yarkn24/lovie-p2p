import { test, expect, devices } from '@playwright/test';
import { DEMO, login, createRequestAPI } from './fixtures';

/**
 * Explicit mobile-viewport tests. The `Mobile Chrome` project already runs
 * the whole suite on Pixel 5, so these focus on mobile-specific UX: iPhone 13
 * emulation, no horizontal scroll, touch-target sizing, and that the primary
 * flows render at 390px width.
 */
const iPhone13 = devices['iPhone 13'];

test.use({ ...iPhone13 });

test.describe('Responsive: iPhone 13 viewport', () => {
  test('login page fits viewport (no horizontal scroll)', async ({ page }) => {
    await page.goto('/auth/login');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
    await expect(page.locator('input[type="email"]').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  });

  test('dashboard renders and balance visible on mobile', async ({ page }) => {
    await login(page, DEMO.michael);
    await expect(page.getByText('Available balance')).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('create-request form usable on mobile', async ({ page }) => {
    await login(page, DEMO.michael);
    await page.goto('/requests/new');
    const email = page.locator('input[type="email"]').first();
    const amount = page.locator('input[inputmode="decimal"]').first();
    await expect(email).toBeVisible();
    await expect(amount).toBeVisible();
    // Primary action button should be reasonably tall (touch target ≥ 40px)
    const button = page.getByRole('button', { name: 'Send request' });
    const box = await button.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(40);
  });

  test('request detail page renders on mobile', async ({ page }) => {
    await login(page, DEMO.michael);
    const { id } = await createRequestAPI(page, {
      recipientEmail: DEMO.david.email,
      amountUsd: '1.00',
      note: 'mobile view test',
    });
    await page.goto(`/requests/${id}`);
    await expect(page.getByText('$1.00').first()).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
