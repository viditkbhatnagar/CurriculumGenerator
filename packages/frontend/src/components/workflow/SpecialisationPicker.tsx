'use client';

import { useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/** A specialisation (elective track) the export can be cut to (backend services/specialisations). */
export interface SpecialisationOption {
  id: string;
  name: string;
  credits: number;
  moduleCodes: string[];
}

/**
 * The programme's specialisations and the one chosen for export ('' = whole programme), with the
 * query string and file-name part the Word and PDF downloads use.
 */
export function useSpecialisationExport(workflowId: string, projectName?: string) {
  const [options, setOptions] = useState<SpecialisationOption[]>([]);
  const [selected, setSelected] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/v3/workflow/${workflowId}/specialisations`)
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (!cancelled && Array.isArray(body?.data)) setOptions(body.data);
      })
      .catch(() => undefined); // no picker; the whole-programme export still works
    return () => {
      cancelled = true;
    };
  }, [workflowId]);

  const chosen = options.find((s) => s.id === selected) || null;
  return {
    options,
    selected,
    setSelected,
    chosen,
    query: chosen ? `?specialisation=${encodeURIComponent(chosen.id)}` : '',
    fileName: chosen
      ? `${projectName || 'curriculum'} - ${chosen.name}`
      : projectName || 'curriculum',
  };
}

/**
 * One pathway: the core modules and one specialisation (Logan Pacey and Dr Sherin Thomas,
 * 24 November 2026). Renders nothing for a programme without elective tracks.
 */
export function SpecialisationPicker({
  options,
  selected,
  onChange,
}: {
  options: SpecialisationOption[];
  selected: string;
  onChange: (id: string) => void;
}) {
  if (!options.length) return null;
  const chosen = options.find((s) => s.id === selected);
  return (
    <div className="mb-6">
      <label
        htmlFor="export-specialisation"
        className="block text-sm font-medium text-teal-700 mb-1"
      >
        Specialisation
      </label>
      <select
        id="export-specialisation"
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        className="w-full md:w-auto md:min-w-[18rem] rounded-lg border border-teal-300 bg-white px-3 py-2 text-teal-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
      >
        <option value="">Whole programme (all {options.length} specialisations)</option>
        {options.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} ({s.credits} credits: {s.moduleCodes.join(', ')})
          </option>
        ))}
      </select>
      <p className="mt-1 text-xs text-teal-600">
        {chosen
          ? `The Word and PDF downloads contain the core modules and the ${chosen.name} modules only.`
          : 'Pick one to download a single pathway: the core modules plus that specialisation.'}
      </p>
    </div>
  );
}
