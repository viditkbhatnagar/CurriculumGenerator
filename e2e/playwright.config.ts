import { defineConfig, devices } from '@playwright/test';

/**
 * E2E config for the Curriculum Generator app.
 *
 * URLs are env-driven so the same suite runs against local / staging / prod.
 * Defaults point at the production Render deploys.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // Auth/admin tests touch shared DB rows; serial keeps them deterministic
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  timeout: 120_000, // per-test cap — the longest meaningful path (Step 14 generate cold) is ~30s
  expect: {
    timeout: 15_000,
  },

  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }], ['github']]
    : [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: process.env.E2E_FRONTEND_URL || 'https://curriculum-frontend-xfyx.onrender.com',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 60_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
