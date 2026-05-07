/**
 * Centralised env config for the E2E suite.
 * All values are overridable via env so the suite runs against
 * local / staging / production without code changes.
 */

export const env = {
  frontendUrl: process.env.E2E_FRONTEND_URL || 'https://curriculum-frontend-xfyx.onrender.com',
  apiUrl: process.env.E2E_API_URL || 'https://curriculum-api-bsac.onrender.com',
  // Optional auth bearer for environments where Auth0 enforcement is on.
  // Leave unset against the default mock-admin prod deploy.
  authToken: process.env.E2E_AUTH_TOKEN || '',
  // Workflow that has reached currentStep=13 with step13 approved (so
  // step 14 is reachable). The default is the airline workflow used during
  // initial development. Override per environment.
  syllabusWorkflowId: process.env.E2E_SYLLABUS_WORKFLOW_ID || '69df99d849f3cbb71b41d901',
};

/** Convenience for raw fetch against the backend with optional bearer. */
export async function apiFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (env.authToken) headers.set('Authorization', `Bearer ${env.authToken}`);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(`${env.apiUrl}${path}`, { ...init, headers });
}
