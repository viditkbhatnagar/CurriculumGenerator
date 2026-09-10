const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/**
 * Download a file from an API endpoint as a blob.
 * Handles auth token injection, timeout, and browser download trigger.
 */
/**
 * The filename the server asked for, from Content-Disposition.
 *
 * Returns null when the header is absent or unparseable, so the caller's guess still applies.
 */
function filenameFromResponse(response: Response): string | null {
  const header = response.headers.get('content-disposition');
  if (!header) return null;
  const utf8 = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1]);
    } catch {
      /* fall through to the plain form */
    }
  }
  const plain = header.match(/filename="?([^";]+)"?/i);
  return plain?.[1]?.trim() || null;
}

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
    // The server's own filename wins when it sends one.
    //
    // Callers pass a name they guessed from the request, and a guessed EXTENSION is worse
    // than a guessed name: the whole-programme Step 10 export is a zip of one document per
    // module, and saving it as ".docx" hands the reviewer a file Word refuses to open.
    a.download = filenameFromResponse(response) || filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objectUrl);
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}
