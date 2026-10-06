/**
 * Adds the signed-in user's token to every fetch the app makes to its own API.
 *
 * The axios client and the React Query helpers already send it, but about a dozen screens
 * call fetch() directly (the projects pages, prompts, programme forms, the final review, the
 * export hook) and sent nothing. That only worked because the API treated every caller as an
 * administrator. Once the API requires sign-in for changes (REQUIRE_AUTH), those requests
 * would fail; patching fetch once covers them, and any added later.
 */
const TOKEN_KEY = 'auth_token';
let installed = false;

function isApiRequest(url: string): boolean {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  return url.startsWith('/api/') || (!!base && url.startsWith(base));
}

export function installAuthFetch(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const original = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    let token: string | null = null;
    try {
      token = window.localStorage.getItem(TOKEN_KEY);
    } catch {
      token = null;
    }
    if (!token || !isApiRequest(url)) return original(input, init);
    const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : {}));
    if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
    return original(input, { ...init, headers });
  };
}
