'use client';

import { useState } from 'react';
import { useExportProgram, ExportFormat } from '@/hooks/useExport';

interface ExportButtonProps {
  programId: string;
}

export function ExportButton({ programId }: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const exportProgram = useExportProgram();

  const handleExport = async (format: ExportFormat) => {
    try {
      await exportProgram.mutateAsync({ programId, format });
      setIsOpen(false);
    } catch (error) {
      alert('Export failed. Please try again.');
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={exportProgram.isPending}
        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center"
      >
        {exportProgram.isPending ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            Exporting...
          </>
        ) : (
          <>
            📥 Export
            <svg
              className="ml-2 h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </>
        )}
      </button>

      {isOpen && !exportProgram.isPending && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
          <div className="py-1">
            <button
              onClick={() => handleExport('docx')}
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              📄 Export as DOCX
            </button>
            <button
              onClick={() => handleExport('pdf')}
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              📕 Export as PDF
            </button>
            <button
              onClick={() => handleExport('scorm')}
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              📦 Export as SCORM
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
