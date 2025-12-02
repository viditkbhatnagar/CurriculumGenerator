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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-300">Loading export...</p>
        </div>
      </div>
    );
  }

  if (error || !workflow) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">Failed to load workflow</p>
          <button
            onClick={() => router.push('/workflow')}
            className="px-4 py-2 bg-slate-700 rounded-lg text-white"
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700/50 backdrop-blur-sm bg-slate-900/50 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push(`/workflow/${id}`)}
                className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
              >
                <svg
                  className="w-5 h-5 text-slate-400"
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
                <h1 className="text-xl font-bold text-white">Export: {workflow.projectName}</h1>
                <p className="text-slate-400 text-sm">Download your curriculum package</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Primary Download Section */}
        <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-2xl border border-cyan-500/30 p-8 mb-8">
          <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
              <svg
                className="w-10 h-10 text-cyan-400"
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
            <h2 className="text-2xl font-bold text-white mb-2">Download Curriculum Package</h2>
            <p className="text-slate-400">
              Export your complete curriculum as a professionally formatted Word document
            </p>
          </div>

          <button
            onClick={handleDownloadWord}
            disabled={isDownloadingWord || !hasData}
            className="w-full py-4 px-6 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 text-lg shadow-lg shadow-cyan-500/20"
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
            <p className="text-amber-400 text-sm text-center mt-4">
              ⚠️ Complete at least Step 1 to enable export
            </p>
          )}
        </div>

        {/* Document Contents Preview */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6 mb-8">
          <h3 className="text-lg font-semibold text-white mb-4">Document Contents</h3>

          <div className="grid grid-cols-3 gap-3">
            {([1, 2, 3, 4, 5, 6, 7, 8, 9] as WorkflowStep[]).map((step) => {
              const stepData = workflow[`step${step}` as keyof typeof workflow];
              const hasStepData = !!stepData;

              return (
                <div
                  key={step}
                  className={`p-3 rounded-lg border flex items-center gap-2 ${
                    hasStepData
                      ? 'bg-emerald-500/10 border-emerald-500/30'
                      : 'bg-slate-900/50 border-slate-700'
                  }`}
                >
                  {hasStepData ? (
                    <svg
                      className="w-4 h-4 text-emerald-400 flex-shrink-0"
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
                      className="w-4 h-4 text-slate-500 flex-shrink-0"
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
                    className={`text-sm truncate ${hasStepData ? 'text-white' : 'text-slate-500'}`}
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
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6 mb-8">
            <h3 className="text-lg font-semibold text-white mb-4">Program Summary</h3>

            <div className="space-y-4">
              <div>
                <h4 className="text-xl font-bold text-cyan-400">
                  {workflow.step1?.programTitle || workflow.projectName}
                </h4>
                {workflow.step1?.programDescription && (
                  <p className="text-slate-300 mt-2 text-sm">{workflow.step1.programDescription}</p>
                )}
              </div>

              <div className="grid grid-cols-4 gap-4 pt-4 border-t border-slate-700">
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">
                    {workflow.step1?.creditFramework?.credits || '-'}
                  </p>
                  <p className="text-xs text-slate-500">Credits</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">
                    {workflow.step1?.creditFramework?.totalHours || '-'}
                  </p>
                  <p className="text-xs text-slate-500">Total Hours</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-white capitalize">
                    {workflow.step1?.academicLevel || '-'}
                  </p>
                  <p className="text-xs text-slate-500">Level</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">
                    {workflow.step4?.modules?.length || '-'}
                  </p>
                  <p className="text-xs text-slate-500">Modules</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Alternative Formats */}
        <div className="bg-slate-800/30 rounded-xl border border-slate-700/30 p-6">
          <h3 className="text-sm font-medium text-slate-400 mb-4">Alternative Formats</h3>

          <div className="flex gap-4">
            <button
              onClick={handleDownloadJSON}
              disabled={isDownloadingJson || !hasData}
              className="flex-1 py-3 px-4 bg-slate-700/50 hover:bg-slate-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isDownloadingJson ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <svg
                    className="w-5 h-5 text-slate-400"
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

            <div className="flex-1 py-3 px-4 bg-slate-800/50 text-slate-500 rounded-lg border border-dashed border-slate-700 flex items-center justify-center gap-2 cursor-not-allowed">
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
        <div className="mt-6 p-4 bg-slate-800/20 rounded-lg">
          <div className="flex items-center justify-between text-xs text-slate-500">
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
