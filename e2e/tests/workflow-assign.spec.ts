import { test, expect } from '@playwright/test';
import { env, apiFetch } from './_env';

/**
 * Regression test for the workflow reassignment feature Logan asked for on
 * 2026-05-11. Admin can transfer ownership of a workflow to a faculty
 * member, the faculty then sees it on /workflow, and non-admins cannot
 * call the endpoint.
 *
 * Pure API test — no page nav needed.
 */
test.describe('Workflow reassignment', () => {
  let testFacultyEmail = '';
  let testFacultyId = '';
  let testFacultyPassword = '';
  let testWorkflowId = '';
  let facultyToken = '';

  test.beforeAll(async () => {
    testFacultyEmail = `assign-e2e-${Date.now()}@example.test`;

    const inviteRes = await apiFetch('/api/users/invite-faculty', {
      method: 'POST',
      body: JSON.stringify({
        email: testFacultyEmail,
        profile: { firstName: 'Assign', lastName: 'E2E' },
      }),
    });
    expect(inviteRes.ok).toBeTruthy();
    const invite = (await inviteRes.json()) as {
      user: { id: string };
      generatedPassword: string;
    };
    testFacultyId = invite.user.id;
    testFacultyPassword = invite.generatedPassword;

    const createRes = await apiFetch('/api/v3/workflow', {
      method: 'POST',
      body: JSON.stringify({ projectName: `Assign-E2E-${Date.now()}` }),
    });
    expect(createRes.ok).toBeTruthy();
    const created = (await createRes.json()) as { data?: { _id: string }; _id?: string };
    testWorkflowId = created.data?._id || created._id || '';
    expect(testWorkflowId).toBeTruthy();
  });

  test.afterAll(async () => {
    if (testWorkflowId) {
      await apiFetch(`/api/v3/workflow/${testWorkflowId}`, { method: 'DELETE' }).catch(() => {});
    }
    if (testFacultyId) {
      await apiFetch(`/api/users/${testFacultyId}`, { method: 'DELETE' }).catch(() => {});
    }
  });

  test('admin can reassign a workflow to a faculty member', async () => {
    const res = await apiFetch(`/api/v3/workflow/${testWorkflowId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ userId: testFacultyId }),
    });
    expect(res.ok).toBeTruthy();
    const body = (await res.json()) as {
      success: boolean;
      data?: { newOwner?: { email?: string } };
    };
    expect(body.success).toBe(true);
    expect(body.data?.newOwner?.email).toBe(testFacultyEmail);
  });

  test('faculty sees the reassigned workflow in their list', async () => {
    // Sign in as the faculty member directly against the API.
    const loginRes = await fetch(`${env.apiUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testFacultyEmail, password: testFacultyPassword }),
    });
    expect(loginRes.ok).toBeTruthy();
    const loginBody = (await loginRes.json()) as { token?: string };
    expect(loginBody.token).toBeTruthy();
    facultyToken = loginBody.token!;

    const listRes = await fetch(`${env.apiUrl}/api/v3/workflow`, {
      headers: { Authorization: `Bearer ${facultyToken}` },
    });
    expect(listRes.ok).toBeTruthy();
    const list = (await listRes.json()) as
      | { data?: Array<{ _id: string }> }
      | Array<{ _id: string }>;
    const wfs = Array.isArray(list) ? list : list.data || [];
    const found = wfs.some((w) => String(w._id) === testWorkflowId);
    expect(found).toBe(true);
  });

  test('non-admin cannot reassign workflows', async () => {
    // facultyToken was set in the previous test; if it's empty fall back.
    if (!facultyToken) {
      const loginRes = await fetch(`${env.apiUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testFacultyEmail, password: testFacultyPassword }),
      });
      const loginBody = (await loginRes.json()) as { token?: string };
      facultyToken = loginBody.token || '';
    }

    const res = await fetch(`${env.apiUrl}/api/v3/workflow/${testWorkflowId}/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${facultyToken}`,
      },
      body: JSON.stringify({ userId: testFacultyId }),
    });
    expect(res.status).toBe(403);
  });
});
