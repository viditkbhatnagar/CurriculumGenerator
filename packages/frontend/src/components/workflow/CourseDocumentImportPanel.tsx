'use client';

import { useRef, useState } from 'react';
import { api } from '@/lib/api';

/**
 * Start from a course that already exists.
 *
 * Athira Hari at India Learns asked (19 November 2026) whether courses drafted in ChatGPT
 * can be developed further here. Upload the document (or paste its text); what it states is
 * shown for review, and "Use this" fills the Step 1 form (which the author still submits) and
 * saves the module list as the Step 4 structure. Anything the document did not say stays empty
 * and is listed, never filled in.
 */

export interface Step1Prefill {
  programTitle?: string;
  programDescription?: string;
  programPurpose?: string;
  academicLevel?:
    | 'certificate'
    | 'micro-credential'
    | 'diploma'
    | 'bachelor'
    | 'postgraduate-diploma'
    | 'master';
  programmeLevel?: number;
  programmeLevelOrigin?: 'stated';
  credits?: number;
  totalHours?: number;
  targetLearnerEducationalBackground?: string;
  jobRoles?: Array<{ title: string; description: string; tasks: string[] }>;
}

interface ImportModule {
  sequenceOrder: number;
  code: string;
  title: string;
  credits: number | null;
  contactHours: number | null;
  independentHours: number | null;
  totalHours: number | null;
  group: string;
  isElective: boolean;
  sourceTopics: string[];
  sourceOutcomes: string[];
}

interface ImportResult {
  course: { flags: string[]; method: 'deterministic' | 'model' };
  step1Prefill: Step1Prefill;
  blueprint: ImportModule[];
  filename: string;
}

interface Props {
  workflowId: string;
  onApplyStep1: (prefill: Step1Prefill) => void;
  disabled?: boolean;
}

const inputClass =
  'w-full rounded-lg border border-teal-200 px-2 py-1.5 text-sm text-teal-900 focus:border-teal-500 focus:outline-none';

const numberOrNull = (value: string): number | null => {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export default function CourseDocumentImportPanel({ workflowId, onApplyStep1, disabled }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [pasted, setPasted] = useState('');
  const [busy, setBusy] = useState<'reading' | 'saving' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<Step1Prefill | null>(null);
  const [modules, setModules] = useState<ImportModule[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [applied, setApplied] = useState<string | null>(null);

  const read = async (body: FormData | { text: string }) => {
    setError(null);
    setBusy('reading');
    try {
      const res = await api.post(
        `/api/v3/workflow/${workflowId}/import-course/parse`,
        body,
        body instanceof FormData
          ? { headers: { 'Content-Type': 'multipart/form-data' } }
          : undefined
      );
      if (!res.data?.success) throw new Error(res.data?.error || 'Could not read that document');
      const data: ImportResult = res.data.data;
      setResult(data);
      setPrefill(data.step1Prefill);
      setModules(data.blueprint);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Could not read that document');
    } finally {
      setBusy(null);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const changeModule = (index: number, change: Partial<ImportModule>) =>
    setModules((prev) => prev.map((m, i) => (i === index ? { ...m, ...change } : m)));

  const applyDocument = async () => {
    if (!prefill || !result) return;
    setError(null);
    setBusy('saving');
    try {
      if (modules.length) {
        const res = await api.post(`/api/v3/workflow/${workflowId}/import-course/apply`, {
          modules,
          filename: result.filename,
          credits: prefill.credits,
          totalHours: prefill.totalHours,
        });
        if (!res.data?.success) throw new Error(res.data?.error || 'Save failed');
      }
      onApplyStep1(prefill);
      setApplied(
        `${Object.keys(prefill).length ? 'Step 1 fields filled below. ' : ''}${
          modules.length ? `${modules.length} modules saved as the Step 4 structure.` : ''
        }`
      );
      setResult(null);
      setPrefill(null);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Save failed');
    } finally {
      setBusy(null);
    }
  };

  const field = (
    label: string,
    key:
      | 'programTitle'
      | 'programDescription'
      | 'programPurpose'
      | 'targetLearnerEducationalBackground',
    multiline = false
  ) => (
    <label className="block text-sm text-teal-700">
      {label}
      {multiline ? (
        <textarea
          rows={3}
          className={inputClass}
          value={prefill?.[key] ?? ''}
          placeholder="Not in the document"
          onChange={(e) => setPrefill((p) => ({ ...(p || {}), [key]: e.target.value }))}
        />
      ) : (
        <input
          className={inputClass}
          value={prefill?.[key] ?? ''}
          placeholder="Not in the document"
          onChange={(e) => setPrefill((p) => ({ ...(p || {}), [key]: e.target.value }))}
        />
      )}
    </label>
  );

  return (
    <div className="mb-6 rounded-xl border border-teal-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-lg font-semibold text-teal-800">
            Start from an existing course document
          </h4>
          <p className="mt-1 max-w-2xl text-sm text-teal-600">
            Already have a course drafted elsewhere, such as in ChatGPT? Upload it (Word, PDF,
            markdown or text, up to 10 MB) or paste it. You review what was found before anything is
            used; nothing is generated and nothing missing is invented.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={disabled}
          className="shrink-0 rounded-lg border border-teal-300 bg-teal-50 px-3 py-1.5 text-sm font-medium text-teal-800 hover:bg-teal-100 disabled:opacity-50"
        >
          {open ? 'Close' : 'Use a document'}
        </button>
      </div>

      {applied && <p className="mt-3 text-sm text-teal-700">{applied}</p>}
      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {open && !result && (
        <div className="mt-4 space-y-3">
          <input
            ref={fileInput}
            type="file"
            accept=".docx,.pdf,.md,.markdown,.txt"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const body = new FormData();
              body.append('file', file);
              read(body);
            }}
          />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={busy !== null}
            className="rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {busy === 'reading' ? 'Reading…' : 'Choose a file'}
          </button>
          <textarea
            rows={5}
            className={inputClass}
            placeholder="…or paste the course text here"
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
          />
          <button
            type="button"
            disabled={busy !== null || !pasted.trim()}
            onClick={() => read({ text: pasted })}
            className="rounded-lg border border-teal-300 px-3 py-1.5 text-sm text-teal-800 hover:bg-teal-50 disabled:opacity-50"
          >
            Read pasted text
          </button>
        </div>
      )}

      {open && result && prefill && (
        <div className="mt-4 space-y-4">
          {result.course.method === 'model' && (
            <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-800">
              This document had no table, headings or list to read, so the model extracted it. Check
              every field below.
            </p>
          )}
          {result.course.flags.length > 0 && (
            <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              <p className="font-medium">Not found or worth checking</p>
              <ul className="mt-1 list-disc pl-5">
                {result.course.flags.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            {field('Programme title', 'programTitle')}
            {field('Target learners', 'targetLearnerEducationalBackground')}
            {field('Description', 'programDescription', true)}
            {field('Purpose', 'programPurpose', true)}
            <label className="block text-sm text-teal-700">
              Credits
              <input
                className={inputClass}
                inputMode="decimal"
                placeholder="Not in the document"
                value={prefill.credits ?? ''}
                onChange={(e) => {
                  const credits = numberOrNull(e.target.value);
                  setPrefill((p) => {
                    const { credits: _drop, ...rest } = p || {};
                    return credits ? { ...rest, credits } : rest;
                  });
                }}
              />
            </label>
            <label className="block text-sm text-teal-700">
              Total hours
              <input
                className={inputClass}
                inputMode="decimal"
                placeholder="Not in the document"
                value={prefill.totalHours ?? ''}
                onChange={(e) => {
                  const totalHours = numberOrNull(e.target.value);
                  setPrefill((p) => {
                    const { totalHours: _drop, ...rest } = p || {};
                    return totalHours ? { ...rest, totalHours } : rest;
                  });
                }}
              />
            </label>
          </div>
          <p className="text-sm text-teal-600">
            {prefill.academicLevel
              ? `Credential: ${prefill.academicLevel}. `
              : 'Credential not stated. '}
            {prefill.programmeLevel
              ? `Level ${prefill.programmeLevel} (stated).`
              : 'Level not stated.'}
            {prefill.jobRoles?.length
              ? ` Job roles: ${prefill.jobRoles.map((r) => r.title).join(', ')}.`
              : ''}
          </p>

          <div>
            <p className="text-sm font-medium text-teal-800">Modules ({modules.length})</p>
            {modules.length === 0 ? (
              <p className="text-sm text-teal-600">
                No modules found. Step 4 will propose its own, or upload a structure there.
              </p>
            ) : (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-teal-600">
                      <th className="pr-2">#</th>
                      <th className="pr-2">Title</th>
                      <th className="pr-2">Credits</th>
                      <th className="pr-2">Hours</th>
                      <th className="pr-2">Topics</th>
                      <th aria-label="Remove" />
                    </tr>
                  </thead>
                  <tbody>
                    {modules.map((m, i) => (
                      <tr key={`${m.code}-${i}`} className="align-top">
                        <td className="pr-2 pt-1.5 text-teal-500">{i + 1}</td>
                        <td className="pr-2 pb-1">
                          <input
                            className={inputClass}
                            aria-label={`Module ${i + 1} title`}
                            value={m.title}
                            onChange={(e) => changeModule(i, { title: e.target.value })}
                          />
                        </td>
                        <td className="w-20 pr-2 pb-1">
                          <input
                            className={inputClass}
                            aria-label={`Module ${i + 1} credits`}
                            inputMode="decimal"
                            value={m.credits ?? ''}
                            onChange={(e) =>
                              changeModule(i, { credits: numberOrNull(e.target.value) })
                            }
                          />
                        </td>
                        <td className="w-20 pr-2 pb-1">
                          <input
                            className={inputClass}
                            aria-label={`Module ${i + 1} total hours`}
                            inputMode="decimal"
                            value={m.totalHours ?? ''}
                            onChange={(e) =>
                              changeModule(i, { totalHours: numberOrNull(e.target.value) })
                            }
                          />
                        </td>
                        <td className="pr-2 pt-1.5 text-teal-600">{m.sourceTopics.length}</td>
                        <td className="pt-1">
                          <button
                            type="button"
                            className="text-teal-500 hover:text-red-600"
                            aria-label={`Remove module ${i + 1}`}
                            onClick={() => setModules((prev) => prev.filter((_, j) => j !== i))}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={applyDocument}
              disabled={busy !== null}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {busy === 'saving' ? 'Saving…' : 'Use this'}
            </button>
            <button
              type="button"
              onClick={() => {
                setResult(null);
                setPrefill(null);
              }}
              className="rounded-lg border border-teal-200 px-4 py-2 text-sm text-teal-700 hover:bg-teal-50"
            >
              Start again
            </button>
          </div>
          <p className="text-xs text-teal-500">
            Using this fills the Step 1 form below for you to check and submit, and saves the
            modules as the Step 4 structure. Any structure already saved for Step 4 is replaced.
          </p>
        </div>
      )}
    </div>
  );
}
