'use client';

import { useState, useEffect, useRef } from 'react';
import {
  useSubmitStep12,
  useSubmitStep12NextModule,
  useApproveStep12,
  useStep12Status,
} from '@/hooks/useWorkflow';
import {
  CurriculumWorkflow,
  ModuleAssignmentPacks,
  AssignmentPack,
  AssignmentDeliveryVariant,
} from '@/types/workflow';
import { useGeneration } from '@/contexts/GenerationContext';

interface Props {
  workflow: CurriculumWorkflow;
  onComplete: () => void;
  onRefresh: () => void;
}

const VARIANT_LABELS: Record<AssignmentDeliveryVariant, string> = {
  in_person: 'In-Person',
  self_study: 'Self-Study',
  hybrid: 'Hybrid',
};

const VARIANT_COLORS: Record<AssignmentDeliveryVariant, string> = {
  in_person: 'from-blue-500 to-indigo-600',
  self_study: 'from-emerald-500 to-teal-600',
  hybrid: 'from-purple-500 to-violet-600',
};

export default function Step12View({ workflow, onComplete, onRefresh }: Props) {
  const submitStep12 = useSubmitStep12();
  const submitNextModule = useSubmitStep12NextModule();
  const approveStep12 = useApproveStep12();
  const { data: _statusData } = useStep12Status(workflow._id);
  const [error, setError] = useState<string | null>(null);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [activeVariant, setActiveVariant] = useState<AssignmentDeliveryVariant>('in_person');
  const [generatingModuleId, setGeneratingModuleId] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const { startGeneration, completeGeneration, failGeneration, isGenerating } = useGeneration();

  const isCurrentlyGenerating =
    isGenerating(workflow._id, 12) ||
    submitStep12.isPending ||
    submitNextModule.isPending ||
    !!generatingModuleId;

  // Track module count to detect completion
  const getCompletedCount = () => {
    return workflow.step12?.moduleAssignmentPacks?.length || 0;
  };

  const prevModuleCountRef = useRef<number>(getCompletedCount());

  useEffect(() => {
    const currentCount = getCompletedCount();
    if (generatingModuleId && currentCount > prevModuleCountRef.current) {
      setGeneratingModuleId(null);
      completeGeneration(workflow._id, 12);
    }
    prevModuleCountRef.current = currentCount;
  }, [
    workflow.step12?.moduleAssignmentPacks,
    generatingModuleId,
    completeGeneration,
    workflow._id,
  ]);

  // Auto-poll during generation
  useEffect(() => {
    if (!generatingModuleId) return;
    const pollInterval = setInterval(() => {
      onRefresh();
    }, 15000);
    return () => clearInterval(pollInterval);
  }, [generatingModuleId, onRefresh]);

  const handleGenerate = async () => {
    if (generatingModuleId || submitNextModule.isPending) return;
    setError(null);

    const totalModules = workflow.step4?.modules?.length || 0;
    const existingModules = workflow.step12?.moduleAssignmentPacks?.length || 0;

    if (existingModules >= totalModules) {
      setError('All assignment packs already generated');
      return;
    }

    const nextModule = workflow.step4?.modules?.[existingModules];
    if (!nextModule) {
      setError('No more modules to generate');
      return;
    }

    setGeneratingModuleId(nextModule.id);
    startGeneration(workflow._id, 12, 300);

    try {
      // Use the queue-based submit endpoint for first module, next-module for subsequent
      if (existingModules === 0) {
        await submitStep12.mutateAsync(workflow._id);
      } else {
        await submitNextModule.mutateAsync(workflow._id);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to generate assignment packs';
      console.error('Failed to generate assignment packs:', err);
      failGeneration(workflow._id, 12, errorMessage);
      setError(errorMessage);
      setGeneratingModuleId(null);
    }
  };

  const handleApprove = async () => {
    setError(null);
    try {
      await approveStep12.mutateAsync(workflow._id);
      onComplete();
    } catch (err: any) {
      console.error('Failed to approve Step 12:', err);
      setError(err.message || 'Failed to approve Step 12');
    }
  };

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const hasStep12Data = workflow.step12 && workflow.step12.moduleAssignmentPacks?.length > 0;
  const isApproved = !!workflow.step12?.approvedAt;
  const totalModules = workflow.step4?.modules?.length || 0;
  const completedModules = workflow.step12?.moduleAssignmentPacks?.length || 0;
  const isAllModulesComplete = hasStep12Data && completedModules >= totalModules;

  // Check if Step 11 is approved
  const validStatuses = [
    'step11_complete',
    'step12_pending',
    'step12_complete',
    'step13_pending',
    'step13_complete',
    'review_pending',
    'published',
  ];
  const isStep11Approved = validStatuses.includes(workflow.status);

  // Auto-select first module
  useEffect(() => {
    if (hasStep12Data && !selectedModule && workflow.step12?.moduleAssignmentPacks?.length) {
      setSelectedModule(workflow.step12.moduleAssignmentPacks[0].moduleId);
    }
  }, [hasStep12Data, selectedModule, workflow.step12]);

  const currentModulePacks: ModuleAssignmentPacks | undefined =
    workflow.step12?.moduleAssignmentPacks?.find((m) => m.moduleId === selectedModule);

  const currentPack: AssignmentPack | undefined = currentModulePacks?.variants?.[activeVariant];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {!hasStep12Data && !isCurrentlyGenerating ? (
        // Pre-Generation View
        <div className="space-y-6">
          {!isStep11Approved && (
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
                    Step 11 Approval Required
                  </h3>
                  <p className="text-teal-700 text-sm">
                    You must approve Step 11 (PPT Generation) before generating Assignment Packs.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/30 rounded-xl p-5">
            <h3 className="text-blue-400 font-semibold mb-3 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                />
              </svg>
              Step 12: Assignment Packs
            </h3>
            <p className="text-sm text-teal-700 mb-4">
              Generate complete assignment packs for each module, tailored to all three delivery
              modes. Each pack includes assignment briefs, rubrics (Fail/Pass/Merit/Distinction),
              evidence requirements, and marking guides.
            </p>

            <div className="bg-teal-50/50 rounded-lg p-4 mb-4">
              <p className="text-teal-600 font-medium mb-3">What Will Be Generated:</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="bg-white/50 rounded p-3">
                  <p className="text-blue-500 font-medium mb-2">In-Person</p>
                  <ul className="text-teal-600 space-y-1">
                    <li>- Group work & presentations</li>
                    <li>- Lab practicals</li>
                    <li>- Physical submissions</li>
                  </ul>
                </div>
                <div className="bg-white/50 rounded p-3">
                  <p className="text-emerald-500 font-medium mb-2">Self-Study</p>
                  <ul className="text-teal-600 space-y-1">
                    <li>- Individual digital work</li>
                    <li>- Online portfolios</li>
                    <li>- Recorded presentations</li>
                  </ul>
                </div>
                <div className="bg-white/50 rounded p-3">
                  <p className="text-purple-500 font-medium mb-2">Hybrid</p>
                  <ul className="text-teal-600 space-y-1">
                    <li>- Flexible mix of modes</li>
                    <li>- Physical + digital options</li>
                    <li>- Adaptable format</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-teal-50/50 rounded-lg p-4">
              <p className="text-teal-600 font-medium mb-3">Each Pack Includes:</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <span className="px-2 py-1 bg-white rounded text-teal-700">Assignment Brief</span>
                <span className="px-2 py-1 bg-white rounded text-teal-700">Rubric (4 levels)</span>
                <span className="px-2 py-1 bg-white rounded text-teal-700">
                  Evidence Requirements
                </span>
                <span className="px-2 py-1 bg-white rounded text-teal-700">Academic Integrity</span>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-400">{error}</p>
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={isCurrentlyGenerating || !isStep11Approved}
            className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCurrentlyGenerating ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generating Assignment Packs...
              </span>
            ) : !isStep11Approved ? (
              'Approve Step 11 First'
            ) : (
              'Generate Assignment Packs'
            )}
          </button>
        </div>
      ) : (
        // Display Generated Assignment Packs
        <div className="space-y-6">
          {/* Module Generation Progress */}
          <div className="bg-teal-50/50 rounded-lg p-6 border border-teal-200">
            <h3 className="text-xl font-bold text-teal-800 mb-4">
              Assignment Pack Generation Progress
            </h3>
            <p className="text-sm text-teal-600 mb-6">
              Each module generates 3 assignment pack variants (In-Person, Self-Study, Hybrid). This
              takes 3-5 minutes per module.
            </p>

            <div className="space-y-4">
              {workflow.step4?.modules?.map((module, index) => {
                const modulePacks = workflow.step12?.moduleAssignmentPacks?.find(
                  (m) => m.moduleId === module.id
                );
                const isComplete = !!modulePacks;
                const isGeneratingThis =
                  generatingModuleId === module.id ||
                  (generatingModuleId && !isComplete && index === completedModules);
                const canGenerate =
                  !isComplete && !isCurrentlyGenerating && index === completedModules;

                return (
                  <div
                    key={`module-${index}-${module.id}`}
                    className={`rounded-lg border p-4 transition-all ${
                      isComplete
                        ? 'bg-emerald-500/10 border-emerald-500/30'
                        : isGeneratingThis
                          ? 'bg-blue-500/10 border-blue-500/30'
                          : canGenerate
                            ? 'bg-white/50 border-slate-600'
                            : 'bg-white/30 border-teal-200/50 opacity-60'
                    }`}
                  >
                    <div className="flex items-start gap-4">
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
                        ) : isGeneratingThis ? (
                          <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                            <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                          </div>
                        ) : canGenerate ? (
                          <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                            <span className="text-sm font-bold text-amber-500">{index + 1}</span>
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

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div className="flex-1">
                            <h4 className="text-teal-800 font-semibold text-lg mb-1">
                              Module {index + 1}: {module.code}
                            </h4>
                            <p className="text-teal-600 text-sm mb-2">{module.title}</p>
                            {isComplete && (
                              <div className="flex items-center gap-3 text-xs text-teal-500">
                                <span className="text-emerald-500">3 variants generated</span>
                                <span>-</span>
                                <span>In-Person / Self-Study / Hybrid</span>
                              </div>
                            )}
                          </div>

                          <div className="flex-shrink-0">
                            {isComplete ? (
                              <button
                                onClick={() => {
                                  setSelectedModule(module.id);
                                  setActiveVariant('in_person');
                                }}
                                className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg transition-colors text-sm font-medium"
                              >
                                View Packs
                              </button>
                            ) : isGeneratingThis ? (
                              <div className="px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg text-sm font-medium">
                                Generating...
                              </div>
                            ) : canGenerate ? (
                              <button
                                onClick={handleGenerate}
                                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white rounded-lg transition-all text-sm font-medium"
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

                        {isGeneratingThis && (
                          <div className="mt-3 bg-white/50 rounded-lg p-3">
                            <div className="flex items-center gap-2 text-sm text-blue-400 mb-2">
                              <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                              <span>Generating 3 assignment pack variants...</span>
                            </div>
                            <p className="text-xs text-teal-500">
                              This will take 3-5 minutes. You can wait here or come back later.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Refresh Button */}
            <div className="mt-6 pt-6 border-t border-teal-200">
              <button
                onClick={onRefresh}
                className="w-full py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white rounded-lg transition-all text-sm font-medium flex items-center justify-center gap-2"
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
          </div>

          {/* Completion Banner */}
          {isAllModulesComplete && (
            <div
              className={`border rounded-xl p-6 text-center ${
                isApproved
                  ? 'bg-gradient-to-r from-emerald-500/20 to-green-500/20 border-emerald-500/30'
                  : 'bg-gradient-to-r from-blue-500/20 to-indigo-500/20 border-blue-500/30'
              }`}
            >
              <div
                className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${isApproved ? 'bg-emerald-500/20' : 'bg-blue-500/20'}`}
              >
                <svg
                  className={`w-8 h-8 ${isApproved ? 'text-emerald-400' : 'text-blue-400'}`}
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
                  <h3 className="text-xl font-bold text-emerald-400 mb-2">Step 12 Approved!</h3>
                  <p className="text-teal-700 mb-4">
                    All assignment packs have been approved. Proceed to Step 13.
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-xl font-bold text-blue-400 mb-2">
                    All Assignment Packs Generated!
                  </h3>
                  <p className="text-teal-700 mb-4">
                    All modules have assignment packs for all 3 delivery modes. Review and approve
                    to continue.
                  </p>
                  <button
                    onClick={handleApprove}
                    disabled={approveStep12.isPending}
                    className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mx-auto"
                  >
                    {approveStep12.isPending ? (
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
                        Approve & Continue to Step 13
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-teal-50/50 rounded-xl p-4 border border-teal-200 text-center">
              <p className="text-3xl font-bold text-teal-800">
                {completedModules}/{totalModules}
              </p>
              <p className="text-xs text-teal-500 mt-1">Modules Complete</p>
            </div>
            <div className="bg-teal-50/50 rounded-xl p-4 border border-teal-200 text-center">
              <p className="text-3xl font-bold text-blue-500">{completedModules * 3}</p>
              <p className="text-xs text-teal-500 mt-1">Total Assignment Packs</p>
            </div>
            <div className="bg-teal-50/50 rounded-xl p-4 border border-teal-200 text-center">
              <p className="text-3xl font-bold text-purple-500">3</p>
              <p className="text-xs text-teal-500 mt-1">Delivery Variants</p>
            </div>
          </div>

          {/* Module Selection */}
          {hasStep12Data && (
            <div className="bg-teal-50/50 rounded-lg p-4 border border-teal-200">
              <h4 className="text-teal-800 font-medium mb-3">
                Select Module to View Assignment Packs
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {workflow.step12?.moduleAssignmentPacks?.map((module, index) => (
                  <button
                    key={`select-${index}-${module.moduleId}`}
                    onClick={() => {
                      setSelectedModule(module.moduleId);
                      setActiveVariant('in_person');
                    }}
                    className={`p-4 rounded-lg border text-left transition-all ${
                      selectedModule === module.moduleId
                        ? 'bg-blue-500/20 border-blue-500 text-blue-500'
                        : 'bg-white border-teal-200 text-teal-700 hover:border-slate-600'
                    }`}
                  >
                    <div className="font-medium mb-1">{module.moduleCode}</div>
                    <div className="text-sm opacity-80 mb-2">{module.moduleTitle}</div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded">
                        In-Person
                      </span>
                      <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-600 rounded">
                        Self-Study
                      </span>
                      <span className="px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded">
                        Hybrid
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Assignment Pack Detail View */}
          {currentModulePacks && (
            <div className="space-y-4">
              <div className="bg-teal-50/50 rounded-lg p-5 border border-teal-200">
                <h3 className="text-xl font-bold text-teal-800 mb-2">
                  {currentModulePacks.moduleCode}: {currentModulePacks.moduleTitle}
                </h3>

                {/* Variant Tabs */}
                <div className="flex gap-2 mt-4">
                  {(['in_person', 'self_study', 'hybrid'] as AssignmentDeliveryVariant[]).map(
                    (variant) => (
                      <button
                        key={variant}
                        onClick={() => setActiveVariant(variant)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          activeVariant === variant
                            ? `bg-gradient-to-r ${VARIANT_COLORS[variant]} text-white`
                            : 'bg-white border border-teal-200 text-teal-700 hover:bg-teal-50'
                        }`}
                      >
                        {VARIANT_LABELS[variant]}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Active Variant Content */}
              {currentPack && (
                <div className="bg-white rounded-xl border border-teal-200/50 overflow-hidden">
                  {/* Overview */}
                  <div className="p-5 border-b border-teal-100">
                    <h4 className="text-lg font-semibold text-teal-800 mb-3">
                      {currentPack.overview?.title || 'Assignment Pack'}
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                      <div>
                        <span className="text-teal-500">Type:</span>{' '}
                        <span className="text-teal-800">
                          {currentPack.overview?.assignmentType}
                        </span>
                      </div>
                      <div>
                        <span className="text-teal-500">Weighting:</span>{' '}
                        <span className="text-teal-800">{currentPack.overview?.weighting}</span>
                      </div>
                      <div>
                        <span className="text-teal-500">Format:</span>{' '}
                        <span className="text-teal-800">
                          {currentPack.overview?.groupOrIndividual}
                        </span>
                      </div>
                      <div>
                        <span className="text-teal-500">Submission:</span>{' '}
                        <span className="text-teal-800">
                          {currentPack.overview?.submissionFormat}
                        </span>
                      </div>
                      <div>
                        <span className="text-teal-500">Variant:</span>{' '}
                        <span className="text-teal-800 font-medium">
                          {VARIANT_LABELS[activeVariant]}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Assessed Outcomes */}
                  <div className="border-b border-teal-100">
                    <button
                      onClick={() => toggleSection('outcomes')}
                      className="w-full p-5 flex items-center justify-between hover:bg-teal-50/50 transition-colors"
                    >
                      <h4 className="font-semibold text-teal-800">
                        Assessed Learning Outcomes ({currentPack.assessedOutcomes?.length || 0})
                      </h4>
                      <svg
                        className={`w-5 h-5 text-teal-500 transition-transform ${expandedSections['outcomes'] ? 'rotate-180' : ''}`}
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
                    {expandedSections['outcomes'] && (
                      <div className="px-5 pb-5 space-y-2">
                        {currentPack.assessedOutcomes?.map((outcome, i) => (
                          <div key={i} className="bg-teal-50/50 rounded-lg p-3">
                            <p className="text-sm text-teal-800 font-medium">{outcome.mloId}</p>
                            <p className="text-sm text-teal-600">{outcome.mloStatement}</p>
                            {outcome.linkedPLOs?.length > 0 && (
                              <div className="flex gap-1 mt-1">
                                {outcome.linkedPLOs.map((plo, j) => (
                                  <span
                                    key={j}
                                    className="px-1.5 py-0.5 bg-white text-xs text-teal-500 rounded"
                                  >
                                    {plo}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Assignment Brief */}
                  <div className="border-b border-teal-100">
                    <button
                      onClick={() => toggleSection('brief')}
                      className="w-full p-5 flex items-center justify-between hover:bg-teal-50/50 transition-colors"
                    >
                      <h4 className="font-semibold text-teal-800">Assignment Brief</h4>
                      <svg
                        className={`w-5 h-5 text-teal-500 transition-transform ${expandedSections['brief'] ? 'rotate-180' : ''}`}
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
                    {expandedSections['brief'] && currentPack.brief && (
                      <div className="px-5 pb-5 space-y-4">
                        <div>
                          <p className="text-xs text-teal-500 uppercase tracking-wide mb-1">
                            Student Introduction
                          </p>
                          <p className="text-sm text-teal-700">
                            {currentPack.brief.studentFacingIntro}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-teal-500 uppercase tracking-wide mb-1">
                            Workplace Context
                          </p>
                          <p className="text-sm text-teal-700">
                            {currentPack.brief.workplaceContext}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-teal-500 uppercase tracking-wide mb-1">
                            Instructions
                          </p>
                          <ol className="list-decimal list-inside space-y-1">
                            {currentPack.brief.stepByStepInstructions?.map((inst, i) => (
                              <li key={i} className="text-sm text-teal-700">
                                {inst}
                              </li>
                            ))}
                          </ol>
                        </div>
                        <div>
                          <p className="text-xs text-teal-500 uppercase tracking-wide mb-1">
                            Deliverables
                          </p>
                          <ul className="list-disc list-inside space-y-1">
                            {currentPack.brief.deliverables?.map((d, i) => (
                              <li key={i} className="text-sm text-teal-700">
                                {d}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Rubric */}
                  <div className="border-b border-teal-100">
                    <button
                      onClick={() => toggleSection('rubric')}
                      className="w-full p-5 flex items-center justify-between hover:bg-teal-50/50 transition-colors"
                    >
                      <h4 className="font-semibold text-teal-800">
                        Rubric ({currentPack.rubric?.length || 0} criteria)
                      </h4>
                      <svg
                        className={`w-5 h-5 text-teal-500 transition-transform ${expandedSections['rubric'] ? 'rotate-180' : ''}`}
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
                    {expandedSections['rubric'] && currentPack.rubric && (
                      <div className="px-5 pb-5 overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                          <thead>
                            <tr className="bg-teal-50">
                              <th className="p-2 text-left text-teal-700 font-medium border border-teal-200">
                                Criterion
                              </th>
                              <th className="p-2 text-left text-red-500 font-medium border border-teal-200">
                                Fail
                              </th>
                              <th className="p-2 text-left text-amber-600 font-medium border border-teal-200">
                                Pass
                              </th>
                              <th className="p-2 text-left text-blue-600 font-medium border border-teal-200">
                                Merit
                              </th>
                              <th className="p-2 text-left text-emerald-600 font-medium border border-teal-200">
                                Distinction
                              </th>
                              <th className="p-2 text-center text-teal-700 font-medium border border-teal-200 w-16">
                                Weight
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {currentPack.rubric.map((criterion, i) => (
                              <tr key={i} className="hover:bg-teal-50/30">
                                <td className="p-2 border border-teal-200 font-medium text-teal-800">
                                  {criterion.criterionName}
                                  {criterion.linkedMLOs?.length > 0 && (
                                    <div className="flex gap-1 mt-1">
                                      {criterion.linkedMLOs.map((mlo, j) => (
                                        <span
                                          key={j}
                                          className="px-1 py-0.5 bg-teal-100 text-xs text-teal-500 rounded"
                                        >
                                          {mlo}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </td>
                                <td className="p-2 border border-teal-200 text-xs text-teal-600">
                                  {criterion.fail}
                                </td>
                                <td className="p-2 border border-teal-200 text-xs text-teal-600">
                                  {criterion.pass}
                                </td>
                                <td className="p-2 border border-teal-200 text-xs text-teal-600">
                                  {criterion.merit}
                                </td>
                                <td className="p-2 border border-teal-200 text-xs text-teal-600">
                                  {criterion.distinction}
                                </td>
                                <td className="p-2 border border-teal-200 text-center text-teal-700 font-medium">
                                  {criterion.weight}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Evidence Requirements */}
                  <div className="border-b border-teal-100">
                    <button
                      onClick={() => toggleSection('evidence')}
                      className="w-full p-5 flex items-center justify-between hover:bg-teal-50/50 transition-colors"
                    >
                      <h4 className="font-semibold text-teal-800">Evidence Requirements</h4>
                      <svg
                        className={`w-5 h-5 text-teal-500 transition-transform ${expandedSections['evidence'] ? 'rotate-180' : ''}`}
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
                    {expandedSections['evidence'] && currentPack.evidenceRequirements && (
                      <div className="px-5 pb-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {currentPack.evidenceRequirements.map((ev, i) => (
                            <div key={i} className="bg-teal-50/50 rounded-lg p-3">
                              <p className="text-sm font-medium text-teal-800">{ev.artefactType}</p>
                              <p className="text-xs text-teal-600 mt-1">{ev.wordCountOrDuration}</p>
                              <p className="text-xs text-teal-500">{ev.fileType}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Academic Integrity & Accessibility */}
                  <div className="p-5 space-y-4">
                    {currentPack.academicIntegrity && (
                      <div>
                        <p className="text-xs text-teal-500 uppercase tracking-wide mb-1">
                          Academic Integrity
                        </p>
                        <p className="text-sm text-teal-700">{currentPack.academicIntegrity}</p>
                      </div>
                    )}
                    {currentPack.accessibilityOptions && (
                      <div>
                        <p className="text-xs text-teal-500 uppercase tracking-wide mb-1">
                          Accessibility Options
                        </p>
                        <p className="text-sm text-teal-700">{currentPack.accessibilityOptions}</p>
                      </div>
                    )}
                  </div>
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
          <div className="flex items-center justify-between pt-6 border-t border-teal-200">
            <button
              onClick={handleGenerate}
              disabled={submitNextModule.isPending || isAllModulesComplete}
              className="px-4 py-2 text-teal-600 hover:text-teal-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAllModulesComplete ? 'All Packs Generated' : 'Generate Next Module'}
            </button>

            {isAllModulesComplete && !isApproved && (
              <button
                onClick={handleApprove}
                disabled={approveStep12.isPending}
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {approveStep12.isPending ? (
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
                    Approve Step 12
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
