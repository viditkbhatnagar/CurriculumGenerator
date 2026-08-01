'use client';

import { useRef, useState } from 'react';
import { api } from '@/lib/api';

/**
 * Define the programme structure before Step 4 generates.
 *
 * Left to itself, Step 4 proposes its own module list, which is fine for a short
 * course and wrong for a degree — an approved 180-credit structure has thirty
 * modules with fixed titles and credits, and those are not the generator's to
 * decide. Upload the structure here and generation fills in teaching content for
 * exactly these modules.
 */

export interface BlueprintModule {
  sequenceOrder: number;
  code: string;
  title: string;
  credits: number | null;
  contactHours: number | null;
  independentHours: number | null;
  totalHours: number | null;
  group: string;
  isElective: boolean;
}

interface ParsedBlueprint {
  modules: BlueprintModule[];
  groups: Array<{ name: string; moduleCount: number; credits: number; isElective: boolean }>;
  totalModules: number;
  totalCredits: number;
  totalCreditsAllTracks: number;
  warnings: string[];
  filename?: string;
}

interface Props {
  workflowId: string;
  /** Structure already saved on the workflow, if any. */
  saved?: BlueprintModule[];
  savedSource?: { filename?: string; totalCredits?: number };
  onSaved: () => void;
  disabled?: boolean;
}

export default function ModuleBlueprintPanel({
  workflowId,
  saved,
  savedSource,
  onSaved,
  disabled,
}: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedBlueprint | null>(null);
  const [busy, setBusy] = useState<'parsing' | 'saving' | 'clearing' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const hasSaved = !!saved?.length;

  const handleFile = async (file: File) => {
    setError(null);
    setBusy('parsing');
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await api.post(`/api/v3/workflow/${workflowId}/step4/blueprint/parse`, body, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (!res.data?.success) throw new Error(res.data?.error || 'Could not read that file');
      setParsed(res.data.data);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Could not read that file');
    } finally {
      setBusy(null);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!parsed) return;
    setError(null);
    setBusy('saving');
    try {
      const res = await api.put(`/api/v3/workflow/${workflowId}/step4/blueprint`, {
        modules: parsed.modules,
        filename: parsed.filename,
      });
      if (!res.data?.success) throw new Error(res.data?.error || 'Save failed');
      setParsed(null);
      onSaved();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Save failed');
    } finally {
      setBusy(null);
    }
  };

  const handleClear = async () => {
    if (!confirm('Remove the uploaded structure? Step 4 will then propose its own modules.'))
      return;
    setBusy('clearing');
    try {
      await api.delete(`/api/v3/workflow/${workflowId}/step4/blueprint`);
      onSaved();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Could not remove the structure');
    } finally {
      setBusy(null);
    }
  };

  const removeRow = (index: number) => {
    if (!parsed) return;
    setParsed({
      ...parsed,
      modules: parsed.modules.filter((_, i) => i !== index),
    });
  };

  const preview = parsed?.modules ?? saved ?? [];
  const showRows = expanded ? preview : preview.slice(0, 8);

  return (
    <div className="mb-6 rounded-xl border border-teal-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-lg font-semibold text-teal-800">Programme structure</h4>
          <p className="mt-1 max-w-2xl text-sm text-teal-600">
            Upload the approved module list with credits and Step 4 will build the outcomes for
            exactly those modules. Without one it proposes its own structure, which is only
            appropriate for short courses.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <input
            ref={fileInput}
            type="file"
            accept=".xlsx,.xlsm"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={disabled || busy !== null}
            className="rounded-lg border border-teal-300 bg-teal-50 px-3 py-1.5 text-sm font-medium text-teal-800 transition-colors hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === 'parsing'
              ? 'Reading…'
              : hasSaved
                ? 'Replace spreadsheet'
                : 'Upload spreadsheet'}
          </button>
          {hasSaved && !parsed && (
            <button
              type="button"
              onClick={handleClear}
              disabled={disabled || busy !== null}
              className="rounded-lg border border-teal-200 px-3 py-1.5 text-sm text-teal-600 transition-colors hover:bg-teal-50 disabled:opacity-50"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {hasSaved && !parsed && (
        <p className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Step 4 will generate <strong>{saved!.length} modules</strong>
          {savedSource?.totalCredits ? ` totalling ${savedSource.totalCredits} credits` : ''}
          {savedSource?.filename ? ` (from ${savedSource.filename})` : ''}.
        </p>
      )}

      {parsed && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="text-teal-700">
              <strong className="text-teal-900">{parsed.modules.length}</strong> modules
            </span>
            <span className="text-teal-700">
              <strong className="text-teal-900">{parsed.totalCredits}</strong> credits per student
            </span>
            <span className="text-teal-700">
              <strong className="text-teal-900">{parsed.groups.length}</strong> sections
            </span>
          </div>

          {parsed.warnings.length > 0 && (
            <ul className="space-y-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {parsed.warnings.map((w) => (
                <li key={w}>• {w}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {preview.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead>
              <tr className="border-b border-teal-200 text-xs uppercase tracking-wide text-teal-500">
                <th className="py-2 pr-3 font-medium">Code</th>
                <th className="py-2 pr-3 font-medium">Module</th>
                <th className="py-2 pr-3 font-medium">Credits</th>
                <th className="py-2 pr-3 font-medium">Hours</th>
                <th className="py-2 pr-3 font-medium">Section</th>
                {parsed && <th className="py-2 font-medium" />}
              </tr>
            </thead>
            <tbody>
              {showRows.map((m, i) => (
                <tr key={`${m.code}-${i}`} className="border-b border-teal-100 last:border-0">
                  <td className="py-1.5 pr-3 font-mono text-xs text-teal-700">{m.code}</td>
                  <td className="py-1.5 pr-3 text-teal-800">{m.title}</td>
                  <td className="py-1.5 pr-3 text-teal-700">{m.credits ?? '—'}</td>
                  <td className="py-1.5 pr-3 text-teal-600">
                    {m.totalHours ? `${m.totalHours} (${m.contactHours ?? '?'} contact)` : '—'}
                  </td>
                  <td className="py-1.5 pr-3 text-xs text-teal-500">
                    {m.group}
                    {m.isElective && (
                      <span className="ml-1 rounded bg-purple-100 px-1 text-purple-700">
                        elective
                      </span>
                    )}
                  </td>
                  {parsed && (
                    <td className="py-1.5">
                      <button
                        type="button"
                        onClick={() => removeRow(i)}
                        className="text-xs text-red-500 hover:underline"
                        aria-label={`Remove ${m.title}`}
                      >
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {preview.length > 8 && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="mt-2 text-xs font-medium text-teal-600 hover:underline"
            >
              {expanded ? 'Show fewer' : `Show all ${preview.length} modules`}
            </button>
          )}
        </div>
      )}

      {parsed && (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={busy !== null || parsed.modules.length === 0}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === 'saving' ? 'Saving…' : `Use these ${parsed.modules.length} modules`}
          </button>
          <button
            type="button"
            onClick={() => setParsed(null)}
            disabled={busy !== null}
            className="rounded-lg border border-teal-300 px-4 py-2 text-sm text-teal-700 transition-colors hover:bg-teal-50 disabled:opacity-50"
          >
            Discard
          </button>
        </div>
      )}
    </div>
  );
}
