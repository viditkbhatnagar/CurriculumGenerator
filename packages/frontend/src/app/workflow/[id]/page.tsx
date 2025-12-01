'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useWorkflow, useWorkflowProgress, useCompleteWorkflow } from '@/hooks/useWorkflow';
import {
  WorkflowStep,
  STEP_NAMES,
  STEP_DESCRIPTIONS,
  ESTIMATED_TIMES,
  StepStatus,
} from '@/types/workflow';

// Step components (we'll create these next)
import Step1Form from '@/components/workflow/Step1Form';
import Step2Form from '@/components/workflow/Step2Form';
import Step3Form from '@/components/workflow/Step3Form';
import Step4View from '@/components/workflow/Step4View';
import Step5View from '@/components/workflow/Step5View';
import Step6View from '@/components/workflow/Step6View';
import Step7Form from '@/components/workflow/Step7Form';
import Step8View from '@/components/workflow/Step8View';
import Step9View from '@/components/workflow/Step9View';

// Step icons
const STEP_ICONS: Record<WorkflowStep, React.ReactNode> = {
  1: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  ),
  2: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
      />
    </svg>
  ),
  3: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 10V3L4 14h7v7l9-11h-7z"
      />
    </svg>
  ),
  4: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 6h16M4 12h16M4 18h16"
      />
    </svg>
  ),
  5: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
      />
    </svg>
  ),
  6: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
      />
    </svg>
  ),
  7: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
  8: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
      />
    </svg>
  ),
  9: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
      />
    </svg>
  ),
};

function getStepStatusColor(status?: StepStatus, isCurrent: boolean = false): string {
  if (status === 'approved' || status === 'completed') {
    return 'bg-emerald-500 text-white border-emerald-500';
  }
  if (isCurrent) {
    return 'bg-cyan-500 text-white border-cyan-500';
  }
  if (status === 'in_progress') {
    return 'bg-amber-500 text-white border-amber-500';
  }
  return 'bg-slate-800 text-slate-400 border-slate-700';
}

export default function WorkflowDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  // All hooks MUST be declared before any conditional returns
  const [activeStep, setActiveStep] = useState<WorkflowStep | null>(null);
  const [showCompletionModal, setShowCompletionModal] = useState(false);

  const { data: workflow, isLoading, error, refetch } = useWorkflow(id);
  const { data: progress } = useWorkflowProgress(id);
  const completeWorkflow = useCompleteWorkflow();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-300">Loading workflow...</p>
        </div>
      </div>
    );
  }

  if (error || !workflow) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center text-red-400">
          <p>Failed to load workflow</p>
          <button
            onClick={() => router.push('/workflow')}
            className="mt-4 px-4 py-2 bg-slate-700 rounded-lg text-white"
          >
            Back to Workflows
          </button>
        </div>
      </div>
    );
  }

  // Set active step to current step if not set
  const currentStep = activeStep || (workflow.currentStep as WorkflowStep);

  const handleStepComplete = () => {
    refetch();
    // If we just completed a step, move to next
    if (currentStep < 9) {
      setActiveStep((currentStep + 1) as WorkflowStep);
    }
  };

  const handleCompleteWorkflow = async () => {
    try {
      await completeWorkflow.mutateAsync(id);
      await refetch();
      setShowCompletionModal(true);
    } catch (err) {
      console.error('Failed to complete workflow:', err);
      alert('Failed to complete workflow. Please try again.');
    }
  };

  // Render step content
  const renderStepContent = () => {
    const stepProps = {
      workflow,
      onComplete: handleStepComplete,
      onRefresh: refetch,
    };

    switch (currentStep) {
      case 1:
        return <Step1Form {...stepProps} />;
      case 2:
        return <Step2Form {...stepProps} />;
      case 3:
        return <Step3Form {...stepProps} />;
      case 4:
        return <Step4View {...stepProps} />;
      case 5:
        return <Step5View {...stepProps} />;
      case 6:
        return <Step6View {...stepProps} />;
      case 7:
        return <Step7Form {...stepProps} />;
      case 8:
        return <Step8View {...stepProps} />;
      case 9:
        return <Step9View {...stepProps} />;
      default:
        return null;
    }
  };

  const isStepAccessible = (step: WorkflowStep): boolean => {
    // Can access any completed step or the current step
    if (step <= workflow.currentStep) return true;
    // Can access next step if previous is complete
    const prevStep = workflow.stepProgress.find((p) => p.step === step - 1);
    return prevStep?.status === 'approved' || prevStep?.status === 'completed';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700/50 backdrop-blur-sm bg-slate-900/50 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/workflow')}
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
                <h1 className="text-xl font-bold text-white">{workflow.projectName}</h1>
                <p className="text-slate-400 text-sm">
                  Step {workflow.currentStep} of 9 •{' '}
                  {progress?.estimatedTimeRemaining || '~2 hours'} remaining
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {workflow.currentStep === 9 && workflow.step9 && (
                <button
                  onClick={handleCompleteWorkflow}
                  disabled={completeWorkflow.isPending}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-medium rounded-lg transition-all shadow-lg shadow-emerald-500/20"
                >
                  {completeWorkflow.isPending ? 'Completing...' : 'Complete & Review'}
                </button>
              )}
              <button
                onClick={() => router.push(`/workflow/${id}/export`)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                Export
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500"
                style={{ width: `${progress?.progressPercent || 0}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6 flex gap-6">
        {/* Sidebar - Step Navigation */}
        <aside className="w-72 flex-shrink-0">
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden sticky top-28">
            <div className="p-4 border-b border-slate-700/50">
              <h2 className="font-semibold text-white">Workflow Steps</h2>
            </div>
            <nav className="p-2">
              {([1, 2, 3, 4, 5, 6, 7, 8, 9] as WorkflowStep[]).map((step) => {
                const stepProgress = workflow.stepProgress.find((p) => p.step === step);
                const isAccessible = isStepAccessible(step);
                const isCurrent = workflow.currentStep === step;
                const isActive = currentStep === step;

                return (
                  <button
                    key={step}
                    onClick={() => isAccessible && setActiveStep(step)}
                    disabled={!isAccessible}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all mb-1 ${
                      isActive
                        ? 'bg-cyan-500/20 border border-cyan-500/50'
                        : isAccessible
                          ? 'hover:bg-slate-700/50'
                          : 'opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${getStepStatusColor(
                        stepProgress?.status,
                        isCurrent
                      )}`}
                    >
                      {stepProgress?.status === 'approved' ||
                      stepProgress?.status === 'completed' ? (
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
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      ) : (
                        <span className="text-sm font-medium">{step}</span>
                      )}
                    </div>
                    <div className="flex-1 text-left">
                      <p
                        className={`text-sm font-medium ${
                          isActive
                            ? 'text-cyan-400'
                            : isAccessible
                              ? 'text-white'
                              : 'text-slate-500'
                        }`}
                      >
                        {STEP_NAMES[step]}
                      </p>
                      <p className="text-xs text-slate-500">{ESTIMATED_TIMES[step]}</p>
                    </div>
                    {stepProgress?.status === 'approved' && (
                      <span className="text-emerald-400 text-xs">Approved</span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          {/* Step Header */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6 mb-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center text-cyan-400">
                {STEP_ICONS[currentStep]}
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">
                  Step {currentStep}: {STEP_NAMES[currentStep]}
                </h2>
                <p className="text-slate-400">{STEP_DESCRIPTIONS[currentStep]}</p>
              </div>
            </div>
          </div>

          {/* Step Content */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50">
            {renderStepContent()}
          </div>
        </main>
      </div>

      {/* Completion Modal */}
      {showCompletionModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-2xl p-8 w-full max-w-md border border-slate-700 shadow-2xl text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-emerald-500/20 to-green-500/20 flex items-center justify-center">
              <svg
                className="w-10 h-10 text-emerald-400"
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
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">🎉 Curriculum Complete!</h2>
            <p className="text-slate-400 mb-6">
              Your curriculum has been successfully generated and is ready for export.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCompletionModal(false)}
                className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                Continue Editing
              </button>
              <button
                onClick={() => router.push(`/workflow/${id}/export`)}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-medium rounded-lg transition-all"
              >
                Export Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
