import { test, expect } from '@playwright/test';
import { env, apiFetch } from './_env';

/**
 * Regression coverage for SME file uploads on Step 5 sources
 * (Athira / LUC, 2026-05-20). Files are stored in MongoDB GridFS via
 * POST /api/v3/files/upload and linked onto a manually-added source.
 *
 * Exercises: upload round-trip, content round-trip on download, the
 * source carrying the uploadedFile reference, type/size rejection, and
 * cleanup. afterAll removes anything the run created.
 */
test.describe('Step 5 file upload (GridFS)', () => {
  let token = '';
  let workflowId = '';
  let targetModuleId = '';
  const addedSourceIds: string[] = [];
  const addedFileIds: string[] = [];
  let canRun = false;

  // A tiny but valid PDF — enough bytes for the route + a recognisable body.
  const pdfBytes = Buffer.from(
    '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
    'utf-8'
  );

  test.beforeAll(async () => {
    const loginRes = await fetch(`${env.apiUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: env.adminEmail, password: env.adminPassword }),
    });
    if (!loginRes.ok) return;
    token = ((await loginRes.json()) as { token?: string }).token || '';

    workflowId = env.syllabusWorkflowId;
    const res = await apiFetch(`/api/v3/workflow/${workflowId}`);
    if (!res.ok) return;
    const body = (await res.json()) as {
      data?: { step4?: { modules?: Array<{ id: string }> }; step5?: unknown };
    };
    const modules = body.data?.step4?.modules || [];
    if (!modules.length || !body.data?.step5 || !token) return;
    targetModuleId = modules[0].id;
    canRun = true;
  });

  test.afterAll(async () => {
    for (const id of addedSourceIds) {
      await apiFetch(`/api/v3/workflow/${workflowId}/step5/source/${id}`, {
        method: 'DELETE',
      }).catch(() => {});
    }
    for (const id of addedFileIds) {
      await fetch(`${env.apiUrl}/api/v3/files/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
  });

  async function uploadFile(bytes: Buffer, name: string, mime: string) {
    const form = new FormData();
    form.append('file', new Blob([bytes], { type: mime }), name);
    // No Content-Type header — fetch sets the multipart boundary itself.
    return fetch(`${env.apiUrl}/api/v3/files/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
  }

  test('uploads a PDF to GridFS and downloads it back byte-for-byte', async () => {
    test.skip(!canRun, 'No Step 5 fixture / no token');

    const upRes = await uploadFile(pdfBytes, 'brand-guidelines.pdf', 'application/pdf');
    expect(upRes.status).toBe(201);
    const upBody = (await upRes.json()) as {
      success: boolean;
      data?: { fileId: string; filename: string; mimeType: string; size: number };
    };
    expect(upBody.success).toBe(true);
    expect(upBody.data?.fileId).toBeTruthy();
    expect(upBody.data?.filename).toBe('brand-guidelines.pdf');
    expect(upBody.data?.size).toBe(pdfBytes.length);
    addedFileIds.push(upBody.data!.fileId);

    // Download it back
    const dlRes = await fetch(`${env.apiUrl}/api/v3/files/${upBody.data!.fileId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(dlRes.ok).toBeTruthy();
    expect(dlRes.headers.get('content-type')).toContain('application/pdf');
    const dlBuf = Buffer.from(await dlRes.arrayBuffer());
    expect(dlBuf.equals(pdfBytes)).toBe(true);
  });

  test('rejects an unsupported file type with 400', async () => {
    test.skip(!canRun, 'No Step 5 fixture / no token');

    const res = await uploadFile(
      Buffer.from('MZ\x90\x00executable'),
      'malware.exe',
      'application/x-msdownload'
    );
    expect(res.status).toBe(400);
  });

  test('404s for a download of an unknown file id', async () => {
    test.skip(!canRun, 'No Step 5 fixture / no token');

    const res = await fetch(`${env.apiUrl}/api/v3/files/665f1a2b3c4d5e6f70819203`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(404);
  });

  test('a Step 5 source carries the uploadedFile reference end-to-end', async () => {
    test.skip(!canRun, 'No Step 5 fixture / no token');

    // 1. Upload a file
    const upRes = await uploadFile(pdfBytes, `e2e-attached-${Date.now()}.pdf`, 'application/pdf');
    expect(upRes.status).toBe(201);
    const file = ((await upRes.json()) as { data: { fileId: string; filename: string } }).data;
    addedFileIds.push(file.fileId);

    // 2. Add a source that references it
    const addRes = await apiFetch(`/api/v3/workflow/${workflowId}/step5/source`, {
      method: 'POST',
      body: JSON.stringify({
        moduleId: targetModuleId,
        title: `E2E source with file ${Date.now()}`,
        authors: ['Tester, A.'],
        year: 2024,
        resourceType: 'document',
        uploadedFile: {
          fileId: file.fileId,
          filename: file.filename,
          mimeType: 'application/pdf',
          size: pdfBytes.length,
        },
      }),
    });
    expect(addRes.status).toBe(201);
    const created = ((await addRes.json()) as { data: { id: string } }).data;
    addedSourceIds.push(created.id);

    // 3. GET the workflow — the source should carry the file pointer
    const wfRes = await apiFetch(`/api/v3/workflow/${workflowId}`);
    const wf = (await wfRes.json()) as {
      data?: { step5?: { sources?: Array<Record<string, any>> } };
    };
    const found = wf.data?.step5?.sources?.find((s) => s.id === created.id);
    expect(found).toBeDefined();
    expect(found?.uploadedFile?.fileId).toBe(file.fileId);
    expect(found?.uploadedFile?.filename).toBe(file.filename);
    expect(found?.userAdded).toBe(true);
  });
});
