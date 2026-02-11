'use client';

import { useState, useEffect } from 'react';
import { useSubmitStep3, useApproveStep3 } from '@/hooks/useWorkflow';
import { useStepStatus } from '@/hooks/useStepStatus';
import { useGeneration, GenerationProgressBar } from '@/contexts/GenerationContext';
import { api } from '@/lib/api';
import {
  CurriculumWorkflow,
  Step3FormData,
  BloomLevel,
  OutcomeEmphasis,
  BLOOM_LEVELS,
  BLOOM_VERBS,
  PLO,
  KSCItem,
} from '@/types/workflow';
import EditWithAIButton, { EditTarget } from './EditWithAIButton';

interface Props {
  workflow: CurriculumWorkflow;
  onComplete: () => void;
  onRefresh: () => void;
  onOpenCanvas?: (target: EditTarget) => void;
}

// Bloom's taxonomy level colors
const BLOOM_COLORS: Record<BloomLevel, string> = {
  remember: 'bg-red-500/20 text-red-400 border-red-500/30',
  understand: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  apply: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  analyze: 'bg-green-500/20 text-green-400 border-green-500/30',
  evaluate: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  create: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

// Bloom's level descriptions per workflow v2.2
const BLOOM_DESCRIPTIONS: Record<BloomLevel, string> = {
  remember: 'Foundational knowledge (lower)',
  understand: 'Foundational knowledge (lower)',
  apply: 'Using knowledge practically (lower)',
  analyze: 'Breaking down complex problems (higher)',
  evaluate: 'Making informed judgments (higher)',
  create: 'Producing original work (higher)',
};

// Lower and higher level classifications
const LOWER_LEVELS: BloomLevel[] = ['remember', 'understand', 'apply'];
const HIGHER_LEVELS: BloomLevel[] = ['analyze', 'evaluate', 'create'];

// Outcome emphasis options per workflow v2.2
const EMPHASIS_OPTIONS: { value: OutcomeEmphasis; label: string; description: string }[] = [
  { value: 'technical', label: 'Technical/Applied', description: 'Focus on skills and procedures' },
  {
    value: 'professional',
    label: 'Professional/Behavioral',
    description: 'Focus on soft skills and conduct',
  },
  { value: 'strategic', label: 'Broad/Strategic', description: 'Systems thinking and leadership' },
  { value: 'mixed', label: 'Mixed', description: 'Combination approach' },
];

// PLO Edit Modal Component
function PLOEditModal({
  plo,
  index,
  onSave,
  onCancel,
  isSaving,
}: {
  plo: PLO;
  index: number;
  onSave: (updatedPlo: PLO) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [statement, setStatement] = useState(plo.statement || '');
  const [verb, setVerb] = useState(plo.verb || '');
  const [bloomLevel, setBloomLevel] = useState<BloomLevel>(plo.bloomLevel || 'apply');
  const [assessmentAlignment, setAssessmentAlignment] = useState(plo.assessmentAlignment || '');
  const [jobTaskMapping, setJobTaskMapping] = useState<string[]>(plo.jobTaskMapping || []);
  const [jobTaskInput, setJobTaskInput] = useState('');

  const handleSave = () => {
    onSave({
      ...plo,
      statement,
      verb,
      bloomLevel,
      assessmentAlignment,
      jobTaskMapping,
    });
  };

  const addJobTask = () => {
    if (jobTaskInput.trim()) {
      setJobTaskMapping([...jobTaskMapping, jobTaskInput.trim()]);
      setJobTaskInput('');
    }
  };

  const removeJobTask = (index: number) => {
    setJobTaskMapping(jobTaskMapping.filter((_, i) => i !== index));
  };

  const wordCount = statement.split(/\s+/).filter(Boolean).length;

  return (
    <div className="fixed inset-0 bg-teal-900/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl border border-teal-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-teal-200">
          <h3 className="text-lg font-semibold text-teal-800 flex items-center gap-2">
            Edit <span className="text-purple-400">PLO {index + 1}</span>
          </h3>
        </div>

        <div className="p-6 space-y-5">
          {/* Statement */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">
              PLO Statement
              <span
                className={`ml-2 text-xs ${wordCount <= 25 ? 'text-emerald-400' : 'text-amber-400'}`}
              >
                ({wordCount}/25 words)
              </span>
            </label>
            <textarea
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-teal-500 resize-none"
              placeholder="Enter the PLO statement..."
            />
          </div>

          {/* Bloom's Level */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">
              Bloom's Taxonomy Level
            </label>
            <div className="grid grid-cols-3 gap-2">
              {BLOOM_LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setBloomLevel(level)}
                  className={`py-2 px-3 rounded-lg border text-sm capitalize transition-all ${
                    bloomLevel === level
                      ? BLOOM_COLORS[level]
                      : 'bg-white border-teal-300 text-teal-600 hover:border-teal-400'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          {/* Verb */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">Bloom's Verb</label>
            <input
              type="text"
              value={verb}
              onChange={(e) => setVerb(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-teal-500"
              placeholder="e.g., analyze, evaluate, design"
            />
            <p className="text-xs text-teal-500 mt-1">
              Suggested verbs for {bloomLevel}: {BLOOM_VERBS[bloomLevel]?.slice(0, 5).join(', ')}
            </p>
          </div>

          {/* Assessment Alignment */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">
              Assessment Alignment
            </label>
            <textarea
              value={assessmentAlignment}
              onChange={(e) => setAssessmentAlignment(e.target.value)}
              rows={2}
              className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-teal-500 resize-none"
              placeholder="How will this PLO be assessed?"
            />
          </div>

          {/* Job Task Mapping */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">
              Job Tasks Addressed
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={jobTaskInput}
                onChange={(e) => setJobTaskInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addJobTask())}
                className="flex-1 px-4 py-2 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-teal-500"
                placeholder="Add a job task..."
              />
              <button
                type="button"
                onClick={addJobTask}
                className="px-4 py-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors"
              >
                Add
              </button>
            </div>
            {jobTaskMapping.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {jobTaskMapping.map((task, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-teal-100 text-teal-700 rounded-full text-sm flex items-center gap-2"
                  >
                    {task}
                    <button
                      type="button"
                      onClick={() => removeJobTask(i)}
                      className="text-teal-500 hover:text-red-400"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Linked KSCs (read-only) */}
          {plo.linkedKSCs && plo.linkedKSCs.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-teal-700 mb-2">
                Linked Competencies
              </label>
              <p className="text-sm text-teal-500 bg-teal-50/50 px-4 py-3 rounded-lg">
                {plo.linkedKSCs.length} KSC{plo.linkedKSCs.length !== 1 ? 's' : ''} linked
              </p>
            </div>
          )}
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
            disabled={isSaving || !statement.trim()}
            className="px-5 py-2.5 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-400 hover:to-pink-500 text-teal-800 font-medium rounded-lg transition-all disabled:opacity-50 flex items-center gap-2"
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

// PLO Card Component
function PLOCard({
  plo,
  index,
  onEdit,
  onInlineEdit,
}: {
  plo: PLO;
  index: number;
  onEdit?: (target: EditTarget) => void;
  onInlineEdit?: (plo: PLO, index: number) => void;
}) {
  const wordCount = plo.statement?.split(/\s+/).length || 0;

  return (
    <div className="bg-white rounded-xl p-5 border border-teal-200 hover:border-teal-300 transition-colors group">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-mono text-teal-500 bg-white px-2 py-1 rounded">
            PLO{index + 1}
          </span>
          <span
            className={`text-xs px-3 py-1 rounded-full border capitalize font-medium ${
              BLOOM_COLORS[plo.bloomLevel] || 'bg-teal-100 text-teal-600'
            }`}
          >
            {plo.bloomLevel}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-teal-500">{wordCount}/25 words</span>
          {onEdit && (
            <EditWithAIButton
              target={{
                type: 'item',
                stepNumber: 3,
                itemId: plo.id,
                originalContent: plo,
                fieldPath: `PLO ${index + 1}: ${plo.statement?.substring(0, 30)}...`,
              }}
              onEdit={onEdit}
              size="sm"
              variant="icon"
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            />
          )}
        </div>
      </div>

      {/* Statement */}
      <p className="text-teal-800 text-lg leading-relaxed mb-4">{plo.statement}</p>

      {/* Details Grid */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        {/* Verb */}
        <div className="bg-teal-50 rounded-lg p-3">
          <p className="text-xs text-teal-500 mb-1">Bloom's Verb</p>
          <p className="text-cyan-400 font-medium capitalize">{plo.verb}</p>
        </div>

        {/* Competency Links */}
        <div className="bg-teal-50 rounded-lg p-3">
          <p className="text-xs text-teal-500 mb-1">Competency Links</p>
          <p className="text-teal-800">
            {plo.linkedKSCs?.length || 0} KSC{(plo.linkedKSCs?.length || 0) !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Assessment Alignment */}
        {plo.assessmentAlignment && (
          <div className="bg-teal-50 rounded-lg p-3 col-span-2">
            <p className="text-xs text-teal-500 mb-1">Assessment Alignment</p>
            <p className="text-teal-700">{plo.assessmentAlignment}</p>
          </div>
        )}

        {/* Job Task Mapping */}
        {plo.jobTaskMapping && plo.jobTaskMapping.length > 0 && (
          <div className="bg-teal-50 rounded-lg p-3 col-span-2">
            <p className="text-xs text-teal-500 mb-1">Job Tasks Addressed</p>
            <p className="text-teal-700">{plo.jobTaskMapping.join(', ')}</p>
          </div>
        )}
      </div>

      {/* Validation Badges and Edit Button */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-teal-200">
        <div className="flex items-center gap-3">
          {plo.measurable && (
            <span className="text-xs text-emerald-400 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Measurable
            </span>
          )}
          {plo.assessable && (
            <span className="text-xs text-emerald-400 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Assessable
            </span>
          )}
          {wordCount <= 25 && (
            <span className="text-xs text-emerald-400 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              ≤25 words
            </span>
          )}
        </div>
        {onInlineEdit && (
          <button
            onClick={() => onInlineEdit(plo, index)}
            className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
          >
            Edit
          </button>
        )}
      </div>
    </div>
  );
}

export default function Step3Form({ workflow, onComplete, onRefresh, onOpenCanvas }: Props) {
  const submitStep3 = useSubmitStep3();
  const approveStep3 = useApproveStep3();

  const { startGeneration, completeGeneration, failGeneration, isGenerating } = useGeneration();

  // Background job polling for Step 3
  const {
    status: stepStatus,
    startPolling,
    isPolling,
    isGenerationActive: isQueueActive,
  } = useStepStatus(workflow._id, 3, {
    pollInterval: 10000,
    autoStart: true,
    onComplete: () => {
      completeGeneration(workflow._id, 3);
      onRefresh();
    },
    onFailed: (err) => {
      failGeneration(workflow._id, 3, err);
      setError(err);
    },
  });

  // Form state
  const [formData, setFormData] = useState<Step3FormData>({
    bloomLevels: ['apply', 'analyze'],
    targetCount: 6,
    outcomeEmphasis: 'mixed',
    priorityCompetencies: [],
    contextConstraints: '',
    preferredVerbs: [],
    avoidVerbs: [],
    stakeholderPriorities: '',
    exclusions: [],
  });

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit state for PLOs
  const [editingPlo, setEditingPlo] = useState<PLO | null>(null);
  const [editingPloIndex, setEditingPloIndex] = useState<number>(-1);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Get Essential KSCs from Step 2 for priority selection
  const essentialKSCs: KSCItem[] = [];
  if (workflow.step2) {
    const step2 = workflow.step2 as any;
    const allItems = [
      ...(step2.knowledgeItems || []),
      ...(step2.skillItems || []),
      ...(step2.competencyItems || step2.attitudeItems || []),
    ];
    essentialKSCs.push(...allItems.filter((item: KSCItem) => item.importance === 'essential'));
  }

  // Validation: check Bloom's level requirements
  const hasLowerLevel = formData.bloomLevels.some((l) => LOWER_LEVELS.includes(l));
  const hasHigherLevel = formData.bloomLevels.some((l) => HIGHER_LEVELS.includes(l));
  const bloomValid = hasLowerLevel && hasHigherLevel;

  const toggleBloomLevel = (level: BloomLevel) => {
    setFormData((prev) => ({
      ...prev,
      bloomLevels: prev.bloomLevels.includes(level)
        ? prev.bloomLevels.filter((l) => l !== level)
        : [...prev.bloomLevels, level],
    }));
  };

  const togglePriorityCompetency = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      priorityCompetencies: prev.priorityCompetencies?.includes(id)
        ? prev.priorityCompetencies.filter((c) => c !== id)
        : [...(prev.priorityCompetencies || []), id],
    }));
  };

  const isCurrentlyGenerating =
    isGenerating(workflow._id, 3) || submitStep3.isPending || isPolling || isQueueActive;

  // Check for completion when data appears
  useEffect(() => {
    if (workflow.step3 && (workflow.step3.outcomes?.length || 0) > 0) {
      completeGeneration(workflow._id, 3);
    }
  }, [workflow.step3, workflow._id, completeGeneration]);

  const handleGenerate = async () => {
    setError(null);

    // Validate Bloom's levels
    if (!bloomValid) {
      setError(
        'You must select at least 1 lower level (Remember/Understand/Apply) AND 1 higher level (Analyze/Evaluate/Create)'
      );
      return;
    }

    try {
      startGeneration(workflow._id, 3);
      const response = await submitStep3.mutateAsync({
        id: workflow._id,
        data: formData,
      });
      if ((response as any)?.data?.jobId) {
        startPolling();
      } else {
        completeGeneration(workflow._id, 3);
        onRefresh();
      }
    } catch (err: any) {
      console.error('Failed to generate PLOs:', err);
      failGeneration(workflow._id, 3, err.message || 'Failed to generate PLOs');
      setError(err.message || 'Failed to generate PLOs');
    }
  };

  const handleApprove = async () => {
    setError(null);
    try {
      await approveStep3.mutateAsync(workflow._id);
      onComplete();
    } catch (err: any) {
      console.error('Failed to approve Step 3:', err);
      setError(err.message || 'Failed to approve Step 3');
    }
  };

  // Handle opening PLO edit modal
  const handleEditPlo = (plo: PLO, index: number) => {
    setEditingPlo(plo);
    setEditingPloIndex(index);
  };

  // Handle saving edited PLO
  const handleSavePlo = async (updatedPlo: PLO) => {
    setIsSavingEdit(true);
    setError(null);

    console.log('Saving PLO:', updatedPlo);

    try {
      const response = await api.put(
        `/api/v3/workflow/${workflow._id}/step3/plo/${updatedPlo.id}`,
        {
          statement: updatedPlo.statement,
          verb: updatedPlo.verb,
          bloomLevel: updatedPlo.bloomLevel,
          assessmentAlignment: updatedPlo.assessmentAlignment,
          jobTaskMapping: updatedPlo.jobTaskMapping,
        }
      );

      console.log('Save response:', response.data);

      // Close modal and refresh data
      setEditingPlo(null);
      setEditingPloIndex(-1);
      await onRefresh();
    } catch (err: any) {
      console.error('Failed to save PLO:', err);
      setError(err.response?.data?.error || err.message || 'Failed to save changes');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Handle canceling PLO edit
  const handleCancelPloEdit = () => {
    setEditingPlo(null);
    setEditingPloIndex(-1);
  };

  const hasStep3Data = workflow.step3 && workflow.step3.outcomes?.length > 0;
  const isApproved = !!workflow.step3?.approvedAt;

  // Calculate coverage stats
  const coverageReport = (workflow.step3 as any)?.coverageReport;
  const bloomDistribution =
    workflow.step3?.bloomDistribution || coverageReport?.bloomDistribution || {};

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {isCurrentlyGenerating && !hasStep3Data && (
        <div className="mb-6 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <div>
              <h3 className="text-lg font-semibold text-teal-800">Generating PLOs...</h3>
              <p className="text-sm text-teal-600">
                This may take 45 seconds. You can navigate away and come back.
              </p>
            </div>
          </div>
          <GenerationProgressBar
            workflowId={workflow._id}
            step={3}
            queueStatus={stepStatus?.status}
          />
        </div>
      )}

      {!hasStep3Data && !isCurrentlyGenerating ? (
        // Generation Form
        <div className="space-y-8">
          {/* About This Step */}
          <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-xl p-5">
            <h3 className="text-purple-400 font-semibold mb-3 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Step 3: Program Learning Outcomes (PLOs)
            </h3>
            <p className="text-sm text-teal-700 mb-3">
              Transform your KSC framework into{' '}
              <strong className="text-purple-300">4-8 precise, measurable</strong> Program Learning
              Outcomes using Bloom's taxonomy. Each PLO follows the structure:
            </p>
            <div className="bg-white rounded-lg p-3 text-center">
              <code className="text-cyan-400">
                [Bloom's Verb] + [Specific Task] + [Real-World Context]
              </code>
            </div>
          </div>

          {/* DECISION 1: Bloom's Taxonomy Levels */}
          <section className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-cyan-400 border-b border-teal-200 pb-2 mb-4">
                1. Bloom's Taxonomy Levels <span className="text-red-400">*</span>
              </h3>
              <p className="text-sm text-teal-600 mb-4">
                Select cognitive levels your program emphasizes. You must choose at least{' '}
                <span className="text-amber-400">1 lower level</span> (Remember/Understand/Apply)
                AND <span className="text-amber-400">1 higher level</span>{' '}
                (Analyze/Evaluate/Create).
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {BLOOM_LEVELS.map((level) => {
                const isLower = LOWER_LEVELS.includes(level);
                const isSelected = formData.bloomLevels.includes(level);
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => toggleBloomLevel(level)}
                    className={`p-4 rounded-lg border text-left transition-all ${
                      isSelected
                        ? BLOOM_COLORS[level]
                        : 'bg-teal-50 border-teal-200 text-teal-600 hover:border-teal-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium capitalize">{level}</p>
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${isLower ? 'bg-amber-500/20 text-amber-400' : 'bg-purple-500/20 text-purple-400'}`}
                      >
                        {isLower ? 'Lower' : 'Higher'}
                      </span>
                    </div>
                    <p className="text-xs opacity-70">{BLOOM_DESCRIPTIONS[level]}</p>
                    <p className="text-xs mt-2 text-teal-500">
                      {BLOOM_VERBS[level].slice(0, 4).join(', ')}...
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Validation indicator */}
            <div
              className={`flex items-center gap-2 text-sm ${bloomValid ? 'text-emerald-400' : 'text-amber-400'}`}
            >
              {bloomValid ? (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Valid selection: has both lower and higher levels
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  {!hasLowerLevel && 'Select at least 1 lower level. '}
                  {!hasHigherLevel && 'Select at least 1 higher level.'}
                </>
              )}
            </div>
          </section>

          {/* DECISION 2: Priority Competencies */}
          {essentialKSCs.length > 0 && (
            <section className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-cyan-400 border-b border-teal-200 pb-2 mb-4">
                  2. Priority Competencies
                </h3>
                <p className="text-sm text-teal-600 mb-4">
                  Select Essential competencies from Step 2 that PLOs must address. PLOs should
                  cover ≥70% of Essential competencies.
                </p>
              </div>

              <div className="grid gap-2 max-h-64 overflow-y-auto">
                {essentialKSCs.map((ksc) => (
                  <button
                    key={ksc.id}
                    type="button"
                    onClick={() => togglePriorityCompetency(ksc.id)}
                    className={`p-3 rounded-lg border text-left text-sm transition-all ${
                      formData.priorityCompetencies?.includes(ksc.id)
                        ? 'bg-cyan-500/20 border-cyan-500 text-teal-800'
                        : 'bg-teal-50 border-teal-200 text-teal-600 hover:border-teal-300'
                    }`}
                  >
                    <span className="text-xs text-teal-500 mr-2">{ksc.id}</span>
                    {ksc.statement}
                  </button>
                ))}
              </div>
              <p className="text-xs text-teal-500">
                {formData.priorityCompetencies?.length || 0} of {essentialKSCs.length} selected
              </p>
            </section>
          )}

          {/* DECISION 3: Outcome Emphasis */}
          <section className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-cyan-400 border-b border-teal-200 pb-2 mb-4">
                3. Outcome Emphasis <span className="text-red-400">*</span>
              </h3>
              <p className="text-sm text-teal-600 mb-4">
                Choose the primary focus for your learning outcomes.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {EMPHASIS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, outcomeEmphasis: option.value }))
                  }
                  className={`p-4 rounded-lg border text-left transition-all ${
                    formData.outcomeEmphasis === option.value
                      ? 'bg-cyan-500/20 border-cyan-500 text-teal-800'
                      : 'bg-teal-50 border-teal-200 text-teal-600 hover:border-teal-300'
                  }`}
                >
                  <p className="font-medium">{option.label}</p>
                  <p className="text-xs mt-1 opacity-70">{option.description}</p>
                </button>
              ))}
            </div>
          </section>

          {/* DECISION 4: Number of Outcomes */}
          <section className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-cyan-400 border-b border-teal-200 pb-2 mb-4">
                4. Number of PLOs <span className="text-red-400">*</span>
              </h3>
            </div>

            <div className="bg-white rounded-lg p-5 border border-teal-200">
              <div className="flex items-center gap-6">
                <input
                  type="range"
                  min={4}
                  max={8}
                  value={formData.targetCount}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, targetCount: parseInt(e.target.value) }))
                  }
                  className="flex-1 accent-cyan-500 h-2"
                />
                <span className="text-4xl font-bold text-cyan-400 w-16 text-center">
                  {formData.targetCount}
                </span>
              </div>
              <div className="flex justify-between text-xs text-teal-500 mt-2">
                <span>4 (minimum)</span>
                <span>6 (recommended)</span>
                <span>8 (maximum)</span>
              </div>
            </div>
          </section>

          {/* Optional Advanced Controls */}
          <section className="space-y-4">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-sm text-teal-600 hover:text-teal-600 transition-colors"
            >
              <svg
                className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
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
              Advanced Controls (Optional)
            </button>

            {showAdvanced && (
              <div className="space-y-4 pl-6 border-l-2 border-teal-200">
                {/* Context Constraints */}
                <div>
                  <label className="block text-sm font-medium text-teal-700 mb-2">
                    Context Constraints
                  </label>
                  <textarea
                    value={formData.contextConstraints}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, contextConstraints: e.target.value }))
                    }
                    placeholder="Industry context, specific tools, limitations..."
                    rows={2}
                    className="w-full px-4 py-2 bg-white border border-teal-200 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-teal-500 resize-none text-sm"
                  />
                </div>

                {/* Stakeholder Priorities */}
                <div>
                  <label className="block text-sm font-medium text-teal-700 mb-2">
                    Stakeholder Priorities
                  </label>
                  <textarea
                    value={formData.stakeholderPriorities}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, stakeholderPriorities: e.target.value }))
                    }
                    placeholder="Employer/client expectations..."
                    rows={2}
                    className="w-full px-4 py-2 bg-white border border-teal-200 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-teal-500 resize-none text-sm"
                  />
                </div>

                {/* Verbs to Prefer */}
                <div>
                  <label className="block text-sm font-medium text-teal-700 mb-2">
                    Verbs to Prefer (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={formData.preferredVerbs?.join(', ') || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        preferredVerbs: e.target.value
                          .split(',')
                          .map((v) => v.trim())
                          .filter(Boolean),
                      }))
                    }
                    placeholder="e.g., analyze, evaluate, design"
                    className="w-full px-4 py-2 bg-white border border-teal-200 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-teal-500 text-sm"
                  />
                </div>

                {/* Verbs to Avoid */}
                <div>
                  <label className="block text-sm font-medium text-teal-700 mb-2">
                    Verbs to Avoid (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={formData.avoidVerbs?.join(', ') || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        avoidVerbs: e.target.value
                          .split(',')
                          .map((v) => v.trim())
                          .filter(Boolean),
                      }))
                    }
                    placeholder="e.g., know, understand, learn"
                    className="w-full px-4 py-2 bg-white border border-teal-200 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-teal-500 text-sm"
                  />
                </div>
              </div>
            )}
          </section>

          {/* Error Display */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-400">{error}</p>
            </div>
          )}

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={submitStep3.isPending || !bloomValid}
            className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-400 hover:to-pink-500 text-teal-800 font-medium rounded-lg transition-all disabled:opacity-50"
          >
            {submitStep3.isPending ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generating PLOs...
              </span>
            ) : (
              `Generate ${formData.targetCount} Program Learning Outcomes`
            )}
          </button>
        </div>
      ) : (
        // Display Generated PLOs
        <div className="space-y-6">
          {/* Coverage Report */}
          <div className="bg-white border border-teal-200 rounded-xl p-5 border border-teal-200">
            <h4 className="text-lg font-semibold text-teal-800 mb-4">Coverage Report</h4>

            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-purple-400">
                  {workflow.step3?.outcomes?.length || 0}
                </p>
                <p className="text-xs text-teal-500">Total PLOs</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-cyan-400">
                  {coverageReport?.coveragePercent || 0}%
                </p>
                <p className="text-xs text-teal-500">KSC Coverage</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-emerald-400">
                  {coverageReport?.competenciesCovered ||
                    workflow.step3?.outcomes?.reduce(
                      (sum: number, plo: PLO) => sum + (plo.linkedKSCs?.length || 0),
                      0
                    ) ||
                    0}
                </p>
                <p className="text-xs text-teal-500">Competencies Linked</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-amber-400">
                  {Object.values(bloomDistribution).filter((v) => (v as number) > 0).length}
                </p>
                <p className="text-xs text-teal-500">Bloom Levels</p>
              </div>
            </div>

            {/* Bloom Distribution */}
            <div>
              <p className="text-sm text-teal-600 mb-3">Bloom's Taxonomy Distribution</p>
              <div className="flex gap-2">
                {BLOOM_LEVELS.map((level) => {
                  const count = (bloomDistribution[level] as number) || 0;
                  const percent = workflow.step3?.outcomes?.length
                    ? Math.round((count / workflow.step3.outcomes.length) * 100)
                    : 0;
                  return (
                    <div key={level} className="flex-1">
                      <div
                        className={`h-8 rounded-lg flex items-center justify-center text-xs font-medium ${
                          count > 0 ? BLOOM_COLORS[level] : 'bg-white text-teal-300'
                        }`}
                      >
                        {count > 0 && `${count} (${percent}%)`}
                      </div>
                      <p className="text-xs text-teal-500 text-center mt-1 capitalize">{level}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Validation Checks */}
            {coverageReport?.validation && (
              <div className="mt-4 pt-4 border-t border-teal-200">
                <p className="text-sm text-teal-600 mb-2">Validation</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <span
                    className={
                      coverageReport.validation.hasLowerLevel ? 'text-emerald-400' : 'text-red-400'
                    }
                  >
                    {coverageReport.validation.hasLowerLevel ? '✓' : '✗'} Has lower level
                  </span>
                  <span
                    className={
                      coverageReport.validation.hasHigherLevel ? 'text-emerald-400' : 'text-red-400'
                    }
                  >
                    {coverageReport.validation.hasHigherLevel ? '✓' : '✗'} Has higher level
                  </span>
                  <span
                    className={
                      coverageReport.validation.noSingleLevelOver50
                        ? 'text-emerald-400'
                        : 'text-amber-400'
                    }
                  >
                    {coverageReport.validation.noSingleLevelOver50 ? '✓' : '⚠'} No level &gt;50%
                  </span>
                  <span
                    className={
                      coverageReport.validation.allUnique ? 'text-emerald-400' : 'text-red-400'
                    }
                  >
                    {coverageReport.validation.allUnique ? '✓' : '✗'} All unique
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* PLO List */}
          <div>
            <h3 className="text-lg font-semibold text-teal-800 mb-4">
              Program Learning Outcomes ({workflow.step3?.outcomes?.length || 0})
            </h3>
            <div className="space-y-4">
              {workflow.step3?.outcomes?.map((plo, index) => (
                <PLOCard
                  key={plo.id}
                  plo={plo}
                  index={index}
                  onEdit={onOpenCanvas}
                  onInlineEdit={handleEditPlo}
                />
              ))}
            </div>
          </div>

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
              disabled={submitStep3.isPending}
              className="px-4 py-2 text-teal-600 hover:text-teal-600 transition-colors"
            >
              Regenerate
            </button>
            <div className="flex gap-3">
              {!isApproved && (
                <button
                  onClick={handleApprove}
                  disabled={approveStep3.isPending || (workflow.step3?.outcomes?.length || 0) < 4}
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-teal-800 font-medium rounded-lg transition-all disabled:opacity-50"
                >
                  {approveStep3.isPending ? 'Approving...' : 'Approve & Continue →'}
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

          {(workflow.step3?.outcomes?.length || 0) < 4 && !isApproved && (
            <p className="text-xs text-amber-400 text-center">
              Minimum 4 PLOs required to approve. Currently: {workflow.step3?.outcomes?.length || 0}
            </p>
          )}
        </div>
      )}

      {/* PLO Edit Modal */}
      {editingPlo && editingPloIndex >= 0 && (
        <PLOEditModal
          plo={editingPlo}
          index={editingPloIndex}
          onSave={handleSavePlo}
          onCancel={handleCancelPloEdit}
          isSaving={isSavingEdit}
        />
      )}
    </div>
  );
}
