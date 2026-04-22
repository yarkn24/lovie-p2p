import { test, expect } from '@playwright/test';
import { DEMO } from './fixtures';

test.describe('Auth negative paths', () => {
  test('wrong password keeps user on login with error', async ({ page }) => {
    await page.goto('/auth/login');
    await page.locator('input[type="email"]').first().fill(DEMO.david.email);
    await page.locator('input[type="password"]').first().fill('totally-wrong');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(page.getByText(/invalid|incorrect|failed/i).first()).toBeVisible();
  });

  test('nonexistent user cannot sign in', async ({ page }) => {
    await page.goto('/auth/login');
    await page.locator('input[type="email"]').first().fill('ghost.user.404@lovie-test.invalid');
    await page.locator('input[type="password"]').first().fill('whatever');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(page.getByText(/invalid|incorrect|failed|not found/i).first()).toBeVisible();
  });

  test('empty credentials blocked by client validation', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('protected route redirects unauthenticated user to login', async ({ page }) => {
    await page.goto('/requests/new');
    await page.waitForURL(/\/auth\/login/, { timeout: 10000 });
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('unauthenticated API returns 401', async ({ request }) => {
    const res = await request.get('/api/auth/user');
    expect(res.status()).toBe(401);
  });
});
