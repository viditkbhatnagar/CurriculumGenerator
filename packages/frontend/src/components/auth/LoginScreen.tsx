'use client';

import { useAuth0 } from '@auth0/auth0-react';
import { usePathname } from 'next/navigation';

/**
 * Full-page login prompt rendered by AuthGate when an unauthenticated user
 * lands on a protected page. We hand off to the Auth0 Universal Login flow
 * (which the admin can theme via the Auth0 dashboard).
 */
export default function LoginScreen() {
  const { loginWithRedirect } = useAuth0();
  const pathname = usePathname();

  const handleLogin = () => {
    loginWithRedirect({
      appState: { returnTo: pathname || '/workflow' },
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-teal-50 via-white to-sage-50">
      <div className="max-w-md w-full bg-white rounded-2xl border border-teal-200 shadow-sm p-8 text-center space-y-5">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-teal-800">Curriculum Generator</h1>
          <p className="text-sm text-teal-600">Sign in to access your programmes.</p>
        </div>

        <button
          onClick={handleLogin}
          className="w-full px-4 py-3 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl font-semibold shadow-sm"
        >
          Sign in
        </button>

        <p className="text-xs text-teal-500 leading-relaxed">
          Access is limited to invited faculty. If your email isn't recognised, please ask an
          administrator to add you on the Faculty Management page.
        </p>
      </div>
    </div>
  );
}
