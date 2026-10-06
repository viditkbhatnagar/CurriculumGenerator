'use client';

/**
 * What the generator supports, shown before anything is generated, and the subject area the
 * author declares against it (backend services/capabilityScope). The 21 September review
 * asked for exactly this: declare supported subjects, levels and jurisdictions up front, and
 * escalate requests outside them rather than accept anything.
 */
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Capability {
  summary: string;
  subjects: string[];
  levels: string[];
  jurisdictions: string[];
  limits: string[];
  subjectAreas: { id: string; label: string }[];
  other: string;
}

export default function CapabilityScopePanel({
  subjectArea,
  acknowledged,
  onChange,
}: {
  subjectArea: string;
  acknowledged: boolean;
  onChange: (next: { subjectArea: string; scopeAcknowledged: boolean }) => void;
}) {
  const [capability, setCapability] = useState<Capability | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    api
      .get('/api/v3/workflow/capability')
      .then((r) => setCapability(r.data?.data || null))
      .catch(() => setCapability(null));
  }, []);

  if (!capability) return null;
  const outside = subjectArea === capability.other;

  return (
    <section className="rounded-xl border border-teal-200 bg-teal-50/50 p-5 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-teal-800">What this generator supports</h2>
        <p className="text-sm text-teal-700 mt-1">{capability.summary}</p>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-2 text-sm text-teal-600 underline"
        >
          {open ? 'Hide' : 'Show'} the supported subjects, levels, jurisdictions and limits
        </button>
        {open && (
          <div className="mt-3 grid gap-4 md:grid-cols-2 text-sm text-teal-800">
            {(
              [
                ['Subjects', capability.subjects],
                ['Levels', capability.levels],
                ['Jurisdictions', capability.jurisdictions],
                ['Limits', capability.limits],
              ] as const
            ).map(([title, items]) => (
              <div key={title}>
                <h3 className="font-medium">{title}</h3>
                <ul className="list-disc ml-5 mt-1 space-y-1">
                  {items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <label htmlFor="subject-area" className="block text-sm font-medium text-teal-700 mb-2">
          Subject area <span className="text-red-400">*</span>
        </label>
        <select
          id="subject-area"
          required
          value={subjectArea}
          onChange={(e) => onChange({ subjectArea: e.target.value, scopeAcknowledged: false })}
          className="w-full px-4 py-3 bg-white border border-teal-200 rounded-lg text-teal-800"
        >
          <option value="">Choose the programme’s subject area</option>
          {capability.subjectAreas.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
          <option value={capability.other}>Another subject (outside the reviewed scope)</option>
        </select>
      </div>

      {outside && (
        <label className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <input
            type="checkbox"
            required
            checked={acknowledged}
            onChange={(e) => onChange({ subjectArea, scopeAcknowledged: e.target.checked })}
            className="mt-1"
          />
          This subject is outside the generator’s reviewed scope. I confirm that a subject expert
          will review everything it drafts before it is used, and the exported curriculum will say
          so.
        </label>
      )}
    </section>
  );
}
