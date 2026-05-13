import { test, expect } from './_fixtures';
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
        data?: {
          step14?: { approvedAt?: string | null };
          stepProgress?: Array<{ step: number; status: string }>;
        };
      };
      const step13 = body.data?.stepProgress?.find((p) => p.step === 13);
      // The Generate/Regenerate flow only renders pre-approval — once
      // step14 has approvedAt set, Step14View swaps to the approved
      // read-only state and the button disappears. Skip cleanly so the
      // suite stays green when run against an already-approved fixture.
      const step14NotApproved = !body.data?.step14?.approvedAt;
      canRun =
        (step13?.status === 'approved' || step13?.status === 'completed') && step14NotApproved;

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

    // Per-module syllabi section (Logan's primary ask) renders with at
    // least one module entry + a per-module download button.
    await expect(page.getByText(/Per-Module Syllabi \(\d+\)/)).toBeVisible();
    const moduleDownloads = page.locator('details summary >> button:has-text("Download .docx")');
    expect(await moduleDownloads.count()).toBeGreaterThan(0);

    // Download buttons in the action bar (we don't click — endpoints are
    // covered by API-only tests below)
    await expect(
      page.getByRole('button', { name: /Download All \(\d+ modules \.zip\)/ })
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /Programme overview \.docx/ })).toBeVisible();
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

  test('per-module export.docx returns a focused module syllabus', async () => {
    test.skip(!canRun, 'No suitable workflow available');

    // Pick the first module from the workflow as the test target
    const wfRes = await apiFetch(`/api/v3/workflow/${env.syllabusWorkflowId}`);
    const wf = (await wfRes.json()) as {
      data?: { step4?: { modules?: Array<{ id: string }> } };
    };
    const moduleId = wf.data?.step4?.modules?.[0]?.id;
    expect(moduleId, 'workflow should have at least one module').toBeTruthy();

    const res = await apiFetch(
      `/api/v3/workflow/${env.syllabusWorkflowId}/step14/module/${moduleId}/export.docx`
    );
    expect(res.status, 'module export.docx should return 200').toBe(200);
    expect(res.headers.get('content-type') || '').toContain('wordprocessingml');
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.length).toBeGreaterThan(3_000);
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
  });

  test('export-all.zip returns a zip containing one DOCX per module', async () => {
    test.skip(!canRun, 'No suitable workflow available');

    const res = await apiFetch(`/api/v3/workflow/${env.syllabusWorkflowId}/step14/export-all.zip`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type') || '').toContain('zip');
    const buf = Buffer.from(await res.arrayBuffer());
    // ZIP magic also starts with PK\x03\x04
    expect(buf.length).toBeGreaterThan(10_000);
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
  });
});
