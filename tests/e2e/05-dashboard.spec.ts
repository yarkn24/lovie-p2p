import { test, expect } from '@playwright/test';
import { DEMO, login, createRequestAPI, getBalanceCents, uniqueUnregisteredEmail } from './fixtures';

test.describe('Paths 14, 15: Dashboard + Balance', () => {
  test('Path 14 — Dashboard filters, search, and incoming/outgoing toggle', async ({ page }) => {
    await login(page, DEMO.michael);

    // Seed a uniquely-searchable outgoing request so we don't depend on existing data
    const needle = `e2efilter${Date.now().toString(36)}`;
    const { id } = await createRequestAPI(page, {
      recipientEmail: await uniqueUnregisteredEmail('-filter'),
      amountUsd: '9.99',
      note: needle,
    });

    await page.goto('/');

    // Toggle to Outgoing tab
    await page.getByRole('button', { name: 'Outgoing' }).click();

    // Search by unique note
    const search = page.getByPlaceholder('Search name or note…');
    await search.fill(needle);
    await expect(page.getByText(needle)).toBeVisible();
    await expect(page.getByText('$9.99').first()).toBeVisible();

    // Clear search and filter to Pending: our fresh record is pending → still visible
    await search.fill('');
    await page.locator('select').first().selectOption('pending');
    await search.fill(needle);
    await expect(page.getByText(needle)).toBeVisible();

    // Filter to Paid: our record is pending → must disappear
    await page.locator('select').first().selectOption('paid');
    await expect(page.getByText(needle)).toHaveCount(0);

    // Back to "All statuses", row still hyperlinks to detail
    await page.locator('select').first().selectOption('all');
    await expect(page.getByText(needle)).toBeVisible();

    // Verify link navigates to detail page
    await page.locator(`a[href="/requests/${id}"]`).first().click();
    await page.waitForURL(new RegExp(`/requests/${id}$`));
    await expect(page.getByText('$9.99').first()).toBeVisible();
  });

  test('Path 15 — Balance widget: Add and Subtract', async ({ page }) => {
    await login(page, DEMO.sarah);

    const start = await getBalanceCents(page);

    // Add $50
    await page.locator('input[type="number"][placeholder="0.00"]').fill('50');
    await page.getByRole('button', { name: '+ Add' }).click();
    // Widget re-renders with new balance via /api/user/balance POST; poll API for truth
    await expect
      .poll(async () => await getBalanceCents(page), { timeout: 10000 })
      .toBe(start + 5000);

    // Subtract $50 → back to start
    await page.locator('input[type="number"][placeholder="0.00"]').fill('50');
    await page.getByRole('button', { name: '− Sub' }).click();
    await expect
      .poll(async () => await getBalanceCents(page), { timeout: 10000 })
      .toBe(start);
  });
});
