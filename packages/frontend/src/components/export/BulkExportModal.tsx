'use client';

import { useState } from 'react';
import { useBulkExport, ExportFormat } from '@/hooks/useExport';

interface BulkExportModalProps {
  programIds: string[];
  isOpen: boolean;
  onClose: () => void;
}

export function BulkExportModal({ programIds, isOpen, onClose }: BulkExportModalProps) {
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const bulkExport = useBulkExport();

  const handleExport = async () => {
    try {
      await bulkExport.mutateAsync({ programIds, format });
      onClose();
    } catch (error) {
      alert('Bulk export failed. Please try again.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Bulk Export</h2>
        <p className="text-gray-600 mb-4">
          Export {programIds.length} program{programIds.length !== 1 ? 's' : ''}
        </p>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Export Format
          </label>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as ExportFormat)}
            className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500"
          >
            <option value="docx">DOCX</option>
            <option value="pdf">PDF</option>
            <option value="scorm">SCORM</option>
          </select>
        </div>

        {bulkExport.isPending && (
          <div className="mb-4">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
            </div>
            <p className="text-sm text-gray-600 mt-2 text-center">
              Exporting programs... This may take a few moments.
            </p>
          </div>
        )}

        <div className="flex justify-end space-x-4">
          <button
            onClick={onClose}
            disabled={bulkExport.isPending}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={bulkExport.isPending}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {bulkExport.isPending ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </div>
    </div>
  );
}
