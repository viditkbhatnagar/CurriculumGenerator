'use client';

import { useState, useEffect, useRef } from 'react';
import { useSubmitStep13, useApproveStep13 } from '@/hooks/useWorkflow';
import { useStepStatus } from '@/hooks/useStepStatus';
import {
  CurriculumWorkflow,
  SectionAQuestion,
  SectionBScenario,
  SectionCTask,
} from '@/types/workflow';
import { useGeneration, GenerationProgressBar } from '@/contexts/GenerationContext';

interface Props {
  workflow: CurriculumWorkflow;
  onComplete: () => void;
  onRefresh: () => void;
}

export default function Step13View({ workflow, onComplete, onRefresh }: Props) {
  const submitStep13 = useSubmitStep13();
  const approveStep13 = useApproveStep13();
  const { startGeneration, completeGeneration, failGeneration, isGenerating, getGenerationState } =
    useGeneration();
  const { status: stepStatusData, startPolling: startStatusPolling } = useStepStatus(
    workflow._id,
    13,
    {
      autoStart: true,
      pollInterval: 10000,
      onComplete: () => {
        completeGeneration(workflow._id, 13);
        onRefresh();
      },
      onFailed: (errorMsg) => {
        failGeneration(workflow._id, 13, errorMsg);
      },
    }
  );
  const queueStatus = stepStatusData?.status || null;
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    sectionA: true,
  });
  const [expandedQuestions, setExpandedQuestions] = useState<Record<string, boolean>>({});
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Detect stale generation (stuck > 20 min without data)
  // Note: queue failure is handled by useStepStatus onFailed callback (transition-based),
  // NOT by checking queueStatus here, because stale status from old jobs would
  // immediately kill new generation attempts.
  useEffect(() => {
    const genState = getGenerationState(workflow._id, 13);
    if (!genState || genState.status !== 'generating') return;

    if (!workflow.step13 && Date.now() - genState.startTime > 20 * 60 * 1000) {
      failGeneration(workflow._id, 13, 'Generation timed out. Please try again.');
    }
  }, [workflow._id, workflow.step13, getGenerationState, failGeneration]);

  // Complete generation when workflow data arrives
  useEffect(() => {
    if (workflow.step13 && isGenerating(workflow._id, 13)) {
      completeGeneration(workflow._id, 13);
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }
  }, [workflow.step13, workflow._id, isGenerating, completeGeneration]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  // Show generating UI if local state OR backend job is active
  const isCurrentlyGenerating =
    isGenerating(workflow._id, 13) ||
    submitStep13.isPending ||
    queueStatus === 'processing' ||
    queueStatus === 'queued';

  const handleGenerate = async () => {
    if (isCurrentlyGenerating) return;
    setError(null);
    startGeneration(workflow._id, 13, 900);

    try {
      await submitStep13.mutateAsync(workflow._id);
      // Start polling AFTER POST succeeds (old job is now removed, new job is queued)
      startStatusPolling();
      // Also refresh workflow data periodically to detect step13 data arrival
      pollIntervalRef.current = setInterval(async () => {
        await onRefresh();
      }, 15000);
      // Clear after 25 minutes (Step 13 can take up to 20 min)
      setTimeout(
        () => {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        },
        25 * 60 * 1000
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate summative exam';
      console.error('Failed to generate exam:', err);
      failGeneration(workflow._id, 13, errorMessage);
      setError(errorMessage);
    }
  };

  const handleApprove = async () => {
    setError(null);
    try {
      await approveStep13.mutateAsync(workflow._id);
      onComplete();
    } catch (err: any) {
      console.error('Failed to approve Step 13:', err);
      setError(err.message || 'Failed to approve Step 13');
    }
  };

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleQuestion = (key: string) => {
    setExpandedQuestions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const hasStep13Data = !!workflow.step13;
  const isApproved = !!workflow.step13?.approvedAt;
  const exam = workflow.step13;

  // Check if Step 12 is approved
  const validStatuses = [
    'step12_complete',
    'step13_pending',
    'step13_complete',
    'review_pending',
    'published',
  ];
  const isStep12Approved = validStatuses.includes(workflow.status);

  // Determine if Section B is excluded (self-study mode)
  const deliveryMode = workflow.step1?.delivery?.mode;
  const isSelfStudy = deliveryMode === 'online_self_study';

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {!hasStep13Data && !isCurrentlyGenerating ? (
        // Pre-Generation View
        <div className="space-y-6">
          {!isStep12Approved && (
            <div className="bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/30 rounded-xl p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                  <svg
                    className="w-6 h-6 text-red-400"
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
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-red-400 mb-1">
                    Step 12 Approval Required
                  </h3>
                  <p className="text-teal-700 text-sm">
                    You must approve Step 12 (Assignment Packs) before generating the Summative
                    Exam.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl p-5">
            <h3 className="text-amber-500 font-semibold mb-3 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
              Step 13: Summative Exam
            </h3>
            <p className="text-sm text-teal-700 mb-4">
              Generate a formal summative exam that validates program-level competence across all
              modules. The exam covers all PLOs and provides model answers with marking criteria.
            </p>

            <div className="bg-teal-50/50 rounded-lg p-4 mb-4">
              <p className="text-teal-600 font-medium mb-3">Exam Structure:</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="bg-white/50 rounded p-3">
                  <p className="text-amber-500 font-medium mb-2">Section A: Knowledge</p>
                  <ul className="text-teal-600 space-y-1">
                    <li>- MCQ questions</li>
                    <li>- Short answer questions</li>
                    <li>- Tests breadth of knowledge</li>
                    <li>- All modules covered</li>
                  </ul>
                </div>
                <div className={`bg-white/50 rounded p-3 ${isSelfStudy ? 'opacity-50' : ''}`}>
                  <p className="text-orange-500 font-medium mb-2">
                    Section B: Scenarios
                    {isSelfStudy && <span className="text-red-400 text-xs ml-1">(Excluded)</span>}
                  </p>
                  <ul className="text-teal-600 space-y-1">
                    <li>- Scenario-based analysis</li>
                    <li>- Applied critical thinking</li>
                    <li>- Model answers provided</li>
                    {isSelfStudy && (
                      <li className="text-red-400">Not available for self-study mode</li>
                    )}
                  </ul>
                </div>
                <div className="bg-white/50 rounded p-3">
                  <p className="text-red-500 font-medium mb-2">Section C: Applied Tasks</p>
                  <ul className="text-teal-600 space-y-1">
                    <li>- Practical application tasks</li>
                    <li>- Simulation exercises</li>
                    <li>- Assessment criteria included</li>
                    <li>- PLO-aligned</li>
                  </ul>
                </div>
              </div>
            </div>

            {isSelfStudy && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                <p className="text-sm text-amber-600 flex items-center gap-2">
                  <svg
                    className="w-4 h-4 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Section B (Scenario Analysis) will be excluded for this online self-study program.
                </p>
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-400">{error}</p>
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={isCurrentlyGenerating || !isStep12Approved}
            className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCurrentlyGenerating ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generating Summative Exam...
              </span>
            ) : !isStep12Approved ? (
              'Approve Step 12 First'
            ) : (
              'Generate Summative Exam'
            )}
          </button>

          {/* Generation Progress */}
          {isCurrentlyGenerating && (
            <GenerationProgressBar workflowId={workflow._id} step={13} queueStatus={queueStatus} />
          )}
        </div>
      ) : isCurrentlyGenerating && !hasStep13Data ? (
        // Generating state
        <div className="space-y-6">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500/20 flex items-center justify-center">
              <div className="w-8 h-8 border-3 border-amber-400 border-t-transparent rounded-full animate-spin" />
            </div>
            <h3 className="text-xl font-bold text-amber-400 mb-2">Generating Summative Exam...</h3>
            <p className="text-teal-700 mb-4">
              This generates the exam in multiple phases. Please wait 1-2 minutes.
            </p>
            <GenerationProgressBar workflowId={workflow._id} step={13} queueStatus={queueStatus} />
          </div>

          <button
            onClick={onRefresh}
            className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white rounded-lg transition-all text-sm font-medium flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh to Check Progress
          </button>
        </div>
      ) : (
        // Display Generated Exam
        <div className="space-y-6">
          {/* Completion Banner */}
          <div
            className={`border rounded-xl p-6 text-center ${
              isApproved
                ? 'bg-gradient-to-r from-emerald-500/20 to-green-500/20 border-emerald-500/30'
                : 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-amber-500/30'
            }`}
          >
            <div
              className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${isApproved ? 'bg-emerald-500/20' : 'bg-amber-500/20'}`}
            >
              <svg
                className={`w-8 h-8 ${isApproved ? 'text-emerald-400' : 'text-amber-400'}`}
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
            {isApproved ? (
              <>
                <h3 className="text-xl font-bold text-emerald-400 mb-2">Step 13 Approved!</h3>
                <p className="text-teal-700 mb-2">
                  The summative exam has been approved. Your curriculum is now complete!
                </p>
                <p className="text-emerald-400 text-sm animate-pulse">
                  Click "Complete & Review" button above to finalize
                </p>
              </>
            ) : (
              <>
                <h3 className="text-xl font-bold text-amber-400 mb-2">Summative Exam Generated!</h3>
                <p className="text-teal-700 mb-4">
                  Review the exam content below and approve to complete the curriculum.
                </p>
                <button
                  onClick={handleApprove}
                  disabled={approveStep13.isPending}
                  className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mx-auto"
                >
                  {approveStep13.isPending ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Approving...
                    </>
                  ) : (
                    <>
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
                      Approve & Complete Curriculum
                    </>
                  )}
                </button>
              </>
            )}
          </div>

          {/* Exam Overview */}
          {exam?.overview && (
            <div className="bg-teal-50/50 rounded-xl p-5 border border-teal-200">
              <h3 className="text-xl font-bold text-teal-800 mb-4">{exam.overview.examTitle}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-teal-500">Duration:</span>
                  <p className="text-teal-800 font-medium">{exam.overview.duration}</p>
                </div>
                <div>
                  <span className="text-teal-500">Total Marks:</span>
                  <p className="text-teal-800 font-medium">{exam.overview.totalMarks}</p>
                </div>
                <div>
                  <span className="text-teal-500">Sections:</span>
                  <p className="text-teal-800 font-medium">
                    {Array.isArray(exam.overview.sectionBreakdown)
                      ? exam.overview.sectionBreakdown
                          .map((s) => `${s.section} (${s.marks} marks)`)
                          .join(', ')
                      : exam.overview.sectionBreakdown}
                  </p>
                </div>
                <div>
                  <span className="text-teal-500">Conditions:</span>
                  <p className="text-teal-800 font-medium">{exam.overview.conditions}</p>
                </div>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-teal-50/50 rounded-xl p-4 border border-teal-200 text-center">
              <p className="text-3xl font-bold text-teal-800">
                {exam?.summary?.totalQuestions || 0}
              </p>
              <p className="text-xs text-teal-500 mt-1">Total Questions</p>
            </div>
            <div className="bg-teal-50/50 rounded-xl p-4 border border-teal-200 text-center">
              <p className="text-3xl font-bold text-amber-500">
                {exam?.summary?.sectionACount || 0}
              </p>
              <p className="text-xs text-teal-500 mt-1">Section A</p>
            </div>
            <div className="bg-teal-50/50 rounded-xl p-4 border border-teal-200 text-center">
              <p className="text-3xl font-bold text-orange-500">
                {exam?.sectionBIncluded ? exam?.summary?.sectionBCount || 0 : 'N/A'}
              </p>
              <p className="text-xs text-teal-500 mt-1">Section B</p>
            </div>
            <div className="bg-teal-50/50 rounded-xl p-4 border border-teal-200 text-center">
              <p className="text-3xl font-bold text-red-500">{exam?.summary?.sectionCCount || 0}</p>
              <p className="text-xs text-teal-500 mt-1">Section C</p>
            </div>
          </div>

          {/* Validation */}
          {exam?.validation && (
            <div className="rounded-lg p-4 border bg-emerald-500/10 border-emerald-500/30">
              <h4 className="font-medium mb-3 text-emerald-400">Validation Report</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <span
                  className={exam.validation.allPLOsCovered ? 'text-emerald-400' : 'text-red-400'}
                >
                  {exam.validation.allPLOsCovered ? '✓' : '✗'} All PLOs Covered
                </span>
                <span className={exam.validation.marksAddUp ? 'text-emerald-400' : 'text-red-400'}>
                  {exam.validation.marksAddUp ? '✓' : '✗'} Marks Add Up
                </span>
                <span
                  className={
                    exam.validation.sectionBalanceValid ? 'text-emerald-400' : 'text-red-400'
                  }
                >
                  {exam.validation.sectionBalanceValid ? '✓' : '✗'} Section Balance
                </span>
                <span
                  className={
                    exam.validation.modelAnswersComplete ? 'text-emerald-400' : 'text-red-400'
                  }
                >
                  {exam.validation.modelAnswersComplete ? '✓' : '✗'} Model Answers Complete
                </span>
              </div>
            </div>
          )}

          {/* Section A: Knowledge Testing */}
          <div className="bg-white rounded-xl border border-teal-200/50 overflow-hidden">
            <button
              onClick={() => toggleSection('sectionA')}
              className="w-full p-5 flex items-center justify-between hover:bg-teal-50/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-bold">
                  A
                </span>
                <h4 className="font-semibold text-teal-800">
                  Section A: Knowledge Testing ({exam?.sectionA?.length || 0} questions)
                </h4>
              </div>
              <svg
                className={`w-5 h-5 text-teal-500 transition-transform ${expandedSections['sectionA'] ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
            {expandedSections['sectionA'] && exam?.sectionA && (
              <div className="px-5 pb-5 space-y-3">
                {exam.sectionA.map((q: SectionAQuestion, i: number) => (
                  <div
                    key={q.questionId || i}
                    className="bg-teal-50/50 rounded-lg border border-teal-100"
                  >
                    <button
                      onClick={() => toggleQuestion(`a-${i}`)}
                      className="w-full p-3 flex items-start justify-between text-left"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs rounded font-medium">
                            Q{i + 1}
                          </span>
                          <span className="px-1.5 py-0.5 bg-teal-100 text-teal-600 text-xs rounded">
                            {q.type === 'mcq' ? 'MCQ' : 'Short Answer'}
                          </span>
                          <span className="text-xs text-teal-500">{q.marks} marks</span>
                        </div>
                        <p className="text-sm text-teal-800">{q.questionText}</p>
                      </div>
                      <svg
                        className={`w-4 h-4 text-teal-400 transition-transform flex-shrink-0 ml-2 mt-1 ${expandedQuestions[`a-${i}`] ? 'rotate-180' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                    {expandedQuestions[`a-${i}`] && (
                      <div className="px-3 pb-3 space-y-2 border-t border-teal-100 pt-2">
                        {q.options && q.options.length > 0 && (
                          <div>
                            <p className="text-xs text-teal-500 mb-1">Options:</p>
                            <div className="space-y-1">
                              {q.options.map((opt, j) => (
                                <p
                                  key={j}
                                  className={`text-sm px-2 py-1 rounded ${opt === q.correctAnswer ? 'bg-emerald-100 text-emerald-700 font-medium' : 'text-teal-600'}`}
                                >
                                  {String.fromCharCode(65 + j)}. {opt}
                                </p>
                              ))}
                            </div>
                          </div>
                        )}
                        <div>
                          <p className="text-xs text-teal-500 mb-1">Correct Answer:</p>
                          <p className="text-sm text-emerald-600 font-medium">{q.correctAnswer}</p>
                        </div>
                        <div>
                          <p className="text-xs text-teal-500 mb-1">Rationale:</p>
                          <p className="text-xs text-teal-600">{q.rationale}</p>
                        </div>
                        <div className="flex gap-1 flex-wrap">
                          {q.linkedMLOs?.map((mlo, j) => (
                            <span
                              key={j}
                              className="px-1.5 py-0.5 bg-blue-100 text-blue-600 text-xs rounded"
                            >
                              {mlo}
                            </span>
                          ))}
                          {q.linkedPLOs?.map((plo, j) => (
                            <span
                              key={j}
                              className="px-1.5 py-0.5 bg-purple-100 text-purple-600 text-xs rounded"
                            >
                              {plo}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section B: Scenario Analysis (Conditional) */}
          {exam?.sectionBIncluded ? (
            <div className="bg-white rounded-xl border border-teal-200/50 overflow-hidden">
              <button
                onClick={() => toggleSection('sectionB')}
                className="w-full p-5 flex items-center justify-between hover:bg-teal-50/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-bold">
                    B
                  </span>
                  <h4 className="font-semibold text-teal-800">
                    Section B: Scenario Analysis ({exam?.sectionB?.length || 0} scenarios)
                  </h4>
                </div>
                <svg
                  className={`w-5 h-5 text-teal-500 transition-transform ${expandedSections['sectionB'] ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              {expandedSections['sectionB'] && exam?.sectionB && (
                <div className="px-5 pb-5 space-y-4">
                  {exam.sectionB.map((scenario: SectionBScenario, i: number) => (
                    <div
                      key={scenario.scenarioId || i}
                      className="bg-teal-50/50 rounded-lg border border-teal-100 p-4"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-xs rounded font-medium">
                          Scenario {i + 1}
                        </span>
                        <span className="text-xs text-teal-500">
                          {scenario.totalMarks} marks total
                        </span>
                      </div>
                      <p className="text-sm text-teal-700 mb-3">{scenario.scenarioText}</p>
                      <div className="space-y-2">
                        {scenario.questions?.map((q, j) => (
                          <div key={q.questionId || j} className="bg-white rounded p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs text-teal-500 font-medium">Q{j + 1}</span>
                              <span className="text-xs text-teal-400">{q.marks} marks</span>
                            </div>
                            <p className="text-sm text-teal-800 mb-2">{q.questionText}</p>
                            <button
                              onClick={() => toggleQuestion(`b-${i}-${j}`)}
                              className="text-xs text-blue-500 hover:underline"
                            >
                              {expandedQuestions[`b-${i}-${j}`] ? 'Hide' : 'Show'} Model Answer
                            </button>
                            {expandedQuestions[`b-${i}-${j}`] && (
                              <div className="mt-2 bg-emerald-50 rounded p-2">
                                <p className="text-xs text-emerald-700">{q.modelAnswer}</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-5">
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-bold">
                  B
                </span>
                <div>
                  <h4 className="font-semibold text-amber-600">Section B: Excluded</h4>
                  <p className="text-sm text-teal-600 mt-1">
                    Section B (Scenario Analysis) is excluded for online self-study delivery mode.
                    Scenario-based analysis requires facilitated interaction which is not available
                    in this mode.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Section C: Applied Tasks */}
          <div className="bg-white rounded-xl border border-teal-200/50 overflow-hidden">
            <button
              onClick={() => toggleSection('sectionC')}
              className="w-full p-5 flex items-center justify-between hover:bg-teal-50/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-bold">
                  C
                </span>
                <h4 className="font-semibold text-teal-800">
                  Section C: Applied Tasks ({exam?.sectionC?.length || 0} tasks)
                </h4>
              </div>
              <svg
                className={`w-5 h-5 text-teal-500 transition-transform ${expandedSections['sectionC'] ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
            {expandedSections['sectionC'] && exam?.sectionC && (
              <div className="px-5 pb-5 space-y-4">
                {exam.sectionC.map((task: SectionCTask, i: number) => (
                  <div
                    key={task.taskId || i}
                    className="bg-teal-50/50 rounded-lg border border-teal-100 p-4"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-xs rounded font-medium">
                        Task {i + 1}
                      </span>
                      <span className="text-xs text-teal-500">{task.marks} marks</span>
                    </div>
                    <p className="text-sm text-teal-800 font-medium mb-2">{task.taskDescription}</p>
                    <p className="text-sm text-teal-600 mb-3">{task.instructions}</p>

                    {task.assessmentCriteria?.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs text-teal-500 mb-1">Assessment Criteria:</p>
                        <ul className="list-disc list-inside text-xs text-teal-600 space-y-0.5">
                          {task.assessmentCriteria.map((c, j) => (
                            <li key={j}>{c}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <button
                      onClick={() => toggleQuestion(`c-${i}`)}
                      className="text-xs text-blue-500 hover:underline"
                    >
                      {expandedQuestions[`c-${i}`] ? 'Hide' : 'Show'} Model Answer
                    </button>
                    {expandedQuestions[`c-${i}`] && (
                      <div className="mt-2 bg-emerald-50 rounded p-3">
                        <p className="text-xs text-emerald-700">{task.modelAnswer}</p>
                      </div>
                    )}

                    <div className="flex gap-1 flex-wrap mt-2">
                      {task.linkedMLOs?.map((mlo, j) => (
                        <span
                          key={j}
                          className="px-1.5 py-0.5 bg-blue-100 text-blue-600 text-xs rounded"
                        >
                          {mlo}
                        </span>
                      ))}
                      {task.linkedPLOs?.map((plo, j) => (
                        <span
                          key={j}
                          className="px-1.5 py-0.5 bg-purple-100 text-purple-600 text-xs rounded"
                        >
                          {plo}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Marking Scheme */}
          {exam?.markingScheme && (
            <div className="bg-white rounded-xl border border-teal-200/50 overflow-hidden">
              <button
                onClick={() => toggleSection('marking')}
                className="w-full p-5 flex items-center justify-between hover:bg-teal-50/50 transition-colors"
              >
                <h4 className="font-semibold text-teal-800">Marking Scheme</h4>
                <svg
                  className={`w-5 h-5 text-teal-500 transition-transform ${expandedSections['marking'] ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              {expandedSections['marking'] && (
                <div className="px-5 pb-5">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="bg-teal-50/50 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-teal-800">
                        {exam.markingScheme.totalMarks}
                      </p>
                      <p className="text-xs text-teal-500">Total Marks</p>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-amber-600">
                        {exam.markingScheme.passMark}%
                      </p>
                      <p className="text-xs text-teal-500">Pass Mark</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-blue-600">
                        {exam.markingScheme.meritThreshold}%
                      </p>
                      <p className="text-xs text-teal-500">Merit Threshold</p>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-emerald-600">
                        {exam.markingScheme.distinctionThreshold}%
                      </p>
                      <p className="text-xs text-teal-500">Distinction</p>
                    </div>
                  </div>
                  {exam.markingScheme.sectionWeights && (
                    <div className="mt-4">
                      <p className="text-xs text-teal-500 mb-2">Section Weights:</p>
                      <div className="flex gap-3">
                        <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded">
                          A: {exam.markingScheme.sectionWeights.sectionA}%
                        </span>
                        {exam.markingScheme.sectionWeights.sectionB !== undefined && (
                          <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded">
                            B: {exam.markingScheme.sectionWeights.sectionB}%
                          </span>
                        )}
                        <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded">
                          C: {exam.markingScheme.sectionWeights.sectionC}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Integrity & Accessibility */}
          {(exam?.integrityAndSecurity || exam?.accessibilityProvisions) && (
            <div className="bg-white rounded-xl border border-teal-200/50 overflow-hidden">
              <button
                onClick={() => toggleSection('integrity')}
                className="w-full p-5 flex items-center justify-between hover:bg-teal-50/50 transition-colors"
              >
                <h4 className="font-semibold text-teal-800">Integrity & Accessibility</h4>
                <svg
                  className={`w-5 h-5 text-teal-500 transition-transform ${expandedSections['integrity'] ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              {expandedSections['integrity'] && (
                <div className="px-5 pb-5 space-y-4">
                  {exam.integrityAndSecurity && (
                    <div>
                      <p className="text-xs text-teal-500 uppercase tracking-wide mb-1">
                        Integrity & Security
                      </p>
                      <p className="text-sm text-teal-700">{exam.integrityAndSecurity}</p>
                    </div>
                  )}
                  {exam.accessibilityProvisions && (
                    <div>
                      <p className="text-xs text-teal-500 uppercase tracking-wide mb-1">
                        Accessibility Provisions
                      </p>
                      <p className="text-sm text-teal-700">{exam.accessibilityProvisions}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-400">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end pt-6 border-t border-teal-200">
            {!isApproved && (
              <button
                onClick={handleApprove}
                disabled={approveStep13.isPending}
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {approveStep13.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Approving...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    Approve & Complete
                  </>
                )}
              </button>
            )}

            {isApproved && (
              <span className="px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm font-medium flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Approved
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
