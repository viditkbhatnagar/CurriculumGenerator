'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AguPathway, getAguPathways, PathwayCourseState } from '@/lib/aguApi';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const STATE: Record<PathwayCourseState, { label: string; tone: string }> = {
  not_started: { label: 'Not started', tone: 'bg-slate-100 text-slate-600' },
  in_progress: { label: 'In progress', tone: 'bg-amber-100 text-amber-800' },
  submitted: { label: 'Awaiting approval', tone: 'bg-sky-100 text-sky-800' },
  published: { label: 'Published', tone: 'bg-emerald-100 text-emerald-800' },
};

/**
 * The three AGU MBA pathways, assembled from the courses built in the generator. A pathway is
 * ready when the super admin has published all 16 of its courses.
 */
export default function AguPathwaysPage() {
  const [pathways, setPathways] = useState<AguPathway[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAguPathways()
      .then(setPathways)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the pathways'));
  }, []);

  const download = async (id: string) => {
    const response = await fetch(`${API_BASE}/api/agu/pathways/${id}/export`);
    if (!response.ok) {
      setError('The pathway document could not be produced. Please try again.');
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AGU-MBA-${id}.docx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <header className="mb-8">
          <p className="text-xs font-semibold tracking-[0.18em] text-teal-600 uppercase">
            American Global University · MBA
          </p>
          <h1 className="text-3xl font-semibold text-slate-900 mt-2">MBA pathways</h1>
          <p className="text-slate-600 mt-2 max-w-3xl">
            Each pathway is the 12-course core plus one 4-course specialization. A course counts
            once the super admin has approved and published it; a pathway is ready when all 16 are
            published.
          </p>
          <Link href="/modules" className="text-sm text-teal-700 underline mt-2 inline-block">
            Back to the catalogue
          </Link>
        </header>

        {error && <p className="text-red-600 mb-4">{error}</p>}
        {!pathways && !error && <p className="text-slate-500">Loading the pathways…</p>}

        {pathways?.map((pathway) => (
          <section key={pathway.id} className="mb-10 rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{pathway.name}</h2>
                <p className="text-sm text-slate-600">
                  {pathway.totals.published} of {pathway.totals.courses} courses published ·{' '}
                  {pathway.totals.credits} credits · {pathway.totals.hours} hours
                </p>
                <div className="mt-2 h-2 w-64 max-w-full rounded-full bg-slate-100" aria-hidden>
                  <div
                    className="h-2 rounded-full bg-emerald-500"
                    style={{
                      width: `${Math.round((pathway.totals.published / pathway.totals.courses) * 100)}%`,
                    }}
                  />
                </div>
              </div>
              <button
                onClick={() => download(pathway.id)}
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500"
              >
                {pathway.ready ? 'Download pathway' : 'Download draft pathway'}
              </button>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-5 py-2 font-medium">Course</th>
                  <th className="px-3 py-2 font-medium">Delivery</th>
                  <th className="px-3 py-2 font-medium">State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pathway.courses.map((c) => (
                  <tr key={c.code}>
                    <td className="px-5 py-2">
                      <span className="font-mono text-slate-500 mr-2">{c.code}</span>
                      {c.programmeId ? (
                        <Link
                          href={`/workflow/${c.programmeId}`}
                          className="text-teal-700 underline"
                        >
                          {c.title}
                        </Link>
                      ) : (
                        <span className="text-slate-800">{c.title}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{c.deliveryWindow}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATE[c.state].tone}`}
                      >
                        {STATE[c.state].label}
                        {c.state === 'in_progress' && c.currentStep
                          ? ` · step ${c.currentStep}`
                          : ''}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </main>
  );
}
