'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { downloadFile } from '@/lib/download';
import { api } from '@/lib/api';

interface StepDownloadButtonProps {
  workflowId: string;
  stepNumber: number;
  programName: string;
  disabled?: boolean;
  moduleIndex?: number;
  moduleCode?: string;
  variant?: 'icon' | 'full';
  className?: string;
}

interface CacheStatus {
  cached: boolean;
  current: boolean;
  generatedAt?: string;
  sizeBytes?: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/** Compact relative time — "just now" / "3m ago" / "2h ago" / "5d ago". */
function relativeTime(iso?: string): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (isNaN(then)) return '';
  const secs = Math.max(0, (Date.now() - then) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

export default function StepDownloadButton({
  workflowId,
  stepNumber,
  programName,
  disabled,
  moduleIndex,
  moduleCode,
  variant = 'full',
  className,
}: StepDownloadButtonProps) {
  const [downloading, setDownloading] = useState(false);
  const [cache, setCache] = useState<CacheStatus | null>(null);

  // In-app preview modal state.
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);

  const moduleParam = moduleIndex !== undefined ? `?module=${moduleIndex}` : '';
  const exportPath = `/api/v3/workflow/${workflowId}/export/word/step/${stepNumber}${moduleParam}`;

  // Check whether this step already has an up-to-date cached export in S3.
  const refreshCacheStatus = useCallback(async () => {
    try {
      const resp = await api.get(
        `/api/v3/workflow/${workflowId}/export/word/step/${stepNumber}/cache-status${moduleParam}`
      );
      setCache(resp.data?.data ?? null);
    } catch {
      setCache(null); // any failure → treat as "no cached copy"
    }
  }, [workflowId, stepNumber, moduleParam]);

  // Only the full variant surfaces the cached-copy UI (the icon variant
  // is used in dense module rows where extra controls would clutter).
  useEffect(() => {
    if (!disabled && variant === 'full') refreshCacheStatus();
  }, [disabled, variant, refreshCacheStatus]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const programSlug = programName.replace(/[^a-zA-Z0-9]/g, '-') || 'curriculum';
      const moduleSlug = moduleCode ? `-${moduleCode}` : '';
      const filename = `${programSlug}-Step${stepNumber}${moduleSlug}.docx`;
      // 10 min — the first render calls OpenAI; cached repeats are instant.
      await downloadFile(exportPath, filename, { timeout: 600000 });
      // It is now cached — reveal the "saved copy" actions.
      if (variant === 'full') refreshCacheStatus();
    } catch (err) {
      console.error('Step download failed:', err);
      alert(`Failed to download Step ${stepNumber} document. Please try again.`);
    } finally {
      setDownloading(false);
    }
  };

  // Render the cached .docx inside the app (docx-preview) — no new tab,
  // no third-party viewer, no server-side conversion.
  useEffect(() => {
    if (!previewOpen) return;
    const container = previewRef.current;
    if (!container) return;

    let cancelled = false;
    container.innerHTML = '';
    setPreviewLoading(true);
    setPreviewError(null);

    (async () => {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
        const resp = await fetch(`${API_BASE}${exportPath}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const blob = await resp.blob();
        if (cancelled) return;
        // Loaded on demand — keeps docx-preview out of the main bundle.
        const { renderAsync } = await import('docx-preview');
        if (cancelled || !previewRef.current) return;
        await renderAsync(blob, previewRef.current);
      } catch (err) {
        console.error('Step preview failed:', err);
        if (!cancelled) {
          setPreviewError('Could not load the preview. Try downloading the file instead.');
        }
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [previewOpen, exportPath]);

  // Close the preview on Escape.
  useEffect(() => {
    if (!previewOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previewOpen]);

  // A cached copy is offered only when it exists AND still matches the
  // current curriculum content (a stale copy stays hidden — the normal
  // Download button regenerates it).
  const hasSavedCopy = !!cache?.cached && !!cache?.current;

  const downloadIcon = (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
      />
    </svg>
  );

  const eyeIcon = (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
      />
    </svg>
  );

  if (variant === 'icon') {
    return (
      <button
        onClick={handleDownload}
        disabled={disabled || downloading}
        title={
          moduleCode
            ? `Download ${moduleCode} Word document`
            : `Download Step ${stepNumber} Word document`
        }
        className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#80A3A2]/20 text-[#80A3A2] ${className || ''}`}
      >
        {downloading ? (
          <div className="w-4 h-4 border-2 border-[#80A3A2] border-t-transparent rounded-full animate-spin" />
        ) : (
          downloadIcon
        )}
      </button>
    );
  }

  return (
    <>
      <div className={`inline-flex flex-col gap-1 ${className || ''}`}>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            disabled={disabled || downloading}
            title={
              hasSavedCopy
                ? 'A saved copy exists — this download is instant'
                : 'Render and download this step as a Word document'
            }
            className="px-3 py-1.5 bg-[#80A3A2] hover:bg-[#6b8e8d] text-white border border-[#80A3A2] rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {downloading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                {downloadIcon}
                {moduleCode ? `Download ${moduleCode}` : 'Download Word'}
              </>
            )}
          </button>

          {/* Extra option — only shown once a current cached export exists. */}
          {hasSavedCopy && !downloading && (
            <button
              onClick={() => setPreviewOpen(true)}
              title="Preview the saved copy in the app"
              className="px-3 py-1.5 bg-transparent hover:bg-[#80A3A2]/10 text-[#80A3A2] border border-[#80A3A2] rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              {eyeIcon}
              Preview
            </button>
          )}
        </div>

        {/* "Saved copy" indicator — clarifies the download is cached/instant. */}
        {hasSavedCopy && !downloading && (
          <span className="text-xs text-[#80A3A2] flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            Saved copy available
            {cache?.generatedAt ? ` · exported ${relativeTime(cache.generatedAt)}` : ''} · downloads
            instantly
          </span>
        )}
      </div>

      {/* In-app preview modal — renders the cached .docx with docx-preview. */}
      {previewOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4"
          onClick={() => setPreviewOpen(false)}
        >
          <div
            className="bg-white rounded-lg w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
              <div>
                <h3 className="text-sm font-semibold text-gray-800">
                  {moduleCode ? `${moduleCode} — Preview` : `Step ${stepNumber} — Preview`}
                </h3>
                <p className="text-xs text-gray-400">
                  Rendered preview — formatting may differ slightly from the Word file
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  className="px-3 py-1.5 bg-[#80A3A2] hover:bg-[#6b8e8d] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-40 flex items-center gap-2"
                >
                  {downloadIcon}
                  Download
                </button>
                <button
                  onClick={() => setPreviewOpen(false)}
                  aria-label="Close preview"
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
            </div>

            <div className="flex-1 overflow-auto bg-gray-100 p-4">
              {previewLoading && (
                <div className="flex items-center justify-center gap-2 py-16 text-gray-500 text-sm">
                  <div className="w-5 h-5 border-2 border-[#80A3A2] border-t-transparent rounded-full animate-spin" />
                  Loading preview…
                </div>
              )}
              {previewError && (
                <div className="py-16 text-center text-sm text-rose-600">{previewError}</div>
              )}
              <div ref={previewRef} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
