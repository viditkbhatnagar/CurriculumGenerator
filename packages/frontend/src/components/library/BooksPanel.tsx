'use client';

import { LibraryBook, LICENCE_LABELS, OntologyDomain, resumeBook } from '@/lib/libraryApi';

interface Props {
  books: LibraryBook[];
  domains: OntologyDomain[];
  onChanged: () => void;
}

const STATUS: Record<LibraryBook['status'], { label: string; tone: string }> = {
  queued: { label: 'Waiting', tone: 'bg-slate-100 text-slate-700' },
  reading: { label: 'Reading the PDF', tone: 'bg-sky-100 text-sky-800' },
  extracting: { label: 'Finding concepts', tone: 'bg-sky-100 text-sky-800' },
  ready: { label: 'In the library', tone: 'bg-emerald-100 text-emerald-800' },
  failed: { label: 'Stopped', tone: 'bg-red-100 text-red-700' },
};

const n = (v?: number) => (v ?? 0).toLocaleString();

/** The books in the library: what each contributed, and where any ingest stands. */
export function BooksPanel({ books, domains, onChanged }: Props) {
  const domainName = (k: string) => domains.find((d) => d.key === k)?.name || k;

  if (!books.length) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
        No books yet. Add an open textbook or an institution&apos;s PDF to start the library.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {books.map((b) => {
        const status = STATUS[b.status];
        const done = b.progress?.sectionsDone ?? 0;
        const total = b.progress?.sectionsTotal ?? 0;
        const pct = total ? Math.round((done / total) * 100) : 0;
        const working =
          b.status === 'reading' || b.status === 'extracting' || b.status === 'queued';
        return (
          <li key={b.id} className="p-5 transition hover:bg-slate-50/60">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold text-slate-900">
                  {b.title}
                  {b.edition && (
                    <span className="ml-2 text-sm font-normal text-slate-500">{b.edition}</span>
                  )}
                </h3>
                <p className="mt-0.5 text-sm text-slate-600">
                  {[b.authors.join(', '), b.publisher, b.year].filter(Boolean).join(' · ')}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                  <span className="rounded-md border border-slate-200 px-2 py-0.5 text-slate-600">
                    {LICENCE_LABELS[b.licence]}
                  </span>
                  {b.accessTier === 'restricted' && (
                    <span className="rounded-md bg-amber-100 px-2 py-0.5 text-amber-800">
                      Restricted: never used for generation
                    </span>
                  )}
                  {b.domainKeys.map((k) => (
                    <span key={k} className="rounded-md bg-teal-50 px-2 py-0.5 text-teal-800">
                      {domainName(k)}
                    </span>
                  ))}
                  {b.programmes.map((p) => (
                    <span key={p} className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-700">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${status.tone}`}
              >
                {status.label}
              </span>
            </div>

            {working && total > 0 && (
              <div className="mt-4">
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>
                    {n(done)} of {n(total)} sections read
                  </span>
                  <span>{pct}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-sky-500 transition-[width] duration-700"
                    style={{ width: `${Math.max(pct, 2)}%` }}
                  />
                </div>
              </div>
            )}

            {(b.status === 'ready' || done > 0) && (
              <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-5">
                <div>
                  <dt className="text-xs text-slate-500">Pages</dt>
                  <dd className="font-medium text-slate-900">{n(b.pageCount)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Passages</dt>
                  <dd className="font-medium text-slate-900">{n(b.stats?.passages)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">New concepts</dt>
                  <dd className="font-medium text-slate-900">{n(b.stats?.conceptsNew)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Merged with other books</dt>
                  <dd className="font-medium text-slate-900">{n(b.stats?.conceptsMerged)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Pages checked</dt>
                  <dd className="font-medium text-slate-900">
                    {b.stats?.conceptsExtracted
                      ? `${Math.round(100 - (100 * (b.stats.pagesCitedOutsideSection ?? 0)) / b.stats.conceptsExtracted)}% cited as given`
                      : '—'}
                  </dd>
                </div>
              </dl>
            )}

            {b.status === 'failed' && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-sm text-red-700">{b.error || 'The ingest stopped.'}</p>
                <button
                  onClick={async () => {
                    await resumeBook(b.id);
                    onChanged();
                  }}
                  className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-red-700 ring-1 ring-red-200 hover:bg-red-100"
                >
                  Resume where it stopped
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
