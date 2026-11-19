'use client';

import { useState } from 'react';
import { addDomain, domainKeyFromName, OntologyDomain } from '@/lib/libraryApi';

interface Props {
  domains: OntologyDomain[];
  selected: string[];
  onChange: (keys: string[]) => void;
  /** Called after an administrator adds a domain, so the page reloads the list. */
  onDomainAdded?: (domain: OntologyDomain) => void;
}

const field =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20';

/**
 * Domain chips for a book, plus "New domain" for administrators. A domain needs only a name;
 * areas (one per line) are optional and a general one is made when none are given.
 * Athira Hari (India Learns, 19 November 2026) could not file fashion books under a fixed list.
 */
export function DomainPicker({ domains, selected, onChange, onDomainAdded }: Props) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [areas, setAreas] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (key: string) =>
    onChange(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]);

  const create = async () => {
    setError(null);
    if (!name.trim()) return setError('Give the domain a name.');
    setBusy(true);
    try {
      const domain = await addDomain({
        key: domainKeyFromName(name),
        name: name.trim(),
        areas: areas
          .split('\n')
          .map((a) => a.trim())
          .filter(Boolean),
      });
      onDomainAdded?.(domain);
      onChange([...selected, domain.key]);
      setCreating(false);
      setName('');
      setAreas('');
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : 'The domain could not be added. Only an administrator can add one.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {domains.map((d) => (
          <button
            key={d.key}
            type="button"
            aria-pressed={selected.includes(d.key)}
            onClick={() => toggle(d.key)}
            className={`rounded-full border px-3 py-1 text-sm transition ${selected.includes(d.key) ? 'border-teal-600 bg-teal-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-teal-400'}`}
          >
            {d.name}
          </button>
        ))}
        {!creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="rounded-full border border-dashed border-slate-400 px-3 py-1 text-sm text-slate-600 hover:border-teal-500 hover:text-teal-700"
          >
            + New domain
          </button>
        )}
      </div>
      {creating && (
        <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-white p-3">
          <label className="block text-xs font-semibold text-slate-500" htmlFor="new-domain-name">
            Domain name (administrators only)
          </label>
          <input
            id="new-domain-name"
            className={field}
            placeholder="e.g. Law & Policy"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <label className="block text-xs font-semibold text-slate-500" htmlFor="new-domain-areas">
            Areas, one per line (optional)
          </label>
          <textarea
            id="new-domain-areas"
            className={field}
            rows={3}
            value={areas}
            onChange={(e) => setAreas(e.target.value)}
          />
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="text-sm text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={create}
              className="rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
            >
              {busy ? 'Adding…' : 'Add domain'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
