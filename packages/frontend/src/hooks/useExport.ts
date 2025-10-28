import { useMutation } from '@tanstack/react-query';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export type ExportFormat = 'docx' | 'pdf' | 'scorm';

async function downloadFile(url: string, filename: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Export failed');
  }
  const blob = await response.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(downloadUrl);
}

export function useExportProgram() {
  return useMutation({
    mutationFn: async ({
      programId,
      format,
    }: {
      programId: string;
      format: ExportFormat;
    }) => {
      const url = `${API_BASE_URL}/api/programs/${programId}/export?format=${format}`;
      const filename = `program-${programId}.${format}`;
      await downloadFile(url, filename);
    },
  });
}

export function useBulkExport() {
  return useMutation({
    mutationFn: async ({
      programIds,
      format,
    }: {
      programIds: string[];
      format: ExportFormat;
    }) => {
      const url = `${API_BASE_URL}/api/programs/bulk-export?format=${format}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ programIds }),
      });

      if (!response.ok) {
        throw new Error('Bulk export failed');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `programs-export.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    },
  });
}
