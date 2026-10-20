'use client';

import { useCallback, useEffect, useState } from 'react';
import { getBooks, getOntology, LibraryBook, OntologyDomain } from '@/lib/libraryApi';
import { AddBookForm } from '@/components/library/AddBookForm';
import { BooksPanel } from '@/components/library/BooksPanel';
import { ConceptsPanel } from '@/components/library/ConceptsPanel';

/**
 * The textbook knowledge library: books in, concepts out. Each book is read into knowledge
 * objects kept with the chapters and pages that teach them; the same concept from several books
 * is one entry with each book as evidence. Programmes draw on it during generation.
 */
export default function LibraryPage() {
  const [tab, setTab] = useState<'books' | 'concepts'>('books');
  const [books, setBooks] = useState<LibraryBook[] | null>(null);
  const [domains, setDomains] = useState<OntologyDomain[]>([]);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    getBooks()
      .then(setBooks)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the library'));
  }, []);

  useEffect(() => {
    load();
    getOntology()
      .then(setDomains)
      .catch(() => undefined);
  }, [load]);

  // Ingests run in the background; refresh while any is in progress.
  const busy = books?.some((b) => ['queued', 'reading', 'extracting'].includes(b.status));
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [busy, load]);

  const ready = books?.filter((b) => b.status === 'ready').length ?? 0;
  const concepts = books?.reduce((n, b) => n + (b.stats?.conceptsNew ?? 0), 0) ?? 0;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-600">
              Knowledge library
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">
              The body of knowledge behind every programme
            </h1>
            <p className="mt-2 text-slate-600">
              Textbooks are read into concepts, each kept with the book, chapter and pages that
              teach it. A concept taught by several books is held once, with every book as evidence,
              and its importance comes from how many books teach it and how deeply. Programmes build
              their competencies and modules from it.
            </p>
          </div>
          {books && (
            <dl className="flex gap-6 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm">
              <div>
                <dt className="text-xs text-slate-500">Books ready</dt>
                <dd className="text-2xl font-semibold text-slate-900">
                  {ready}
                  <span className="text-sm font-normal text-slate-400"> / {books.length}</span>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Concepts</dt>
                <dd className="text-2xl font-semibold text-slate-900">
                  {concepts.toLocaleString()}
                </dd>
              </div>
            </dl>
          )}
        </header>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div
            className="inline-flex rounded-xl border border-slate-200 bg-white p-1"
            role="tablist"
            aria-label="Library view"
          >
            {(['books', 'concepts'] as const).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${tab === t ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'}`}
              >
                {t === 'books' ? 'Books' : 'Concepts'}
              </button>
            ))}
          </div>
          {tab === 'books' && !adding && (
            <button
              onClick={() => setAdding(true)}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-teal-700"
            >
              Add a book
            </button>
          )}
        </div>

        {error && <p className="mb-4 text-red-600">{error}</p>}
        {tab === 'books' && (
          <div className="space-y-6">
            {adding && (
              <AddBookForm
                domains={domains}
                onCancel={() => setAdding(false)}
                onAdded={() => {
                  setAdding(false);
                  load();
                }}
              />
            )}
            {!books && !error && <p className="text-slate-500">Loading the library…</p>}
            {books && <BooksPanel books={books} domains={domains} onChanged={load} />}
          </div>
        )}
        {tab === 'concepts' && <ConceptsPanel domains={domains} />}
      </div>
    </main>
  );
}
