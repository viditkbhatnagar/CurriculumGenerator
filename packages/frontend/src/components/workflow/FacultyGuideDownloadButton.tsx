'use client';

import { useState } from 'react';
import { downloadFile } from '@/lib/download';

interface FacultyGuideDownloadButtonProps {
  workflowId: string;
  programName: string;
}

/**
 * Downloads the Step 10 lesson plans reorganised as a faculty delivery guide: one Word file
 * per module, nine short sections per session, for the lecturer who teaches it. Requested by
 * the BBA's SME, who found the lesson-plan files too dense to scan while preparing a session.
 */
export default function FacultyGuideDownloadButton({
  workflowId,
  programName,
}: FacultyGuideDownloadButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setBusy(true);
    setError(null);
    try {
      const slug = programName.replace(/[^a-zA-Z0-9]+/g, '-') || 'curriculum';
      // A 46-module programme builds one document per module; allow it the time it needs.
      await downloadFile(
        `/api/v3/workflow/${workflowId}/export/faculty-guide`,
        `${slug}-Faculty-Delivery-Guide.zip`,
        { timeout: 600000 }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not build the faculty guide');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        disabled={busy}
        title="One Word file per module: session focus, alignment, teaching guidance, key concepts, activities, prompts, checks, resources and takeaways"
        className="px-4 py-2 text-sm font-medium rounded-lg border border-teal-300 text-teal-700 hover:bg-teal-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {busy ? 'Building faculty guide…' : 'Faculty delivery guide'}
      </button>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
