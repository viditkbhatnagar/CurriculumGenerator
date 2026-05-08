/**
 * Centralised env config for the E2E suite.
 * All values are overridable via env so the suite runs against
 * local / staging / production without code changes.
 */

export const env = {
  frontendUrl: process.env.E2E_FRONTEND_URL || 'https://curriculum-frontend-xfyx.onrender.com',
  apiUrl: process.env.E2E_API_URL || 'https://curriculum-api-bsac.onrender.com',
  // Bearer token used for raw API calls in tests. Lazy-fetched via
  // /api/auth/login the first time apiFetch needs it.
  authToken: process.env.E2E_AUTH_TOKEN || '',
  adminEmail: process.env.E2E_ADMIN_EMAIL || 'loganpacey@gmail.com',
  adminPassword: process.env.E2E_ADMIN_PASSWORD || 'loganPacey123!',
  // Workflow that has reached currentStep=13 with step13 approved (so
  // step 14 is reachable). The default is the airline workflow used during
  // initial development. Override per environment.
  syllabusWorkflowId: process.env.E2E_SYLLABUS_WORKFLOW_ID || '69df99d849f3cbb71b41d901',
};

let cachedAdminToken: string | null = null;

async function getAdminToken(): Promise<string> {
  if (env.authToken) return env.authToken;
  if (cachedAdminToken) return cachedAdminToken;

  const res = await fetch(`${env.apiUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: env.adminEmail, password: env.adminPassword }),
  });
  if (!res.ok) {
    throw new Error(
      `E2E admin login failed (status ${res.status}). Set E2E_ADMIN_EMAIL/PASSWORD or E2E_AUTH_TOKEN.`
    );
  }
  const body = (await res.json()) as { token?: string };
  if (!body.token) throw new Error('Admin login response missing token');
  cachedAdminToken = body.token;
  return body.token;
}

/** Convenience for raw fetch against the backend with admin bearer. */
export async function apiFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  // Auto-attach the admin bearer unless one is already on the request OR the
  // request is the login itself.
  if (!headers.has('Authorization') && !path.startsWith('/api/auth/login')) {
    try {
      const token = await getAdminToken();
      headers.set('Authorization', `Bearer ${token}`);
    } catch {
      // Fall through — the endpoint may be public, or the test will assert
      // the unauthenticated response.
    }
  }
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(`${env.apiUrl}${path}`, { ...init, headers });
}
