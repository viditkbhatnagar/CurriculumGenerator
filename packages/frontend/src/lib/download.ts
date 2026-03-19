const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/**
 * Download a file from an API endpoint as a blob.
 * Handles auth token injection, timeout, and browser download trigger.
 */
export async function downloadFile(
  url: string,
  filename: string,
  options?: { method?: 'GET' | 'POST'; timeout?: number }
): Promise<void> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

  const controller = new AbortController();
  const timeoutMs = options?.timeout || 120000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;
    const response = await fetch(fullUrl, {
      method: options?.method || 'GET',
      signal: controller.signal,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Download failed (${response.status})`);
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objectUrl);
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}
