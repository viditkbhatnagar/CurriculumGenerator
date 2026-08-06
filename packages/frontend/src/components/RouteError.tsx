'use client';

/**
 * Shared recovery screen for route-level error boundaries.
 *
 * Steps render generated documents whose shape no schema enforces, so one
 * unexpected field used to replace the entire page with React's bare
 * "Application error: a client-side exception has occurred" — naming no step,
 * offering no way back, and giving no sign that the curriculum was intact.
 */

import { useEffect } from 'react';
import Link from 'next/link';

export function RouteError({
  error,
  reset,
  context,
  backHref = '/workflow',
  backLabel = 'Back to all curricula',
}: {
  error: Error & { digest?: string };
  reset: () => void;
  /** What failed, in the author's terms — e.g. "this curriculum". */
  context: string;
  backHref?: string;
  backLabel?: string;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(`Render failed (${context}):`, error);
  }, [error, context]);

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-2xl flex-col justify-center px-6 py-16">
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-8">
        <h1 className="text-xl font-semibold text-amber-900">This page could not be displayed</h1>

        <p className="mt-3 text-sm leading-relaxed text-amber-900/90">
          Something in {context} could not be drawn on screen. Your work is safe — this is a display
          problem, not lost data. Nothing has been deleted and no step has been changed.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={reset}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2"
          >
            Try again
          </button>
          <Link
            href={backHref}
            className="rounded-lg border border-amber-400 px-4 py-2 text-sm font-medium text-amber-900 transition-colors hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2"
          >
            {backLabel}
          </Link>
        </div>

        {/* The message is what makes a report actionable, so make it easy to send on. */}
        <details className="mt-6">
          <summary className="cursor-pointer text-xs font-medium text-amber-800">
            Details to send if it keeps happening
          </summary>
          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-amber-100/70 p-3 text-xs text-amber-900">
            {error.message || 'Unknown error'}
            {error.digest ? `\n\nReference: ${error.digest}` : ''}
          </pre>
        </details>
      </div>
    </main>
  );
}
