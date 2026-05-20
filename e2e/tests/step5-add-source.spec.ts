import { test, expect } from '@playwright/test';
import { env, apiFetch } from './_env';

/**
 * Regression coverage for the Step 5 "add a source manually" feature
 * (Athira / LUC, 2026-05-18) — SMEs adding documents, YouTube links,
 * e-books, articles, physical books that the AI pipeline didn't surface.
 *
 * Pure API round-trip — POST + DELETE on the new route plus the
 * rejection paths. Cleans up rows it adds in afterAll so re-runs stay
 * deterministic against the shared syllabusWorkflowId fixture.
 */
test.describe('Step 5 add source', () => {
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
        step5?: unknown;
      };
    };
    const modules = body.data?.step4?.modules || [];
    if (!modules.length || !body.data?.step5) return;
    targetModuleId = modules[0].id;
    canRun = true;
  });

  test.afterAll(async () => {
    for (const id of addedIds) {
      await apiFetch(`/api/v3/workflow/${workflowId}/step5/source/${id}`, {
        method: 'DELETE',
      }).catch(() => {});
    }
  });

  test('POST adds a YouTube-video source, GET returns it with userAdded=true', async () => {
    test.skip(!canRun, 'No Step 5 on the fixture workflow');

    const stamp = Date.now();
    const payload = {
      moduleId: targetModuleId,
      title: `E2E manual source ${stamp}`,
      authors: ['Vogue'],
      year: 2024,
      resourceType: 'video',
      type: 'industry',
      url: 'https://www.youtube.com/watch?v=e2e',
      complianceNotes: 'Added by e2e test',
    };

    const postRes = await apiFetch(`/api/v3/workflow/${workflowId}/step5/source`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    expect(postRes.status).toBe(201);
    const postBody = (await postRes.json()) as {
      success: boolean;
      data?: { id: string; userAdded?: boolean; agiCompliant?: boolean; resourceType?: string };
    };
    expect(postBody.success).toBe(true);
    expect(postBody.data?.userAdded).toBe(true);
    expect(postBody.data?.agiCompliant).toBe(false);
    expect(postBody.data?.resourceType).toBe('video');

    const newId = postBody.data!.id;
    addedIds.push(newId);

    const getRes = await apiFetch(`/api/v3/workflow/${workflowId}`);
    const body = (await getRes.json()) as {
      data?: { step5?: { sources?: Array<Record<string, unknown>> } };
    };
    const found = body.data?.step5?.sources?.find((s) => s.id === newId);
    expect(found).toBeDefined();
    expect((found as { userAdded?: boolean }).userAdded).toBe(true);
    expect((found as { title?: string }).title).toBe(payload.title);
  });

  test('POST rejects missing / invalid fields with 400', async () => {
    test.skip(!canRun, 'No Step 5 on the fixture workflow');

    const cases = [
      { ...baseValid(targetModuleId), title: '' },
      { ...baseValid(targetModuleId), authors: [] },
      { ...baseValid(targetModuleId), year: 'not a number' },
      { ...baseValid(targetModuleId), resourceType: 'podcast' },
      { ...baseValid(targetModuleId), moduleId: '' },
      { ...baseValid(targetModuleId), moduleId: 'does-not-exist' },
    ];
    for (const body of cases) {
      const res = await apiFetch(`/api/v3/workflow/${workflowId}/step5/source`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      expect(res.status).toBe(400);
    }
  });

  test('DELETE removes a source and decrements totalSources', async () => {
    test.skip(!canRun, 'No Step 5 on the fixture workflow');

    const postRes = await apiFetch(`/api/v3/workflow/${workflowId}/step5/source`, {
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
      data?: { step5?: { totalSources?: number } };
    };
    const beforeCount = before.data?.step5?.totalSources ?? 0;

    const delRes = await apiFetch(`/api/v3/workflow/${workflowId}/step5/source/${data.id}`, {
      method: 'DELETE',
    });
    expect(delRes.ok).toBeTruthy();

    const afterRes = await apiFetch(`/api/v3/workflow/${workflowId}`);
    const after = (await afterRes.json()) as {
      data?: { step5?: { totalSources?: number; sources?: Array<{ id: string }> } };
    };
    expect(after.data?.step5?.totalSources ?? 0).toBe(beforeCount - 1);
    expect(after.data?.step5?.sources?.find((s) => s.id === data.id)).toBeUndefined();
  });
});

function baseValid(moduleId: string) {
  return {
    moduleId,
    title: 'Valid source title',
    authors: ['Wheeler, A.'],
    year: 2024,
    resourceType: 'book',
    type: 'applied',
  };
}
