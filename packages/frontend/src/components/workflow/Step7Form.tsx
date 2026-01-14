'use client';

import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSubmitStep7, useApproveStep7, useClearStep7 } from '@/hooks/useWorkflow';
import { api } from '@/lib/api';
import {
  CurriculumWorkflow,
  FormativeAssessment,
  SummativeAssessment,
  MCQSample,
  SJTSample,
  CaseSample,
  EssaySample,
  PracticalSample,
} from '@/types/workflow';
import { useGeneration, GenerationProgressBar } from '@/contexts/GenerationContext';

interface Props {
  workflow: CurriculumWorkflow;
  onComplete: () => void;
  onRefresh: () => void;
}

// Formative Assessment Edit Modal Component
function FormativeAssessmentEditModal({
  assessment,
  onSave,
  onCancel,
  isSaving,
}: {
  assessment: FormativeAssessment;
  onSave: (updatedAssessment: FormativeAssessment) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [title, setTitle] = useState(assessment.title || '');
  const [assessmentType, setAssessmentType] = useState(assessment.assessmentType || '');
  const [description, setDescription] = useState(assessment.description || '');
  const [instructions, setInstructions] = useState(assessment.instructions || '');
  const [alignedPLOs, setAlignedPLOs] = useState<string[]>(assessment.alignedPLOs || []);
  const [alignedMLOs, setAlignedMLOs] = useState<string[]>(assessment.alignedMLOs || []);
  const [assessmentCriteria, setAssessmentCriteria] = useState<string[]>(
    assessment.assessmentCriteria || []
  );
  const [maxMarks, setMaxMarks] = useState(assessment.maxMarks || 0);
  const [ploInput, setPloInput] = useState('');
  const [mloInput, setMloInput] = useState('');
  const [criteriaInput, setCriteriaInput] = useState('');

  const handleSave = () => {
    onSave({
      ...assessment,
      title,
      assessmentType,
      description,
      instructions,
      alignedPLOs,
      alignedMLOs,
      assessmentCriteria,
      maxMarks,
    });
  };

  const addPLO = () => {
    if (ploInput.trim()) {
      setAlignedPLOs([...alignedPLOs, ploInput.trim()]);
      setPloInput('');
    }
  };

  const removePLO = (index: number) => {
    setAlignedPLOs(alignedPLOs.filter((_, i) => i !== index));
  };

  const addMLO = () => {
    if (mloInput.trim()) {
      setAlignedMLOs([...alignedMLOs, mloInput.trim()]);
      setMloInput('');
    }
  };

  const removeMLO = (index: number) => {
    setAlignedMLOs(alignedMLOs.filter((_, i) => i !== index));
  };

  const addCriteria = () => {
    if (criteriaInput.trim()) {
      setAssessmentCriteria([...assessmentCriteria, criteriaInput.trim()]);
      setCriteriaInput('');
    }
  };

  const removeCriteria = (index: number) => {
    setAssessmentCriteria(assessmentCriteria.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 bg-teal-900/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl border border-teal-200 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-teal-200">
          <h3 className="text-lg font-semibold text-teal-800 flex items-center gap-2">
            Edit <span className="text-cyan-400">Formative Assessment</span>
          </h3>
        </div>

        <div className="p-6 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-teal-500"
              placeholder="Enter assessment title..."
            />
          </div>

          {/* Assessment Type */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">Assessment Type</label>
            <input
              type="text"
              value={assessmentType}
              onChange={(e) => setAssessmentType(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-teal-500"
              placeholder="e.g., Quiz, Short Answer, MCQ"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-teal-500 resize-none"
              placeholder="Assessment description..."
            />
          </div>

          {/* Instructions */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">Instructions</label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-teal-500 resize-none"
              placeholder="Student instructions..."
            />
          </div>

          {/* Max Marks */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">Max Marks</label>
            <input
              type="number"
              value={maxMarks}
              onChange={(e) => setMaxMarks(parseInt(e.target.value) || 0)}
              min="0"
              className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-teal-500"
              placeholder="100"
            />
          </div>

          {/* Aligned PLOs */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">Aligned PLOs</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={ploInput}
                onChange={(e) => setPloInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addPLO())}
                className="flex-1 px-4 py-2 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-teal-500"
                placeholder="Add a PLO..."
              />
              <button
                type="button"
                onClick={addPLO}
                className="px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition-colors"
              >
                Add
              </button>
            </div>
            {alignedPLOs.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {alignedPLOs.map((plo, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-teal-100 text-teal-700 rounded-full text-sm flex items-center gap-2"
                  >
                    {plo}
                    <button
                      type="button"
                      onClick={() => removePLO(i)}
                      className="text-teal-500 hover:text-red-400"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Aligned MLOs */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">Aligned MLOs</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={mloInput}
                onChange={(e) => setMloInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addMLO())}
                className="flex-1 px-4 py-2 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-teal-500"
                placeholder="Add an MLO..."
              />
              <button
                type="button"
                onClick={addMLO}
                className="px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition-colors"
              >
                Add
              </button>
            </div>
            {alignedMLOs.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {alignedMLOs.map((mlo, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-teal-100 text-teal-700 rounded-full text-sm flex items-center gap-2"
                  >
                    {mlo}
                    <button
                      type="button"
                      onClick={() => removeMLO(i)}
                      className="text-teal-500 hover:text-red-400"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Assessment Criteria */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">
              Assessment Criteria
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={criteriaInput}
                onChange={(e) => setCriteriaInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addCriteria())}
                className="flex-1 px-4 py-2 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-teal-500"
                placeholder="Add assessment criteria..."
              />
              <button
                type="button"
                onClick={addCriteria}
                className="px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition-colors"
              >
                Add
              </button>
            </div>
            {assessmentCriteria.length > 0 && (
              <div className="space-y-2">
                {assessmentCriteria.map((criteria, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 bg-white rounded">
                    <span className="text-sm text-teal-700 flex-1">{criteria}</span>
                    <button
                      type="button"
                      onClick={() => removeCriteria(i)}
                      className="text-teal-500 hover:text-red-400"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
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
            disabled={isSaving || !title.trim()}
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

// Summative Assessment Edit Modal Component
function SummativeAssessmentEditModal({
  assessment,
  onSave,
  onCancel,
  isSaving,
}: {
  assessment: SummativeAssessment;
  onSave: (updatedAssessment: SummativeAssessment) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [title, setTitle] = useState(assessment.title || '');
  const [format, setFormat] = useState(assessment.format || '');
  const [overview, setOverview] = useState(assessment.overview || '');

  const handleSave = () => {
    onSave({
      ...assessment,
      title,
      format,
      overview,
    });
  };

  return (
    <div className="fixed inset-0 bg-teal-900/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl border border-teal-200 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-teal-200">
          <h3 className="text-lg font-semibold text-teal-800 flex items-center gap-2">
            Edit <span className="text-amber-400">Summative Assessment</span>
          </h3>
        </div>

        <div className="p-6 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-amber-500"
              placeholder="Enter assessment title..."
            />
          </div>

          {/* Format */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">Format</label>
            <input
              type="text"
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-amber-500"
              placeholder="e.g., Written Assignment, Case Study Analysis"
            />
          </div>

          {/* Overview */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">Overview</label>
            <textarea
              value={overview}
              onChange={(e) => setOverview(e.target.value)}
              rows={5}
              className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-amber-500 resize-none"
              placeholder="Assessment overview and description..."
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
            disabled={isSaving || !title.trim()}
            className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-teal-800 font-medium rounded-lg transition-all disabled:opacity-50 flex items-center gap-2"
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

interface Props {
  workflow: CurriculumWorkflow;
  onComplete: () => void;
  onRefresh: () => void;
}

// Assessment preferences form data
interface AssessmentUserPreferences {
  assessmentStructure: 'formative_only' | 'summative_only' | 'both_formative_and_summative';
  assessmentBalance:
    | 'mostly_knowledge_based'
    | 'mostly_applied'
    | 'mostly_scenario_based'
    | 'blended_mix';
  certificationStyles: string[];
  academicTypes: string[];
  summativeFormat:
    | 'mcq_exam'
    | 'written_assignment'
    | 'case_study_analysis'
    | 'project_capstone'
    | 'mixed_format'
    | 'user_defined';
  userDefinedSummativeDescription?: string;
  formativeTypesPerUnit: string[];
  formativePerModule: number;
  weightages: {
    formative?: number;
    summative?: number;
    mcqComponents?: number;
    writtenComponents?: number;
    practicalComponents?: number;
    projectCapstone?: number;
  };
  higherOrderPloPolicy: 'yes' | 'no' | 'partial';
  higherOrderPloRules?: string;
  useRealWorldScenarios: boolean;
  alignToWorkplacePerformance: boolean;
  integratedRealWorldSummative: boolean;
}

const CERTIFICATION_STYLES = ['SHRM', 'PMI', 'ASCM', 'SCOR', 'CIPS', 'AHLEI', 'CMA', 'None'];
const ACADEMIC_TYPES = [
  'Essays',
  'Case-study reports',
  'Presentations',
  'Portfolios',
  'Research papers',
  'Short written responses',
  'None',
];
const FORMATIVE_TYPES = [
  'Short quizzes',
  'MCQ knowledge checks',
  'Scenario-based micro-tasks',
  'Worksheets / problem sets',
  'Short written reflections',
  'Mini-case exercises',
  'Discussion prompts',
  'Practice simulations',
  'Coding / technical tasks',
  'None',
];

// Type for streaming samples state
interface StreamingSamplesState {
  mcq: MCQSample[];
  sjt: SJTSample[];
  caseQuestions: CaseSample[];
  essayPrompts: EssaySample[];
  practicalTasks: PracticalSample[];
}

export default function Step7FormNew({ workflow, onComplete, onRefresh }: Props) {
  const queryClient = useQueryClient();
  const submitStep7 = useSubmitStep7();
  const approveStep7 = useApproveStep7();
  const clearStep7 = useClearStep7();
  const [error, setError] = useState<string | null>(null);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'advanced'>('basic');
  const { startGeneration, completeGeneration, failGeneration, isGenerating } = useGeneration();

  // Edit state for assessments
  const [editingFormative, setEditingFormative] = useState<FormativeAssessment | null>(null);
  const [editingSummative, setEditingSummative] = useState<SummativeAssessment | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Real-time streaming data
  const [streamingFormatives, setStreamingFormatives] = useState<FormativeAssessment[]>([]);
  const [streamingSummatives, setStreamingSummatives] = useState<SummativeAssessment[]>([]);
  const [streamingSamples, setStreamingSamples] = useState<StreamingSamplesState>({
    mcq: [],
    sjt: [],
    caseQuestions: [],
    essayPrompts: [],
    practicalTasks: [],
  });

  const isCurrentlyGenerating = isGenerating(workflow._id, 7) || submitStep7.isPending;

  // Form state with defaults
  const [formData, setFormData] = useState<AssessmentUserPreferences>({
    assessmentStructure: 'both_formative_and_summative',
    assessmentBalance: 'blended_mix',
    certificationStyles: ['None'],
    academicTypes: ['None'],
    summativeFormat: 'mixed_format',
    formativeTypesPerUnit: ['Short quizzes', 'MCQ knowledge checks'],
    formativePerModule: 2,
    weightages: {
      formative: 30,
      summative: 70,
    },
    higherOrderPloPolicy: 'yes',
    useRealWorldScenarios: true,
    alignToWorkplacePerformance: true,
    integratedRealWorldSummative: true,
  });

  // Check for completion when data appears (only if not already generating)
  useEffect(() => {
    const hasData =
      workflow.step7 &&
      ((workflow.step7.formativeAssessments && workflow.step7.formativeAssessments.length > 0) ||
        (workflow.step7.summativeAssessments && workflow.step7.summativeAssessments.length > 0));

    if (hasData && isCurrentlyGenerating) {
      completeGeneration(workflow._id, 7);
      console.log('[Step7Form] Data appeared, marking generation as complete');
    }

    // If we have workflow data after streaming completed, clear streaming data to use canonical source
    if (hasData && (streamingFormatives.length > 0 || streamingSummatives.length > 0)) {
      console.log(
        '[Step7Form] Workflow data loaded, clearing streaming data to use canonical source'
      );
      setStreamingFormatives([]);
      setStreamingSummatives([]);
      setStreamingSamples({
        mcq: [],
        sjt: [],
        caseQuestions: [],
        essayPrompts: [],
        practicalTasks: [],
      });
    }
  }, [
    workflow.step7,
    workflow._id,
    completeGeneration,
    isCurrentlyGenerating,
    streamingFormatives.length,
    streamingSummatives.length,
  ]);

  // Update weightages when structure changes
  useEffect(() => {
    if (formData.assessmentStructure === 'formative_only') {
      setFormData((prev) => ({ ...prev, weightages: { formative: 100, summative: 0 } }));
    } else if (formData.assessmentStructure === 'summative_only') {
      setFormData((prev) => ({ ...prev, weightages: { formative: 0, summative: 100 } }));
    } else {
      // Default split
      setFormData((prev) => ({
        ...prev,
        weightages: {
          formative: prev.weightages.formative || 30,
          summative: prev.weightages.summative || 70,
        },
      }));
    }
  }, [formData.assessmentStructure]);

  const handleGenerate = async () => {
    setError(null);

    // Clear previous streaming data
    setStreamingFormatives([]);
    setStreamingSummatives([]);
    setStreamingSamples({
      mcq: [],
      sjt: [],
      caseQuestions: [],
      essayPrompts: [],
      practicalTasks: [],
    });

    // Debug: Log form data being sent
    console.log('[Step7Form] Using STREAMING endpoint for complete question generation:', {
      formativePerModule: formData.formativePerModule,
      formativePerModuleType: typeof formData.formativePerModule,
      weightages: formData.weightages,
      structure: formData.assessmentStructure,
    });

    startGeneration(workflow._id, 7, 2400); // 40 minutes estimated for complete questions (120+ detailed questions)

    try {
      // Use STREAMING endpoint to avoid timeouts with complete question generation
      const token = localStorage.getItem('auth_token');
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

      const response = await fetch(`${API_BASE_URL}/api/v3/workflow/${workflow._id}/step7/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to start generation');
      }

      // Read the SSE stream
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No reader available');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data:')) {
            try {
              const data = JSON.parse(line.slice(5).trim());
              console.log('[SSE Event]', data.type, data);

              // Accumulate streaming data for real-time display
              if (data.type === 'formative_batch' && data.formatives) {
                setStreamingFormatives((prev) => [...prev, ...data.formatives]);
              } else if (data.type === 'summative_batch' && data.summatives) {
                setStreamingSummatives((prev) => [...prev, ...data.summatives]);
              } else if (data.type === 'sample_batch' && data.samples) {
                const sampleType = data.sampleType;
                setStreamingSamples((prev) => ({
                  ...prev,
                  [sampleType]: data.samples,
                }));
              } else if (data.type === 'complete') {
                console.log('[Step7Form] ✅ Generation complete!');
                completeGeneration(workflow._id, 7);

                // Invalidate React Query cache to force refetch with fresh data
                console.log('[Step7Form] Invalidating workflow cache and refetching...');
                await queryClient.invalidateQueries({ queryKey: ['workflow', workflow._id] });

                // Force an immediate refetch to ensure we get the latest data
                await queryClient.refetchQueries({ queryKey: ['workflow', workflow._id] });

                // Also call onRefresh to trigger parent component update
                await onRefresh();

                console.log(
                  '[Step7Form] Data refreshed, UI should now show results with Approve button'
                );
                return;
              } else if (data.type === 'error') {
                throw new Error(data.error);
              }
            } catch (e) {
              console.error('[SSE] Parse error:', e);
            }
          }
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate assessments';
      console.error('Failed to generate assessments:', err);
      failGeneration(workflow._id, 7, errorMessage);
      setError(errorMessage);
    }
  };

  const handleApprove = async () => {
    setError(null);
    try {
      await approveStep7.mutateAsync(workflow._id);
      onComplete();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to approve Step 7';
      console.error('Failed to approve Step 7:', err);
      setError(errorMessage);
    }
  };

  // Handle editing a formative assessment
  const handleEditFormative = (assessment: FormativeAssessment) => {
    setEditingFormative(assessment);
  };

  // Handle editing a summative assessment
  const handleEditSummative = (assessment: SummativeAssessment) => {
    setEditingSummative(assessment);
  };

  // Handle saving edited formative assessment
  const handleSaveFormative = async (updatedAssessment: FormativeAssessment) => {
    setIsSavingEdit(true);
    setError(null);

    console.log('Saving formative assessment:', updatedAssessment);
    console.log('Workflow ID:', workflow._id);
    console.log('Assessment ID:', updatedAssessment.id);

    try {
      const response = await api.put(
        `/api/v3/workflow/${workflow._id}/step7/formative/${updatedAssessment.id}`,
        {
          title: updatedAssessment.title,
          assessmentType: updatedAssessment.assessmentType,
          description: updatedAssessment.description,
          instructions: updatedAssessment.instructions,
          alignedPLOs: updatedAssessment.alignedPLOs,
          alignedMLOs: updatedAssessment.alignedMLOs,
          assessmentCriteria: updatedAssessment.assessmentCriteria,
          maxMarks: updatedAssessment.maxMarks,
        }
      );

      console.log('Save response:', response.data);

      setEditingFormative(null);
      await onRefresh();
    } catch (err) {
      console.error('Error saving formative assessment:', err);
      setError(err instanceof Error ? err.message : 'Failed to save formative assessment');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Handle saving edited summative assessment
  const handleSaveSummative = async (updatedAssessment: SummativeAssessment) => {
    setIsSavingEdit(true);
    setError(null);

    console.log('Saving summative assessment:', updatedAssessment);
    console.log('Workflow ID:', workflow._id);
    console.log('Assessment ID:', updatedAssessment.id);

    try {
      const response = await api.put(
        `/api/v3/workflow/${workflow._id}/step7/summative/${updatedAssessment.id}`,
        {
          title: updatedAssessment.title,
          format: updatedAssessment.format,
          overview: updatedAssessment.overview,
        }
      );

      console.log('Save response:', response.data);

      setEditingSummative(null);
      await onRefresh();
    } catch (err) {
      console.error('Error saving summative assessment:', err);
      setError(err instanceof Error ? err.message : 'Failed to save summative assessment');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Handle canceling edit
  const handleCancelEdit = () => {
    setEditingFormative(null);
    setEditingSummative(null);
  };

  const handleRegenerate = async () => {
    setError(null);
    setShowRegenerateConfirm(false);

    try {
      console.log('[Step7Form] Clearing existing Step 7 data...');

      // Set generating state BEFORE clearing to keep UI in generating mode
      startGeneration(workflow._id, 7, 2400);

      // Clear existing Step 7 data from backend
      await clearStep7.mutateAsync(workflow._id);

      console.log('[Step7Form] Data cleared, starting regeneration...');

      // Start generation immediately (no refresh needed - will auto-refresh on complete)
      await handleGenerate();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to clear Step 7 data';
      console.error('Failed to regenerate:', err);
      setError(errorMessage);
      failGeneration(workflow._id, 7, errorMessage);
    }
  };

  // Check if we have data either from workflow prop OR from streaming (during/after generation)
  const hasWorkflowData =
    workflow.step7 &&
    ((workflow.step7.formativeAssessments && workflow.step7.formativeAssessments.length > 0) ||
      (workflow.step7.summativeAssessments && workflow.step7.summativeAssessments.length > 0));
  const hasStreamingData = streamingFormatives.length > 0 || streamingSummatives.length > 0;
  const hasStep7Data = hasWorkflowData || hasStreamingData;

  // DEBUG: Log what we have
  console.log('[Step7Form] Data check:', {
    hasWorkflowData,
    hasStreamingData,
    hasStep7Data,
    formativesInWorkflow: workflow.step7?.formativeAssessments?.length || 0,
    summativesInWorkflow: workflow.step7?.summativeAssessments?.length || 0,
    streamingFormatives: streamingFormatives.length,
    streamingSummatives: streamingSummatives.length,
    step7Exists: !!workflow.step7,
  });

  const isApproved = !!workflow.step7?.approvedAt;
  const validation = workflow.step7?.validation;

  // Toggle array item
  const toggleArrayItem = (array: string[], item: string) => {
    if (item === 'None') {
      return ['None'];
    }
    const filtered = array.filter((i) => i !== 'None');
    if (filtered.includes(item)) {
      const result = filtered.filter((i) => i !== item);
      return result.length === 0 ? ['None'] : result;
    }
    return [...filtered, item];
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Show generating state */}
      {isCurrentlyGenerating && !hasStep7Data && (
        <div className="mb-6 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 border-3 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            <div>
              <h3 className="text-lg font-semibold text-teal-800">
                Generating Comprehensive Assessments...
              </h3>
              <p className="text-sm text-teal-600">
                This may take 30-40 minutes. Streaming results appear below in real-time.
              </p>
            </div>
          </div>
          <GenerationProgressBar workflowId={workflow._id} step={7} />

          {/* Real-time streaming data display */}
          {(streamingFormatives.length > 0 ||
            streamingSummatives.length > 0 ||
            Object.values(streamingSamples).some(
              (arr: MCQSample[] | SJTSample[] | CaseSample[] | EssaySample[] | PracticalSample[]) =>
                arr.length > 0
            )) && (
            <div className="mt-6 space-y-4">
              <h4 className="text-teal-800 font-medium">Live Data Stream</h4>

              {/* Streaming counts */}
              <div className="grid grid-cols-5 gap-4">
                <div className="bg-white rounded-xl p-4 border border-cyan-500/30 text-center">
                  <p className="text-3xl font-bold text-cyan-400 animate-pulse">
                    {streamingFormatives.length}
                  </p>
                  <p className="text-xs text-teal-500 mt-1">Formative</p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-amber-500/30 text-center">
                  <p className="text-3xl font-bold text-amber-400 animate-pulse">
                    {streamingSummatives.length}
                  </p>
                  <p className="text-xs text-teal-500 mt-1">Summative</p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-purple-500/30 text-center">
                  <p className="text-3xl font-bold text-purple-400 animate-pulse">
                    {streamingSamples.mcq.length +
                      streamingSamples.sjt.length +
                      streamingSamples.caseQuestions.length +
                      streamingSamples.essayPrompts.length +
                      streamingSamples.practicalTasks.length}
                  </p>
                  <p className="text-xs text-teal-500 mt-1">Samples</p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-green-500/30 text-center">
                  <p className="text-2xl font-bold text-green-400">
                    {streamingFormatives.reduce((sum, f) => sum + (f.questions?.length || 0), 0)}
                  </p>
                  <p className="text-xs text-teal-500 mt-1">Questions</p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-emerald-500/30 text-center">
                  <p className="text-lg font-bold text-emerald-400">✓ Saved</p>
                  <p className="text-xs text-teal-500 mt-1">To Database</p>
                </div>
              </div>

              {/* Preview of formatives */}
              {streamingFormatives.length > 0 && (
                <div className="bg-teal-50/50 rounded-lg p-4 border border-cyan-500/20">
                  <h5 className="text-cyan-400 font-medium mb-2">Latest Formative Assessments</h5>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {streamingFormatives
                      .slice(-3)
                      .reverse()
                      .map((formative, idx) => (
                        <div
                          key={idx}
                          className="bg-teal-50 p-3 rounded border border-teal-200"
                        >
                          <p className="text-teal-800 font-medium text-sm">{formative.title}</p>
                          <p className="text-teal-600 text-xs mt-1">{formative.description}</p>
                          {formative.questions && formative.questions.length > 0 && (
                            <p className="text-cyan-400 text-xs mt-2">
                              ✓ {formative.questions.length} complete questions generated
                            </p>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!hasStep7Data && !isCurrentlyGenerating ? (
        // Configuration Form
        <div className="space-y-6">
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
              Step 7: Comprehensive Assessment Generation
            </h3>
            <p className="text-sm text-teal-700 mb-4">
              Generate a complete assessment system including formative assessments, summative
              assessments with components, sample question banks (MCQ, SJT, case studies, essays,
              practical tasks), and LMS-ready packages.
            </p>
            <div className="bg-white rounded-lg p-3 text-sm">
              <p className="text-teal-600">
                <strong className="text-teal-800">Comprehensive Assessment Package:</strong> Formative
                (low-stakes practice), Summative (graded components), Sample Questions (MCQ, SJT,
                cases, essays, practicals), and LMS export formats.
              </p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('basic')}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                activeTab === 'basic'
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500'
                  : 'bg-white text-teal-600 border border-teal-200'
              }`}
            >
              Basic Settings
            </button>
            <button
              onClick={() => setActiveTab('advanced')}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                activeTab === 'advanced'
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500'
                  : 'bg-white text-teal-600 border border-teal-200'
              }`}
            >
              Advanced Options
            </button>
          </div>

          {activeTab === 'basic' ? (
            <div className="space-y-6">
              {/* Assessment Structure */}
              <div>
                <h4 className="text-teal-800 font-medium mb-3">Assessment Structure</h4>
                <div className="space-y-2">
                  {[
                    {
                      value: 'both_formative_and_summative',
                      label: 'Both Formative & Summative',
                      desc: 'Complete assessment system (recommended)',
                    },
                    {
                      value: 'formative_only',
                      label: 'Formative Only',
                      desc: 'Low-stakes practice assessments',
                    },
                    {
                      value: 'summative_only',
                      label: 'Summative Only',
                      desc: 'Graded assessments only',
                    },
                  ].map((option) => (
                    <label
                      key={option.value}
                      className="flex items-start gap-3 p-3 bg-teal-50/50 rounded-lg border border-teal-200 cursor-pointer hover:border-cyan-500/50 transition-colors"
                    >
                      <input
                        type="radio"
                        name="assessmentStructure"
                        value={option.value}
                        checked={formData.assessmentStructure === option.value}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            assessmentStructure: e.target.value as
                              | 'formative_only'
                              | 'summative_only'
                              | 'both_formative_and_summative',
                          }))
                        }
                        className="mt-1 w-4 h-4 text-cyan-500 focus:ring-cyan-500"
                      />
                      <div>
                        <div className="text-sm text-teal-800 font-medium">{option.label}</div>
                        <div className="text-xs text-teal-600">{option.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Assessment Balance */}
              <div>
                <h4 className="text-teal-800 font-medium mb-3">Assessment Balance</h4>
                <div className="space-y-2">
                  {[
                    {
                      value: 'mostly_knowledge_based',
                      label: 'Mostly Knowledge-Based',
                      desc: 'Recall, definitions, concepts',
                    },
                    {
                      value: 'mostly_applied',
                      label: 'Mostly Applied',
                      desc: 'Problem-solving, calculations, application',
                    },
                    {
                      value: 'mostly_scenario_based',
                      label: 'Mostly Scenario-Based',
                      desc: 'Real-world situations, judgment calls',
                    },
                    {
                      value: 'blended_mix',
                      label: 'Blended Mix',
                      desc: 'Balanced combination (recommended)',
                    },
                  ].map((option) => (
                    <label
                      key={option.value}
                      className="flex items-start gap-3 p-3 bg-teal-50/50 rounded-lg border border-teal-200 cursor-pointer hover:border-cyan-500/50 transition-colors"
                    >
                      <input
                        type="radio"
                        name="assessmentBalance"
                        value={option.value}
                        checked={formData.assessmentBalance === option.value}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            assessmentBalance: e.target.value as
                              | 'mostly_knowledge_based'
                              | 'mostly_applied'
                              | 'mostly_scenario_based'
                              | 'blended_mix',
                          }))
                        }
                        className="mt-1 w-4 h-4 text-cyan-500 focus:ring-cyan-500"
                      />
                      <div>
                        <div className="text-sm text-teal-800 font-medium">{option.label}</div>
                        <div className="text-xs text-teal-600">{option.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Formative Settings */}
              {(formData.assessmentStructure === 'both_formative_and_summative' ||
                formData.assessmentStructure === 'formative_only') && (
                <div>
                  <h4 className="text-teal-800 font-medium mb-3">Formative Assessment Settings</h4>

                  <div className="mb-4">
                    <label className="block text-sm text-teal-600 mb-2">
                      Assessments per Module
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={formData.formativePerModule}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          formativePerModule: parseInt(e.target.value) || 1,
                        }))
                      }
                      className="w-32 px-4 py-2 bg-white border border-teal-200 rounded-lg text-teal-800 focus:outline-none focus:border-teal-500"
                    />
                    <p className="text-xs text-teal-500 mt-1">
                      1-5 formative assessments per module
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm text-teal-600 mb-2">
                      Formative Types (select multiple)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {FORMATIVE_TYPES.map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              formativeTypesPerUnit: toggleArrayItem(
                                prev.formativeTypesPerUnit,
                                type
                              ),
                            }))
                          }
                          className={`text-xs px-3 py-1.5 rounded transition-colors ${
                            formData.formativeTypesPerUnit.includes(type)
                              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500'
                              : 'bg-white text-teal-600 border border-teal-200 hover:border-teal-300'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Summative Format */}
              {(formData.assessmentStructure === 'both_formative_and_summative' ||
                formData.assessmentStructure === 'summative_only') && (
                <div>
                  <h4 className="text-teal-800 font-medium mb-3">Summative Assessment Format</h4>
                  <select
                    value={formData.summativeFormat}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        summativeFormat: e.target.value as
                          | 'mcq_exam'
                          | 'written_assignment'
                          | 'case_study_analysis'
                          | 'project_capstone'
                          | 'mixed_format'
                          | 'user_defined',
                      }))
                    }
                    className="w-full px-4 py-2 bg-white border border-teal-200 rounded-lg text-teal-800 focus:outline-none focus:border-teal-500"
                  >
                    <option value="mixed_format">Mixed Format (recommended)</option>
                    <option value="mcq_exam">MCQ Examination</option>
                    <option value="written_assignment">Written Assignment</option>
                    <option value="case_study_analysis">Case Study Analysis</option>
                    <option value="project_capstone">Project/Capstone</option>
                    <option value="user_defined">User Defined</option>
                  </select>

                  {formData.summativeFormat === 'user_defined' && (
                    <textarea
                      value={formData.userDefinedSummativeDescription || ''}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          userDefinedSummativeDescription: e.target.value,
                        }))
                      }
                      placeholder="Describe your custom summative format..."
                      className="mt-3 w-full px-4 py-2 bg-white border border-teal-200 rounded-lg text-teal-800 focus:outline-none focus:border-teal-500"
                      rows={3}
                    />
                  )}
                </div>
              )}

              {/* Weightages */}
              {formData.assessmentStructure === 'both_formative_and_summative' && (
                <div>
                  <h4 className="text-teal-800 font-medium mb-3">Assessment Weightages</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-teal-600 mb-2">
                        Formative Weight (%)
                      </label>
                      <input
                        type="number"
                        min={10}
                        max={50}
                        value={formData.weightages.formative || 30}
                        onChange={(e) => {
                          const formative = parseInt(e.target.value) || 30;
                          setFormData((prev) => ({
                            ...prev,
                            weightages: {
                              ...prev.weightages,
                              formative,
                              summative: 100 - formative,
                            },
                          }));
                        }}
                        className="w-full px-4 py-2 bg-white border border-teal-200 rounded-lg text-teal-800 focus:outline-none focus:border-teal-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-teal-600 mb-2">
                        Summative Weight (%)
                      </label>
                      <input
                        type="number"
                        min={50}
                        max={90}
                        value={formData.weightages.summative || 70}
                        onChange={(e) => {
                          const summative = parseInt(e.target.value) || 70;
                          setFormData((prev) => ({
                            ...prev,
                            weightages: {
                              ...prev.weightages,
                              summative,
                              formative: 100 - summative,
                            },
                          }));
                        }}
                        className="w-full px-4 py-2 bg-white border border-teal-200 rounded-lg text-teal-800 focus:outline-none focus:border-teal-500"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-teal-500 mt-2">
                    Total:{' '}
                    {(formData.weightages.formative || 0) + (formData.weightages.summative || 0)}%
                    {Math.abs(
                      (formData.weightages.formative || 0) +
                        (formData.weightages.summative || 0) -
                        100
                    ) > 0.1 && <span className="text-red-400 ml-2">⚠ Must sum to 100%</span>}
                  </p>
                </div>
              )}
            </div>
          ) : (
            // Advanced Options
            <div className="space-y-6">
              {/* Certification Styles */}
              <div>
                <h4 className="text-teal-800 font-medium mb-3">
                  Certification Style Influence (optional)
                </h4>
                <p className="text-xs text-teal-600 mb-2">
                  Select certification patterns to emulate:
                </p>
                <div className="flex flex-wrap gap-2">
                  {CERTIFICATION_STYLES.map((style) => (
                    <button
                      key={style}
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          certificationStyles: toggleArrayItem(prev.certificationStyles, style),
                        }))
                      }
                      className={`text-xs px-3 py-1.5 rounded transition-colors ${
                        formData.certificationStyles.includes(style)
                          ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500'
                          : 'bg-white text-teal-600 border border-teal-200 hover:border-teal-300'
                      }`}
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </div>

              {/* Academic Types */}
              <div>
                <h4 className="text-teal-800 font-medium mb-3">
                  Academic Assessment Types (optional)
                </h4>
                <p className="text-xs text-teal-600 mb-2">Select academic formats to include:</p>
                <div className="flex flex-wrap gap-2">
                  {ACADEMIC_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          academicTypes: toggleArrayItem(prev.academicTypes, type),
                        }))
                      }
                      className={`text-xs px-3 py-1.5 rounded transition-colors ${
                        formData.academicTypes.includes(type)
                          ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500'
                          : 'bg-white text-teal-600 border border-teal-200 hover:border-teal-300'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Higher-Order PLO Policy */}
              <div>
                <h4 className="text-teal-800 font-medium mb-3">Higher-Order PLO Policy</h4>
                <div className="space-y-2">
                  {[
                    {
                      value: 'yes',
                      label: 'Yes',
                      desc: 'Higher-order PLOs require advanced assessment types',
                    },
                    { value: 'no', label: 'No', desc: 'Treat all PLOs equally' },
                    {
                      value: 'partial',
                      label: 'Partial',
                      desc: 'Custom rules for higher-order PLOs',
                    },
                  ].map((option) => (
                    <label
                      key={option.value}
                      className="flex items-start gap-3 p-3 bg-teal-50/50 rounded-lg border border-teal-200 cursor-pointer hover:border-cyan-500/50 transition-colors"
                    >
                      <input
                        type="radio"
                        name="higherOrderPloPolicy"
                        value={option.value}
                        checked={formData.higherOrderPloPolicy === option.value}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            higherOrderPloPolicy: e.target.value as 'yes' | 'no' | 'partial',
                          }))
                        }
                        className="mt-1 w-4 h-4 text-cyan-500 focus:ring-cyan-500"
                      />
                      <div>
                        <div className="text-sm text-teal-800 font-medium">{option.label}</div>
                        <div className="text-xs text-teal-600">{option.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>

                {formData.higherOrderPloPolicy === 'partial' && (
                  <textarea
                    value={formData.higherOrderPloRules || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, higherOrderPloRules: e.target.value }))
                    }
                    placeholder="Describe your custom rules for higher-order PLOs..."
                    className="mt-3 w-full px-4 py-2 bg-white border border-teal-200 rounded-lg text-teal-800 focus:outline-none focus:border-teal-500"
                    rows={3}
                  />
                )}
              </div>

              {/* Toggles */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.useRealWorldScenarios}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, useRealWorldScenarios: e.target.checked }))
                    }
                    className="w-4 h-4 rounded border-teal-300 text-cyan-500 focus:ring-cyan-500 bg-white"
                  />
                  <span className="text-sm text-teal-700">
                    Use real-world scenarios in assessments
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.alignToWorkplacePerformance}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        alignToWorkplacePerformance: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 rounded border-teal-300 text-cyan-500 focus:ring-cyan-500 bg-white"
                  />
                  <span className="text-sm text-teal-700">
                    Align to workplace performance standards
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.integratedRealWorldSummative}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        integratedRealWorldSummative: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 rounded border-teal-300 text-cyan-500 focus:ring-cyan-500 bg-white"
                  />
                  <span className="text-sm text-teal-700">
                    Integrate real-world elements in summative assessment
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-400">{error}</p>
            </div>
          )}

          {/* Validation Warnings */}
          {Math.abs(
            (formData.weightages.formative || 0) + (formData.weightages.summative || 0) - 100
          ) > 0.1 && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
              <p className="text-yellow-400 text-sm">⚠️ Weightages must sum to 100%</p>
            </div>
          )}
          {(formData.formativePerModule < 1 || formData.formativePerModule > 5) && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
              <p className="text-yellow-400 text-sm">
                ⚠️ Formative assessments per module must be between 1 and 5
              </p>
            </div>
          )}

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={
              isCurrentlyGenerating ||
              Math.abs(
                (formData.weightages.formative || 0) + (formData.weightages.summative || 0) - 100
              ) > 0.1 ||
              !formData.formativePerModule ||
              formData.formativePerModule < 1 ||
              formData.formativePerModule > 5
            }
            className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-teal-800 font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCurrentlyGenerating ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generating Comprehensive Assessments...
              </span>
            ) : (
              'Generate Assessment Package'
            )}
          </button>
        </div>
      ) : (
        // Display Generated Assessments
        <div className="space-y-6">
          {/* Overall Stats - Use workflow data if available, otherwise streaming data */}
          <div className="grid grid-cols-5 gap-4">
            <div className="bg-white rounded-xl p-4 border border-teal-200 text-center">
              <p className="text-3xl font-bold text-cyan-400">
                {workflow.step7?.formativeAssessments?.length || streamingFormatives.length}
              </p>
              <p className="text-xs text-teal-500 mt-1">Formative</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-teal-200 text-center">
              <p className="text-3xl font-bold text-amber-400">
                {workflow.step7?.summativeAssessments?.length || streamingSummatives.length}
              </p>
              <p className="text-xs text-teal-500 mt-1">Summative</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-teal-200 text-center">
              <p className="text-3xl font-bold text-purple-400">
                {workflow.step7?.sampleQuestions
                  ? (workflow.step7.sampleQuestions.mcq?.length || 0) +
                    (workflow.step7.sampleQuestions.sjt?.length || 0) +
                    (workflow.step7.sampleQuestions.caseQuestions?.length || 0) +
                    (workflow.step7.sampleQuestions.essayPrompts?.length || 0) +
                    (workflow.step7.sampleQuestions.practicalTasks?.length || 0)
                  : streamingSamples.mcq.length +
                    streamingSamples.sjt.length +
                    streamingSamples.caseQuestions.length +
                    streamingSamples.essayPrompts.length +
                    streamingSamples.practicalTasks.length}
              </p>
              <p className="text-xs text-teal-500 mt-1">Sample Questions</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-teal-200 text-center">
              <p className="text-3xl font-bold text-green-400">
                {Object.keys(workflow.step7?.lmsPackages || {}).length}
              </p>
              <p className="text-xs text-teal-500 mt-1">LMS Formats</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-teal-200 text-center">
              <p
                className={`text-3xl font-bold ${validation?.plosCovered ? 'text-emerald-400' : hasStreamingData ? 'text-amber-400' : 'text-red-400'}`}
              >
                {validation?.plosCovered ? '✓' : hasStreamingData ? '⟳' : '✗'}
              </p>
              <p className="text-xs text-teal-500 mt-1">
                {hasStreamingData && !validation ? 'Loading...' : 'Valid'}
              </p>
            </div>
          </div>

          {/* Loading message if we only have streaming data */}
          {hasStreamingData && !hasWorkflowData && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                <p className="text-blue-400">
                  Generation complete! Finalizing data and validation... This will take just a
                  moment.
                </p>
              </div>
            </div>
          )}

          {/* Validation Report */}
          {validation && (
            <div
              className={`rounded-lg p-4 border ${validation.plosCovered ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}
            >
              <h4
                className={`font-medium mb-3 ${validation.plosCovered ? 'text-emerald-400' : 'text-amber-400'}`}
              >
                Validation Report
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                <span
                  className={validation.allFormativesMapped ? 'text-emerald-400' : 'text-red-400'}
                >
                  {validation.allFormativesMapped ? '✓' : '✗'} Formatives Mapped
                </span>
                <span
                  className={validation.allSummativesMapped ? 'text-emerald-400' : 'text-red-400'}
                >
                  {validation.allSummativesMapped ? '✓' : '✗'} Summatives Mapped
                </span>
                <span className={validation.weightsSum100 ? 'text-emerald-400' : 'text-red-400'}>
                  {validation.weightsSum100 ? '✓' : '✗'} Weights = 100%
                </span>
                <span
                  className={
                    validation.sufficientSampleQuestions ? 'text-emerald-400' : 'text-red-400'
                  }
                >
                  {validation.sufficientSampleQuestions ? '✓' : '✗'} Sufficient Samples
                </span>
                <span className={validation.plosCovered ? 'text-emerald-400' : 'text-red-400'}>
                  {validation.plosCovered ? '✓' : '✗'} All PLOs Covered
                </span>
              </div>
            </div>
          )}

          {/* Sample Breakdown */}
          {workflow.step7?.sampleQuestions && (
            <div className="bg-white rounded-lg p-4 border border-teal-200">
              <h4 className="text-teal-800 font-medium mb-3">Sample Question Bank</h4>
              <div className="grid grid-cols-5 gap-3 text-sm">
                <div>
                  <span className="text-teal-600">MCQ:</span>
                  <span className="text-teal-800 ml-2">
                    {workflow.step7.sampleQuestions.mcq?.length || 0}
                  </span>
                </div>
                <div>
                  <span className="text-teal-600">SJT:</span>
                  <span className="text-teal-800 ml-2">
                    {workflow.step7.sampleQuestions.sjt?.length || 0}
                  </span>
                </div>
                <div>
                  <span className="text-teal-600">Cases:</span>
                  <span className="text-teal-800 ml-2">
                    {workflow.step7.sampleQuestions.caseQuestions?.length || 0}
                  </span>
                </div>
                <div>
                  <span className="text-teal-600">Essays:</span>
                  <span className="text-teal-800 ml-2">
                    {workflow.step7.sampleQuestions.essayPrompts?.length || 0}
                  </span>
                </div>
                <div>
                  <span className="text-teal-600">Practical:</span>
                  <span className="text-teal-800 ml-2">
                    {workflow.step7.sampleQuestions.practicalTasks?.length || 0}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Detailed Assessment Cards */}
          {((workflow.step7?.formativeAssessments?.length ?? 0) > 0 ||
            (workflow.step7?.summativeAssessments?.length ?? 0) > 0) && (
            <div className="space-y-6">
              {/* Formative Assessments */}
              {(workflow.step7?.formativeAssessments?.length ?? 0) > 0 && (
                <div className="bg-white rounded-lg p-5 border border-teal-200">
                  <h4 className="text-cyan-400 font-medium mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5H7a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                      />
                    </svg>
                    Formative Assessments ({workflow.step7?.formativeAssessments?.length ?? 0})
                  </h4>
                  <div className="space-y-4">
                    {workflow.step7?.formativeAssessments?.map((assessment) => (
                      <div
                        key={assessment.id}
                        className="bg-teal-50 rounded-lg p-4 border border-teal-200"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h5 className="text-teal-800 font-medium mb-1">{assessment.title}</h5>
                            <div className="flex items-center gap-3 text-sm text-teal-600 mb-2">
                              <span className="px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded text-xs">
                                {assessment.assessmentType}
                              </span>
                              {assessment.maxMarks && <span>{assessment.maxMarks} marks</span>}
                              <span>Module: {assessment.moduleId}</span>
                            </div>
                            <p className="text-sm text-teal-700 mb-2">{assessment.description}</p>
                            {assessment.alignedPLOs?.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-2">
                                <span className="text-xs text-teal-500">PLOs:</span>
                                {assessment.alignedPLOs.map((plo, i) => (
                                  <span
                                    key={i}
                                    className="text-xs px-2 py-0.5 bg-teal-100 rounded text-teal-700"
                                  >
                                    {plo}
                                  </span>
                                ))}
                              </div>
                            )}
                            {assessment.alignedMLOs?.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                <span className="text-xs text-teal-500">MLOs:</span>
                                {assessment.alignedMLOs.map((mlo, i) => (
                                  <span
                                    key={i}
                                    className="text-xs px-2 py-0.5 bg-teal-100 rounded text-teal-700"
                                  >
                                    {mlo}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => handleEditFormative(assessment)}
                            className="px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded-lg transition-colors text-sm font-medium flex items-center gap-1"
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
                        </div>
                        {assessment.instructions && (
                          <div className="bg-white rounded p-3 mt-3">
                            <p className="text-xs text-teal-500 mb-1">Instructions:</p>
                            <p className="text-sm text-teal-700">{assessment.instructions}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Summative Assessments */}
              {(workflow.step7?.summativeAssessments?.length ?? 0) > 0 && (
                <div className="bg-white rounded-lg p-5 border border-teal-200">
                  <h4 className="text-amber-400 font-medium mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    Summative Assessments ({workflow.step7?.summativeAssessments?.length ?? 0})
                  </h4>
                  <div className="space-y-4">
                    {workflow.step7?.summativeAssessments?.map((assessment) => (
                      <div
                        key={assessment.id}
                        className="bg-teal-50 rounded-lg p-4 border border-teal-200"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h5 className="text-teal-800 font-medium mb-1">{assessment.title}</h5>
                            <div className="flex items-center gap-3 text-sm text-teal-600 mb-2">
                              <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded text-xs">
                                {assessment.format}
                              </span>
                              <span className="px-2 py-1 bg-teal-300 text-teal-700 rounded text-xs">
                                {assessment.scope}
                              </span>
                              {assessment.moduleId && <span>Module: {assessment.moduleId}</span>}
                            </div>
                            <p className="text-sm text-teal-700 mb-3">{assessment.overview}</p>
                            {assessment.components?.length > 0 && (
                              <div className="space-y-1">
                                <span className="text-xs text-teal-500">Components:</span>
                                {assessment.components.map((component, i) => (
                                  <div key={i} className="flex items-center gap-2 text-xs">
                                    <span className="px-2 py-0.5 bg-teal-100 rounded text-teal-700">
                                      {component.name} ({component.weight}%)
                                    </span>
                                    <span className="text-teal-500">{component.description}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => handleEditSummative(assessment)}
                            className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg transition-colors text-sm font-medium flex items-center gap-1"
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
                        </div>
                      </div>
                    ))}
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
              onClick={() => setShowRegenerateConfirm(true)}
              disabled={clearStep7.isPending || submitStep7.isPending}
              className="px-4 py-2 text-teal-600 hover:text-teal-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {clearStep7.isPending ? 'Clearing...' : 'Regenerate'}
            </button>
            <div className="flex gap-3">
              {!isApproved && (
                <button
                  onClick={handleApprove}
                  disabled={
                    approveStep7.isPending ||
                    !validation?.plosCovered ||
                    (hasStreamingData && !hasWorkflowData)
                  }
                  title={
                    hasStreamingData && !hasWorkflowData
                      ? 'Waiting for data to finalize...'
                      : !validation?.plosCovered
                        ? 'All PLOs must be covered before approval'
                        : undefined
                  }
                  className={`px-6 py-2.5 font-medium rounded-lg transition-all disabled:opacity-50 ${
                    !validation?.plosCovered || (hasStreamingData && !hasWorkflowData)
                      ? 'bg-teal-300 text-teal-600 cursor-not-allowed'
                      : 'bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-teal-800'
                  }`}
                >
                  {approveStep7.isPending
                    ? 'Approving...'
                    : hasStreamingData && !hasWorkflowData
                      ? 'Finalizing...'
                      : 'Approve & Continue →'}
                </button>
              )}
              {isApproved && (
                <span className="px-4 py-2.5 bg-emerald-500/20 text-emerald-400 rounded-lg flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
        </div>
      )}

      {/* Regenerate Confirmation Dialog */}
      {showRegenerateConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white border border-teal-200 rounded-xl p-6 max-w-md mx-4 shadow-2xl">
            <h3 className="text-xl font-semibold text-teal-800 mb-3">Regenerate Step 7?</h3>
            <p className="text-teal-700 mb-6">
              This will <strong className="text-red-400">delete all existing Step 7 data</strong>{' '}
              (formative assessments, summative assessments, sample questions) and start fresh
              generation.
            </p>
            <p className="text-sm text-teal-600 mb-6">
              This action cannot be undone. The generation will take 30-40 minutes.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowRegenerateConfirm(false)}
                className="px-4 py-2 bg-teal-100 hover:bg-teal-300 text-teal-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRegenerate}
                disabled={clearStep7.isPending}
                className="px-4 py-2 bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-400 hover:to-orange-500 text-teal-800 font-medium rounded-lg transition-all disabled:opacity-50"
              >
                {clearStep7.isPending ? 'Clearing...' : 'Yes, Regenerate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modals */}
      {editingFormative && (
        <FormativeAssessmentEditModal
          assessment={editingFormative}
          onSave={handleSaveFormative}
          onCancel={handleCancelEdit}
          isSaving={isSavingEdit}
        />
      )}

      {editingSummative && (
        <SummativeAssessmentEditModal
          assessment={editingSummative}
          onSave={handleSaveSummative}
          onCancel={handleCancelEdit}
          isSaving={isSavingEdit}
        />
      )}
    </div>
  );
}
