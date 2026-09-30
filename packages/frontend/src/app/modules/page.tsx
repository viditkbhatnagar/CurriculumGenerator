'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AguCatalogue, AguCourse, getAguCatalogue } from '@/lib/aguApi';

const TRACKS: { id: AguCourse['track']; label: string }[] = [
  { id: 'core', label: 'Core (all MBA students)' },
  { id: 'fintech', label: 'FinTech specialization' },
  { id: 'finance', label: 'Finance specialization' },
  { id: 'supply_chain_operations', label: 'Supply Chain & Operations specialization' },
];

/**
 * AGU catalogue courses, the starting point for developing a module package. Everything shown
 * here is locked catalogue data; faculty develop the design inside a course, not the course.
 */
export default function AguModulesPage() {
  const [catalogue, setCatalogue] = useState<AguCatalogue | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAguCatalogue()
      .then(setCatalogue)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the catalogue'));
  }, []);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <header className="mb-8">
          <p className="text-xs font-semibold tracking-[0.18em] text-teal-600 uppercase">
            American Global University · MBA
          </p>
          <h1 className="text-3xl font-semibold text-slate-900 mt-2">Develop a catalogue course</h1>
          <p className="text-slate-600 mt-2 max-w-3xl">
            Pick a course to draft its four-week module package. Codes, titles, credits, hours and
            descriptions are locked to the catalogue; the outcomes, weeks, assessments and readings
            are drafted from verified open-access sources for faculty to review.
          </p>
          {catalogue && (
            <p className="mt-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 inline-block">
              Catalog v{catalogue.edition.version} ({catalogue.edition.published}) ·{' '}
              {catalogue.edition.approvalStatus === 'approved'
                ? 'approved edition'
                : 'awaiting AGU confirmation as the approved edition'}
            </p>
          )}
        </header>

        {error && <p className="text-red-600">{error}</p>}
        {!catalogue && !error && <p className="text-slate-500">Loading the catalogue…</p>}

        {catalogue &&
          TRACKS.map((track) => {
            const courses = catalogue.courses.filter((c) => c.track === track.id);
            return (
              <section key={track.id} className="mb-10" aria-labelledby={`track-${track.id}`}>
                <h2
                  id={`track-${track.id}`}
                  className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3"
                >
                  {track.label}
                </h2>
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {courses.map((c) => (
                    <li key={c.code}>
                      <Link
                        href={`/modules/${c.code}`}
                        className="block h-full rounded-xl border border-slate-200 bg-white p-4 hover:border-teal-400 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 transition"
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-mono text-sm font-semibold text-teal-700">
                            {c.code}
                          </span>
                          <span className="text-xs text-slate-500">{c.deliveryWindow}</span>
                        </div>
                        <p className="mt-1 font-medium text-slate-900">{c.title}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {c.roleLabel} · {c.semesterCredits} SCH · {c.hours.total} h
                        </p>
                        {c.descriptionMissing && (
                          <p className="mt-2 text-xs text-amber-700">
                            No topical description in the catalogue: scope is set by faculty.
                          </p>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
      </div>
    </main>
  );
}
