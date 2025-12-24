'use client';

import { useState, useEffect } from 'react';
import { useSubmitStep10 } from '@/hooks/useWorkflow';
import {
  CurriculumWorkflow,
  ModuleLessonPlan,
  LessonPlan,
  LessonActivity,
  FormativeCheck,
} from '@/types/workflow';
import { useGeneration, GenerationProgressBar } from '@/contexts/GenerationContext';
import { EditTarget } from './EditWithAIButton';

interface Props {
  workflow: CurriculumWorkflow;
  onComplete: () => void;
  onRefresh: () => void;
  onOpenCanvas?: (target: EditTarget) => void;
}

export default function Step10View({ workflow, onComplete: _onComplete, onRefresh }: Props) {
  const submitStep10 = useSubmitStep10();
  const [error, setError] = useState<string | null>(null);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<string | null>(null);
  const [justGenerated, setJustGenerated] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const { startGeneration, completeGeneration, failGeneration, isGenerating } = useGeneration();

  const isCurrentlyGenerating = isGenerating(workflow._id, 10) || submitStep10.isPending;

  // Real-time polling for Step 10 progress
  useEffect(() => {
    if (!isCurrentlyGenerating || hasStep10Data) {
      setIsPolling(false);
      return;
    }

    setIsPolling(true);
    const pollInterval = setInterval(async () => {
      try {
        await onRefresh(); // Refresh workflow data to get latest step10 progress
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 5000); // Poll every 5 seconds

    return () => {
      clearInterval(pollInterval);
      setIsPolling(false);
    };
  }, [isCurrentlyGenerating, onRefresh]);

  // Check for completion when data appears
  useEffect(() => {
    if ((workflow.step10?.moduleLessonPlans?.length ?? 0) > 0) {
      completeGeneration(workflow._id, 10);
    }
  }, [workflow.step10, workflow._id, completeGeneration]);

  const handleGenerate = async () => {
    setError(null);
    startGeneration(workflow._id, 10, 180); // 3 minutes estimated per module
    try {
      const response: any = await submitStep10.mutateAsync(workflow._id);

      // Check if generation started in background
      if (response?.data?.generationStarted) {
        // Auto-refresh after 3 minutes to check progress
        setTimeout(async () => {
          await onRefresh();
          completeGeneration(workflow._id, 10);
        }, 180000); // 3 minutes

        setJustGenerated(true);
      } else {
        completeGeneration(workflow._id, 10);
        await onRefresh();
        setJustGenerated(true);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate lesson plans';
      console.error('Failed to generate lesson plans:', err);
      failGeneration(workflow._id, 10, errorMessage);
      setError(errorMessage);
    }
  };

  const hasStep10Data = workflow.step10 && workflow.step10.moduleLessonPlans?.length > 0;
  const validation = workflow.step10?.validation;

  // Check if Step 9 is approved
  const validStatuses = [
    'step9_complete',
    'step10_pending',
    'step10_complete',
    'review_pending',
    'published',
  ];
  const isStep9Approved = validStatuses.includes(workflow.status);

  // Check if generation is incomplete
  const totalModules = workflow.step4?.modules?.length || 0;
  const completedModules = workflow.step10?.moduleLessonPlans?.length || 0;
  const isIncomplete = hasStep10Data && completedModules < totalModules;

  // Auto-select first module if none selected
  useEffect(() => {
    if (hasStep10Data && !selectedModule && workflow.step10?.moduleLessonPlans?.length) {
      setSelectedModule(workflow.step10.moduleLessonPlans[0].moduleId);
    }
  }, [hasStep10Data, selectedModule, workflow.step10]);

  const currentModule = workflow.step10?.moduleLessonPlans?.find(
    (m) => m.moduleId === selectedModule
  );

  const currentLesson = currentModule?.lessons?.find((l) => l.lessonId === selectedLesson);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Show generating state with real-time progress */}
      {isCurrentlyGenerating && (
        <div className="mb-6 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 border-3 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white">
                Generating Lesson Plans & PPTs...
              </h3>
              <p className="text-sm text-slate-400">
                Module generation takes 2-5 minutes. The page will auto-refresh when complete, or
                you can manually refresh to check progress.
              </p>
            </div>
          </div>

          {/* Real-time progress */}
          {workflow.step10?.moduleLessonPlans && workflow.step10.moduleLessonPlans.length > 0 && (
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-300">Modules Completed:</span>
                <span className="text-cyan-400 font-semibold">
                  {workflow.step10.moduleLessonPlans.length} /{' '}
                  {workflow.step4?.modules?.length || '?'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-300">Total Lessons Generated:</span>
                <span className="text-cyan-400 font-semibold">
                  {workflow.step10.summary?.totalLessons || 0}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-300">Contact Hours:</span>
                <span className="text-cyan-400 font-semibold">
                  {workflow.step10.summary?.totalContactHours || 0}h
                </span>
              </div>

              {/* Module list with lesson-level detail */}
              <div className="mt-4 space-y-3">
                <p className="text-xs text-slate-400 font-medium">Progress by Module:</p>
                {workflow.step10.moduleLessonPlans.map((module, idx) => {
                  const step4Module = workflow.step4?.modules?.find(
                    (m) => m.id === module.moduleId
                  );
                  const expectedLessons = step4Module
                    ? Math.ceil((step4Module.contactHours * 60) / 90)
                    : module.totalLessons;
                  const isComplete = module.lessons.length >= expectedLessons;

                  return (
                    <div key={module.moduleId} className="bg-slate-800/50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <svg
                          className={`w-4 h-4 ${isComplete ? 'text-green-400' : 'text-amber-400'}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          {isComplete ? (
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          ) : (
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          )}
                        </svg>
                        <span className="text-slate-300 font-medium text-sm">
                          {module.moduleCode}: {module.moduleTitle}
                        </span>
                      </div>
                      <div className="ml-6 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400">Lessons:</span>
                          <span
                            className={`font-semibold ${isComplete ? 'text-green-400' : 'text-amber-400'}`}
                          >
                            {module.lessons.length} / {expectedLessons}
                            {!isComplete && ' (generating...)'}
                          </span>
                        </div>
                        {/* Show individual lessons */}
                        {module.lessons.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {module.lessons.map((lesson, lessonIdx) => (
                              <div
                                key={lesson.lessonId}
                                className="flex items-center gap-2 text-xs text-slate-400"
                              >
                                <svg
                                  className="w-3 h-3 text-green-400"
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
                                <span>
                                  Lesson {lessonIdx + 1}: {lesson.lessonTitle} ({lesson.duration}
                                  min)
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <GenerationProgressBar workflowId={workflow._id} step={10} />
        </div>
      )}

      {!hasStep10Data && !isCurrentlyGenerating ? (
        // Pre-Generation View
        <div className="space-y-6">
          {/* Step 9 Approval Warning */}
          {!isStep9Approved && (
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
                    Step 9 Approval Required
                  </h3>
                  <p className="text-slate-300 text-sm">
                    You must approve Step 9 (Glossary) before proceeding to Step 10. Please go back
                    to Step 9 and click the "Approve" button.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* About This Step */}
          <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-xl p-5">
            <h3 className="text-cyan-400 font-semibold mb-3 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Step 10: Lesson Plans & PowerPoint Generation
            </h3>
            <p className="text-sm text-slate-300 mb-4">
              Generate detailed lesson plans for each module with activity sequences, materials, and
              instructor notes. PowerPoint decks will be automatically created for each lesson.
            </p>

            {/* What Will Be Generated */}
            <div className="bg-slate-900/50 rounded-lg p-4 mb-4">
              <p className="text-slate-400 font-medium mb-3">What Will Be Generated:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-800/50 rounded p-3">
                  <p className="text-cyan-400 font-medium mb-2">📚 Lesson Plans</p>
                  <ul className="text-slate-400 space-y-1">
                    <li>• Lesson objectives from MLOs</li>
                    <li>• Activity sequences with timings</li>
                    <li>• Teaching methods & materials</li>
                    <li>• Instructor notes & guidance</li>
                    <li>• Independent study assignments</li>
                  </ul>
                </div>
                <div className="bg-slate-800/50 rounded p-3">
                  <p className="text-orange-400 font-medium mb-2">📊 PowerPoint Decks</p>
                  <ul className="text-slate-400 space-y-1">
                    <li>• Title & objectives slides</li>
                    <li>• Key concepts & definitions</li>
                    <li>• Case study slides</li>
                    <li>• Formative check questions</li>
                    <li>• Summary & references</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Context Sources */}
            <div className="bg-slate-900/50 rounded-lg p-4">
              <p className="text-slate-400 font-medium mb-3">
                Using Context From All Previous Steps:
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                <span className="px-2 py-1 bg-slate-800 rounded text-slate-300">
                  Step 1: Program Foundation
                </span>
                <span className="px-2 py-1 bg-slate-800 rounded text-slate-300">
                  Step 2: Competencies
                </span>
                <span className="px-2 py-1 bg-slate-800 rounded text-slate-300">Step 3: PLOs</span>
                <span className="px-2 py-1 bg-slate-800 rounded text-slate-300">
                  Step 4: Modules & MLOs
                </span>
                <span className="px-2 py-1 bg-slate-800 rounded text-slate-300">
                  Steps 5-6: Sources & Readings
                </span>
                <span className="px-2 py-1 bg-slate-800 rounded text-slate-300">
                  Step 7: Assessments
                </span>
                <span className="px-2 py-1 bg-slate-800 rounded text-slate-300">
                  Step 8: Case Studies
                </span>
                <span className="px-2 py-1 bg-slate-800 rounded text-slate-300">
                  Step 9: Glossary
                </span>
              </div>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-400">{error}</p>
            </div>
          )}

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={isCurrentlyGenerating || !isStep9Approved}
            className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCurrentlyGenerating ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generating Lesson Plans & PPTs...
              </span>
            ) : !isStep9Approved ? (
              '🔒 Approve Step 9 First'
            ) : (
              '📚 Generate Lesson Plans & PowerPoints'
            )}
          </button>
        </div>
      ) : (
        // Display Generated Lesson Plans
        <div className="space-y-6">
          {/* Completion Banner */}
          {justGenerated && !isIncomplete && (
            <div className="bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 rounded-xl p-6 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-cyan-500/20 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-cyan-400"
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
              <h3 className="text-xl font-bold text-cyan-400 mb-2">
                🎉 Lesson Plans & PPTs Generated!
              </h3>
              <p className="text-slate-300 mb-4">
                Your lesson plans and PowerPoint decks have been generated. Click "Complete &
                Review" in the header to finalize your curriculum.
              </p>
              <p className="text-cyan-400 text-sm animate-pulse">
                ↑ Click "Complete & Review" button above to finalize
              </p>
            </div>
          )}

          {/* Incomplete Generation Banner */}
          {isIncomplete && (
            <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-xl p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <svg
                    className="w-6 h-6 text-amber-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-amber-400 mb-1">
                    Generation In Progress
                  </h3>
                  <p className="text-slate-300 text-sm">
                    {completedModules} of {totalModules} modules completed. Click the button below
                    to continue generating the remaining modules.
                  </p>
                </div>
              </div>
              <button
                onClick={handleGenerate}
                disabled={isCurrentlyGenerating}
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-medium rounded-lg transition-all disabled:opacity-50"
              >
                {isCurrentlyGenerating ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Generating Next Module...
                  </span>
                ) : (
                  `📚 Continue Generation (${totalModules - completedModules} modules remaining)`
                )}
              </button>
            </div>
          )}

          {/* Overall Stats */}
          <div className="grid grid-cols-5 gap-4">
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700 text-center">
              <p className="text-3xl font-bold text-white">
                {workflow.step10?.summary?.totalLessons || 0}
              </p>
              <p className="text-xs text-slate-500 mt-1">Total Lessons</p>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700 text-center">
              <p className="text-3xl font-bold text-cyan-400">
                {workflow.step10?.summary?.totalContactHours || 0}h
              </p>
              <p className="text-xs text-slate-500 mt-1">Contact Hours</p>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700 text-center">
              <p className="text-3xl font-bold text-purple-400">
                {workflow.step10?.summary?.caseStudiesIncluded || 0}
              </p>
              <p className="text-xs text-slate-500 mt-1">Case Studies</p>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700 text-center">
              <p className="text-3xl font-bold text-amber-400">
                {workflow.step10?.summary?.formativeChecksIncluded || 0}
              </p>
              <p className="text-xs text-slate-500 mt-1">Formative Checks</p>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700 text-center">
              <p className="text-3xl font-bold text-orange-400">
                {workflow.step10?.moduleLessonPlans?.reduce(
                  (sum, m) => sum + m.pptDecks.length,
                  0
                ) || 0}
              </p>
              <p className="text-xs text-slate-500 mt-1">PPT Decks</p>
            </div>
          </div>

          {/* Validation Report */}
          {validation && (
            <div className="rounded-lg p-4 border bg-emerald-500/10 border-emerald-500/30">
              <h4 className="font-medium mb-3 text-emerald-400">Validation Report</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                <span
                  className={
                    validation.allModulesHaveLessonPlans ? 'text-emerald-400' : 'text-red-400'
                  }
                >
                  {validation.allModulesHaveLessonPlans ? '✓' : '✗'} All Modules Have Lessons
                </span>
                <span
                  className={
                    validation.allLessonDurationsValid ? 'text-emerald-400' : 'text-red-400'
                  }
                >
                  {validation.allLessonDurationsValid ? '✓' : '✗'} Lesson Durations Valid
                </span>
                <span className={validation.totalHoursMatch ? 'text-emerald-400' : 'text-red-400'}>
                  {validation.totalHoursMatch ? '✓' : '✗'} Total Hours Match
                </span>
                <span className={validation.allMLOsCovered ? 'text-emerald-400' : 'text-red-400'}>
                  {validation.allMLOsCovered ? '✓' : '✗'} All MLOs Covered
                </span>
                <span
                  className={validation.caseStudiesIntegrated ? 'text-emerald-400' : 'text-red-400'}
                >
                  {validation.caseStudiesIntegrated ? '✓' : '✗'} Case Studies Integrated
                </span>
                <span
                  className={validation.assessmentsIntegrated ? 'text-emerald-400' : 'text-red-400'}
                >
                  {validation.assessmentsIntegrated ? '✓' : '✗'} Assessments Integrated
                </span>
              </div>
            </div>
          )}

          {/* Download options removed - now shown on Final Review page after clicking "Complete & Review" */}

          {/* Module Selection */}
          <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
            <h4 className="text-white font-medium mb-3">Select Module</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {workflow.step10?.moduleLessonPlans?.map((module) => (
                <button
                  key={module.moduleId}
                  onClick={() => {
                    setSelectedModule(module.moduleId);
                    setSelectedLesson(null);
                  }}
                  className={`p-4 rounded-lg border text-left transition-all ${
                    selectedModule === module.moduleId
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <div className="font-medium mb-1">{module.moduleCode}</div>
                  <div className="text-sm opacity-80 mb-2">{module.moduleTitle}</div>
                  <div className="flex items-center gap-3 text-xs">
                    <span>{module.totalLessons} lessons</span>
                    <span>•</span>
                    <span>{module.totalContactHours}h</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Module Details */}
          {currentModule && (
            <div className="space-y-4">
              <div className="bg-slate-900/50 rounded-lg p-5 border border-slate-700">
                <h3 className="text-xl font-bold text-white mb-2">
                  {currentModule.moduleCode}: {currentModule.moduleTitle}
                </h3>
                <div className="flex items-center gap-4 text-sm text-slate-400">
                  <span>{currentModule.totalLessons} Lessons</span>
                  <span>•</span>
                  <span>{currentModule.totalContactHours} Contact Hours</span>
                  <span>•</span>
                  <span>{currentModule.pptDecks.length} PPT Decks</span>
                </div>
              </div>

              {/* Lesson List */}
              <div className="bg-slate-900/50 rounded-lg p-5 border border-slate-700">
                <h4 className="text-white font-medium mb-4">Lessons</h4>
                <div className="space-y-3">
                  {currentModule.lessons.map((lesson) => (
                    <button
                      key={lesson.lessonId}
                      onClick={() => setSelectedLesson(lesson.lessonId)}
                      className={`w-full p-4 rounded-lg border text-left transition-all ${
                        selectedLesson === lesson.lessonId
                          ? 'bg-cyan-500/20 border-cyan-500'
                          : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-white font-medium">
                              Lesson {lesson.lessonNumber}: {lesson.lessonTitle}
                            </span>
                            <span className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded">
                              {lesson.bloomLevel}
                            </span>
                          </div>
                          <div className="text-sm text-slate-400 mb-2">
                            {lesson.duration} minutes • {lesson.activities.length} activities
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs">
                            {lesson.linkedMLOs.map((mlo) => (
                              <span
                                key={mlo}
                                className="px-2 py-0.5 bg-slate-700 rounded text-slate-300"
                              >
                                {mlo}
                              </span>
                            ))}
                          </div>
                        </div>
                        <svg
                          className={`w-5 h-5 text-slate-400 transition-transform ${
                            selectedLesson === lesson.lessonId ? 'rotate-90' : ''
                          }`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* PowerPoint Decks for Module */}
              <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/30 rounded-xl p-5">
                <h4 className="text-orange-400 font-medium mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                  PowerPoint Decks ({currentModule.pptDecks.length})
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {currentModule.pptDecks.map((deck) => {
                    const lesson = currentModule.lessons.find((l) => l.lessonId === deck.lessonId);
                    return (
                      <div key={deck.deckId} className="bg-slate-900/50 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="text-white font-medium text-sm">
                              Lesson {lesson?.lessonNumber || '?'}
                            </p>
                            <p className="text-xs text-slate-400">{deck.slideCount} slides</p>
                          </div>
                          <span className="text-xl">📊</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {deck.pptxPath && (
                            <a
                              href={deck.pptxPath}
                              download
                              className="flex items-center gap-1 px-2 py-1 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded text-xs transition-colors"
                              title="Download PPTX (Editable)"
                            >
                              <svg
                                className="w-3 h-3"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3 3m0 0l-3-3m3 3V8"
                                />
                              </svg>
                              PPTX
                            </a>
                          )}
                          {deck.pdfPath && (
                            <a
                              href={deck.pdfPath}
                              download
                              className="flex items-center gap-1 px-2 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded text-xs transition-colors"
                              title="Download PDF (Read-only)"
                            >
                              <svg
                                className="w-3 h-3"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3 3m0 0l-3-3m3 3V8"
                                />
                              </svg>
                              PDF
                            </a>
                          )}
                          {deck.imagesPath && (
                            <a
                              href={deck.imagesPath}
                              download
                              className="flex items-center gap-1 px-2 py-1 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded text-xs transition-colors"
                              title="Download Images (LMS Compatible)"
                            >
                              <svg
                                className="w-3 h-3"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                />
                              </svg>
                              IMG
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 bg-slate-900/50 rounded-lg p-3 text-xs text-slate-400">
                  <p className="flex items-start gap-2">
                    <svg
                      className="w-4 h-4 mt-0.5 flex-shrink-0"
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
                    <span>
                      PowerPoint decks are automatically adapted based on your delivery mode
                      (online, in-person, hybrid) with appropriate visual density and engagement
                      elements.
                    </span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Lesson Details */}
          {currentLesson && (
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-xl p-6">
                <h3 className="text-2xl font-bold text-white mb-3">
                  Lesson {currentLesson.lessonNumber}: {currentLesson.lessonTitle}
                </h3>
                <div className="flex items-center gap-4 text-sm text-slate-300 mb-4">
                  <span>⏱️ {currentLesson.duration} minutes</span>
                  <span>•</span>
                  <span>📊 {currentLesson.bloomLevel}</span>
                  <span>•</span>
                  <span>🎯 {currentLesson.linkedMLOs.length} MLOs</span>
                </div>

                {/* Objectives */}
                <div className="bg-slate-900/50 rounded-lg p-4 mb-4">
                  <h4 className="text-cyan-400 font-medium mb-2">Learning Objectives</h4>
                  <ul className="space-y-1 text-sm text-slate-300">
                    {currentLesson.objectives.map((obj, i) => (
                      <li key={i}>• {obj}</li>
                    ))}
                  </ul>
                </div>

                {/* Activity Sequence */}
                <div className="bg-slate-900/50 rounded-lg p-4">
                  <h4 className="text-cyan-400 font-medium mb-3">Activity Sequence</h4>
                  <div className="space-y-3">
                    {currentLesson.activities.map((activity) => (
                      <div key={activity.activityId} className="bg-slate-800/50 rounded p-3">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-white font-medium">{activity.title}</span>
                              <span className="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded">
                                {activity.type.replace('_', ' ')}
                              </span>
                            </div>
                            <p className="text-sm text-slate-400">{activity.description}</p>
                          </div>
                          <span className="text-sm text-cyan-400 font-medium whitespace-nowrap">
                            {activity.duration} min
                          </span>
                        </div>
                        {activity.teachingMethod && (
                          <div className="text-xs text-slate-500">
                            Method: {activity.teachingMethod}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Materials */}
              <div className="bg-slate-900/50 rounded-lg p-5 border border-slate-700">
                <h4 className="text-white font-medium mb-3">Required Materials</h4>
                <div className="space-y-3">
                  {currentLesson.materials.pptDeckRef && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-orange-400">📊</span>
                      <span className="text-slate-300">
                        PowerPoint: {currentLesson.materials.pptDeckRef}
                      </span>
                    </div>
                  )}
                  {currentLesson.materials.caseFiles.length > 0 && (
                    <div>
                      <p className="text-sm text-slate-400 mb-1">Case Files:</p>
                      <div className="flex flex-wrap gap-2">
                        {currentLesson.materials.caseFiles.map((file, i) => (
                          <span
                            key={i}
                            className="text-xs px-2 py-1 bg-slate-800 rounded text-slate-300"
                          >
                            {file}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {currentLesson.materials.readingReferences.length > 0 && (
                    <div>
                      <p className="text-sm text-slate-400 mb-1">Reading References:</p>
                      <div className="space-y-1">
                        {currentLesson.materials.readingReferences.map((ref, i) => (
                          <div key={i} className="text-xs text-slate-300">
                            • {ref.authors.join(', ')} ({ref.year}). {ref.title}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Instructor Notes */}
              <div className="bg-slate-900/50 rounded-lg p-5 border border-slate-700">
                <h4 className="text-white font-medium mb-3">Instructor Notes</h4>
                <div className="space-y-3 text-sm">
                  {currentLesson.instructorNotes.pedagogicalGuidance && (
                    <div>
                      <p className="text-cyan-400 font-medium mb-1">Pedagogical Guidance:</p>
                      <p className="text-slate-300">
                        {currentLesson.instructorNotes.pedagogicalGuidance}
                      </p>
                    </div>
                  )}
                  {currentLesson.instructorNotes.pacingSuggestions && (
                    <div>
                      <p className="text-cyan-400 font-medium mb-1">Pacing Suggestions:</p>
                      <p className="text-slate-300">
                        {currentLesson.instructorNotes.pacingSuggestions}
                      </p>
                    </div>
                  )}
                  {currentLesson.instructorNotes.adaptationOptions.length > 0 && (
                    <div>
                      <p className="text-cyan-400 font-medium mb-1">Adaptation Options:</p>
                      <ul className="text-slate-300 space-y-1">
                        {currentLesson.instructorNotes.adaptationOptions.map((opt, i) => (
                          <li key={i}>• {opt}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {/* Independent Study */}
              <div className="bg-slate-900/50 rounded-lg p-5 border border-slate-700">
                <h4 className="text-white font-medium mb-3">Independent Study</h4>
                <div className="space-y-3">
                  {currentLesson.independentStudy.coreReadings.length > 0 && (
                    <div>
                      <p className="text-sm text-cyan-400 font-medium mb-2">Core Readings:</p>
                      <div className="space-y-2">
                        {currentLesson.independentStudy.coreReadings.map((reading, i) => (
                          <div key={i} className="text-xs bg-slate-800/50 rounded p-2">
                            <p className="text-slate-300 mb-1">{reading.citation}</p>
                            <p className="text-slate-500">
                              Est. {reading.estimatedMinutes} minutes
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {currentLesson.independentStudy.supplementaryReadings.length > 0 && (
                    <div>
                      <p className="text-sm text-slate-400 font-medium mb-2">
                        Supplementary Readings:
                      </p>
                      <div className="space-y-2">
                        {currentLesson.independentStudy.supplementaryReadings.map((reading, i) => (
                          <div key={i} className="text-xs bg-slate-800/50 rounded p-2">
                            <p className="text-slate-300 mb-1">{reading.citation}</p>
                            <p className="text-slate-500">
                              Est. {reading.estimatedMinutes} minutes
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="text-sm text-slate-400">
                    Total estimated effort: {currentLesson.independentStudy.estimatedEffort} minutes
                  </div>
                </div>
              </div>

              {/* Case Study Activity */}
              {currentLesson.caseStudyActivity && (
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-5">
                  <h4 className="text-purple-400 font-medium mb-3">Case Study Activity</h4>
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-white font-medium">
                        {currentLesson.caseStudyActivity.caseTitle}
                      </p>
                      <p className="text-slate-400 text-xs mt-1">
                        {currentLesson.caseStudyActivity.activityType} •{' '}
                        {currentLesson.caseStudyActivity.duration} min
                      </p>
                    </div>
                    <div>
                      <p className="text-purple-400 font-medium mb-1">Learning Purpose:</p>
                      <p className="text-slate-300">
                        {currentLesson.caseStudyActivity.learningPurpose}
                      </p>
                    </div>
                    <div>
                      <p className="text-purple-400 font-medium mb-1">Instructor Instructions:</p>
                      <p className="text-slate-300">
                        {currentLesson.caseStudyActivity.instructorInstructions}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Formative Checks */}
              {currentLesson.formativeChecks.length > 0 && (
                <div className="bg-slate-900/50 rounded-lg p-5 border border-slate-700">
                  <h4 className="text-white font-medium mb-3">Formative Checks</h4>
                  <div className="space-y-3">
                    {currentLesson.formativeChecks.map((check) => (
                      <div key={check.checkId} className="bg-slate-800/50 rounded p-3">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <p className="text-sm text-white flex-1">{check.question}</p>
                          <span className="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded whitespace-nowrap">
                            {check.type}
                          </span>
                        </div>
                        {check.options && (
                          <div className="space-y-1 text-xs text-slate-400 mb-2">
                            {check.options.map((opt, i) => (
                              <div
                                key={i}
                                className={opt === check.correctAnswer ? 'text-emerald-400' : ''}
                              >
                                {String.fromCharCode(65 + i)}. {opt}
                                {opt === check.correctAnswer && ' ✓'}
                              </div>
                            ))}
                          </div>
                        )}
                        {check.explanation && (
                          <p className="text-xs text-slate-500 mt-2">💡 {check.explanation}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* PowerPoint Deck */}
              {currentModule && (
                <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/30 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-orange-400 font-medium flex items-center gap-2">
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
                      PowerPoint Deck
                    </h4>
                  </div>

                  {(() => {
                    const pptDeck = currentModule.pptDecks.find(
                      (deck) => deck.lessonId === currentLesson.lessonId
                    );

                    if (!pptDeck) {
                      return (
                        <p className="text-slate-400 text-sm">
                          No PowerPoint deck available for this lesson.
                        </p>
                      );
                    }

                    return (
                      <div className="space-y-4">
                        <div className="bg-slate-900/50 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <p className="text-white font-medium">
                                Lesson {currentLesson.lessonNumber} Slides
                              </p>
                              <p className="text-sm text-slate-400">{pptDeck.slideCount} slides</p>
                            </div>
                            <span className="text-2xl">📊</span>
                          </div>

                          {/* Download Options */}
                          <div className="space-y-2">
                            <p className="text-xs text-slate-500 mb-2">Download Formats:</p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                              {pptDeck.pptxPath && (
                                <a
                                  href={pptDeck.pptxPath}
                                  download
                                  className="flex items-center justify-center gap-2 px-3 py-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded-lg transition-colors text-sm"
                                >
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
                                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3 3m0 0l-3-3m3 3V8"
                                    />
                                  </svg>
                                  PPTX (Editable)
                                </a>
                              )}
                              {pptDeck.pdfPath && (
                                <a
                                  href={pptDeck.pdfPath}
                                  download
                                  className="flex items-center justify-center gap-2 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors text-sm"
                                >
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
                                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3 3m0 0l-3-3m3 3V8"
                                    />
                                  </svg>
                                  PDF (Read-only)
                                </a>
                              )}
                              {pptDeck.imagesPath && (
                                <a
                                  href={pptDeck.imagesPath}
                                  download
                                  className="flex items-center justify-center gap-2 px-3 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg transition-colors text-sm"
                                >
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
                                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                    />
                                  </svg>
                                  Images (LMS)
                                </a>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Preview Note */}
                        <div className="bg-slate-900/50 rounded-lg p-3 text-xs text-slate-400">
                          <p className="flex items-start gap-2">
                            <svg
                              className="w-4 h-4 mt-0.5 flex-shrink-0"
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
                            <span>
                              PowerPoint decks are automatically generated based on the lesson plan
                              content, including objectives, key concepts, case studies, and
                              formative checks. Download to view and customize for your teaching
                              needs.
                            </span>
                          </p>
                        </div>
                      </div>
                    );
                  })()}
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

          {/* Regenerate Button */}
          <div className="flex items-center justify-center pt-6 border-t border-slate-700">
            <button
              onClick={handleGenerate}
              disabled={submitStep10.isPending}
              className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
            >
              Regenerate Lesson Plans
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
