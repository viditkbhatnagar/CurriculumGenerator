'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

/**
 * Set how many modules Step 4 should propose.
 *
 * The count was derived from the programme's credits and never shown, so an
 * author who wanted a different number had no way to ask for one — the only
 * options were accept it or upload a full structure. This lets them try a count
 * and see what the generator proposes, which is the cheaper way to explore
 * before committing to a structure.
 *
 * Hidden when a structure is uploaded: that fixes the module list outright, so a
 * target count would be meaningless.
 */

interface Props {
  workflowId: string;
  currentCount: number;
  creditFramework?: { credits?: number; system?: string; creditSystem?: string };
  hasBlueprint: boolean;
  onSaved: () => void;
  disabled?: boolean;
}

/**
 * A typical module's credits in each credit system, as the backend uses them to propose a
 * count (services/moduleFramework typicalModuleCredits). The screen used 6 (ECTS) for every
 * system, so a 60 UK-credit programme read "10 suits 60 credits at 6 each" while Step 4
 * proposed 4 modules of 15 (Logan's test run, 28 October 2026).
 */
function typicalModuleCredits(system: unknown): number | null {
  switch (String(system || '')) {
    case 'ects':
      return 6;
    case 'uk':
    case 'uk_credits':
      return 15;
    case 'us_semester':
      return 3;
    default:
      return null;
  }
}
const MIN_MODULES = 4;
const MAX_MODULES = 40;

export default function ModuleCountControl({
  workflowId,
  currentCount,
  creditFramework,
  hasBlueprint,
  onSaved,
  disabled,
}: Props) {
  const credits = creditFramework?.credits || 0;
  const moduleSize = typicalModuleCredits(creditFramework?.system || creditFramework?.creditSystem);
  const derived =
    credits && moduleSize
      ? Math.min(MAX_MODULES, Math.max(MIN_MODULES, Math.round(credits / moduleSize)))
      : null;

  const [value, setValue] = useState<string>(String(currentCount || derived || 8));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (hasBlueprint) return null;

  const count = Number.parseInt(value, 10);
  const valid = Number.isFinite(count) && count >= MIN_MODULES && count <= MAX_MODULES;
  const perModule = valid && credits ? Math.round((credits / count) * 10) / 10 : null;

  const handleSave = async () => {
    if (!valid) return;
    setError(null);
    setBusy(true);
    setSaved(false);
    try {
      const res = await api.put(`/api/v3/workflow/${workflowId}/step4/module-count`, {
        moduleCount: count,
      });
      if (!res.data?.success) throw new Error(res.data?.error || 'Could not save');
      setSaved(true);
      onSaved();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-teal-200 bg-white p-5">
      <h4 className="text-lg font-semibold text-teal-800">How many modules?</h4>
      <p className="mt-1 max-w-2xl text-sm text-teal-600">
        Set a target and regenerate to see what the generator proposes. Useful for exploring the
        shape of the programme before settling on a structure.
      </p>

      <label className="mt-3 flex flex-wrap items-center gap-2 text-sm text-teal-800">
        <span>Modules</span>
        <input
          type="number"
          min={MIN_MODULES}
          max={MAX_MODULES}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setSaved(false);
          }}
          disabled={disabled || busy}
          className="w-20 rounded border border-teal-300 px-2 py-1 text-sm disabled:opacity-50"
        />
        {perModule !== null && (
          <span className="text-teal-600">
            → about <strong className="text-teal-900">{perModule} credits</strong> each
          </span>
        )}
        {derived !== null && (
          <span className="text-xs text-teal-500">
            (currently {currentCount || derived}; {derived} modules of {moduleSize} credits make{' '}
            {credits} credits)
          </span>
        )}
      </label>

      {!valid && value !== '' && (
        <p className="mt-2 text-xs text-amber-700">
          Choose between {MIN_MODULES} and {MAX_MODULES} modules.
        </p>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {saved && !error && (
        <p className="mt-2 text-xs text-emerald-700">
          Saved — press Regenerate to rebuild the framework with {count} modules.
        </p>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={disabled || busy || !valid}
        className="mt-3 rounded-lg border border-teal-300 bg-teal-50 px-3 py-1.5 text-sm font-medium text-teal-800 transition-colors hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? 'Saving…' : 'Use this count'}
      </button>
    </div>
  );
}
