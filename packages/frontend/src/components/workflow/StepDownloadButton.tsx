'use client';

import { useState } from 'react';
import { downloadFile } from '@/lib/download';

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

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const moduleParam = moduleIndex !== undefined ? `?module=${moduleIndex}` : '';
      const url = `/api/v3/workflow/${workflowId}/export/word/step/${stepNumber}${moduleParam}`;
      const programSlug = programName.replace(/[^a-zA-Z0-9]/g, '-') || 'curriculum';
      const moduleSlug = moduleCode ? `-${moduleCode}` : '';
      const filename = `${programSlug}-Step${stepNumber}${moduleSlug}.docx`;

      await downloadFile(url, filename);
    } catch (err) {
      console.error('Step download failed:', err);
      alert(`Failed to download Step ${stepNumber} document. Please try again.`);
    } finally {
      setDownloading(false);
    }
  };

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
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={handleDownload}
      disabled={disabled || downloading}
      className={`px-3 py-1.5 bg-[#80A3A2] hover:bg-[#6b8e8d] text-white border border-[#80A3A2] rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 ${className || ''}`}
    >
      {downloading ? (
        <>
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          Downloading...
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          {moduleCode ? `Download ${moduleCode}` : 'Download Word'}
        </>
      )}
    </button>
  );
}
