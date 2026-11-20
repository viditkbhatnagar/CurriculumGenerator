'use client';

import { useState } from 'react';
import {
  addBook,
  Licence,
  LICENCE_LABELS,
  OntologyDomain,
  titleFromFileName,
} from '@/lib/libraryApi';
import { DomainPicker } from './DomainPicker';
import { ProgrammePicker } from './ProgrammePicker';

interface Props {
  domains: OntologyDomain[];
  onDomainAdded?: (domain: OntologyDomain) => void;
  onDone: () => void;
  onCancel: () => void;
}

type RowState = 'waiting' | 'uploading' | 'added' | 'duplicate' | 'failed';

interface Row {
  file: File;
  title: string;
  year: string;
  state: RowState;
  message?: string;
}

const field =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20';
const label = 'block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1';

const BUSY_RETRIES = 10;
const BUSY_WAIT_MS = 15000;
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

const STATE_LABEL: Record<RowState, string> = {
  waiting: 'Waiting',
  uploading: 'Uploading…',
  added: 'Added, reading queued',
  duplicate: 'Already in the library',
  failed: 'Failed',
};

/**
 * Add several PDFs at once. Athira Hari (India Learns, 19 November 2026) had a shelf of fashion
 * textbooks and the form took one. The files share the domains, licence, programmes and
 * provider chosen here; each keeps its own title and year. They are sent one after another,
 * because the server takes in one book at a time (a 250 MB upload is held in memory), and each
 * book is then read in the background, one by one, as before.
 */
export function BulkUploadForm({ domains, onDomainAdded, onDone, onCancel }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [shared, setShared] = useState({
    licence: 'unknown' as Licence,
    programmes: '',
    providedBy: '',
    accessTier: 'teaching' as 'teaching' | 'restricted',
    domainKeys: [] as string[],
  });
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patchRow = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const choose = (files: FileList | null) => {
    const pdfs = Array.from(files || []).filter(
      (f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name)
    );
    setRows(
      pdfs.map((file) => ({
        file,
        title: titleFromFileName(file.name),
        year: '',
        state: 'waiting' as RowState,
      }))
    );
    setFinished(false);
  };

  const uploadOne = async (row: Row, i: number) => {
    for (let attempt = 0; ; attempt++) {
      try {
        await addBook({
          title: row.title.trim(),
          authors: '',
          year: row.year,
          licence: shared.licence,
          domainKeys: shared.domainKeys,
          programmes: shared.programmes,
          providedBy: shared.providedBy,
          accessTier: shared.accessTier,
          file: row.file,
        });
        return patchRow(i, { state: 'added' });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed';
        if (/already in the library/i.test(message)) {
          return patchRow(i, { state: 'duplicate', message });
        }
        if (/another book is being added/i.test(message) && attempt < BUSY_RETRIES) {
          patchRow(i, { message: 'The server is busy with another book; waiting…' });
          await pause(BUSY_WAIT_MS);
          continue;
        }
        return patchRow(i, { state: 'failed', message });
      }
    }
  };

  const start = async () => {
    setError(null);
    if (!rows.length) return setError('Choose at least one PDF.');
    if (!shared.domainKeys.length) return setError('Choose at least one domain.');
    if (rows.some((r) => r.state === 'waiting' && !r.title.trim()))
      return setError('Every book needs a title.');
    setRunning(true);
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].state !== 'waiting' && rows[i].state !== 'failed') continue;
      patchRow(i, { state: 'uploading', message: undefined });
      await uploadOne(rows[i], i);
    }
    setRunning(false);
    setFinished(true);
  };

  const retryable = rows.some((r) => r.state === 'failed');
  const added = rows.filter((r) => r.state === 'added').length;

  return (
    <section
      className="rounded-2xl border border-teal-200 bg-gradient-to-b from-teal-50/60 to-white p-6 shadow-sm"
      aria-labelledby="bulk-heading"
    >
      <h3 id="bulk-heading" className="text-lg font-semibold text-slate-900">
        Upload several books
      </h3>
      <p className="mt-1 max-w-2xl text-sm text-slate-600">
        Choose the PDFs, set what they share, and check each title. Books are uploaded one after
        another, then read into concepts in the background.
      </p>

      <div className="mt-5 grid gap-4 md:grid-cols-6">
        <div className="md:col-span-6">
          <label className={label} htmlFor="bulk-files">
            PDFs (up to 250 MB each)
          </label>
          <input
            id="bulk-files"
            type="file"
            accept="application/pdf"
            multiple
            disabled={running}
            onChange={(e) => choose(e.target.files)}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-teal-600 file:px-3 file:py-1.5 file:text-white hover:file:bg-teal-700"
          />
        </div>

        <fieldset className="md:col-span-6">
          <legend className={label}>Domains for all of them</legend>
          <DomainPicker
            domains={domains}
            selected={shared.domainKeys}
            onChange={(keys) => setShared((s) => ({ ...s, domainKeys: keys }))}
            onDomainAdded={onDomainAdded}
          />
        </fieldset>

        <div className="md:col-span-2">
          <label className={label} htmlFor="bulk-licence">
            Licence
          </label>
          <select
            id="bulk-licence"
            className={field}
            value={shared.licence}
            onChange={(e) => setShared((s) => ({ ...s, licence: e.target.value as Licence }))}
          >
            {Object.entries(LICENCE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        {shared.licence === 'institution-licensed' && (
          <div className="md:col-span-2">
            <ProgrammePicker
              id="bulk-programmes"
              value={shared.programmes}
              onChange={(v) => setShared((s) => ({ ...s, programmes: v }))}
            />
          </div>
        )}
        <div className="md:col-span-2">
          <label className={label} htmlFor="bulk-provided">
            Provided by
          </label>
          <input
            id="bulk-provided"
            className={field}
            value={shared.providedBy}
            onChange={(e) => setShared((s) => ({ ...s, providedBy: e.target.value }))}
          />
        </div>
        <fieldset className="md:col-span-6">
          <legend className={label}>Use</legend>
          <div className="flex gap-4 text-sm text-slate-700">
            {(['teaching', 'restricted'] as const).map((tier) => (
              <label key={tier} className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="bulk-tier"
                  checked={shared.accessTier === tier}
                  onChange={() => setShared((s) => ({ ...s, accessTier: tier }))}
                />
                {tier === 'teaching' ? 'Teaching source' : 'Restricted (answer keys, test banks)'}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      {rows.length > 0 && (
        <ul className="mt-6 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {rows.map((r, i) => (
            <li key={`${r.file.name}-${i}`} className="grid gap-2 p-3 md:grid-cols-12">
              <div className="md:col-span-6">
                <label className="sr-only" htmlFor={`bulk-title-${i}`}>
                  Title of {r.file.name}
                </label>
                <input
                  id={`bulk-title-${i}`}
                  className={field}
                  value={r.title}
                  disabled={running || r.state === 'added' || r.state === 'duplicate'}
                  onChange={(e) => patchRow(i, { title: e.target.value })}
                />
                <p className="mt-1 truncate text-xs text-slate-400">
                  {r.file.name} · {(r.file.size / (1024 * 1024)).toFixed(1)} MB
                </p>
              </div>
              <div className="md:col-span-2">
                <label className="sr-only" htmlFor={`bulk-year-${i}`}>
                  Year of {r.file.name}
                </label>
                <input
                  id={`bulk-year-${i}`}
                  className={field}
                  placeholder="Year"
                  inputMode="numeric"
                  value={r.year}
                  disabled={running || r.state === 'added' || r.state === 'duplicate'}
                  onChange={(e) => patchRow(i, { year: e.target.value })}
                />
              </div>
              <div className="md:col-span-4" role="status">
                <p
                  className={`text-sm font-medium ${r.state === 'failed' ? 'text-red-600' : r.state === 'added' ? 'text-teal-700' : r.state === 'duplicate' ? 'text-amber-700' : 'text-slate-600'}`}
                >
                  {STATE_LABEL[r.state]}
                </p>
                {r.message && r.state !== 'duplicate' && (
                  <p className="text-xs text-slate-500">{r.message}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      {finished && (
        <p className="mt-4 text-sm text-slate-700" role="status">
          {added} of {rows.length} added. Reading runs in the background; the Books list shows
          progress.
        </p>
      )}
      <div className="mt-6 flex items-center justify-end gap-3">
        <button
          type="button"
          disabled={running}
          onClick={finished ? onDone : onCancel}
          className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 disabled:opacity-60"
        >
          {finished ? 'Close' : 'Cancel'}
        </button>
        {(!finished || retryable) && (
          <button
            type="button"
            disabled={running || !rows.length}
            onClick={start}
            className="rounded-lg bg-teal-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-teal-700 disabled:opacity-60"
          >
            {running
              ? 'Uploading…'
              : finished
                ? 'Retry the failed ones'
                : `Upload ${rows.length || ''} ${rows.length === 1 ? 'book' : 'books'}`}
          </button>
        )}
      </div>
    </section>
  );
}
