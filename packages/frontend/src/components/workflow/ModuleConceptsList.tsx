'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Concept, getConceptsByCodes } from '@/lib/libraryApi';

const TONE: Record<string, string> = {
  core: 'bg-teal-700 text-white',
  supporting: 'bg-teal-100 text-teal-800',
  advanced: 'bg-violet-100 text-violet-800',
  optional: 'bg-slate-100 text-slate-600',
};

/**
 * The textbook-library concepts a Step 4 module was built from, each with the book, chapter
 * and pages that teach it. Shown only for a programme built with the library.
 */
export default function ModuleConceptsList({ codes }: { codes: string[] }) {
  const [concepts, setConcepts] = useState<Concept[] | null>(null);
  const key = codes.join(',');
  useEffect(() => {
    getConceptsByCodes(key.split(',').filter(Boolean))
      .then(setConcepts)
      .catch(() => setConcepts([]));
  }, [key]);
  if (!codes.length) return null;

  return (
    <div>
      <h5 className="mb-2 text-sm font-medium text-teal-700">
        Built from the textbook library ({codes.length} concept{codes.length === 1 ? '' : 's'})
      </h5>
      {!concepts && <p className="text-xs text-teal-500">Loading…</p>}
      {concepts && (
        <ul className="grid gap-1.5">
          {concepts.map((c) => (
            <li key={c.code} className="rounded-lg border border-teal-100 bg-white px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm text-teal-900">
                  <span className="mr-2 font-mono text-[11px] text-teal-600">{c.code}</span>
                  {c.name}
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${TONE[c.importance] || TONE.optional}`}
                >
                  {c.importance}
                </span>
              </div>
              {c.sources?.[0] && (
                <p className="mt-0.5 text-xs text-slate-500">{c.sources[0].citation}</p>
              )}
            </li>
          ))}
        </ul>
      )}
      <Link href="/library" className="mt-2 inline-block text-xs text-teal-700 underline">
        Open the library
      </Link>
    </div>
  );
}
