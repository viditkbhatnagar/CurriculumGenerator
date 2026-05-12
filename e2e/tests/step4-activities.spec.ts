import { test, expect } from '@playwright/test';
import JSZip from 'jszip';
import { env, apiFetch } from './_env';

/**
 * Regression coverage for the Step 4 activities editor (Logan / LUC, 2026-05).
 *
 * Pure API round-trip — exercises the PUT /api/v3/workflow/:id/step4/module/:moduleId
 * route with the new contactActivities[] / independentActivities[] payload, plus
 * the rejection paths (oversize, invalid type, sanitization).
 *
 * Uses the syllabusWorkflowId fixture because that workflow has Step 4 fully
 * generated. The test is careful to snapshot the original arrays and restore
 * them in afterAll, so subsequent runs against the same workflow stay clean.
 */
test.describe('Step 4 activities editor', () => {
  let workflowId = '';
  let targetModuleId = '';
  let originalContact: string[] = [];
  let originalIndependent: string[] = [];
  let canRun = false;

  test.beforeAll(async () => {
    workflowId = env.syllabusWorkflowId;
    const res = await apiFetch(`/api/v3/workflow/${workflowId}`);
    if (!res.ok) return;
    const body = (await res.json()) as {
      data?: { step4?: { modules?: Array<Record<string, unknown>> } };
    };
    const modules = body.data?.step4?.modules || [];
    if (!modules.length) return;
    const first = modules[0] as Record<string, unknown>;
    targetModuleId = String(first.id);
    originalContact = Array.isArray(first.contactActivities)
      ? (first.contactActivities as string[]).slice()
      : [];
    originalIndependent = Array.isArray(first.independentActivities)
      ? (first.independentActivities as string[]).slice()
      : [];
    canRun = true;
  });

  test.afterAll(async () => {
    if (!canRun || !targetModuleId) return;
    // Restore the workflow's original arrays so test re-runs don't accrue
    // junk activities on the shared fixture.
    await apiFetch(`/api/v3/workflow/${workflowId}/step4/module/${targetModuleId}`, {
      method: 'PUT',
      body: JSON.stringify({
        contactActivities: originalContact,
        independentActivities: originalIndependent,
      }),
    }).catch(() => {});
  });

  test('PATCH contactActivities persists and round-trips on next GET', async () => {
    test.skip(!canRun, 'No Step 4 modules available on the fixture workflow');

    const stamp = Date.now();
    const next = [
      `E2E Lecture: orientation (${stamp})`,
      `E2E Workshop: practical (${stamp})`,
      `E2E Lab: simulation (${stamp})`,
    ];

    const putRes = await apiFetch(`/api/v3/workflow/${workflowId}/step4/module/${targetModuleId}`, {
      method: 'PUT',
      body: JSON.stringify({ contactActivities: next }),
    });
    expect(putRes.ok).toBeTruthy();

    const getRes = await apiFetch(`/api/v3/workflow/${workflowId}`);
    expect(getRes.ok).toBeTruthy();
    const body = (await getRes.json()) as {
      data?: { step4?: { modules?: Array<Record<string, unknown>> } };
    };
    const updated = body.data?.step4?.modules?.find((m) => String(m.id) === targetModuleId) as
      | Record<string, unknown>
      | undefined;
    expect(Array.isArray(updated?.contactActivities)).toBe(true);
    expect(updated?.contactActivities).toEqual(next);
  });

  test('Reordering activities round-trips in the new order', async () => {
    test.skip(!canRun, 'No Step 4 modules available');

    const stamp = Date.now();
    const a = `E2E A (${stamp})`;
    const b = `E2E B (${stamp})`;
    const c = `E2E C (${stamp})`;

    await apiFetch(`/api/v3/workflow/${workflowId}/step4/module/${targetModuleId}`, {
      method: 'PUT',
      body: JSON.stringify({ independentActivities: [a, b, c] }),
    });
    const reorderRes = await apiFetch(
      `/api/v3/workflow/${workflowId}/step4/module/${targetModuleId}`,
      {
        method: 'PUT',
        body: JSON.stringify({ independentActivities: [c, a, b] }),
      }
    );
    expect(reorderRes.ok).toBeTruthy();

    const getRes = await apiFetch(`/api/v3/workflow/${workflowId}`);
    const body = (await getRes.json()) as {
      data?: { step4?: { modules?: Array<Record<string, unknown>> } };
    };
    const updated = body.data?.step4?.modules?.find((m) => String(m.id) === targetModuleId) as
      | Record<string, unknown>
      | undefined;
    expect(updated?.independentActivities).toEqual([c, a, b]);
  });

  test('Sanitizer strips empty rows + rejects oversize arrays', async () => {
    test.skip(!canRun, 'No Step 4 modules available');

    // Note on HTML: the global sanitizeBody middleware (middleware/security.ts)
    // HTML-escapes every incoming string body field before our route handler
    // sees it, so <script> → &lt;script&gt; on the request side. Our route
    // sanitizer adds defence-in-depth, but its tag-strip regex is a no-op by
    // the time the request reaches us. The end state is safe (no executable
    // markup ever lands in storage); we just assert the empty-row + valid-row
    // filter, which is uniquely our route's responsibility.
    const dirty = ['', '   ', 'Tutorial (2h)'];
    const putRes = await apiFetch(`/api/v3/workflow/${workflowId}/step4/module/${targetModuleId}`, {
      method: 'PUT',
      body: JSON.stringify({ contactActivities: dirty }),
    });
    expect(putRes.ok).toBeTruthy();

    const getRes = await apiFetch(`/api/v3/workflow/${workflowId}`);
    const body = (await getRes.json()) as {
      data?: { step4?: { modules?: Array<Record<string, unknown>> } };
    };
    const updated = body.data?.step4?.modules?.find((m) => String(m.id) === targetModuleId) as
      | Record<string, unknown>
      | undefined;
    expect(updated?.contactActivities).toEqual(['Tutorial (2h)']);

    // Oversize → 400
    const tooMany = Array.from({ length: 51 }, (_, i) => `Item ${i}`);
    const overRes = await apiFetch(
      `/api/v3/workflow/${workflowId}/step4/module/${targetModuleId}`,
      {
        method: 'PUT',
        body: JSON.stringify({ contactActivities: tooMany }),
      }
    );
    expect(overRes.status).toBe(400);

    // Non-array → 400
    const badRes = await apiFetch(`/api/v3/workflow/${workflowId}/step4/module/${targetModuleId}`, {
      method: 'PUT',
      body: JSON.stringify({ contactActivities: 'not-an-array' }),
    });
    expect(badRes.status).toBe(400);
  });

  test('Word export reflects post-edit activities (200 + non-empty docx)', async () => {
    test.skip(!canRun, 'No Step 4 modules available');

    const stamp = Date.now();
    const marker = `E2E export marker ${stamp}`;
    await apiFetch(`/api/v3/workflow/${workflowId}/step4/module/${targetModuleId}`, {
      method: 'PUT',
      body: JSON.stringify({ contactActivities: [marker] }),
    });

    // Step 4 download endpoint — same one the frontend hits from
    // StepDownloadButton. We assert it returns a real docx so the
    // post-edit path is end-to-end exercised.
    const dlRes = await apiFetch(`/api/v3/workflow/${workflowId}/export/word/step/4`);
    expect(dlRes.ok).toBeTruthy();
    const buf = Buffer.from(await dlRes.arrayBuffer());
    expect(buf.length).toBeGreaterThan(1000);
    // .docx files are zip archives — they start with PK
    expect(buf.slice(0, 2).toString('latin1')).toBe('PK');
    // Unzip and confirm the marker is present in word/document.xml. A
    // raw byte-search on the zip won't work because document.xml is
    // DEFLATE-compressed inside the archive.
    const zip = await JSZip.loadAsync(buf);
    const docXml = await zip.file('word/document.xml')?.async('string');
    expect(docXml).toBeDefined();
    expect(docXml || '').toContain(marker);
  });
});
