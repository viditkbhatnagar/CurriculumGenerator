'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

interface StepVersion {
  fileId: string;
  savedAt: string;
  sizeBytes?: number;
}

interface StepVersionHistoryProps {
  workflowId: string;
  stepNumber: number;
  onRestored: () => void | Promise<void>;
}

/** Compact relative time — "just now" / "3m ago" / "2h ago" / "5d ago". */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (isNaN(then)) return '';
  const secs = Math.max(0, (Date.now() - then) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

/**
 * "Version history" control for a workflow step. Lists the snapshots
 * saved automatically before each regeneration and lets the user
 * restore one. Restoring snapshots the current version first, so it is
 * itself reversible.
 */
export default function StepVersionHistory({
  workflowId,
  stepNumber,
  onRestored,
}: StepVersionHistoryProps) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<StepVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadVersions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await api.get(`/api/v3/workflow/${workflowId}/step/${stepNumber}/versions`);
      setVersions(resp.data?.data ?? []);
    } catch {
      setVersions([]);
    } finally {
      setLoading(false);
    }
  }, [workflowId, stepNumber]);

  // Keep the count fresh on mount and whenever the viewed step changes.
  useEffect(() => {
    loadVersions();
  }, [loadVersions]);

  // Escape closes the modal.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const handleRestore = async (fileId: string) => {
    if (
      !confirm(
        'Restore this version?\n\nThe current version is saved to history first, so you can switch back.'
      )
    ) {
      return;
    }
    setRestoringId(fileId);
    setError(null);
    try {
      await api.post(`/api/v3/workflow/${workflowId}/step/${stepNumber}/restore`, { fileId });
      setOpen(false);
      await onRestored();
      await loadVersions();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to restore this version.');
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
          loadVersions();
        }}
        title="See and restore earlier versions of this step"
        className="px-3 py-1.5 bg-white border border-teal-300 text-teal-700 hover:bg-teal-50 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 shrink-0"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        Version history
        {versions.length > 0 && (
          <span className="ml-0.5 text-xs bg-teal-100 text-teal-700 rounded-full px-1.5">
            {versions.length}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-lg w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
              <h3 className="text-sm font-semibold text-gray-800">
                Step {stepNumber} — Version history
              </h3>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4">
              {loading && (
                <div className="flex items-center justify-center gap-2 py-10 text-gray-500 text-sm">
                  <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                  Loading…
                </div>
              )}
              {error && (
                <div className="mb-3 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}
              {!loading && versions.length === 0 && (
                <p className="py-10 text-center text-sm text-gray-500">
                  No earlier versions yet. A snapshot is saved automatically each time you
                  regenerate this step — then you can restore it here.
                </p>
              )}
              {versions.length > 0 && (
                <ul className="space-y-2">
                  {versions.map((v, i) => (
                    <li
                      key={v.fileId}
                      className="flex items-center justify-between gap-3 border border-gray-200 rounded-lg px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm text-gray-800">
                          Saved {relativeTime(v.savedAt)}
                          {i === 0 && (
                            <span className="ml-2 text-xs text-teal-600">(most recent)</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {new Date(v.savedAt).toLocaleString()}
                          {v.sizeBytes ? ` · ${(v.sizeBytes / 1024).toFixed(0)} KB` : ''}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRestore(v.fileId)}
                        disabled={restoringId !== null}
                        className="px-3 py-1.5 bg-teal-500/15 hover:bg-teal-500/25 text-teal-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 shrink-0"
                      >
                        {restoringId === v.fileId ? 'Restoring…' : 'Restore'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
