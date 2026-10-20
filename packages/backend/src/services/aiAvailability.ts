/**
 * Shared by every long-running AI job (lesson plans, book ingestion): an error that will fail
 * every later call too must stop the run instead of being saved as empty content.
 */

/**
 * Whether an OpenAI error means the service is unusable for every subsequent call, rather than
 * having failed this one call. Credentials, permissions and exhausted quota all persist for the
 * whole run; a timeout or a malformed response does not.
 */
export function isAiUnavailable(error: unknown): boolean {
  const status = (error as { status?: number; code?: string })?.status;
  if (status === 401 || status === 403) return true;

  const code = String((error as { code?: string })?.code || '').toLowerCase();
  if (
    code === 'invalid_api_key' ||
    code === 'insufficient_quota' ||
    code === 'account_deactivated'
  ) {
    return true;
  }

  const message = String((error as { message?: string })?.message || '').toLowerCase();
  return (
    message.includes('incorrect api key') ||
    message.includes('invalid_api_key') ||
    message.includes('insufficient_quota') ||
    message.includes('exceeded your current quota') ||
    message.includes('api key not configured') ||
    message.includes('openai_api_key')
  );
}
