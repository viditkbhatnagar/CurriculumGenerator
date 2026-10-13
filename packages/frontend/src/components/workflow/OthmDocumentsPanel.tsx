'use client';

/**
 * The three documents of a full programme in an awarding body's layout (OTHM's, as Rejin asked
 * on 13 October 2026): Qualification Specification, Unit Specifications and Assignment Briefs.
 * The unit assessment criteria they need are written once by the AI ("Prepare"); the documents
 * themselves are built from the saved programme each time they are downloaded.
 */
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { downloadFile } from '@/lib/download';

interface Status {
  units: { code: string; title: string; criteriaReady: boolean; briefReady: boolean }[];
  run: {
    running: boolean;
    written: number;
    skipped: number;
    failed: number;
    units: number;
    errors: string[];
  } | null;
}

const DOCUMENTS = [
  {
    kind: 'qualification-specification',
    label: 'Qualification Specification',
    name: 'Qualification-Specification',
  },
  { kind: 'unit-specifications', label: 'Unit Specifications', name: 'Unit-Specifications' },
  { kind: 'assignment-briefs', label: 'Assignment Briefs', name: 'Assignment-Briefs' },
] as const;

export default function OthmDocumentsPanel({
  workflowId,
  programName,
}: {
  workflowId: string;
  programName: string;
}) {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api.get(`/api/v3/workflow/${workflowId}/othm/status`);
      setStatus(r.data?.data || null);
    } catch {
      setStatus(null);
    }
  }, [workflowId]);

  useEffect(() => {
    load();
  }, [load]);

  // While the criteria are being written, check every 10 seconds.
  useEffect(() => {
    if (!status?.run?.running) return;
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [status?.run?.running, load]);

  const units = status?.units || [];
  const ready = units.filter((u) => u.criteriaReady).length;
  const briefs = units.filter((u) => u.briefReady).length;
  const running = !!status?.run?.running;

  const prepare = async () => {
    setError(null);
    try {
      await api.post(`/api/v3/workflow/${workflowId}/othm/prepare`);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Could not start writing the assessment criteria.');
    }
  };

  const download = async (kind: string, name: string) => {
    setBusy(kind);
    setError(null);
    try {
      const slug = programName.replace(/[^a-zA-Z0-9]+/g, '-') || 'programme';
      await downloadFile(
        `/api/v3/workflow/${workflowId}/export/othm/${kind}`,
        `${slug}-${name}.docx`,
        {
          timeout: 300000,
        }
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not build the document.');
    } finally {
      setBusy(null);
    }
  };

  if (!status) return null;

  return (
    <section className="bg-white rounded-xl border border-teal-200/50 p-6 mb-8 shadow-sm space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-teal-800">Programme documents (OTHM layout)</h3>
        <p className="text-sm text-teal-600 mt-1">
          The qualification specification, unit specifications and assignment briefs, in the layout
          awarding bodies use, under this programme’s name. Units are graded Pass / Fail against
          numbered assessment criteria.
        </p>
      </div>

      <div className="text-sm text-teal-800 space-y-1">
        <p>
          Assessment criteria written for <strong>{ready}</strong> of {units.length} units.
          {running && ' Writing now…'}
        </p>
        <p>
          Assignment briefs available for <strong>{briefs}</strong> of {units.length} units (from
          Step 12, or Step 7 where Step 12 is not done).
        </p>
        {!!status.run?.failed && (
          <p className="text-amber-700">
            {status.run.failed} unit(s) could not be written; prepare again to retry them.
          </p>
        )}
      </div>

      {ready < units.length && (
        <button
          type="button"
          onClick={prepare}
          disabled={running}
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
        >
          {running
            ? 'Writing assessment criteria…'
            : 'Prepare OTHM documents (write assessment criteria)'}
        </button>
      )}

      <div className="flex flex-wrap gap-3">
        {DOCUMENTS.map((d) => (
          <button
            key={d.kind}
            type="button"
            onClick={() => download(d.kind, d.name)}
            disabled={!!busy}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-teal-300 text-teal-700 hover:bg-teal-50 disabled:opacity-60"
          >
            {busy === d.kind ? 'Building…' : d.label}
          </button>
        ))}
      </div>
      {ready < units.length && (
        <p className="text-xs text-teal-600">
          Documents can be downloaded now; units without criteria are marked as not yet written.
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </section>
  );
}
