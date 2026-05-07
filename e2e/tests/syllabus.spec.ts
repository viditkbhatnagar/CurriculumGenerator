import { test, expect } from '@playwright/test';
import { env, apiFetch } from './_env';

/**
 * Step 14 (Course Syllabus) verification.
 *
 * Depends on a workflow that has reached currentStep=13 with step13 approved
 * (so the sidebar gate allows navigation to Step 14). The workflow id is
 * configurable via E2E_SYLLABUS_WORKFLOW_ID. If no suitable workflow is
 * available the whole describe block is skipped — failure should mean
 * "the feature is broken", not "test fixture deleted".
 */
test.describe('Step 14: Course Syllabus', () => {
  let canRun = false;

  test.beforeAll(async () => {
    try {
      const res = await apiFetch(`/api/v3/workflow/${env.syllabusWorkflowId}`);
      if (!res.ok) return;
      const body = (await res.json()) as {
        data?: { stepProgress?: Array<{ step: number; status: string }> };
      };
      const step13 = body.data?.stepProgress?.find((p) => p.step === 13);
      canRun = step13?.status === 'approved' || step13?.status === 'completed';

      if (canRun) {
        // Pre-save instructor + schedule so the form is hydrated. Idempotent.
        await apiFetch(`/api/v3/workflow/${env.syllabusWorkflowId}/step14`, {
          method: 'PUT',
          body: JSON.stringify({
            instructor: {
              name: 'Dr. E2E Tester',
              email: 'e2e-tester@example.test',
              title: 'Adjunct Faculty',
              preferredCommunication: 'Email',
              expectedResponseTime: 'Within 24 hours on weekdays',
              officeHours: 'Wed 4–5 PM',
              officeLocation: 'Online',
            },
            courseNumber: 'E2E 101',
            semester: 'E2E Term',
            meetingPattern: 'Tue Thu 2:00 PM',
            meetingLocation: 'Test Studio',
            startDate: '2027-01-15',
            numWeeks: 14,
            sessionsPerWeek: 2,
            examSchedule: [
              { name: 'Midterm', date: '2027-02-26', weight: 25 },
              { name: 'Final Project', date: '2027-04-23', weight: 35 },
            ],
          }),
        });
      }
    } catch {
      canRun = false;
    }
  });

  test('sidebar nav → form pre-fills → generate → preview renders', async ({ page }) => {
    test.skip(
      !canRun,
      `No workflow at currentStep=13 (need E2E_SYLLABUS_WORKFLOW_ID to point at one with step 13 approved)`
    );

    await page.goto(`/workflow/${env.syllabusWorkflowId}`);

    // Sidebar entry → click into Step 14
    await page.getByText('Course Syllabus').first().click();
    // The "Step 14" string also appears in the page header; scope to the
    // Step14View's own heading to avoid the strict-mode collision.
    await expect(
      page.getByRole('heading', { name: 'Step 14: Course Syllabus' }).first()
    ).toBeVisible({ timeout: 30_000 });

    // Pre-saved instructor name is in one of the form inputs
    await expect(page.locator('input[type="text"][value="Dr. E2E Tester"]').first()).toBeVisible();

    // Click Generate (button label changes once a syllabus already exists)
    await page.getByRole('button', { name: /Generate Syllabus|Regenerate Syllabus/ }).click();

    // Preview heading + populated outcomes/schedule
    await expect(page.getByText('Generated Syllabus Preview')).toBeVisible({
      timeout: 90_000,
    });

    const previewSection = page
      .locator('text=Generated Syllabus Preview')
      .locator('xpath=ancestor::section');
    await expect(previewSection.locator('ol > li').first()).toBeVisible();
    await expect(previewSection.locator('table tbody tr').first()).toBeVisible();

    // Download button is rendered (we don't actually download in CI to keep the
    // test fast and avoid juggling browser download events; the endpoint is
    // covered by an API-only test below).
    await expect(page.getByRole('button', { name: /Download \.docx/ })).toBeVisible();
  });

  test('export.docx endpoint returns a real Word document', async () => {
    test.skip(!canRun, 'No suitable workflow available');

    const res = await apiFetch(`/api/v3/workflow/${env.syllabusWorkflowId}/step14/export.docx`);
    expect(res.status, 'export.docx should return 200').toBe(200);

    const ct = res.headers.get('content-type') || '';
    expect(ct).toContain('wordprocessingml');

    const buf = Buffer.from(await res.arrayBuffer());
    // DOCX is a ZIP — the magic bytes start with PK\x03\x04
    expect(buf.length, 'DOCX should be at least 5KB').toBeGreaterThan(5_000);
    expect(buf[0]).toBe(0x50); // P
    expect(buf[1]).toBe(0x4b); // K
    expect(buf[2]).toBe(0x03);
    expect(buf[3]).toBe(0x04);
  });
});
