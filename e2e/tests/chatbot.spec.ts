import { test, expect } from '@playwright/test';
import { env, apiFetch } from './_env';

/**
 * "Edit with VB" Curriculum AI Assistant.
 *
 * Costly to run (one OpenAI call per prompt → ~$0.05–0.20). The test:
 *   1. Snapshots PLO1's current statement.
 *   2. Asks the chatbot to change PLO1 to a known string.
 *   3. Asserts the Apply Changes button appears (i.e. AI returned proposedChanges).
 *   4. Clicks Apply, polls the API, asserts PLO1 actually changed.
 *   5. Restores PLO1 via the API so the workflow is left as we found it.
 *
 * Skip with E2E_SKIP_CHATBOT=1 when you don't want to spend tokens on a run.
 */
test.describe('Curriculum AI Assistant', () => {
  let canRun = false;
  let originalPlo1Statement = '';

  test.beforeAll(async () => {
    if (process.env.E2E_SKIP_CHATBOT === '1') return;
    try {
      const res = await apiFetch(`/api/v3/workflow/${env.syllabusWorkflowId}`);
      if (!res.ok) return;
      const body = (await res.json()) as {
        data?: { step3?: { outcomes?: Array<{ code: string; statement: string }> } };
      };
      const plo1 = body.data?.step3?.outcomes?.find((o) => o.code === 'PLO1');
      if (plo1?.statement) {
        originalPlo1Statement = plo1.statement;
        canRun = true;
      }
    } catch {
      canRun = false;
    }
  });

  test.afterAll(async () => {
    // Restore PLO1 to whatever it was before the test ran. Never leave the
    // shared workflow in test state.
    if (!canRun || !originalPlo1Statement) return;
    await apiFetch(`/api/v3/workflow/${env.syllabusWorkflowId}/apply-edit`, {
      method: 'POST',
      body: JSON.stringify({
        stepNumber: 3,
        newContent: {
          updates: [
            {
              step: 3,
              path: 'outcomes',
              action: 'update',
              match: { code: 'PLO1' },
              changes: { statement: originalPlo1Statement },
            },
          ],
        },
      }),
    });
  });

  test('edit prompt → Apply Changes → PLO1 updated in DB', async ({ page }) => {
    test.skip(!canRun, 'No workflow with step 3 PLOs available, or chatbot tests opted out');

    const newStatement =
      'Apply data-driven analytics frameworks to inform retail and customer-journey decisions across the program.';

    await page.goto(`/workflow/${env.syllabusWorkflowId}`);
    await page.getByText('Program Learning Outcomes').first().click();

    // Open the floating "Edit with VB" panel and switch to the Chat tab
    await page.getByRole('button', { name: 'Edit with VB', exact: true }).click();
    await page.locator('button:has-text("Chat (")').first().click();

    // Send an unambiguous edit prompt — the AI's system prompt routes "change X to Y"
    // to proposedChanges (auto-apply) rather than suggestions (copy/paste).
    const input = page
      .locator('textarea[placeholder*="changes" i], textarea[placeholder*="edit" i]')
      .first();
    await input.fill(`Change PLO1 to: "${newStatement}"`);
    await input.press('Enter');

    // Wait for either the Apply button (success path) or any visible AI text.
    // The AI call typically lands in 15–30s.
    const applyBtn = page.getByRole('button', { name: /Apply Changes|✓ Apply/ }).first();
    await expect(applyBtn).toBeVisible({ timeout: 90_000 });

    await applyBtn.click();

    // Poll the API until the change shows up (or fail at 30s)
    await expect
      .poll(
        async () => {
          const res = await apiFetch(`/api/v3/workflow/${env.syllabusWorkflowId}`);
          if (!res.ok) return null;
          const body = (await res.json()) as {
            data?: { step3?: { outcomes?: Array<{ code: string; statement: string }> } };
          };
          return body.data?.step3?.outcomes?.find((o) => o.code === 'PLO1')?.statement;
        },
        { timeout: 30_000, intervals: [1_000, 2_000, 3_000] }
      )
      .toBe(newStatement);
  });

  test('apply-edit endpoint rejects updates that do not match anything', async () => {
    test.skip(!canRun, 'No workflow available');

    // Point the match at a code that doesn't exist. The fixed handler should
    // return 400 with rejected[] — previously this silently 200'd.
    const res = await apiFetch(`/api/v3/workflow/${env.syllabusWorkflowId}/apply-edit`, {
      method: 'POST',
      body: JSON.stringify({
        stepNumber: 3,
        newContent: {
          updates: [
            {
              step: 3,
              path: 'outcomes',
              action: 'update',
              match: { code: 'PLO_DOES_NOT_EXIST_42' },
              changes: { statement: 'should not land' },
            },
          ],
        },
      }),
    });
    expect(res.status, 'silent-fail bug fix should return 400').toBe(400);
    const body = (await res.json()) as { rejected?: unknown[]; appliedCount?: number };
    expect(body.appliedCount).toBe(0);
    expect(Array.isArray(body.rejected)).toBe(true);
  });
});
