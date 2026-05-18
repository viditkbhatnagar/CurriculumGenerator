import { test, expect } from '@playwright/test';
import { env, apiFetch } from './_env';

/**
 * Regression coverage for the Step 6 "add a reading manually" feature
 * (Logan / LUC, 2026-05-17).
 *
 * Pure API round-trip — exercises POST + DELETE on the new route,
 * and the rejection paths (missing fields, bad year, non-existent
 * module). Cleans up any rows it adds in afterAll so re-runs stay
 * deterministic against the shared syllabusWorkflowId fixture.
 */
test.describe('Step 6 add reading', () => {
  let workflowId = '';
  let targetModuleId = '';
  const addedIds: string[] = [];
  let canRun = false;

  test.beforeAll(async () => {
    workflowId = env.syllabusWorkflowId;
    const res = await apiFetch(`/api/v3/workflow/${workflowId}`);
    if (!res.ok) return;
    const body = (await res.json()) as {
      data?: {
        step4?: { modules?: Array<{ id: string }> };
        step6?: unknown;
      };
    };
    const modules = body.data?.step4?.modules || [];
    if (!modules.length || !body.data?.step6) return;
    targetModuleId = modules[0].id;
    canRun = true;
  });

  test.afterAll(async () => {
    for (const id of addedIds) {
      await apiFetch(`/api/v3/workflow/${workflowId}/step6/reading/${id}`, {
        method: 'DELETE',
      }).catch(() => {});
    }
  });

  test('POST adds a reading, GET returns it with userAdded=true', async () => {
    test.skip(!canRun, 'No Step 6 on the fixture workflow');

    const stamp = Date.now();
    const payload = {
      moduleId: targetModuleId,
      title: `E2E manual reading ${stamp}`,
      authors: ['Tester, A.', 'Tester, B.'],
      year: 2024,
      category: 'supplementary',
      contentType: 'journal_article',
      readingType: 'applied',
      estimatedReadingMinutes: 45,
      url: 'https://example.com/e2e',
      pageRange: 'pp. 1-12',
      notes: 'Added by e2e test',
    };

    const postRes = await apiFetch(`/api/v3/workflow/${workflowId}/step6/reading`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    expect(postRes.status).toBe(201);
    const postBody = (await postRes.json()) as {
      success: boolean;
      data?: { id: string; userAdded?: boolean; agiCompliant?: boolean };
    };
    expect(postBody.success).toBe(true);
    expect(postBody.data?.id).toBeTruthy();
    expect(postBody.data?.userAdded).toBe(true);
    expect(postBody.data?.agiCompliant).toBe(false);

    const newId = postBody.data!.id;
    addedIds.push(newId);

    // Round-trip on GET
    const getRes = await apiFetch(`/api/v3/workflow/${workflowId}`);
    const body = (await getRes.json()) as {
      data?: { step6?: { readings?: Array<Record<string, unknown>> } };
    };
    const found = body.data?.step6?.readings?.find((r) => r.id === newId);
    expect(found).toBeDefined();
    expect((found as { userAdded?: boolean }).userAdded).toBe(true);
    expect((found as { title?: string }).title).toBe(payload.title);
  });

  test('POST rejects missing required fields with 400', async () => {
    test.skip(!canRun, 'No Step 6 on the fixture workflow');

    const cases = [
      { ...baseValid(targetModuleId), title: '' },
      { ...baseValid(targetModuleId), authors: [] },
      { ...baseValid(targetModuleId), year: 'not a number' },
      { ...baseValid(targetModuleId), category: 'maybe' },
      { ...baseValid(targetModuleId), moduleId: '' },
    ];
    for (const body of cases) {
      const res = await apiFetch(`/api/v3/workflow/${workflowId}/step6/reading`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      expect(res.status).toBe(400);
    }
  });

  test('POST rejects unknown moduleId with 400', async () => {
    test.skip(!canRun, 'No Step 6 on the fixture workflow');

    const res = await apiFetch(`/api/v3/workflow/${workflowId}/step6/reading`, {
      method: 'POST',
      body: JSON.stringify({ ...baseValid(targetModuleId), moduleId: 'does-not-exist' }),
    });
    expect(res.status).toBe(400);
  });

  test('DELETE removes a reading and decrements counts', async () => {
    test.skip(!canRun, 'No Step 6 on the fixture workflow');

    // Add one, then delete it
    const postRes = await apiFetch(`/api/v3/workflow/${workflowId}/step6/reading`, {
      method: 'POST',
      body: JSON.stringify({
        ...baseValid(targetModuleId),
        title: `E2E to-be-deleted ${Date.now()}`,
      }),
    });
    expect(postRes.status).toBe(201);
    const { data } = (await postRes.json()) as { data: { id: string } };

    const beforeRes = await apiFetch(`/api/v3/workflow/${workflowId}`);
    const before = (await beforeRes.json()) as {
      data?: { step6?: { totalReadings?: number } };
    };
    const beforeCount = before.data?.step6?.totalReadings ?? 0;

    const delRes = await apiFetch(`/api/v3/workflow/${workflowId}/step6/reading/${data.id}`, {
      method: 'DELETE',
    });
    expect(delRes.ok).toBeTruthy();

    const afterRes = await apiFetch(`/api/v3/workflow/${workflowId}`);
    const after = (await afterRes.json()) as {
      data?: { step6?: { totalReadings?: number; readings?: Array<{ id: string }> } };
    };
    const afterCount = after.data?.step6?.totalReadings ?? 0;
    expect(afterCount).toBe(beforeCount - 1);
    expect(after.data?.step6?.readings?.find((r) => r.id === data.id)).toBeUndefined();
  });
});

function baseValid(moduleId: string) {
  return {
    moduleId,
    title: 'Valid title',
    authors: ['Tester, A.'],
    year: 2024,
    category: 'core',
    contentType: 'textbook_chapter',
    readingType: 'academic',
    estimatedReadingMinutes: 60,
  };
}
