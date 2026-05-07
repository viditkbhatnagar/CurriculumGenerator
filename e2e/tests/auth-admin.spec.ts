import { test, expect } from '@playwright/test';

/**
 * Faculty allowlist admin UI.
 * Creates a unique test invite, asserts it appears in the table, then
 * revokes it and asserts the row disappears. Each run uses a timestamped
 * email so concurrent CI runs don't collide on the same row.
 */
test.describe('Faculty admin UI', () => {
  const testEmail = `playwright-test-${Date.now()}@example.test`;

  test('invite → appears in list → revoke → gone', async ({ page }) => {
    await page.goto('/admin/faculty');
    await expect(page.getByRole('heading', { name: /Faculty Management/i })).toBeVisible();

    // Invite
    await page.getByPlaceholder(/email@university\.edu/i).fill(testEmail);
    await page.getByPlaceholder(/First name/i).fill('Playwright');
    await page.getByPlaceholder(/Last name/i).fill('Tester');
    await page.getByRole('button', { name: /^Invite$/ }).click();

    // Row should appear
    const row = page.locator(`tr:has-text("${testEmail}")`);
    await expect(row).toBeVisible({ timeout: 15_000 });

    // Revoke (auto-accept the confirm dialog)
    page.once('dialog', (d) => d.accept());
    await row.locator('button:has-text("Revoke")').click();

    // Row should disappear
    await expect(row).toHaveCount(0, { timeout: 15_000 });
  });
});
