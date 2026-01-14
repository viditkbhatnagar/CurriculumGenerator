'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useWorkflow } from '@/hooks/useWorkflow';
import { api } from '@/lib/api';

interface Module {
  id: string;
  moduleCode: string;
  title: string;
}

interface PPTValidationResponse {
  success: boolean;
  data: {
    isComplete: boolean;
    missingSteps: number[];
    canGeneratePPT: boolean;
    moduleCount: number;
    modules: Module[];
  };
}

export default function PPTGenerationPage() {
  const params = useParams();
  const router = useRouter();
  const workflowId = params.id as string;

  const { data: workflow, isLoading: workflowLoading } = useWorkflow(workflowId);

  const [validation, setValidation] = useState<PPTValidationResponse['data'] | null>(null);
  const [isValidating, setIsValidating] = useState(true);
  const [generatingModules, setGeneratingModules] = useState<Set<string>>(new Set());
  const [completedModules, setCompletedModules] = useState<Set<string>>(new Set());
  const [errorModules, setErrorModules] = useState<Set<string>>(new Set());
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [currentGeneratingModule, setCurrentGeneratingModule] = useState<string>('');
  const [progressMessage, setProgressMessage] = useState<string>('');

  // Validate workflow on mount
  useEffect(() => {
    validateWorkflow();
  }, [workflowId]);

  const validateWorkflow = async () => {
    try {
      setIsValidating(true);
      const response = await api.get<PPTValidationResponse>(`/api/v3/ppt/validate/${workflowId}`);

      if (response.data.success) {
        setValidation(response.data.data);
      }
    } catch (error: any) {
      console.error('Failed to validate workflow:', error);
      alert('Failed to validate workflow. Please try again.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleGenerateSingle = async (moduleId: string, moduleCode: string) => {
    try {
      setGeneratingModules((prev) => new Set(prev).add(moduleId));
      setProgressMessage(`Generating PPT for ${moduleCode}...`);

      const response = await api.post(
        `/api/v3/ppt/generate/module/${workflowId}/${moduleId}`,
        {},
        {
          responseType: 'blob',
        }
      );

      // Download the file
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;

      // Extract filename from response headers or use default
      const contentDisposition = response.headers['content-disposition'];
      let filename = `${moduleCode}_Presentation.pptx`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setCompletedModules((prev) => new Set(prev).add(moduleId));
      setProgressMessage(`Successfully generated PPT for ${moduleCode}`);
    } catch (error: any) {
      console.error('Failed to generate PPT:', error);
      setErrorModules((prev) => new Set(prev).add(moduleId));
      setProgressMessage(`Failed to generate PPT for ${moduleCode}`);
      alert(`Failed to generate PowerPoint for ${moduleCode}. Please try again.`);
    } finally {
      setGeneratingModules((prev) => {
        const newSet = new Set(prev);
        newSet.delete(moduleId);
        return newSet;
      });
    }
  };

  const handleGenerateAll = async () => {
    try {
      setIsGeneratingAll(true);
      setProgressMessage('Generating PowerPoints for all modules...');

      const response = await api.post(
        `/api/v3/ppt/generate/all/${workflowId}`,
        {},
        {
          responseType: 'blob',
        }
      );

      // Download the ZIP file
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;

      // Extract filename from response headers or use default
      const contentDisposition = response.headers['content-disposition'];
      let filename = 'All_Modules_Presentations.zip';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setProgressMessage('Successfully generated all PowerPoints!');

      // Mark all modules as completed
      if (validation?.modules) {
        setCompletedModules(new Set(validation.modules.map((m) => m.id)));
      }
    } catch (error: any) {
      console.error('Failed to generate all PPTs:', error);
      setProgressMessage('Failed to generate PowerPoints');
      alert('Failed to generate PowerPoints. Please try again.');
    } finally {
      setIsGeneratingAll(false);
    }
  };

  if (workflowLoading || isValidating) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-teal-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#80A3A2] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-teal-600">Loading workflow...</p>
        </div>
      </div>
    );
  }

  if (!validation || !validation.canGeneratePPT) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-teal-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl border border-teal-200/50 p-8 text-center shadow-sm">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-rose-100 flex items-center justify-center">
              <svg
                className="w-10 h-10 text-rose-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-teal-800 mb-4">Cannot Generate PowerPoints</h2>
            <p className="text-teal-600 mb-6">
              Please complete all 9 steps of the curriculum workflow before generating PowerPoints.
            </p>
            {validation && validation.missingSteps.length > 0 && (
              <div className="mb-6">
                <p className="text-teal-700 mb-2">Missing steps:</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {validation.missingSteps.map((step) => (
                    <span
                      key={step}
                      className="px-3 py-1 bg-rose-100 text-rose-600 rounded-full text-sm"
                    >
                      Step {step}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <button
              onClick={() => router.push(`/workflow/${workflowId}`)}
              className="px-6 py-3 bg-gradient-to-r from-[#80A3A2] to-[#5a9090] hover:from-[#8fb3b2] hover:to-[#6aa0a0] text-white font-medium rounded-lg transition-all"
            >
              Return to Workflow
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-teal-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push(`/workflow/${workflowId}`)}
            className="mb-4 text-teal-600 hover:text-teal-800 flex items-center gap-2 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Workflow
          </button>

          <div className="bg-white rounded-xl border border-teal-200/50 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-teal-800 mb-2">PowerPoint Generation</h1>
                <p className="text-teal-600">
                  Generate professional PowerPoint presentations for each module
                </p>
              </div>
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#c4967a]/20 to-[#b47a5a]/20 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-[#c4967a]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Progress Message */}
        {progressMessage && (
          <div className="mb-6 bg-white rounded-lg border border-teal-200/50 p-4 shadow-sm">
            <p className="text-teal-700 text-center">{progressMessage}</p>
          </div>
        )}

        {/* Generate All Button */}
        <div className="mb-6">
          <button
            onClick={handleGenerateAll}
            disabled={isGeneratingAll}
            className="w-full px-6 py-4 bg-gradient-to-r from-[#80A3A2] to-[#5a9090] hover:from-[#8fb3b2] hover:to-[#6aa0a0] disabled:from-teal-200 disabled:to-teal-300 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all shadow-lg flex items-center justify-center gap-3"
          >
            {isGeneratingAll ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Generating All PowerPoints...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                Generate All PowerPoints (ZIP)
              </>
            )}
          </button>
        </div>

        {/* Module List */}
        <div className="bg-white rounded-xl border border-teal-200/50 p-6 shadow-sm">
          <h2 className="text-xl font-bold text-teal-800 mb-4">Modules ({validation.moduleCount})</h2>

          <div className="space-y-3">
            {validation.modules.map((module) => {
              const isGenerating = generatingModules.has(module.id);
              const isCompleted = completedModules.has(module.id);
              const hasError = errorModules.has(module.id);

              return (
                <div
                  key={module.id}
                  className="flex items-center justify-between p-4 bg-teal-50/50 rounded-lg border border-teal-200/30 hover:border-teal-300 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        isCompleted
                          ? 'bg-[#80A3A2]/20 text-[#80A3A2]'
                          : hasError
                            ? 'bg-rose-100 text-rose-500'
                            : 'bg-[#c4967a]/20 text-[#c4967a]'
                      }`}
                    >
                      {isCompleted ? (
                        <svg
                          className="w-5 h-5"
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
                      ) : hasError ? (
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                          />
                        </svg>
                      )}
                    </div>
                    <div>
                      <p className="text-teal-800 font-medium">{module.moduleCode}</p>
                      <p className="text-sm text-teal-600">{module.title}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleGenerateSingle(module.id, module.moduleCode)}
                    disabled={isGenerating || isGeneratingAll}
                    className="px-4 py-2 bg-gradient-to-r from-[#80A3A2] to-[#5a9090] hover:from-[#8fb3b2] hover:to-[#6aa0a0] disabled:from-teal-200 disabled:to-teal-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-all flex items-center gap-2"
                  >
                    {isGenerating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Generating...
                      </>
                    ) : isCompleted ? (
                      <>
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                          />
                        </svg>
                        Regenerate
                      </>
                    ) : (
                      <>
                        <svg
                          className="w-4 h-4"
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
                        Generate PPT
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
