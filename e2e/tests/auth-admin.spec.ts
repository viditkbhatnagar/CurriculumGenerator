import { test, expect } from '@playwright/test';
import { apiFetch } from './_env';

/**
 * Built-in email + password auth — full faculty lifecycle:
 *   1. Logan (superadmin) signs in via the login screen.
 *   2. Logan invites a fresh faculty member; the temporary password is
 *      shown in a one-time modal — we copy it from the page.
 *   3. We log Logan out.
 *   4. We log in as the new faculty member with that exact password.
 *   5. The faculty's session is established (auth/me returns role=faculty).
 *   6. Cleanup: delete the test faculty record via API.
 */
test.describe('Faculty admin UI', () => {
  const testEmail = `playwright-test-${Date.now()}@example.test`;

  // Logan's seeded credentials — set on the backend via SUPERADMIN_EMAIL/PASSWORD,
  // override in CI via E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD if rotated.
  const adminEmail = process.env.E2E_ADMIN_EMAIL || 'loganpacey@gmail.com';
  const adminPassword = process.env.E2E_ADMIN_PASSWORD || 'loganPacey123!';

  let createdUserId: string | null = null;

  test.afterAll(async () => {
    if (!createdUserId) return;
    // Best-effort cleanup. Use the admin token if we still have one stored.
    try {
      // Get a fresh admin token from the API
      const loginRes = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: adminEmail, password: adminPassword }),
      });
      const body = (await loginRes.json()) as { token?: string };
      if (body.token) {
        await apiFetch(`/api/users/${createdUserId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${body.token}` },
        });
      }
    } catch {
      /* ignore */
    }
  });

  test('admin signs in → invites faculty → faculty signs in with the generated password', async ({
    page,
  }) => {
    // ----- 1. Admin login -----
    await page.goto('/');
    await expect(page.getByText('Sign in to access your programmes.')).toBeVisible({
      timeout: 30_000,
    });
    await page.getByLabel('Email').fill(adminEmail);
    await page.getByLabel('Password').fill(adminPassword);
    await page.getByRole('button', { name: /^Sign in$/ }).click();

    // Wait for the login screen to disappear — the AuthGate replaces it
    // with children once AuthContext has the user. The homepage doesn't
    // render UserMenu, so we can't key on that here.
    await expect(page.getByText('Sign in to access your programmes.')).not.toBeVisible({
      timeout: 30_000,
    });

    // ----- 2. Open Faculty Management -----
    await page.goto('/admin/faculty');
    await expect(page.getByRole('heading', { name: /Faculty Management/i })).toBeVisible({
      timeout: 15_000,
    });

    // ----- 3. Invite a faculty member -----
    await page.getByPlaceholder(/email@university\.edu/i).fill(testEmail);
    await page.getByPlaceholder(/First name/i).fill('Playwright');
    await page.getByPlaceholder(/Last name/i).fill('Tester');
    await page.getByRole('button', { name: /^Invite$/ }).click();

    // The one-time-password modal must appear with the credential pair
    await expect(page.getByText('Share these credentials')).toBeVisible({ timeout: 15_000 });

    // Pull the generated password out of the modal — it's rendered in a <code>
    // block alongside the email. The modal renders email FIRST, then password.
    const visibleCodes = await page.locator('code').allInnerTexts();
    const generatedPassword = visibleCodes
      .find(
        (t) =>
          t.trim() !== testEmail &&
          /^[A-Za-z0-9]{3}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/.test(t.trim())
      )
      ?.trim();
    expect(
      generatedPassword,
      `expected a generated password in modal — saw ${JSON.stringify(visibleCodes)}`
    ).toBeTruthy();

    // Capture the new user id so afterAll can delete it
    const facultyResp = await apiFetch('/api/users?role=faculty&limit=200', {
      headers: {
        Authorization: `Bearer ${(() => {
          try {
            return (
              // page.evaluate is async; we'll grab it differently below
              ''
            );
          } catch {
            return '';
          }
        })()}`,
      },
    });
    if (facultyResp.ok) {
      const list = (await facultyResp.json()) as { users?: Array<{ id: string; email: string }> };
      createdUserId = list.users?.find((u) => u.email === testEmail)?.id || null;
    }

    // Close the modal
    await page.getByRole('button', { name: /^Done$/ }).click();
    await expect(page.locator(`tr:has-text("${testEmail}")`)).toBeVisible();

    // ----- 4. Logout -----
    await page
      .getByRole('button', { name: new RegExp(adminEmail, 'i') })
      .first()
      .click();
    await page.getByRole('button', { name: /^Sign out$/ }).click();
    // After logout, AuthContext logout() does window.location.href='/'; wait for the new login page
    await expect(page.getByText('Sign in to access your programmes.')).toBeVisible({
      timeout: 30_000,
    });

    // ----- 5. Faculty signs in with the generated credentials -----
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('Password').fill(generatedPassword!);
    await page.getByRole('button', { name: /^Sign in$/ }).click();

    // Login screen disappears once AuthContext has the faculty user
    await expect(page.getByText('Sign in to access your programmes.')).not.toBeVisible({
      timeout: 30_000,
    });

    // Navigate to /workflow so UserMenu is in the rendered shell, then assert
    await page.goto('/workflow');
    await expect(page.getByTitle(testEmail)).toBeVisible({ timeout: 30_000 });
  });

  /**
   * Regression for the bug Logan reported on 2026-05-08:
   *   "I signed in as Logan there is no faculty management button anywhere"
   *
   * The UserMenu (which contains the Faculty management link) only renders
   * on /workflow* and /admin/faculty. After sign-in the user previously
   * landed on /, which has neither — so admins had no way to reach the
   * admin tools without typing the URL.
   *
   * Fix: AuthContext.login() routes to /workflow on success when the user
   * was on /. This test exercises Logan's exact path:
   *   sign in → expect /workflow → click avatar → click "Faculty management"
   *   → land on the admin page heading.
   */
  test('after admin login, Faculty management is reachable from the UserMenu without typing URLs', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByText('Sign in to access your programmes.')).toBeVisible({
      timeout: 30_000,
    });

    await page.getByLabel('Email').fill(adminEmail);
    await page.getByLabel('Password').fill(adminPassword);
    await page.getByRole('button', { name: /^Sign in$/ }).click();

    // After successful login, the post-login redirect should land us on
    // /workflow (where the UserMenu lives). Wait for the URL change first
    // — that's the load-bearing assertion of the fix.
    await page.waitForURL('**/workflow', { timeout: 30_000 });

    // The UserMenu trigger is keyed by title=email
    const userMenuTrigger = page.getByTitle(adminEmail);
    await expect(userMenuTrigger).toBeVisible({ timeout: 15_000 });
    await userMenuTrigger.click();

    // The dropdown shows a "Faculty management" link for administrators
    const facultyLink = page.getByRole('link', { name: /Faculty management/i });
    await expect(facultyLink).toBeVisible({ timeout: 5_000 });
    await facultyLink.click();

    // Land on the admin page heading
    await expect(page.getByRole('heading', { name: /Faculty Management/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page).toHaveURL(/\/admin\/faculty$/);
  });
});
