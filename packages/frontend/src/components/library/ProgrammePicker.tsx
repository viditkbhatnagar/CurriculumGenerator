'use client';

import { useWorkflows } from '@/hooks/useWorkflow';

/**
 * The programmes an institution-licensed book is limited to, chosen from the real programmes.
 *
 * The book forms asked every uploader to type programme names, comma separated. Open and
 * unrecorded books ignore the field (they serve every programme in their domains), and for a
 * licensed book the library compares programme ids, so typed names such as "BBA, MBA" never
 * matched and hid the book from everyone. Athira Hari (India Learns, 20 November 2026) asked
 * for the field to go: it is now shown only for an institution-licensed book, as a pick-list
 * that stores the ids the library checks. The value stays a comma-separated string.
 */
export function ProgrammePicker({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  id?: string;
}) {
  const { data: workflows = [], isLoading } = useWorkflows();
  const chosen = value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  const toggle = (wid: string) => {
    const next = chosen.includes(wid) ? chosen.filter((c) => c !== wid) : [...chosen, wid];
    onChange(next.join(','));
  };

  return (
    <fieldset id={id} className="rounded-lg border border-teal-200 bg-white p-3">
      <legend className="px-1 text-xs font-medium uppercase tracking-wide text-teal-700">
        Licensed for these programmes only
      </legend>
      <p className="mb-2 text-xs text-teal-600">
        Tick programmes to limit this licensed book to them. Leave none ticked and every programme
        in its domains may use it.
      </p>
      {isLoading ? (
        <p className="text-sm text-teal-600">Loading programmes…</p>
      ) : (
        <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
          {workflows.map((w: any) => (
            <li key={w._id}>
              <label className="inline-flex items-center gap-2 text-teal-800">
                <input
                  type="checkbox"
                  checked={chosen.includes(String(w._id))}
                  onChange={() => toggle(String(w._id))}
                  className="h-4 w-4 accent-teal-600"
                />
                {w.projectName || w.step1?.programTitle || String(w._id)}
              </label>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}
