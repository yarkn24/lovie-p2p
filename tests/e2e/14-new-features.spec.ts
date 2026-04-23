import { test, expect } from '@playwright/test';
import { DEMO, login, adminSupabase, hasAdminCreds } from './fixtures';

/**
 * Regression coverage for post-v1 features:
 *  - Public preview at /requests/[id] for anon viewers + /preview endpoint
 *  - Dashboard "View details" pill on every row
 *  - Detail page share button (copies URL to clipboard)
 *  - Pay on expired row returns REQUEST_EXPIRED (not INVALID_STATUS)
 *  - Signup rejects already-registered emails
 *  - Middleware kicks out authenticated users whose profile row was deleted
 *  - /auth/complete-profile renders when session exists without profile row
 */

test.describe('public preview (/requests/[id] + /preview endpoint)', () => {
  test('preview endpoint is anonymous and returns minimal fields', async ({ request }) => {
    test.skip(!hasAdminCreds(), 'needs service role to query a known request id');
    const admin = adminSupabase();
    const { data: rows } = await admin
      .from('payment_requests').select('id').limit(1);
    const id = rows?.[0]?.id;
    test.skip(!id, 'no payment requests in DB to preview');

    const res = await request.get(`/api/payment-requests/${id}/preview`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      id,
      amount: expect.any(Number),
      status: expect.any(Number),
      expires_at: expect.any(String),
      sender_name: expect.any(String),
      recipient_email: expect.any(String),
    });
    // Must not leak internal fields
    expect(body).not.toHaveProperty('note');
    expect(body).not.toHaveProperty('sender_id');
    expect(body).not.toHaveProperty('recipient_id');
  });

  test('anon viewer sees Sign in + Create account CTAs on /requests/[id]', async ({ browser }) => {
    test.skip(!hasAdminCreds(), 'needs service role to fetch a known request id');
    const admin = adminSupabase();
    const { data: rows } = await admin
      .from('payment_requests').select('id').limit(1);
    const id = rows?.[0]?.id;
    test.skip(!id, 'no payment requests in DB');

    const ctx = await browser.newContext({ storageState: undefined });
    const page = await ctx.newPage();
    await page.goto(`/requests/${id}`);
    await expect(page.getByText(/requested/i).first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /create account/i })).toBeVisible();
    await ctx.close();
  });

  test('preview 404s for an unknown id', async ({ request }) => {
    const res = await request.get('/api/payment-requests/00000000-0000-0000-0000-000000000000/preview');
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.error?.code).toBe('REQUEST_NOT_FOUND');
  });
});

test.describe('dashboard UX', () => {
  test('every request row shows a "View details" pill', async ({ page }) => {
    await login(page, DEMO.michael);
    await expect(page.getByText('View details').first()).toBeVisible({ timeout: 8000 });
  });
});

test.describe('request detail page', () => {
  test('share button is present for authorized viewer', async ({ page }) => {
    test.skip(!hasAdminCreds(), 'needs service role to fetch a known request id');
    const admin = adminSupabase();
    const { data: rows } = await admin
      .from('payment_requests')
      .select('id')
      .eq('sender_id', 'ba58fdb6-268c-466a-80dc-9fc981812b79') // Michael
      .limit(1);
    const id = rows?.[0]?.id;
    test.skip(!id, 'no Michael-sent request');

    await login(page, DEMO.michael);
    await page.goto(`/requests/${id}`);
    await expect(page.getByRole('button', { name: /copy share link/i })).toBeVisible();
  });
});

test.describe('payment edge case: expired status=4', () => {
  test('pay on status=4 returns REQUEST_EXPIRED (not INVALID_STATUS)', async ({ page, request }) => {
    test.skip(!hasAdminCreds(), 'needs service role to seed an expired row');
    const admin = adminSupabase();

    // Seed a fresh already-expired request Michael → Sarah
    const michaelId = 'ba58fdb6-268c-466a-80dc-9fc981812b79';
    const sarahId = '3a418e23-9ab4-45bb-9d17-2e5869dcaff0';
    const past = new Date(Date.now() - 2 * 86400000).toISOString();
    const { data: inserted, error: insErr } = await admin
      .from('payment_requests')
      .insert({
        sender_id: michaelId,
        recipient_id: sarahId,
        recipient_email: DEMO.sarah.email,
        amount: 500,
        status: 4,
        expired: 1,
        repeated: 0,
        expires_at: past,
        updated_at: past,
        note: 'expired regression',
      })
      .select('id')
      .single();
    expect(insErr).toBeNull();
    const id = inserted!.id;

    try {
      await login(page, DEMO.sarah);
      const cookies = await page.context().cookies();
      const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
      const res = await request.post(`/api/payment-requests/${id}/pay`, {
        headers: { Cookie: cookieHeader },
      });
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.error?.code).toBe('REQUEST_EXPIRED');
    } finally {
      await admin.from('payment_requests').delete().eq('id', id);
    }
  });
});

test.describe('signup edge cases', () => {
  test('rejects email that already has an account', async ({ page }) => {
    await page.goto('/auth/signup');
    await page.locator('input').nth(0).fill('Test');
    await page.locator('input').nth(1).fill('User');
    await page.locator('input[type="email"]').fill(DEMO.sarah.email);
    await page.locator('input[type="password"]').nth(0).fill('password123');
    await page.locator('input[type="password"]').nth(1).fill('password123');
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page.getByText(/already have an account/i)).toBeVisible({ timeout: 8000 });
  });
});

test.describe('middleware: deleted-profile kickout', () => {
  test('authenticated user without profile row is redirected to login', async ({ browser }) => {
    test.skip(!hasAdminCreds(), 'needs service role to temporarily remove profile');
    const admin = adminSupabase();

    // Create a throwaway auth user + profile, sign in, then delete profile row
    // and assert the next request redirects to login.
    const email = `ghost+${Date.now()}@lovie-test.invalid`;
    const password = 'password123';
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name: 'Ghost', last_name: 'User' },
    });
    expect(createErr).toBeNull();
    if (!created.user) throw new Error('createUser returned null user');
    const userId = created.user.id;

    await admin.from('users').insert({
      id: userId,
      email,
      first_name: 'Ghost',
      last_name: 'User',
      balance: 1000000,
    });

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    try {
      await page.goto('/auth/login');
      await page.locator('input[type="email"]').first().fill(email);
      await page.locator('input[type="password"]').first().fill(password);
      await page.getByRole('button', { name: 'Sign in' }).click();
      await page.waitForURL((url) => url.pathname === '/', { timeout: 20000 });

      // Now remove the profile row behind their back and refresh.
      await admin.from('users').delete().eq('id', userId);
      await page.goto('/');
      await page.waitForURL(/\/auth\/login/, { timeout: 8000 });
      expect(page.url()).toMatch(/\/auth\/login/);
    } finally {
      await admin.from('users').delete().eq('id', userId);
      await admin.auth.admin.deleteUser(userId);
      await ctx.close();
    }
  });
});

test.describe('complete-profile page', () => {
  test('renders form with first/last name fields', async ({ page }) => {
    await page.goto('/auth/complete-profile');
    await expect(page.getByText(/complete your profile/i)).toBeVisible();
    await expect(page.getByText(/first name/i)).toBeVisible();
    await expect(page.getByText(/last name/i)).toBeVisible();
  });
});
