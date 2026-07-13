'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { toast } from '@/stores/toastStore';

/**
 * Step 5.5 — Book Ingestion.
 * Lists the sourced textbooks eligible for decomposition, lets the SME upload
 * a book and opt it in, and polls decomposition status. See docs/book-ingestion/.
 */

interface Candidate {
  id: string;
  title: string;
  authors: string;
  publisher?: string;
  year?: number;
  mloIds: string[];
  ingestionStatus: string | null;
}

interface BookStatus {
  bookId: string;
  sourceId: string;
  bookTitle: string;
  status: string;
  depth: string;
  nodeCount: number;
  qualityReport: { totalNodes?: number; embedded?: number; lowConfidence?: number } | null;
  lastError: { message: string } | null;
}

const DEPTHS = ['essential', 'standard', 'comprehensive', 'forensic'] as const;
const TERMINAL = ['ready', 'failed', 'needs_review'];

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-xs text-teal-500">not ingested</span>;
  const tone: Record<string, string> = {
    ready: 'bg-green-500/15 text-green-600',
    needs_review: 'bg-amber-500/15 text-amber-600',
    failed: 'bg-red-500/15 text-red-600',
  };
  const cls = tone[status] || 'bg-teal-500/15 text-teal-600';
  const label = status === 'needs_review' ? 'ready (review)' : status.replace(/_/g, ' ');
  return <span className={`text-xs px-2 py-0.5 rounded-full ${cls}`}>{label}</span>;
}

export default function BookIngestionPanel({ workflowId }: { workflowId: string }) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [statuses, setStatuses] = useState<Record<string, BookStatus>>({});
  const [loading, setLoading] = useState(true);
  const [depth, setDepth] = useState<string>('standard');
  const [busyId, setBusyId] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadCandidates = useCallback(async () => {
    try {
      const r = await api.get(`/api/v3/workflow/${workflowId}/book-ingestion/candidates`);
      setCandidates(r.data?.data || []);
    } catch {
      toast.error('Could not load textbooks', 'Make sure Step 5 (Sources) is complete.');
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  const loadStatus = useCallback(async () => {
    try {
      const r = await api.get(`/api/v3/workflow/${workflowId}/book-ingestion/status`);
      const map: Record<string, BookStatus> = {};
      (r.data?.data || []).forEach((b: BookStatus) => (map[b.sourceId] = b));
      setStatuses(map);
    } catch {
      /* transient */
    }
  }, [workflowId]);

  useEffect(() => {
    loadCandidates();
    loadStatus();
    pollRef.current = setInterval(loadStatus, 10000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [loadCandidates, loadStatus]);

  const ingest = async (c: Candidate) => {
    const file = fileInputs.current[c.id]?.files?.[0];
    if (!file) {
      toast.error('Upload the book file first', `Attach the file for "${c.title}".`);
      return;
    }
    setBusyId(c.id);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('sourceId', c.id);
      form.append('depth', depth);
      await api.post(`/api/v3/workflow/${workflowId}/book-ingestion/ingest`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Queued for ingestion', `"${c.title}" is decomposing in the background.`);
      await loadStatus();
    } catch (e: any) {
      toast.error('Ingestion failed to start', e?.response?.data?.error || 'Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <div className="p-6 text-teal-600">Loading sourced textbooks…</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <header className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-teal-500/30 rounded-xl p-5">
        <h2 className="text-2xl font-bold text-teal-800 mb-1">Step 5.5: Book Ingestion</h2>
        <p className="text-sm text-teal-700">
          Decompose a sourced textbook into a source-grounded knowledge layer the later steps can
          cite. Only academic texts from Step 5 are eligible; upload the book and opt it in.
        </p>
      </header>

      <div className="flex items-center gap-2 text-sm text-teal-700">
        <span>Depth:</span>
        <select
          value={depth}
          onChange={(e) => setDepth(e.target.value)}
          className="border border-teal-200 rounded px-2 py-1 bg-white"
        >
          {DEPTHS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      {candidates.length === 0 ? (
        <div className="text-teal-600 text-sm border border-teal-200/60 rounded-lg p-4">
          No ingestable textbooks found in Step 5 (only sources typed as “academic text” can be
          decomposed).
        </div>
      ) : (
        <ul className="space-y-3">
          {candidates.map((c) => {
            const st = statuses[c.id];
            const inFlight = st && !TERMINAL.includes(st.status);
            return (
              <li key={c.id} className="border border-teal-200/60 rounded-lg p-4 bg-white">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-teal-800">{c.title}</p>
                    <p className="text-xs text-teal-500">
                      {c.authors}
                      {c.year ? ` · ${c.year}` : ''} · {c.mloIds.length} MLO
                      {c.mloIds.length === 1 ? '' : 's'}
                    </p>
                  </div>
                  <StatusBadge status={st?.status ?? c.ingestionStatus} />
                </div>

                {st && (st.status === 'ready' || st.status === 'needs_review') && (
                  <p className="text-xs text-teal-600 mt-2">
                    {st.nodeCount} knowledge nodes
                    {st.qualityReport?.embedded != null
                      ? ` · ${st.qualityReport.embedded} embedded`
                      : ''}
                    {st.qualityReport?.lowConfidence
                      ? ` · ${st.qualityReport.lowConfidence} low-confidence to review`
                      : ''}
                  </p>
                )}
                {st?.status === 'failed' && st.lastError && (
                  <p className="text-xs text-red-500 mt-2">Failed: {st.lastError.message}</p>
                )}

                <div className="flex items-center gap-3 mt-3">
                  <input
                    type="file"
                    accept=".pdf,.docx,.epub,.txt"
                    ref={(el) => {
                      fileInputs.current[c.id] = el;
                    }}
                    className="text-xs text-teal-700"
                    disabled={!!inFlight || busyId === c.id}
                  />
                  <button
                    onClick={() => ingest(c)}
                    disabled={!!inFlight || busyId === c.id}
                    className="px-4 py-2 text-sm bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-lg disabled:opacity-50"
                  >
                    {inFlight
                      ? 'Ingesting…'
                      : busyId === c.id
                        ? 'Uploading…'
                        : st
                          ? 'Re-ingest'
                          : 'Ingest book'}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
