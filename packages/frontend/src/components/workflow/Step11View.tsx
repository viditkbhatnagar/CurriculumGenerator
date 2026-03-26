'use client';

import { useState, useEffect, useRef } from 'react';
import { useSubmitStep11, useApproveStep11, useStep11Status } from '@/hooks/useWorkflow';
import { CurriculumWorkflow } from '@/types/workflow';
import { useGeneration } from '@/contexts/GenerationContext';
import { api } from '@/lib/api';
import StepDownloadButton from './StepDownloadButton';

interface Props {
  workflow: CurriculumWorkflow;
  onComplete: () => void;
  onRefresh: () => void;
}

export default function Step11View({ workflow, onComplete, onRefresh }: Props) {
  const submitStep11 = useSubmitStep11();
  const approveStep11 = useApproveStep11();
  const [error, setError] = useState<string | null>(null);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [isAutoGenerating, setIsAutoGenerating] = useState(false);
  const [downloadingModule, setDownloadingModule] = useState<string | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const { startGeneration, completeGeneration, failGeneration, isGenerating } = useGeneration();

  // Compute whether we need active status polling (before the hook call)
  const _lessonPlans = workflow.step10?.moduleLessonPlans || [];
  const _totalMods = _lessonPlans.length;
  const _completedMods = new Set(workflow.step11?.modulePPTDecks?.map((m) => m.moduleId) || [])
    .size;
  const shouldPollStatus = isAutoGenerating || (_completedMods > 0 && _completedMods < _totalMods);
  const { data: statusData, refetch: refetchStatus } = useStep11Status(
    workflow._id,
    shouldPollStatus
  );

  const isCurrentlyGenerating = isAutoGenerating || submitStep11.isPending;

  // Grace period: don't react to stale errors right after starting generation
  // (backend clears lastError on POST /step11, but query hasn't refetched yet)
  const generationStartedAtRef = useRef(0);

  // Derive which module is currently generating (first incomplete module)
  const currentlyGeneratingModuleId = isCurrentlyGenerating
    ? (_lessonPlans.find(
        (m) =>
          !new Set(workflow.step11?.modulePPTDecks?.map((d) => d.moduleId) || []).has(m.moduleId)
      )?.moduleId ?? null)
    : null;

  // 1. Auto-detect active backend jobs on mount (recover from page refresh)
  const mountCheckedRef = useRef(false);
  useEffect(() => {
    if (mountCheckedRef.current || !statusData || isAutoGenerating) return;
    mountCheckedRef.current = true;
    const backendBusy = (statusData.jobs?.active ?? 0) > 0;
    if (backendBusy && _completedMods < _totalMods) {
      setIsAutoGenerating(true);
      startGeneration(workflow._id, 11, (_totalMods - _completedMods) * 900);
    }
  }, [statusData]); // eslint-disable-line

  // 2. Monitor completion, errors, and auto-continue while generating
  // This is the core fix: we stay in generating mode until ALL modules are done,
  // and auto-trigger the next module if the backend queue isn't chaining (sync fallback)
  const prevCompletedRef = useRef(_completedMods);
  useEffect(() => {
    // Compute completed count (same logic as below, but inline for the effect)
    const completedModuleIds = new Set(
      workflow.step11?.modulePPTDecks?.map((m) => m.moduleId) || []
    );
    const completedByCodeMap = new Map<string, boolean>();
    (workflow.step11?.modulePPTDecks || []).forEach((m) => {
      if (m.moduleCode) completedByCodeMap.set(m.moduleCode, true);
    });
    const lessonPlans = workflow.step10?.moduleLessonPlans || [];
    const totalModules = lessonPlans.length;
    let completedFromWf = 0;
    for (let i = 0; i < totalModules; i++) {
      const lp = lessonPlans[i];
      if (lp && (completedModuleIds.has(lp.moduleId) || completedByCodeMap.has(lp.moduleCode))) {
        completedFromWf++;
      }
    }
    const completedModules = Math.max(completedFromWf, statusData?.modulesGenerated ?? 0);
    const allComplete = completedModules >= totalModules && totalModules > 0;

    if (!isAutoGenerating) {
      prevCompletedRef.current = completedModules;
      return;
    }

    // All done — exit generating mode
    if (allComplete) {
      setIsAutoGenerating(false);
      completeGeneration(workflow._id, 11);
      prevCompletedRef.current = completedModules;
      return;
    }

    // Error check — only stop if backend isn't retrying and we're past the grace period
    // (after clicking Generate/Retry, the old lastError is stale until the query refetches)
    const isWithinGracePeriod = Date.now() - generationStartedAtRef.current < 15000;
    if (workflow.step11?.lastError && !isWithinGracePeriod) {
      const backendBusy = (statusData?.jobs?.active ?? 0) > 0;
      if (!backendBusy) {
        setIsAutoGenerating(false);
        setError(
          `PPT generation failed for module ${workflow.step11.lastError.moduleIndex + 1}: ${workflow.step11.lastError.message}`
        );
        failGeneration(workflow._id, 11, workflow.step11.lastError.message);
        prevCompletedRef.current = completedModules;
        return;
      }
    }

    // Progress detected — auto-continue if backend has no active jobs
    // This handles the sync fallback case where the backend doesn't auto-chain
    if (completedModules > prevCompletedRef.current) {
      prevCompletedRef.current = completedModules;
      const backendBusy = (statusData?.jobs?.active ?? 0) > 0;
      if (!backendBusy && completedModules < totalModules) {
        submitStep11.mutateAsync(workflow._id).catch((err) => {
          console.error('Auto-continuation failed:', err);
        });
      }
    }
  }, [workflow.step11, statusData, isAutoGenerating]); // eslint-disable-line

  // 3. Poll workflow data while generating
  useEffect(() => {
    if (!isAutoGenerating) return;
    const interval = setInterval(() => {
      onRefresh();
      refetchStatus();
    }, 10000);
    return () => clearInterval(interval);
  }, [isAutoGenerating, onRefresh, refetchStatus]);

  // 4. Clear stale GenerationContext state from previous sessions (localStorage)
  useEffect(() => {
    if (!isGenerating(workflow._id, 11) || isAutoGenerating || submitStep11.isPending) return;
    if (!statusData) return;
    const backendBusy = (statusData.jobs?.active ?? 0) > 0;
    if (!backendBusy) {
      if (workflow.step11?.lastError) {
        failGeneration(workflow._id, 11, workflow.step11.lastError.message);
      } else {
        completeGeneration(workflow._id, 11);
      }
    }
  }, [statusData, workflow.step11?.lastError]); // eslint-disable-line

  const handleRetry = async () => {
    setError(null);
    await handleGenerate();
  };

  const handleGenerate = async () => {
    if (isAutoGenerating || submitStep11.isPending) {
      console.log('Generation already in progress, ignoring click');
      return;
    }

    setError(null);
    setIsAutoGenerating(true);
    generationStartedAtRef.current = Date.now();
    // Estimate based on remaining modules
    const remaining = _totalMods - _completedMods;
    startGeneration(workflow._id, 11, remaining * 900);

    try {
      await submitStep11.mutateAsync(workflow._id);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate PPTs';
      console.error('Failed to generate PPTs:', err);
      setIsAutoGenerating(false);
      failGeneration(workflow._id, 11, errorMessage);
      setError(errorMessage);
    }
  };

  const handleApprove = async () => {
    setError(null);
    try {
      await approveStep11.mutateAsync(workflow._id);
      onComplete();
    } catch (err: any) {
      console.error('Failed to approve Step 11:', err);
      setError(err.message || 'Failed to approve Step 11');
    }
  };

  // Download all PPTs as a ZIP file
  const handleDownloadAllPPTs = async () => {
    setDownloadingAll(true);
    setError(null);
    try {
      const response = await api.post(
        `/api/v3/ppt/generate/all/${workflow._id}`,
        {},
        { responseType: 'blob', timeout: 1800000 } // 30 min timeout for all modules
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const programTitle =
        workflow.step1?.programTitle?.replace(/[^a-zA-Z0-9]/g, '_') || 'Curriculum';
      link.download = `${programTitle}_All_PPTs.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Failed to download PPTs:', err);
      setError('Failed to download PPTs. Please try again.');
    } finally {
      setDownloadingAll(false);
    }
  };

  // Download PPTs for a specific module using module index
  const handleDownloadModulePPTs = async (moduleId: string, moduleCode: string) => {
    setDownloadingModule(moduleId);
    setError(null);
    try {
      // Find the module index from step10 lesson plans
      const moduleIndex = workflow.step10?.moduleLessonPlans?.findIndex(
        (m) => m.moduleId === moduleId
      );

      if (moduleIndex === undefined || moduleIndex === -1) {
        throw new Error('Module not found in lesson plans');
      }

      // Use the new endpoint that accepts module index
      const response = await api.post(
        `/api/v3/ppt/download/module/${workflow._id}/${moduleIndex}`,
        {},
        { responseType: 'blob', timeout: 900000 } // 15 min timeout for PPT file generation
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${moduleCode}_PPTs.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Failed to download module PPTs:', err);
      setError(`Failed to download ${moduleCode} PPTs. Please try again.`);
    } finally {
      setDownloadingModule(null);
    }
  };

  const hasStep11Data = workflow.step11 && workflow.step11.modulePPTDecks?.length > 0;
  const validation = workflow.step11?.validation;
  const isApproved = !!workflow.step11?.approvedAt;

  // Check if Step 10 is approved (required for Step 11)
  const validStatuses = [
    'step10_complete',
    'step11_pending',
    'step11_complete',
    'step12_pending',
    'step12_complete',
    'step13_pending',
    'step13_complete',
    'review_pending',
    'published',
  ];
  const isStep10Approved = validStatuses.includes(workflow.status);

  // Check completion status - count unique completed modules by matching with step10 moduleIds
  // This handles cases where there might be duplicate entries in step11.modulePPTDecks
  // Also falls back to moduleCode matching for resilience against ID mismatches
  const totalModules = workflow.step10?.moduleLessonPlans?.length || 0;
  const completedModuleIds = new Set(workflow.step11?.modulePPTDecks?.map((m) => m.moduleId) || []);
  const completedByCode = new Map<string, any>();
  (workflow.step11?.modulePPTDecks || []).forEach((m) => {
    if (m.moduleCode) completedByCode.set(m.moduleCode, m);
  });

  // Count how many step10 modules have corresponding step11 PPTs (by ID or code fallback)
  let completedFromWorkflow = 0;
  for (let i = 0; i < totalModules; i++) {
    const lp = workflow.step10?.moduleLessonPlans?.[i];
    if (lp && (completedModuleIds.has(lp.moduleId) || completedByCode.has(lp.moduleCode))) {
      completedFromWorkflow++;
    }
  }
  // Use the higher of workflow state vs polling status to avoid stale-state locking
  const completedModules = Math.max(completedFromWorkflow, statusData?.modulesGenerated ?? 0);

  const _isIncomplete = hasStep11Data && completedModules < totalModules;
  const isAllModulesComplete = hasStep11Data && completedModules >= totalModules;

  // Auto-select first module if none selected
  useEffect(() => {
    if (hasStep11Data && !selectedModule && workflow.step11?.modulePPTDecks?.length) {
      setSelectedModule(workflow.step11.modulePPTDecks[0].moduleId);
    }
  }, [hasStep11Data, selectedModule, workflow.step11]);

  const currentModule = workflow.step11?.modulePPTDecks?.find((m) => m.moduleId === selectedModule);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {!hasStep11Data && !isCurrentlyGenerating ? (
        // Pre-Generation View
        <div className="space-y-6">
          {/* Step 10 Approval Warning */}
          {!isStep10Approved && (
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
                    Step 10 Approval Required
                  </h3>
                  <p className="text-teal-700 text-sm">
                    You must approve Step 10 (Lesson Plans) before generating PowerPoint decks.
                    Please go back to Step 10 and click the "Approve" button.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* About This Step */}
          <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/30 rounded-xl p-5">
            <h3 className="text-orange-400 font-semibold mb-3 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
              Step 11: PowerPoint Generation
            </h3>
            <p className="text-sm text-teal-700 mb-4">
              Generate professional PowerPoint slide decks for each lesson based on the lesson plans
              from Step 10. Each deck includes objectives, key concepts, case studies, and formative
              checks.
            </p>

            {/* What Will Be Generated */}
            <div className="bg-teal-50/50 rounded-lg p-4 mb-4">
              <p className="text-teal-600 font-medium mb-3">What Will Be Generated:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="bg-white/50 rounded p-3">
                  <p className="text-orange-400 font-medium mb-2">📊 Slide Types</p>
                  <ul className="text-teal-600 space-y-1">
                    <li>• Title & objectives slides</li>
                    <li>• Key concepts & definitions</li>
                    <li>• Content explanation slides</li>
                    <li>• Case study analysis slides</li>
                    <li>• Formative check questions</li>
                    <li>• Summary & key takeaways</li>
                  </ul>
                </div>
                <div className="bg-white/50 rounded p-3">
                  <p className="text-teal-600 font-medium mb-2">🎯 Features</p>
                  <ul className="text-teal-600 space-y-1">
                    <li>• 15-35 slides per lesson</li>
                    <li>• Speaker notes included</li>
                    <li>• Visual suggestions</li>
                    <li>• Delivery mode adapted</li>
                    <li>• Glossary terms highlighted</li>
                    <li>• Assessment-ready content</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Context Sources */}
            <div className="bg-teal-50/50 rounded-lg p-4">
              <p className="text-teal-600 font-medium mb-3">Using Context From:</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <span className="px-2 py-1 bg-white rounded text-teal-700">
                  Step 1: Program Info
                </span>
                <span className="px-2 py-1 bg-white rounded text-teal-700">Step 3: PLOs</span>
                <span className="px-2 py-1 bg-white rounded text-teal-700">Step 4: MLOs</span>
                <span className="px-2 py-1 bg-white rounded text-teal-700">Step 9: Glossary</span>
                <span className="px-2 py-1 bg-cyan-500/20 text-teal-600 rounded">
                  Step 10: Lesson Plans
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
            disabled={isCurrentlyGenerating || !isStep10Approved}
            className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 text-teal-800 font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCurrentlyGenerating ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generating PowerPoint Decks...
              </span>
            ) : !isStep10Approved ? (
              '🔒 Approve Step 10 First'
            ) : (
              '📊 Generate PowerPoint Decks'
            )}
          </button>
        </div>
      ) : (
        // Display Generated PPT Decks
        <div className="space-y-6">
          {/* Local error display (e.g., mutation failures, validation errors) */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-center justify-between">
              <p className="text-red-400">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-red-400 hover:text-red-300 ml-4 flex-shrink-0"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          )}

          {/* Module Generation List */}
          <div className="bg-teal-50/50 rounded-lg p-6 border border-teal-200">
            <h3 className="text-xl font-bold text-teal-800 mb-4">PPT Generation Progress</h3>
            <p className="text-sm text-teal-600 mb-4">
              Generate PowerPoint slide decks for each module. Each module takes 15-30 minutes to
              generate depending on the number of lessons.
            </p>

            {/* Generate All Button */}
            {!isAllModulesComplete && !isCurrentlyGenerating && (
              <button
                onClick={handleGenerate}
                disabled={submitStep11.isPending}
                className="w-full mb-6 py-3 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
                Generate All Remaining PPTs ({totalModules - completedModules} modules)
              </button>
            )}
            {isCurrentlyGenerating && (
              <div className="w-full mb-6 py-3 bg-orange-500/10 border border-orange-500/30 text-orange-600 font-medium rounded-lg flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                Auto-generating all modules sequentially... ({completedModules}/{totalModules}{' '}
                complete)
              </div>
            )}

            <div className="space-y-4">
              {workflow.step10?.moduleLessonPlans?.map((module, index) => {
                const modulePPT =
                  workflow.step11?.modulePPTDecks?.find((m) => m.moduleId === module.moduleId) ||
                  completedByCode.get(module.moduleCode);
                // Module is complete if we have its data OR polling says it's done
                const isComplete = !!modulePPT || index < completedModules;
                const isGenerating = currentlyGeneratingModuleId === module.moduleId;
                const canGenerate =
                  !isComplete && !isCurrentlyGenerating && index <= completedModules;

                return (
                  <div
                    key={`step10-module-${index}-${module.moduleId}`}
                    className={`rounded-lg border p-4 transition-all ${
                      isComplete
                        ? 'bg-emerald-500/10 border-emerald-500/30'
                        : isGenerating
                          ? 'bg-orange-500/10 border-orange-500/30'
                          : canGenerate
                            ? 'bg-white/50 border-slate-600'
                            : 'bg-white/30 border-teal-200/50 opacity-60'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Status Icon */}
                      <div className="flex-shrink-0 mt-1">
                        {isComplete ? (
                          <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                            <svg
                              className="w-6 h-6 text-emerald-400"
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
                        ) : isGenerating ? (
                          <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                            <div className="w-6 h-6 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                          </div>
                        ) : canGenerate ? (
                          <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                            <span className="text-xl">📊</span>
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-teal-100/50 flex items-center justify-center">
                            <svg
                              className="w-6 h-6 text-teal-500"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                              />
                            </svg>
                          </div>
                        )}
                      </div>

                      {/* Module Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div className="flex-1">
                            <h4 className="text-teal-800 font-semibold text-lg mb-1">
                              Module {index + 1}: {module.moduleCode}
                            </h4>
                            <p className="text-teal-600 text-sm mb-2">{module.moduleTitle}</p>
                            <div className="flex items-center gap-4 text-xs text-teal-500">
                              <span>{module.totalLessons} lessons</span>
                              {modulePPT && (
                                <>
                                  <span>•</span>
                                  <span className="text-orange-400">
                                    {modulePPT.pptDecks.length} PPT decks generated
                                  </span>
                                  <span>•</span>
                                  <span className="text-teal-600">
                                    {modulePPT.pptDecks.reduce(
                                      (sum: number, d: any) => sum + d.slideCount,
                                      0
                                    )}{' '}
                                    slides
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Action Button */}
                          <div className="flex-shrink-0 flex items-center gap-2">
                            {isComplete ? (
                              <>
                                <button
                                  onClick={() => setSelectedModule(module.moduleId)}
                                  className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg transition-colors text-sm font-medium"
                                >
                                  View PPTs
                                </button>
                                <button
                                  onClick={() =>
                                    handleDownloadModulePPTs(module.moduleId, module.moduleCode)
                                  }
                                  disabled={downloadingModule === module.moduleId}
                                  className="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-teal-600 rounded-lg transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                  title="Download PPTs for this module"
                                >
                                  {downloadingModule === module.moduleId ? (
                                    <>
                                      <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                                      <span>Downloading...</span>
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
                                      <span>Download</span>
                                    </>
                                  )}
                                </button>
                              </>
                            ) : isGenerating ? (
                              <div className="px-4 py-2 bg-orange-500/20 text-orange-400 rounded-lg text-sm font-medium">
                                Generating...
                              </div>
                            ) : canGenerate ? (
                              <button
                                onClick={handleGenerate}
                                className="px-4 py-2 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 text-teal-800 rounded-lg transition-all text-sm font-medium"
                              >
                                Generate Now
                              </button>
                            ) : (
                              <div className="px-4 py-2 bg-teal-100/50 text-teal-500 rounded-lg text-sm font-medium">
                                Locked
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Progress indicator for generating module */}
                        {isGenerating && (
                          <div className="mt-3 bg-white/50 rounded-lg p-3">
                            <div className="flex items-center gap-2 text-sm text-orange-400 mb-2">
                              <div className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                              <span>Generating PPT decks for {module.totalLessons} lessons...</span>
                            </div>
                            <p className="text-xs text-teal-500">
                              This may take 15-30 minutes. You can leave this page and come back
                              later.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Manual Refresh Button */}
            <div className="mt-6 pt-6 border-t border-teal-200">
              <button
                onClick={onRefresh}
                className="w-full py-3 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 text-teal-800 rounded-lg transition-all text-sm font-medium flex items-center justify-center gap-2"
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
              <p className="text-xs text-teal-500 text-center mt-2">
                Click after starting generation to check if the module has completed
              </p>
            </div>
          </div>

          {/* Error Banner with Retry */}
          {(workflow.step11?.lastError ||
            (statusData?.jobs?.failed > 0 && !isCurrentlyGenerating)) && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5">
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
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-red-400 mb-1">PPT Generation Failed</h3>
                  <p className="text-teal-700 text-sm">
                    {workflow.step11?.lastError?.message ||
                      'A background job failed. Click Retry to attempt generation again.'}
                  </p>
                </div>
                <button
                  onClick={handleRetry}
                  disabled={isCurrentlyGenerating}
                  className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 text-teal-800 font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Retry
                </button>
              </div>
            </div>
          )}

          {/* Completion Banner */}
          {isAllModulesComplete && (
            <div
              className={`border rounded-xl p-6 text-center ${
                isApproved
                  ? 'bg-gradient-to-r from-emerald-500/20 to-green-500/20 border-emerald-500/30'
                  : 'bg-gradient-to-r from-orange-500/20 to-red-500/20 border-orange-500/30'
              }`}
            >
              <div
                className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
                  isApproved ? 'bg-emerald-500/20' : 'bg-orange-500/20'
                }`}
              >
                {isApproved ? (
                  <svg
                    className="w-8 h-8 text-emerald-400"
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
                    className="w-8 h-8 text-orange-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                )}
              </div>

              {isApproved ? (
                <>
                  <h3 className="text-xl font-bold text-emerald-400 mb-2">Step 11 Approved!</h3>
                  <p className="text-teal-700 mb-4">
                    All PowerPoint decks have been approved. Proceed to Step 12 - Assignment Packs.
                  </p>
                  <div className="flex items-center justify-center gap-4 mb-4">
                    <button
                      onClick={handleDownloadAllPPTs}
                      disabled={downloadingAll}
                      className="px-6 py-3 bg-cyan-500/20 hover:bg-cyan-500/30 text-teal-600 rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {downloadingAll ? (
                        <>
                          <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                          Downloading...
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
                              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                            />
                          </svg>
                          Download All PPTs
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-emerald-400 text-sm animate-pulse">
                    Continue to Step 12 to generate Assignment Packs
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-xl font-bold text-orange-400 mb-2">🎉 All PPTs Generated!</h3>
                  <p className="text-teal-700 mb-4">
                    All PowerPoint decks have been generated. Review the content and approve to
                    complete.
                  </p>
                  <div className="flex items-center justify-center gap-4 mb-4">
                    <button
                      onClick={handleDownloadAllPPTs}
                      disabled={downloadingAll}
                      className="px-6 py-3 bg-cyan-500/20 hover:bg-cyan-500/30 text-teal-600 rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {downloadingAll ? (
                        <>
                          <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                          Downloading...
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
                              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                            />
                          </svg>
                          Download All PPTs
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleApprove}
                      disabled={approveStep11.isPending}
                      className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-teal-800 font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {approveStep11.isPending ? (
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
                          Approve & Complete
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Overall Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-teal-50/50 rounded-xl p-4 border border-teal-200 text-center">
              <p className="text-3xl font-bold text-teal-800">
                {workflow.step11?.summary?.totalPPTDecks || 0}
              </p>
              <p className="text-xs text-teal-500 mt-1">Total PPT Decks</p>
            </div>
            <div className="bg-teal-50/50 rounded-xl p-4 border border-teal-200 text-center">
              <p className="text-3xl font-bold text-orange-400">
                {workflow.step11?.summary?.totalSlides || 0}
              </p>
              <p className="text-xs text-teal-500 mt-1">Total Slides</p>
            </div>
            <div className="bg-teal-50/50 rounded-xl p-4 border border-teal-200 text-center">
              <p className="text-3xl font-bold text-teal-600">
                {workflow.step11?.summary?.averageSlidesPerLesson || 0}
              </p>
              <p className="text-xs text-teal-500 mt-1">Avg Slides/Lesson</p>
            </div>
            <div className="bg-teal-50/50 rounded-xl p-4 border border-teal-200 text-center">
              <p className="text-3xl font-bold text-purple-400">
                {completedModules}/{totalModules}
              </p>
              <p className="text-xs text-teal-500 mt-1">Modules Complete</p>
            </div>
          </div>

          {/* Validation Report */}
          {validation && (
            <div className="rounded-lg p-4 border bg-emerald-500/10 border-emerald-500/30">
              <h4 className="font-medium mb-3 text-emerald-400">Validation Report</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <span
                  className={validation.allLessonsHavePPTs ? 'text-emerald-400' : 'text-red-400'}
                >
                  {validation.allLessonsHavePPTs ? '✓' : '✗'} All Lessons Have PPTs
                </span>
                <span
                  className={validation.allSlideCountsValid ? 'text-emerald-400' : 'text-red-400'}
                >
                  {validation.allSlideCountsValid ? '✓' : '✗'} Slide Counts Valid
                </span>
                <span className={validation.allMLOsCovered ? 'text-emerald-400' : 'text-red-400'}>
                  {validation.allMLOsCovered ? '✓' : '✗'} All MLOs Covered
                </span>
                <span
                  className={validation.allCitationsValid ? 'text-emerald-400' : 'text-red-400'}
                >
                  {validation.allCitationsValid ? '✓' : '✗'} Citations Valid
                </span>
              </div>
            </div>
          )}

          {/* Module Selection */}
          <div className="bg-teal-50/50 rounded-lg p-4 border border-teal-200">
            <h4 className="text-teal-800 font-medium mb-3">Select Module to View PPTs</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {workflow.step11?.modulePPTDecks?.map((module, index) => (
                <button
                  key={`step11-module-${index}-${module.moduleId}`}
                  onClick={() => setSelectedModule(module.moduleId)}
                  className={`p-4 rounded-lg border text-left transition-all ${
                    selectedModule === module.moduleId
                      ? 'bg-orange-500/20 border-orange-500 text-orange-400'
                      : 'bg-white border-teal-200 text-teal-700 hover:border-slate-600'
                  }`}
                >
                  <div className="font-medium mb-1">{module.moduleCode}</div>
                  <div className="text-sm opacity-80 mb-2">{module.moduleTitle}</div>
                  <div className="flex items-center gap-3 text-xs">
                    <span>{module.pptDecks.length} PPT decks</span>
                    <span>•</span>
                    <span>{module.pptDecks.reduce((sum, d) => sum + d.slideCount, 0)} slides</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Module PPT Details */}
          {currentModule && (
            <div className="space-y-4">
              <div className="bg-teal-50/50 rounded-lg p-5 border border-teal-200">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-teal-800 mb-2">
                      {currentModule.moduleCode}: {currentModule.moduleTitle}
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-teal-600">
                      <span>{currentModule.totalLessons} Lessons</span>
                      <span>•</span>
                      <span>{currentModule.pptDecks.length} PPT Decks</span>
                      <span>•</span>
                      <span>
                        {currentModule.pptDecks.reduce((sum, d) => sum + d.slideCount, 0)} Total
                        Slides
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      handleDownloadModulePPTs(currentModule.moduleId, currentModule.moduleCode)
                    }
                    disabled={downloadingModule === currentModule.moduleId}
                    className="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-teal-600 rounded-lg transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {downloadingModule === currentModule.moduleId ? (
                      <>
                        <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                        <span>Downloading...</span>
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
                        <span>Download Module PPTs</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* PPT Deck List */}
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
                  PowerPoint Decks
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {currentModule.pptDecks.map((deck) => (
                    <div key={deck.deckId} className="bg-teal-50/50 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="text-teal-800 font-medium text-sm mb-1">
                            Lesson {deck.lessonNumber}: {deck.lessonTitle}
                          </p>
                          <p className="text-xs text-teal-600">
                            {deck.slideCount} slides • {deck.deliveryMode}
                          </p>
                        </div>
                        <span className="text-xl">📊</span>
                      </div>

                      {/* Slide Type Breakdown */}
                      <div className="flex flex-wrap gap-1 mb-3">
                        {deck.slides?.slice(0, 5).map((slide, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 bg-white rounded text-xs text-teal-600"
                          >
                            {slide.slideType}
                          </span>
                        ))}
                        {deck.slides?.length > 5 && (
                          <span className="px-2 py-0.5 bg-white rounded text-xs text-teal-500">
                            +{deck.slides.length - 5} more
                          </span>
                        )}
                      </div>

                      {/* Validation badges */}
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span
                          className={
                            deck.validation?.slideCountValid ? 'text-emerald-400' : 'text-amber-400'
                          }
                        >
                          {deck.validation?.slideCountValid ? '✓' : '⚠'} Slides
                        </span>
                        <span
                          className={
                            deck.validation?.mlosCovered ? 'text-emerald-400' : 'text-amber-400'
                          }
                        >
                          {deck.validation?.mlosCovered ? '✓' : '⚠'} MLOs
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-400">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-6 border-t border-teal-200">
            <button
              onClick={handleGenerate}
              disabled={submitStep11.isPending || isAllModulesComplete}
              className="px-4 py-2 text-teal-600 hover:text-teal-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAllModulesComplete
                ? 'All PPTs Generated'
                : isCurrentlyGenerating
                  ? 'Generating...'
                  : `Generate All Remaining PPTs (${totalModules - completedModules} modules)`}
            </button>

            {isAllModulesComplete && !isApproved && (
              <button
                onClick={handleApprove}
                disabled={approveStep11.isPending}
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-teal-800 font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {approveStep11.isPending ? (
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
                    Approve Step 11
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

            {!!workflow.step11 && (
              <StepDownloadButton
                workflowId={workflow._id}
                stepNumber={11}
                programName={workflow.projectName || workflow.step1?.programTitle || ''}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
