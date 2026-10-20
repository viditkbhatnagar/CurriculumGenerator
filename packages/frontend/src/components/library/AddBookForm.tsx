'use client';

import { useState } from 'react';
import { addBook, Licence, LICENCE_LABELS, OntologyDomain } from '@/lib/libraryApi';

interface Props {
  domains: OntologyDomain[];
  onAdded: () => void;
  onCancel: () => void;
}

const field =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20';
const label = 'block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1';

/**
 * Add a book to the library: a PDF upload, or a link to an open textbook on its publisher's own
 * site (the server fetches it from an allow-listed host). The licence and access tier are
 * recorded with the book; a restricted book (a test bank, an answer key) never feeds generation.
 */
export function AddBookForm({ domains, onAdded, onCancel }: Props) {
  const [mode, setMode] = useState<'link' | 'upload'>('link');
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    title: '',
    authors: '',
    edition: '',
    year: '',
    publisher: '',
    url: '',
    licence: 'unknown' as Licence,
    licenceStatement: '',
    programmes: '',
    providedBy: '',
    accessTier: 'teaching' as 'teaching' | 'restricted',
    domainKeys: [] as string[],
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  const toggleDomain = (key: string) =>
    set(
      'domainKeys',
      form.domainKeys.includes(key)
        ? form.domainKeys.filter((d) => d !== key)
        : [...form.domainKeys, key]
    );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) return setError('Give the book its title.');
    if (!form.domainKeys.length) return setError('Choose at least one domain.');
    if (mode === 'upload' && !file) return setError('Choose a PDF to upload.');
    if (mode === 'link' && !/^https:\/\//.test(form.url))
      return setError('Give an https link to the PDF.');
    setBusy(true);
    try {
      await addBook({ ...form, file: mode === 'upload' ? file || undefined : undefined });
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The book could not be added.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-teal-200 bg-gradient-to-b from-teal-50/60 to-white p-6 shadow-sm"
      aria-labelledby="add-book-heading"
    >
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h3 id="add-book-heading" className="text-lg font-semibold text-slate-900">
            Add a book
          </h3>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            The book is read chapter by chapter into concepts, each kept with the pages that teach
            it. Concepts already in the library from other books are merged, not repeated.
          </p>
        </div>
        <div
          className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-sm"
          role="tablist"
        >
          {(['link', 'upload'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 rounded-md transition ${mode === m ? 'bg-teal-600 text-white' : 'text-slate-600 hover:text-slate-900'}`}
            >
              {m === 'link' ? 'Open textbook link' : 'Upload PDF'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-6">
        <div className="md:col-span-4">
          <label className={label} htmlFor="kb-title">
            Title
          </label>
          <input
            id="kb-title"
            className={field}
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
          />
        </div>
        <div className="md:col-span-2">
          <label className={label} htmlFor="kb-edition">
            Edition
          </label>
          <input
            id="kb-edition"
            className={field}
            placeholder="3rd ed."
            value={form.edition}
            onChange={(e) => set('edition', e.target.value)}
          />
        </div>
        <div className="md:col-span-3">
          <label className={label} htmlFor="kb-authors">
            Authors (comma separated)
          </label>
          <input
            id="kb-authors"
            className={field}
            value={form.authors}
            onChange={(e) => set('authors', e.target.value)}
          />
        </div>
        <div className="md:col-span-2">
          <label className={label} htmlFor="kb-publisher">
            Publisher
          </label>
          <input
            id="kb-publisher"
            className={field}
            value={form.publisher}
            onChange={(e) => set('publisher', e.target.value)}
          />
        </div>
        <div className="md:col-span-1">
          <label className={label} htmlFor="kb-year">
            Year
          </label>
          <input
            id="kb-year"
            className={field}
            inputMode="numeric"
            value={form.year}
            onChange={(e) => set('year', e.target.value)}
          />
        </div>

        <div className="md:col-span-6">
          {mode === 'link' ? (
            <>
              <label className={label} htmlFor="kb-url">
                Link to the PDF on the publisher&apos;s site
              </label>
              <input
                id="kb-url"
                className={field}
                placeholder="https://assets.openstax.org/…/book.pdf"
                value={form.url}
                onChange={(e) => set('url', e.target.value)}
              />
            </>
          ) : (
            <>
              <label className={label} htmlFor="kb-file">
                PDF (up to 250 MB)
              </label>
              <input
                id="kb-file"
                type="file"
                accept="application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-teal-600 file:px-3 file:py-1.5 file:text-white hover:file:bg-teal-700"
              />
            </>
          )}
        </div>

        <div className="md:col-span-2">
          <label className={label} htmlFor="kb-licence">
            Licence
          </label>
          <select
            id="kb-licence"
            className={field}
            value={form.licence}
            onChange={(e) => set('licence', e.target.value)}
          >
            {Object.entries(LICENCE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-4">
          <label className={label} htmlFor="kb-licence-stmt">
            Licence as stated by the publisher
          </label>
          <input
            id="kb-licence-stmt"
            className={field}
            value={form.licenceStatement}
            onChange={(e) => set('licenceStatement', e.target.value)}
          />
        </div>

        <fieldset className="md:col-span-3">
          <legend className={label}>Domains</legend>
          <div className="flex flex-wrap gap-2">
            {domains.map((d) => (
              <button
                key={d.key}
                type="button"
                aria-pressed={form.domainKeys.includes(d.key)}
                onClick={() => toggleDomain(d.key)}
                className={`rounded-full border px-3 py-1 text-sm transition ${form.domainKeys.includes(d.key) ? 'border-teal-600 bg-teal-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-teal-400'}`}
              >
                {d.name}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="md:col-span-3">
          <legend className={label}>Use</legend>
          <div className="flex gap-4 text-sm text-slate-700">
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="tier"
                checked={form.accessTier === 'teaching'}
                onChange={() => set('accessTier', 'teaching')}
              />
              Teaching source
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="tier"
                checked={form.accessTier === 'restricted'}
                onChange={() => set('accessTier', 'restricted')}
              />
              Restricted (answer keys, test banks)
            </label>
          </div>
        </fieldset>
        <div className="md:col-span-3">
          <label className={label} htmlFor="kb-programmes">
            Programmes (comma separated)
          </label>
          <input
            id="kb-programmes"
            className={field}
            placeholder="BBA, MBA"
            value={form.programmes}
            onChange={(e) => set('programmes', e.target.value)}
          />
        </div>
        <div className="md:col-span-3">
          <label className={label} htmlFor="kb-provided">
            Provided by
          </label>
          <input
            id="kb-provided"
            className={field}
            placeholder="e.g. Dr Sherin Thomas (SSM LMS)"
            value={form.providedBy}
            onChange={(e) => set('providedBy', e.target.value)}
          />
        </div>
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <div className="mt-6 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-teal-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
        >
          {busy ? (mode === 'link' ? 'Fetching the book…' : 'Uploading…') : 'Add to the library'}
        </button>
      </div>
    </form>
  );
}
