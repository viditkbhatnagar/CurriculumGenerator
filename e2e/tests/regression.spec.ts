import { test, expect } from '@playwright/test';
import { env, apiFetch } from './_env';

/**
 * Regression checks for things that have broken before:
 *   - Step 10 module details still loads after the schema bump for ai_activity
 *   - The "View Details" button (the bug Logan reported) still scrolls into view
 *
 * These tests piggy-back on the same workflow as the syllabus suite so they
 * skip cleanly when no fixture is available.
 */
test.describe('Regression checks', () => {
  let canRun = false;

  test.beforeAll(async () => {
    try {
      const res = await apiFetch(`/api/v3/workflow/${env.syllabusWorkflowId}`);
      if (!res.ok) return;
      const body = (await res.json()) as {
        data?: { step10?: { moduleLessonPlans?: unknown[] } };
      };
      canRun = (body.data?.step10?.moduleLessonPlans?.length || 0) > 0;
    } catch {
      canRun = false;
    }
  });

  test('Step 10 module details panel still renders after Step 14 schema bump', async ({ page }) => {
    test.skip(!canRun, 'No workflow with step10 lesson plans available');

    await page.goto(`/workflow/${env.syllabusWorkflowId}`);
    await page.getByText('Lesson Plans').first().click();
    await expect(page.getByText('Module Generation Progress')).toBeVisible({ timeout: 30_000 });

    // Click first available "View Details" — the click + scroll fix from
    // an earlier session. Should reveal the module's lesson list.
    const viewBtn = page.getByRole('button', { name: /View Details/ }).first();
    await viewBtn.click();
    await expect(page.getByRole('heading', { name: /Lessons$/ })).toBeVisible({
      timeout: 20_000,
    });
  });
});
