'use client';

import { useState, useEffect } from 'react';
import { useSubmitStep10, useApproveStep10 } from '@/hooks/useWorkflow';
import { api } from '@/lib/api';
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

// Lesson Plan Edit Modal Component
function LessonPlanEditModal({
  lesson,
  onSave,
  onCancel,
  isSaving,
}: {
  lesson: LessonPlan;
  onSave: (updatedLesson: LessonPlan) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [lessonTitle, setLessonTitle] = useState(lesson.lessonTitle || '');
  const [duration, setDuration] = useState(lesson.duration || 90);
  const [objectives, setObjectives] = useState<string[]>(lesson.objectives || []);
  const [pedagogicalGuidance, setPedagogicalGuidance] = useState(
    lesson.instructorNotes?.pedagogicalGuidance || ''
  );
  const [pacingSuggestions, setPacingSuggestions] = useState(
    lesson.instructorNotes?.pacingSuggestions || ''
  );
  const [adaptationOptions, setAdaptationOptions] = useState<string[]>(
    lesson.instructorNotes?.adaptationOptions || []
  );
  const [estimatedEffort, setEstimatedEffort] = useState(
    lesson.independentStudy?.estimatedEffort || 120
  );
  const [objectiveInput, setObjectiveInput] = useState('');
  const [adaptationInput, setAdaptationInput] = useState('');

  const handleSave = () => {
    onSave({
      ...lesson,
      lessonTitle,
      duration,
      objectives,
      instructorNotes: {
        ...lesson.instructorNotes,
        pedagogicalGuidance,
        pacingSuggestions,
        adaptationOptions,
      },
      independentStudy: {
        ...lesson.independentStudy,
        estimatedEffort,
      },
    });
  };

  const addObjective = () => {
    if (objectiveInput.trim()) {
      setObjectives([...objectives, objectiveInput.trim()]);
      setObjectiveInput('');
    }
  };

  const removeObjective = (index: number) => {
    setObjectives(objectives.filter((_, i) => i !== index));
  };

  const addAdaptation = () => {
    if (adaptationInput.trim()) {
      setAdaptationOptions([...adaptationOptions, adaptationInput.trim()]);
      setAdaptationInput('');
    }
  };

  const removeAdaptation = (index: number) => {
    setAdaptationOptions(adaptationOptions.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 bg-teal-900/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl border border-teal-200 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-teal-200">
          <h3 className="text-lg font-semibold text-teal-800 flex items-center gap-2">
            Edit <span className="text-cyan-400">Lesson Plan</span>
          </h3>
        </div>

        <div className="p-6 space-y-5">
          {/* Lesson Title */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">Lesson Title</label>
            <input
              type="text"
              value={lessonTitle}
              onChange={(e) => setLessonTitle(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-teal-500"
              placeholder="Enter lesson title..."
            />
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">
              Duration (minutes)
            </label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value) || 90)}
              min="30"
              max="180"
              className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-teal-500"
              placeholder="90"
            />
          </div>

          {/* Learning Objectives */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">
              Learning Objectives
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={objectiveInput}
                onChange={(e) => setObjectiveInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addObjective())}
                className="flex-1 px-4 py-2 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-teal-500"
                placeholder="Add a learning objective..."
              />
              <button
                type="button"
                onClick={addObjective}
                className="px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition-colors"
              >
                Add
              </button>
            </div>
            {objectives.length > 0 && (
              <div className="space-y-2">
                {objectives.map((objective, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 bg-white rounded">
                    <span className="text-sm text-teal-700 flex-1">{objective}</span>
                    <button
                      type="button"
                      onClick={() => removeObjective(i)}
                      className="text-teal-500 hover:text-red-400"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pedagogical Guidance */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">
              Pedagogical Guidance
            </label>
            <textarea
              value={pedagogicalGuidance}
              onChange={(e) => setPedagogicalGuidance(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-teal-500 resize-none"
              placeholder="Teaching approach and methodology guidance..."
            />
          </div>

          {/* Pacing Suggestions */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">
              Pacing Suggestions
            </label>
            <textarea
              value={pacingSuggestions}
              onChange={(e) => setPacingSuggestions(e.target.value)}
              rows={2}
              className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-teal-500 resize-none"
              placeholder="Timing and pacing recommendations..."
            />
          </div>

          {/* Adaptation Options */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">
              Adaptation Options
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={adaptationInput}
                onChange={(e) => setAdaptationInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addAdaptation())}
                className="flex-1 px-4 py-2 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-teal-500"
                placeholder="Add an adaptation option..."
              />
              <button
                type="button"
                onClick={addAdaptation}
                className="px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition-colors"
              >
                Add
              </button>
            </div>
            {adaptationOptions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {adaptationOptions.map((option, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-teal-100 text-teal-700 rounded-full text-sm flex items-center gap-2"
                  >
                    {option}
                    <button
                      type="button"
                      onClick={() => removeAdaptation(i)}
                      className="text-teal-500 hover:text-red-400"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Independent Study Effort */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">
              Independent Study Effort (minutes)
            </label>
            <input
              type="number"
              value={estimatedEffort}
              onChange={(e) => setEstimatedEffort(parseInt(e.target.value) || 120)}
              min="30"
              max="300"
              className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-teal-500"
              placeholder="120"
            />
          </div>
        </div>

        <div className="p-6 border-t border-teal-200 flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isSaving}
            className="px-5 py-2.5 text-teal-600 hover:text-teal-600 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !lessonTitle.trim()}
            className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-teal-800 font-medium rounded-lg transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Step10View({ workflow, onComplete, onRefresh }: Props) {
  const submitStep10 = useSubmitStep10();
  const approveStep10 = useApproveStep10();
  const [error, setError] = useState<string | null>(null);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<string | null>(null);
  const [generatingModuleId, setGeneratingModuleId] = useState<string | null>(null);
  const { startGeneration, completeGeneration, failGeneration, isGenerating } = useGeneration();

  // Edit state for lesson plans
  const [editingLesson, setEditingLesson] = useState<LessonPlan | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const isCurrentlyGenerating = isGenerating(workflow._id, 10) || submitStep10.isPending;

  const handleGenerate = async () => {
    setError(null);

    const nextModuleIndex = workflow.step10?.moduleLessonPlans?.length || 0;
    const nextModule = workflow.step4?.modules?.[nextModuleIndex];

    if (!nextModule) {
      setError('No more modules to generate');
      return;
    }

    setGeneratingModuleId(nextModule.id);
    startGeneration(workflow._id, 10, 300); // 5 minutes estimated per module

    try {
      await submitStep10.mutateAsync(workflow._id);

      // Generation started in background - user will manually refresh to check progress
      completeGeneration(workflow._id, 10);
      setGeneratingModuleId(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate lesson plans';
      console.error('Failed to generate lesson plans:', err);
      failGeneration(workflow._id, 10, errorMessage);
      setError(errorMessage);
      setGeneratingModuleId(null);
    }
  };

  // Handle editing a lesson plan
  const handleEditLesson = (lesson: LessonPlan) => {
    setEditingLesson(lesson);
  };

  // Handle saving edited lesson plan
  const handleSaveLesson = async (updatedLesson: LessonPlan) => {
    setIsSavingEdit(true);
    setError(null);

    console.log('[Step10] Saving lesson plan:', {
      workflowId: workflow._id,
      lessonId: updatedLesson.lessonId,
      lessonTitle: updatedLesson.lessonTitle,
    });

    try {
      const payload = {
        lessonTitle: updatedLesson.lessonTitle,
        duration: updatedLesson.duration,
        objectives: updatedLesson.objectives,
        instructorNotes: updatedLesson.instructorNotes,
        independentStudy: updatedLesson.independentStudy,
      };

      console.log('[Step10] Sending PUT request with payload:', payload);

      const response = await api.put(
        `/api/v3/workflow/${workflow._id}/step10/lesson/${updatedLesson.lessonId}`,
        payload
      );

      console.log('[Step10] ✅ Save response:', response.data);

      // Close modal first
      setEditingLesson(null);

      // Force refresh the workflow data
      console.log('[Step10] Refreshing workflow data...');
      await onRefresh();
      console.log('[Step10] ✅ Refresh complete');
    } catch (err) {
      console.error('[Step10] ❌ Error saving lesson plan:', err);
      setError(err instanceof Error ? err.message : 'Failed to save lesson plan');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Handle canceling edit
  const handleCancelEdit = () => {
    setEditingLesson(null);
  };

  // Handle approving Step 10
  const handleApprove = async () => {
    setError(null);
    try {
      await approveStep10.mutateAsync(workflow._id);
      onComplete();
    } catch (err: any) {
      console.error('Failed to approve Step 10:', err);
      setError(err.message || 'Failed to approve Step 10');
    }
  };

  const hasStep10Data = workflow.step10 && workflow.step10.moduleLessonPlans?.length > 0;
  const validation = workflow.step10?.validation;
  const isApproved = !!workflow.step10?.approvedAt;

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
  const isAllModulesComplete = hasStep10Data && completedModules >= totalModules;

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
                  <p className="text-teal-700 text-sm">
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
            <p className="text-sm text-teal-700 mb-4">
              Generate detailed lesson plans for each module with activity sequences, materials, and
              instructor notes. PowerPoint decks will be automatically created for each lesson.
            </p>

            {/* What Will Be Generated */}
            <div className="bg-white rounded-lg p-4 mb-4">
              <p className="text-teal-600 font-medium mb-3">What Will Be Generated:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="bg-teal-50 rounded p-3">
                  <p className="text-cyan-400 font-medium mb-2">📚 Lesson Plans</p>
                  <ul className="text-teal-600 space-y-1">
                    <li>• Lesson objectives from MLOs</li>
                    <li>• Activity sequences with timings</li>
                    <li>• Teaching methods & materials</li>
                    <li>• Instructor notes & guidance</li>
                    <li>• Independent study assignments</li>
                  </ul>
                </div>
                <div className="bg-teal-50 rounded p-3">
                  <p className="text-orange-400 font-medium mb-2">📊 PowerPoint Decks</p>
                  <ul className="text-teal-600 space-y-1">
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
            <div className="bg-white rounded-lg p-4">
              <p className="text-teal-600 font-medium mb-3">
                Using Context From All Previous Steps:
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                <span className="px-2 py-1 bg-white rounded text-teal-700">
                  Step 1: Program Foundation
                </span>
                <span className="px-2 py-1 bg-white rounded text-teal-700">
                  Step 2: Competencies
                </span>
                <span className="px-2 py-1 bg-white rounded text-teal-700">Step 3: PLOs</span>
                <span className="px-2 py-1 bg-white rounded text-teal-700">
                  Step 4: Modules & MLOs
                </span>
                <span className="px-2 py-1 bg-white rounded text-teal-700">
                  Steps 5-6: Sources & Readings
                </span>
                <span className="px-2 py-1 bg-white rounded text-teal-700">
                  Step 7: Assessments
                </span>
                <span className="px-2 py-1 bg-white rounded text-teal-700">
                  Step 8: Case Studies
                </span>
                <span className="px-2 py-1 bg-white rounded text-teal-700">
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
            className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-teal-800 font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
          {/* Module Generation List - Show all modules with individual controls */}
          <div className="bg-white rounded-lg p-6 border border-teal-200">
            <h3 className="text-xl font-bold text-teal-800 mb-4">Module Generation Progress</h3>
            <p className="text-sm text-teal-600 mb-6">
              Generate lesson plans and PowerPoint decks for each module individually. Each module
              takes 2-5 minutes to generate.
            </p>

            <div className="space-y-4">
              {workflow.step4?.modules?.map((module, index) => {
                const modulePlan = workflow.step10?.moduleLessonPlans?.find(
                  (m) => m.moduleId === module.id
                );
                const isComplete = !!modulePlan;
                const isGenerating =
                  generatingModuleId === module.id ||
                  (generatingModuleId === 'next' && !isComplete && index === completedModules);
                const canGenerate =
                  !isComplete && !isCurrentlyGenerating && index === completedModules;

                return (
                  <div
                    key={module.id}
                    className={`rounded-lg border p-4 transition-all ${
                      isComplete
                        ? 'bg-emerald-500/10 border-emerald-500/30'
                        : isGenerating
                          ? 'bg-cyan-500/10 border-cyan-500/30'
                          : canGenerate
                            ? 'bg-teal-50 border-teal-300'
                            : 'bg-teal-50/30 border-teal-200/50 opacity-60'
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
                          <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
                            <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                          </div>
                        ) : canGenerate ? (
                          <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                            <span className="text-xl">📚</span>
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
                              Module {index + 1}: {module.code}
                            </h4>
                            <p className="text-teal-600 text-sm mb-2">{module.title}</p>
                            <div className="flex items-center gap-4 text-xs text-teal-500">
                              <span>{module.contactHours}h contact hours</span>
                              {modulePlan && (
                                <>
                                  <span>•</span>
                                  <span className="text-emerald-400">
                                    {modulePlan.totalLessons} lessons generated
                                  </span>
                                  <span>•</span>
                                  <span className="text-orange-400">
                                    {modulePlan.pptDecks.length} PPT decks
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Action Button */}
                          <div className="flex-shrink-0">
                            {isComplete ? (
                              <button
                                onClick={() => setSelectedModule(module.id)}
                                className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg transition-colors text-sm font-medium"
                              >
                                View Details
                              </button>
                            ) : isGenerating ? (
                              <div className="px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-lg text-sm font-medium">
                                Generating...
                              </div>
                            ) : canGenerate ? (
                              <button
                                onClick={handleGenerate}
                                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-teal-800 rounded-lg transition-all text-sm font-medium"
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
                          <div className="mt-3 bg-teal-50 rounded-lg p-3">
                            <div className="flex items-center gap-2 text-sm text-cyan-400 mb-2">
                              <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                              <span>Generating lesson plans and PPT decks...</span>
                            </div>
                            <p className="text-xs text-teal-500">
                              This will take 2-5 minutes. You can wait here or come back later -
                              progress is saved automatically.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Manual Refresh Button - Always visible when generation is in progress */}
            <div className="mt-6 pt-6 border-t border-teal-200">
              <button
                onClick={onRefresh}
                className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-teal-800 rounded-lg transition-all text-sm font-medium flex items-center justify-center gap-2"
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

          {/* Completion Banner */}
          {isAllModulesComplete && (
            <div
              className={`border rounded-xl p-6 text-center ${
                isApproved
                  ? 'bg-gradient-to-r from-emerald-500/20 to-green-500/20 border-emerald-500/30'
                  : 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border-cyan-500/30'
              }`}
            >
              <div
                className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
                  isApproved ? 'bg-emerald-500/20' : 'bg-cyan-500/20'
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
                    className="w-8 h-8 text-cyan-400"
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
                  <h3 className="text-xl font-bold text-emerald-400 mb-2">✅ Step 10 Approved!</h3>
                  <p className="text-teal-700 mb-4">
                    All lesson plans and PowerPoint decks have been approved. Click "Complete &
                    Review" in the header to finalize your curriculum.
                  </p>
                  <p className="text-emerald-400 text-sm animate-pulse">
                    ↑ Click "Complete & Review" button above to finalize
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-xl font-bold text-cyan-400 mb-2">🎉 All Modules Complete!</h3>
                  <p className="text-teal-700 mb-4">
                    All lesson plans and PowerPoint decks have been generated. Review the content
                    and approve to continue.
                  </p>
                  <button
                    onClick={handleApprove}
                    disabled={approveStep10.isPending}
                    className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-teal-800 font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mx-auto"
                  >
                    {approveStep10.isPending ? (
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
                        Approve & Continue
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Overall Stats */}
          <div className="grid grid-cols-5 gap-4">
            <div className="bg-white rounded-xl p-4 border border-teal-200 text-center">
              <p className="text-3xl font-bold text-teal-800">
                {workflow.step10?.summary?.totalLessons || 0}
              </p>
              <p className="text-xs text-teal-500 mt-1">Total Lessons</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-teal-200 text-center">
              <p className="text-3xl font-bold text-cyan-400">
                {workflow.step10?.summary?.totalContactHours || 0}h
              </p>
              <p className="text-xs text-teal-500 mt-1">Contact Hours</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-teal-200 text-center">
              <p className="text-3xl font-bold text-purple-400">
                {workflow.step10?.summary?.caseStudiesIncluded || 0}
              </p>
              <p className="text-xs text-teal-500 mt-1">Case Studies</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-teal-200 text-center">
              <p className="text-3xl font-bold text-amber-400">
                {workflow.step10?.summary?.formativeChecksIncluded || 0}
              </p>
              <p className="text-xs text-teal-500 mt-1">Formative Checks</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-teal-200 text-center">
              <p className="text-3xl font-bold text-orange-400">
                {workflow.step10?.moduleLessonPlans?.reduce(
                  (sum, m) => sum + m.pptDecks.length,
                  0
                ) || 0}
              </p>
              <p className="text-xs text-teal-500 mt-1">PPT Decks</p>
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
          <div className="bg-white rounded-lg p-4 border border-teal-200">
            <h4 className="text-teal-800 font-medium mb-3">Select Module</h4>
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
                      : 'bg-white border-teal-200 text-teal-700 hover:border-teal-300'
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
              <div className="bg-white rounded-lg p-5 border border-teal-200">
                <h3 className="text-xl font-bold text-teal-800 mb-2">
                  {currentModule.moduleCode}: {currentModule.moduleTitle}
                </h3>
                <div className="flex items-center gap-4 text-sm text-teal-600">
                  <span>{currentModule.totalLessons} Lessons</span>
                  <span>•</span>
                  <span>{currentModule.totalContactHours} Contact Hours</span>
                  <span>•</span>
                  <span>{currentModule.pptDecks.length} PPT Decks</span>
                </div>
              </div>

              {/* Lesson List */}
              <div className="bg-white rounded-lg p-5 border border-teal-200">
                <h4 className="text-teal-800 font-medium mb-4">Lessons</h4>
                <div className="space-y-3">
                  {currentModule.lessons.map((lesson) => (
                    <div
                      key={lesson.lessonId}
                      className={`w-full p-4 rounded-lg border transition-all ${
                        selectedLesson === lesson.lessonId
                          ? 'bg-cyan-500/20 border-cyan-500'
                          : 'bg-white border-teal-200 hover:border-teal-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <button
                          onClick={() => setSelectedLesson(lesson.lessonId)}
                          className="flex-1 text-left"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-teal-800 font-medium">
                              Lesson {lesson.lessonNumber}: {lesson.lessonTitle}
                            </span>
                            <span className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded">
                              {lesson.bloomLevel}
                            </span>
                          </div>
                          <div className="text-sm text-teal-600 mb-2">
                            {lesson.duration} minutes • {lesson.activities.length} activities
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs">
                            {lesson.linkedMLOs.map((mlo) => (
                              <span
                                key={mlo}
                                className="px-2 py-0.5 bg-teal-100 rounded text-teal-700"
                              >
                                {mlo}
                              </span>
                            ))}
                          </div>
                        </button>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEditLesson(lesson)}
                            className="px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded-lg transition-colors text-sm font-medium flex items-center gap-1"
                            title="Edit lesson"
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
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                            Edit
                          </button>
                          <svg
                            className={`w-5 h-5 text-teal-600 transition-transform ${
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
                      </div>
                    </div>
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
                      <div key={deck.deckId} className="bg-white rounded-lg p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="text-teal-800 font-medium text-sm">
                              Lesson {lesson?.lessonNumber || '?'}
                            </p>
                            <p className="text-xs text-teal-600">{deck.slideCount} slides</p>
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
                <div className="mt-4 bg-white rounded-lg p-3 text-xs text-teal-600">
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
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-teal-800 mb-3">
                      Lesson {currentLesson.lessonNumber}: {currentLesson.lessonTitle}
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-teal-700 mb-4">
                      <span>⏱️ {currentLesson.duration} minutes</span>
                      <span>•</span>
                      <span>📊 {currentLesson.bloomLevel}</span>
                      <span>•</span>
                      <span>🎯 {currentLesson.linkedMLOs.length} MLOs</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleEditLesson(currentLesson)}
                    className="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded-lg transition-colors text-sm font-medium flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                    Edit Lesson
                  </button>
                </div>

                {/* Objectives */}
                <div className="bg-white rounded-lg p-4 mb-4">
                  <h4 className="text-cyan-400 font-medium mb-2">Learning Objectives</h4>
                  <ul className="space-y-1 text-sm text-teal-700">
                    {currentLesson.objectives.map((obj, i) => (
                      <li key={i}>• {obj}</li>
                    ))}
                  </ul>
                </div>

                {/* Activity Sequence */}
                <div className="bg-white rounded-lg p-4">
                  <h4 className="text-cyan-400 font-medium mb-3">Activity Sequence</h4>
                  <div className="space-y-3">
                    {currentLesson.activities.map((activity) => (
                      <div key={activity.activityId} className="bg-teal-50 rounded p-3">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-teal-800 font-medium">{activity.title}</span>
                              <span className="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded">
                                {activity.type.replace('_', ' ')}
                              </span>
                            </div>
                            <p className="text-sm text-teal-600">{activity.description}</p>
                          </div>
                          <span className="text-sm text-cyan-400 font-medium whitespace-nowrap">
                            {activity.duration} min
                          </span>
                        </div>
                        {activity.teachingMethod && (
                          <div className="text-xs text-teal-500">
                            Method: {activity.teachingMethod}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Materials */}
              <div className="bg-white rounded-lg p-5 border border-teal-200">
                <h4 className="text-teal-800 font-medium mb-3">Required Materials</h4>
                <div className="space-y-3">
                  {currentLesson.materials.pptDeckRef && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-orange-400">📊</span>
                      <span className="text-teal-700">
                        PowerPoint: {currentLesson.materials.pptDeckRef}
                      </span>
                    </div>
                  )}
                  {currentLesson.materials.caseFiles.length > 0 && (
                    <div>
                      <p className="text-sm text-teal-600 mb-1">Case Files:</p>
                      <div className="flex flex-wrap gap-2">
                        {currentLesson.materials.caseFiles.map((file, i) => (
                          <span
                            key={i}
                            className="text-xs px-2 py-1 bg-white rounded text-teal-700"
                          >
                            {file}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {currentLesson.materials.readingReferences.length > 0 && (
                    <div>
                      <p className="text-sm text-teal-600 mb-1">Reading References:</p>
                      <div className="space-y-1">
                        {currentLesson.materials.readingReferences.map((ref, i) => (
                          <div key={i} className="text-xs text-teal-700">
                            • {ref.authors.join(', ')} ({ref.year}). {ref.title}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Instructor Notes */}
              <div className="bg-white rounded-lg p-5 border border-teal-200">
                <h4 className="text-teal-800 font-medium mb-3">Instructor Notes</h4>
                <div className="space-y-3 text-sm">
                  {currentLesson.instructorNotes.pedagogicalGuidance && (
                    <div>
                      <p className="text-cyan-400 font-medium mb-1">Pedagogical Guidance:</p>
                      <p className="text-teal-700">
                        {currentLesson.instructorNotes.pedagogicalGuidance}
                      </p>
                    </div>
                  )}
                  {currentLesson.instructorNotes.pacingSuggestions && (
                    <div>
                      <p className="text-cyan-400 font-medium mb-1">Pacing Suggestions:</p>
                      <p className="text-teal-700">
                        {currentLesson.instructorNotes.pacingSuggestions}
                      </p>
                    </div>
                  )}
                  {currentLesson.instructorNotes.adaptationOptions.length > 0 && (
                    <div>
                      <p className="text-cyan-400 font-medium mb-1">Adaptation Options:</p>
                      <ul className="text-teal-700 space-y-1">
                        {currentLesson.instructorNotes.adaptationOptions.map((opt, i) => (
                          <li key={i}>• {opt}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {/* Independent Study */}
              <div className="bg-white rounded-lg p-5 border border-teal-200">
                <h4 className="text-teal-800 font-medium mb-3">Independent Study</h4>
                <div className="space-y-3">
                  {currentLesson.independentStudy.coreReadings.length > 0 && (
                    <div>
                      <p className="text-sm text-cyan-400 font-medium mb-2">Core Readings:</p>
                      <div className="space-y-2">
                        {currentLesson.independentStudy.coreReadings.map((reading, i) => (
                          <div key={i} className="text-xs bg-teal-50 rounded p-2">
                            <p className="text-teal-700 mb-1">{reading.citation}</p>
                            <p className="text-teal-500">
                              Est. {reading.estimatedMinutes} minutes
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {currentLesson.independentStudy.supplementaryReadings.length > 0 && (
                    <div>
                      <p className="text-sm text-teal-600 font-medium mb-2">
                        Supplementary Readings:
                      </p>
                      <div className="space-y-2">
                        {currentLesson.independentStudy.supplementaryReadings.map((reading, i) => (
                          <div key={i} className="text-xs bg-teal-50 rounded p-2">
                            <p className="text-teal-700 mb-1">{reading.citation}</p>
                            <p className="text-teal-500">
                              Est. {reading.estimatedMinutes} minutes
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="text-sm text-teal-600">
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
                      <p className="text-teal-800 font-medium">
                        {currentLesson.caseStudyActivity.caseTitle}
                      </p>
                      <p className="text-teal-600 text-xs mt-1">
                        {currentLesson.caseStudyActivity.activityType} •{' '}
                        {currentLesson.caseStudyActivity.duration} min
                      </p>
                    </div>
                    <div>
                      <p className="text-purple-400 font-medium mb-1">Learning Purpose:</p>
                      <p className="text-teal-700">
                        {currentLesson.caseStudyActivity.learningPurpose}
                      </p>
                    </div>
                    <div>
                      <p className="text-purple-400 font-medium mb-1">Instructor Instructions:</p>
                      <p className="text-teal-700">
                        {currentLesson.caseStudyActivity.instructorInstructions}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Formative Checks */}
              {currentLesson.formativeChecks.length > 0 && (
                <div className="bg-white rounded-lg p-5 border border-teal-200">
                  <h4 className="text-teal-800 font-medium mb-3">Formative Checks</h4>
                  <div className="space-y-3">
                    {currentLesson.formativeChecks.map((check) => (
                      <div key={check.checkId} className="bg-teal-50 rounded p-3">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <p className="text-sm text-teal-800 flex-1">{check.question}</p>
                          <span className="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded whitespace-nowrap">
                            {check.type}
                          </span>
                        </div>
                        {check.options && (
                          <div className="space-y-1 text-xs text-teal-600 mb-2">
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
                          <p className="text-xs text-teal-500 mt-2">💡 {check.explanation}</p>
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
                        <p className="text-teal-600 text-sm">
                          No PowerPoint deck available for this lesson.
                        </p>
                      );
                    }

                    return (
                      <div className="space-y-4">
                        <div className="bg-white rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <p className="text-teal-800 font-medium">
                                Lesson {currentLesson.lessonNumber} Slides
                              </p>
                              <p className="text-sm text-teal-600">{pptDeck.slideCount} slides</p>
                            </div>
                            <span className="text-2xl">📊</span>
                          </div>

                          {/* Download Options */}
                          <div className="space-y-2">
                            <p className="text-xs text-teal-500 mb-2">Download Formats:</p>
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
                        <div className="bg-white rounded-lg p-3 text-xs text-teal-600">
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

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-6 border-t border-teal-200">
            <button
              onClick={handleGenerate}
              disabled={submitStep10.isPending || isAllModulesComplete}
              className="px-4 py-2 text-teal-600 hover:text-teal-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAllModulesComplete ? 'All Modules Generated' : 'Regenerate Lesson Plans'}
            </button>

            {isAllModulesComplete && !isApproved && (
              <button
                onClick={handleApprove}
                disabled={approveStep10.isPending}
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-teal-800 font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {approveStep10.isPending ? (
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
                    Approve Step 10
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

      {/* Edit Modal */}
      {editingLesson && (
        <LessonPlanEditModal
          lesson={editingLesson}
          onSave={handleSaveLesson}
          onCancel={handleCancelEdit}
          isSaving={isSavingEdit}
        />
      )}
    </div>
  );
}
