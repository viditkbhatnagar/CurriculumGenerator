'use client';

import { useState, useEffect } from 'react';
import { useSubmitStep3, useApproveStep3 } from '@/hooks/useWorkflow';
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

// PLO Card Component
function PLOCard({
  plo,
  index,
  onEdit,
}: {
  plo: PLO;
  index: number;
  onEdit?: (target: EditTarget) => void;
}) {
  const wordCount = plo.statement?.split(/\s+/).length || 0;

  return (
    <div className="bg-slate-900/50 rounded-xl p-5 border border-slate-700 hover:border-slate-600 transition-colors group">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-mono text-slate-500 bg-slate-800 px-2 py-1 rounded">
            PLO{index + 1}
          </span>
          <span
            className={`text-xs px-3 py-1 rounded-full border capitalize font-medium ${
              BLOOM_COLORS[plo.bloomLevel] || 'bg-slate-700 text-slate-400'
            }`}
          >
            {plo.bloomLevel}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">{wordCount}/25 words</span>
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
      <p className="text-white text-lg leading-relaxed mb-4">{plo.statement}</p>

      {/* Details Grid */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        {/* Verb */}
        <div className="bg-slate-800/50 rounded-lg p-3">
          <p className="text-xs text-slate-500 mb-1">Bloom's Verb</p>
          <p className="text-cyan-400 font-medium capitalize">{plo.verb}</p>
        </div>

        {/* Competency Links */}
        <div className="bg-slate-800/50 rounded-lg p-3">
          <p className="text-xs text-slate-500 mb-1">Competency Links</p>
          <p className="text-white">
            {plo.linkedKSCs?.length || 0} KSC{(plo.linkedKSCs?.length || 0) !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Assessment Alignment */}
        {plo.assessmentAlignment && (
          <div className="bg-slate-800/50 rounded-lg p-3 col-span-2">
            <p className="text-xs text-slate-500 mb-1">Assessment Alignment</p>
            <p className="text-slate-300">{plo.assessmentAlignment}</p>
          </div>
        )}

        {/* Job Task Mapping */}
        {plo.jobTaskMapping && plo.jobTaskMapping.length > 0 && (
          <div className="bg-slate-800/50 rounded-lg p-3 col-span-2">
            <p className="text-xs text-slate-500 mb-1">Job Tasks Addressed</p>
            <p className="text-slate-300">{plo.jobTaskMapping.join(', ')}</p>
          </div>
        )}
      </div>

      {/* Validation Badges */}
      <div className="flex items-center gap-3 mt-4 pt-3 border-t border-slate-700">
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
    </div>
  );
}

export default function Step3Form({ workflow, onComplete, onRefresh, onOpenCanvas }: Props) {
  const submitStep3 = useSubmitStep3();
  const approveStep3 = useApproveStep3();

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
      await submitStep3.mutateAsync({
        id: workflow._id,
        data: formData,
      });
      onRefresh();
    } catch (err: any) {
      console.error('Failed to generate PLOs:', err);
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

  const hasStep3Data = workflow.step3 && workflow.step3.outcomes?.length > 0;
  const isApproved = !!workflow.step3?.approvedAt;

  // Calculate coverage stats
  const coverageReport = (workflow.step3 as any)?.coverageReport;
  const bloomDistribution =
    workflow.step3?.bloomDistribution || coverageReport?.bloomDistribution || {};

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {!hasStep3Data ? (
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
            <p className="text-sm text-slate-300 mb-3">
              Transform your KSC framework into{' '}
              <strong className="text-purple-300">4-8 precise, measurable</strong> Program Learning
              Outcomes using Bloom's taxonomy. Each PLO follows the structure:
            </p>
            <div className="bg-slate-900/50 rounded-lg p-3 text-center">
              <code className="text-cyan-400">
                [Bloom's Verb] + [Specific Task] + [Real-World Context]
              </code>
            </div>
          </div>

          {/* DECISION 1: Bloom's Taxonomy Levels */}
          <section className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-cyan-400 border-b border-slate-700 pb-2 mb-4">
                1. Bloom's Taxonomy Levels <span className="text-red-400">*</span>
              </h3>
              <p className="text-sm text-slate-400 mb-4">
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
                        : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
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
                    <p className="text-xs mt-2 text-slate-500">
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
                <h3 className="text-lg font-semibold text-cyan-400 border-b border-slate-700 pb-2 mb-4">
                  2. Priority Competencies
                </h3>
                <p className="text-sm text-slate-400 mb-4">
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
                        ? 'bg-cyan-500/20 border-cyan-500 text-white'
                        : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <span className="text-xs text-slate-500 mr-2">{ksc.id}</span>
                    {ksc.statement}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500">
                {formData.priorityCompetencies?.length || 0} of {essentialKSCs.length} selected
              </p>
            </section>
          )}

          {/* DECISION 3: Outcome Emphasis */}
          <section className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-cyan-400 border-b border-slate-700 pb-2 mb-4">
                3. Outcome Emphasis <span className="text-red-400">*</span>
              </h3>
              <p className="text-sm text-slate-400 mb-4">
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
                      ? 'bg-cyan-500/20 border-cyan-500 text-white'
                      : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
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
              <h3 className="text-lg font-semibold text-cyan-400 border-b border-slate-700 pb-2 mb-4">
                4. Number of PLOs <span className="text-red-400">*</span>
              </h3>
            </div>

            <div className="bg-slate-900/50 rounded-lg p-5 border border-slate-700">
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
              <div className="flex justify-between text-xs text-slate-500 mt-2">
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
              className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
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
              <div className="space-y-4 pl-6 border-l-2 border-slate-700">
                {/* Context Constraints */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Context Constraints
                  </label>
                  <textarea
                    value={formData.contextConstraints}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, contextConstraints: e.target.value }))
                    }
                    placeholder="Industry context, specific tools, limitations..."
                    rows={2}
                    className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none text-sm"
                  />
                </div>

                {/* Stakeholder Priorities */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Stakeholder Priorities
                  </label>
                  <textarea
                    value={formData.stakeholderPriorities}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, stakeholderPriorities: e.target.value }))
                    }
                    placeholder="Employer/client expectations..."
                    rows={2}
                    className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none text-sm"
                  />
                </div>

                {/* Verbs to Prefer */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
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
                    className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 text-sm"
                  />
                </div>

                {/* Verbs to Avoid */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
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
                    className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 text-sm"
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
            className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-400 hover:to-pink-500 text-white font-medium rounded-lg transition-all disabled:opacity-50"
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
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-5 border border-slate-700">
            <h4 className="text-lg font-semibold text-white mb-4">Coverage Report</h4>

            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-purple-400">
                  {workflow.step3?.outcomes?.length || 0}
                </p>
                <p className="text-xs text-slate-500">Total PLOs</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-cyan-400">
                  {coverageReport?.coveragePercent || 0}%
                </p>
                <p className="text-xs text-slate-500">KSC Coverage</p>
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
                <p className="text-xs text-slate-500">Competencies Linked</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-amber-400">
                  {Object.values(bloomDistribution).filter((v) => (v as number) > 0).length}
                </p>
                <p className="text-xs text-slate-500">Bloom Levels</p>
              </div>
            </div>

            {/* Bloom Distribution */}
            <div>
              <p className="text-sm text-slate-400 mb-3">Bloom's Taxonomy Distribution</p>
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
                          count > 0 ? BLOOM_COLORS[level] : 'bg-slate-800 text-slate-600'
                        }`}
                      >
                        {count > 0 && `${count} (${percent}%)`}
                      </div>
                      <p className="text-xs text-slate-500 text-center mt-1 capitalize">{level}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Validation Checks */}
            {coverageReport?.validation && (
              <div className="mt-4 pt-4 border-t border-slate-700">
                <p className="text-sm text-slate-400 mb-2">Validation</p>
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
            <h3 className="text-lg font-semibold text-white mb-4">
              Program Learning Outcomes ({workflow.step3?.outcomes?.length || 0})
            </h3>
            <div className="space-y-4">
              {workflow.step3?.outcomes?.map((plo, index) => (
                <PLOCard key={plo.id} plo={plo} index={index} onEdit={onOpenCanvas} />
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
          <div className="flex items-center justify-between pt-6 border-t border-slate-700">
            <button
              onClick={handleGenerate}
              disabled={submitStep3.isPending}
              className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
            >
              Regenerate
            </button>
            <div className="flex gap-3">
              {!isApproved && (
                <button
                  onClick={handleApprove}
                  disabled={approveStep3.isPending || (workflow.step3?.outcomes?.length || 0) < 4}
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-medium rounded-lg transition-all disabled:opacity-50"
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
    </div>
  );
}
