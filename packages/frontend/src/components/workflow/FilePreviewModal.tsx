'use client';

import { useState, useEffect, useRef } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface FilePreviewModalProps {
  fileId: string;
  filename: string;
  mimeType?: string;
  onClose: () => void;
}

/**
 * In-app preview for an SME-uploaded source file.
 *  - PDF  → rendered in an <iframe>
 *  - DOCX → rendered with docx-preview
 *  - anything else → a "download to view" message
 *
 * The /api/v3/files/:id endpoint requires a JWT, so the bytes are fetched
 * with the token and handed to the renderer as a blob — an <iframe src>
 * pointing straight at the API would not carry the auth header.
 */
export default function FilePreviewModal({
  fileId,
  filename,
  mimeType,
  onClose,
}: FilePreviewModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const docxRef = useRef<HTMLDivElement | null>(null);

  const lower = (mimeType || '').toLowerCase();
  const isPdf = lower.includes('pdf') || /\.pdf$/i.test(filename);
  const isDocx = lower.includes('wordprocessingml') || /\.docx$/i.test(filename);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    (async () => {
      setLoading(true);
      setError(null);
      if (!isPdf && !isDocx) {
        setError('In-app preview isn’t available for this file type — use Download to open it.');
        setLoading(false);
        return;
      }
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
        const resp = await fetch(`${API_BASE}/api/v3/files/${fileId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const blob = await resp.blob();
        if (cancelled) return;
        if (isPdf) {
          objectUrl = URL.createObjectURL(blob);
          setPdfUrl(objectUrl);
        } else {
          // Loaded on demand — keeps docx-preview out of the main bundle.
          const { renderAsync } = await import('docx-preview');
          if (cancelled || !docxRef.current) return;
          docxRef.current.innerHTML = '';
          await renderAsync(blob, docxRef.current);
        }
      } catch (err) {
        console.error('File preview failed:', err);
        if (!cancelled) {
          setError('Could not load the preview. Try downloading the file instead.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileId, isPdf, isDocx]);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
          <h3 className="text-sm font-semibold text-gray-800 truncate">{filename}</h3>
          <button
            onClick={onClose}
            aria-label="Close preview"
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors shrink-0"
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

        <div className="flex-1 overflow-auto bg-gray-100">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-16 text-gray-500 text-sm">
              <div className="w-5 h-5 border-2 border-[#80A3A2] border-t-transparent rounded-full animate-spin" />
              Loading preview…
            </div>
          )}
          {error && <div className="py-16 px-6 text-center text-sm text-gray-600">{error}</div>}
          {!loading && !error && isPdf && pdfUrl && (
            <iframe src={pdfUrl} title={filename} className="w-full h-full border-0" />
          )}
          {!error && isDocx && <div ref={docxRef} className="p-4" />}
        </div>
      </div>
    </div>
  );
}
