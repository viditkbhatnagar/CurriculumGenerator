'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  getBooks,
  getOntology,
  getProgrammeLibrary,
  LibraryBook,
  OntologyDomain,
  ProgrammeLibrary,
  setProgrammeLibrary,
} from '@/lib/libraryApi';

/**
 * Which part of the textbook library this programme is built from. With it on, Steps 1-5 draw
 * on the books' concepts (with chapter and page citations), Step 2 builds skills from them and
 * Step 4 draws its modules as clusters of them. Saved as soon as it changes.
 */
export default function ProgrammeLibraryPanel({ workflowId }: { workflowId: string }) {
  const [library, setLibrary] = useState<ProgrammeLibrary | null>(null);
  const [domains, setDomains] = useState<OntologyDomain[]>([]);
  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getProgrammeLibrary(workflowId)
      .then(setLibrary)
      .catch(() => setLibrary({ enabled: false, domainKeys: [] }));
    getOntology()
      .then(setDomains)
      .catch(() => undefined);
    getBooks()
      .then(setBooks)
      .catch(() => undefined);
  }, [workflowId]);

  const save = async (next: ProgrammeLibrary) => {
    setError(null);
    setLibrary(next);
    if (next.enabled && !next.domainKeys.length) return;
    setSaving(true);
    try {
      setLibrary(await setProgrammeLibrary(workflowId, next));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the library choice');
    } finally {
      setSaving(false);
    }
  };

  if (!library) return null;
  // Books this programme can draw on: another institution's licensed books are not counted
  // (backend knowledge/bookAccess restrictedFrom).
  const usable = (b: (typeof books)[number]) =>
    !(
      b.licence === 'institution-licensed' &&
      (b.programmes || []).length > 0 &&
      !(b.programmes || []).includes(workflowId)
    );
  const readyIn = (key: string) =>
    books.filter(
      (b) =>
        b.status === 'ready' &&
        b.accessTier === 'teaching' &&
        b.domainKeys.includes(key) &&
        usable(b)
    ).length;

  return (
    <section
      className="rounded-xl border border-teal-200 bg-teal-50/50 p-5"
      aria-labelledby="programme-library"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h2 id="programme-library" className="font-semibold text-teal-800">
            Textbook library
          </h2>
          <p className="mt-1 text-sm text-teal-700">
            Build this programme from the textbooks in the library: competencies and modules are
            drawn from the concepts the books teach, cited to their chapters and pages.{' '}
            <Link href="/library" className="underline">
              See the library
            </Link>
          </p>
        </div>
        <label className="inline-flex items-center gap-2 text-sm font-medium text-teal-800">
          <input
            type="checkbox"
            checked={library.enabled}
            onChange={(e) => save({ ...library, enabled: e.target.checked })}
            className="h-4 w-4 accent-teal-600"
          />
          {library.enabled ? 'On' : 'Off'}
        </label>
      </div>
      {library.enabled && (
        <div className="mt-4 flex flex-wrap gap-2">
          {domains.map((d) => {
            const on = library.domainKeys.includes(d.key);
            return (
              <button
                key={d.key}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  save({
                    ...library,
                    domainKeys: on
                      ? library.domainKeys.filter((k) => k !== d.key)
                      : [...library.domainKeys, d.key],
                  })
                }
                className={`rounded-full border px-3 py-1 text-sm transition ${on ? 'border-teal-600 bg-teal-600 text-white' : 'border-teal-300 bg-white text-teal-800 hover:border-teal-500'}`}
              >
                {d.name}{' '}
                <span className="opacity-75">
                  · {readyIn(d.key)} book{readyIn(d.key) === 1 ? '' : 's'}
                </span>
              </button>
            );
          })}
        </div>
      )}
      {library.enabled && !library.domainKeys.length && (
        <p className="mt-2 text-sm text-amber-700">Choose at least one domain.</p>
      )}
      {saving && <p className="mt-2 text-xs text-teal-600">Saving…</p>}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  );
}
