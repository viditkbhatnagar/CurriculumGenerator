'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useWorkflow, useExportWorkflow } from '@/hooks/useWorkflow';
import { STEP_NAMES, WorkflowStep } from '@/types/workflow';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function ExportPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: workflow, isLoading, error } = useWorkflow(id);
  const { data: exportData, refetch: fetchExport, isFetching: isExporting } = useExportWorkflow(id);

  const [isDownloadingWord, setIsDownloadingWord] = useState(false);
  const [isDownloadingJson, setIsDownloadingJson] = useState(false);

  const handleDownloadWord = async () => {
    setIsDownloadingWord(true);
    try {
      const response = await fetch(`${API_BASE}/api/v3/workflow/${id}/export/word`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to download');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${workflow?.projectName?.replace(/[^a-zA-Z0-9]/g, '-') || 'curriculum'}-${new Date().toISOString().split('T')[0]}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
      alert('Failed to download Word document. Please try again.');
    } finally {
      setIsDownloadingWord(false);
    }
  };

  const handleDownloadJSON = async () => {
    setIsDownloadingJson(true);
    try {
      const result = await fetchExport();
      const data = result.data || exportData;

      if (!data) {
        throw new Error('No data available');
      }

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `curriculum-${workflow?.projectName?.replace(/\s+/g, '-').toLowerCase() || id}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
      alert('Failed to download JSON. Please try again.');
    } finally {
      setIsDownloadingJson(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#233234] via-[#2d4144] to-[#233234] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#80A3A2] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#ABCECF]">Loading export...</p>
        </div>
      </div>
    );
  }

  if (error || !workflow) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#233234] via-[#2d4144] to-[#233234] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#c88c96] mb-4">Failed to load workflow</p>
          <button
            onClick={() => router.push('/workflow')}
            className="px-4 py-2 bg-[#324649] rounded-lg text-white"
          >
            Back to Workflows
          </button>
        </div>
      </div>
    );
  }

  // Check if workflow has any data to export
  const hasData = workflow.step1 || workflow.step2 || workflow.step3;

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-teal-50">
      {/* Header */}
      <header className="border-b border-teal-200/50 backdrop-blur-sm bg-white/80 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push(`/workflow/${id}`)}
                className="p-2 hover:bg-teal-100 rounded-lg transition-colors"
              >
                <svg
                  className="w-5 h-5 text-teal-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
              <div>
                <h1 className="text-xl font-bold text-teal-800">Export: {workflow.projectName}</h1>
                <p className="text-teal-600 text-sm">Download your curriculum package</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Primary Download Section */}
        <div className="bg-gradient-to-br from-[#80A3A2]/10 to-[#5a9090]/10 rounded-2xl border border-[#80A3A2]/30 p-8 mb-8">
          <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#80A3A2]/20 to-[#5a9090]/20 flex items-center justify-center">
              <svg
                className="w-10 h-10 text-[#80A3A2]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-teal-800 mb-2">Download Curriculum Package</h2>
            <p className="text-teal-600">
              Export your complete curriculum as a professionally formatted Word document
            </p>
          </div>

          <button
            onClick={handleDownloadWord}
            disabled={isDownloadingWord || !hasData}
            className="w-full py-4 px-6 bg-gradient-to-r from-[#80A3A2] to-[#5a9090] hover:from-[#8fb3b2] hover:to-[#6aa0a0] text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 text-lg shadow-lg shadow-[#80A3A2]/20"
          >
            {isDownloadingWord ? (
              <>
                <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
                Generating Document...
              </>
            ) : (
              <>
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                Download Word Document (.docx)
              </>
            )}
          </button>

          {!hasData && (
            <p className="text-amber-600 text-sm text-center mt-4">
              ⚠️ Complete at least Step 1 to enable export
            </p>
          )}
        </div>

        {/* Document Contents Preview */}
        <div className="bg-white rounded-xl border border-teal-200/50 p-6 mb-8 shadow-sm">
          <h3 className="text-lg font-semibold text-teal-800 mb-4">Document Contents</h3>

          <div className="grid grid-cols-3 gap-3">
            {([1, 2, 3, 4, 5, 6, 7, 8, 9] as WorkflowStep[]).map((step) => {
              const stepData = workflow[`step${step}` as keyof typeof workflow];
              const hasStepData = !!stepData;

              return (
                <div
                  key={step}
                  className={`p-3 rounded-lg border flex items-center gap-2 ${
                    hasStepData
                      ? 'bg-[#80A3A2]/10 border-[#80A3A2]/30'
                      : 'bg-teal-50/50 border-teal-200'
                  }`}
                >
                  {hasStepData ? (
                    <svg
                      className="w-4 h-4 text-[#80A3A2] flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-4 h-4 text-teal-400 flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4m0 4h.01"
                      />
                    </svg>
                  )}
                  <span
                    className={`text-sm truncate ${hasStepData ? 'text-teal-800' : 'text-teal-500'}`}
                  >
                    {STEP_NAMES[step]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Program Summary */}
        {workflow.step1 && (
          <div className="bg-white rounded-xl border border-teal-200/50 p-6 mb-8 shadow-sm">
            <h3 className="text-lg font-semibold text-teal-800 mb-4">Program Summary</h3>

            <div className="space-y-4">
              <div>
                <h4 className="text-xl font-bold text-[#80A3A2]">
                  {workflow.step1?.programTitle || workflow.projectName}
                </h4>
                {workflow.step1?.programDescription && (
                  <p className="text-teal-700 mt-2 text-sm">{workflow.step1.programDescription}</p>
                )}
              </div>

              <div className="grid grid-cols-4 gap-4 pt-4 border-t border-teal-200">
                <div className="text-center">
                  <p className="text-2xl font-bold text-teal-800">
                    {workflow.step1?.creditFramework?.credits || '-'}
                  </p>
                  <p className="text-xs text-teal-500">Credits</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-teal-800">
                    {workflow.step1?.creditFramework?.totalHours || '-'}
                  </p>
                  <p className="text-xs text-teal-500">Total Hours</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-teal-800 capitalize">
                    {workflow.step1?.academicLevel || '-'}
                  </p>
                  <p className="text-xs text-teal-500">Level</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-teal-800">
                    {workflow.step4?.modules?.length || '-'}
                  </p>
                  <p className="text-xs text-teal-500">Modules</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Alternative Formats */}
        <div className="bg-white/50 rounded-xl border border-teal-200/30 p-6">
          <h3 className="text-sm font-medium text-teal-600 mb-4">Alternative Formats</h3>

          <div className="flex gap-4">
            <button
              onClick={handleDownloadJSON}
              disabled={isDownloadingJson || !hasData}
              className="flex-1 py-3 px-4 bg-teal-100 hover:bg-teal-200 text-teal-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isDownloadingJson ? (
                <>
                  <div className="w-4 h-4 border-2 border-teal-700 border-t-transparent rounded-full animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <svg
                    className="w-5 h-5 text-teal-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  JSON Data Export
                </>
              )}
            </button>

            <div className="flex-1 py-3 px-4 bg-teal-50 text-teal-400 rounded-lg border border-dashed border-teal-200 flex items-center justify-center gap-2 cursor-not-allowed">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Excel (Coming Soon)
            </div>
          </div>
        </div>

        {/* Metadata */}
        <div className="mt-6 p-4 bg-teal-50/50 rounded-lg">
          <div className="flex items-center justify-between text-xs text-teal-500">
            <span>Created: {new Date(workflow.createdAt).toLocaleDateString()}</span>
            <span>Last Updated: {new Date(workflow.updatedAt).toLocaleDateString()}</span>
            {workflow.completedAt && (
              <span>Completed: {new Date(workflow.completedAt).toLocaleDateString()}</span>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
