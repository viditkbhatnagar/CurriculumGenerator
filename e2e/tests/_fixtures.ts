import { test as base, expect } from '@playwright/test';
import { apiFetch } from './_env';

/**
 * Custom Playwright fixture that pre-authenticates each test as the
 * superadmin. Logs in via the API once per test, plants the JWT into the
 * page's localStorage before any navigation, and the app boots already
 * signed in (AuthContext picks up the token in /me).
 *
 * Tests that explicitly want to drive the login UI (auth-admin.spec.ts)
 * should import from `@playwright/test` directly instead of this file.
 */

const adminEmail = process.env.E2E_ADMIN_EMAIL || 'loganpacey@gmail.com';
const adminPassword = process.env.E2E_ADMIN_PASSWORD || 'loganPacey123!';

export const test = base.extend<Record<string, never>>({
  page: async ({ page }, use) => {
    // Get a fresh admin JWT once and stash it in localStorage for this page.
    const loginRes = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: adminEmail, password: adminPassword }),
    });
    if (!loginRes.ok) {
      throw new Error(
        `E2E admin login failed (status ${loginRes.status}). ` +
          `Make sure SUPERADMIN_EMAIL/PASSWORD are seeded on the backend.`
      );
    }
    const body = (await loginRes.json()) as { token?: string };
    if (!body.token) throw new Error('Admin login response missing token');

    await page.addInitScript((token: string) => {
      try {
        localStorage.setItem('auth_token', token);
      } catch {
        /* ignore */
      }
    }, body.token);

    await use(page);
  },
});

export { expect };
