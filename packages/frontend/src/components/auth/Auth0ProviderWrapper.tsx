'use client';

import { Auth0Provider } from '@auth0/auth0-react';
import { useRouter } from 'next/navigation';

/**
 * Wraps children with Auth0Provider ONLY when the env vars are present.
 * That way:
 *   - Production with Auth0 configured → real auth flow
 *   - Local / staging without Auth0 → falls through to the existing
 *     mock-admin behaviour (the backend middleware does the same fallback)
 *
 * Env vars (set on the frontend service):
 *   NEXT_PUBLIC_AUTH0_DOMAIN     e.g. agi-academy.us.auth0.com
 *   NEXT_PUBLIC_AUTH0_CLIENT_ID  Auth0 SPA application client id
 *   NEXT_PUBLIC_AUTH0_AUDIENCE   Auth0 API audience (matches backend AUTH0_AUDIENCE)
 */
export function isAuth0Enabled(): boolean {
  return !!(process.env.NEXT_PUBLIC_AUTH0_DOMAIN && process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID);
}

export default function Auth0ProviderWrapper({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  if (!isAuth0Enabled()) {
    // Auth0 not configured — render children unchanged. Existing mock-admin
    // path keeps working.
    return <>{children}</>;
  }

  const domain = process.env.NEXT_PUBLIC_AUTH0_DOMAIN as string;
  const clientId = process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID as string;
  const audience = process.env.NEXT_PUBLIC_AUTH0_AUDIENCE;

  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: typeof window !== 'undefined' ? window.location.origin : undefined,
        audience,
      }}
      onRedirectCallback={(appState) => {
        // After login, send the user back to the page they were trying to reach.
        router.replace((appState?.returnTo as string) || '/workflow');
      }}
      // Cache tokens in localStorage so the existing api.ts interceptor
      // (which reads "auth_token") can pick them up. We also explicitly
      // sync the token in useAuthBridge below.
      cacheLocation="localstorage"
      useRefreshTokens
    >
      {children}
    </Auth0Provider>
  );
}
