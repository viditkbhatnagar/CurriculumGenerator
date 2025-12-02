'use client';

import { useState, useEffect } from 'react';
import { useSubmitStep8, useApproveStep8 } from '@/hooks/useWorkflow';
import {
  CurriculumWorkflow,
  CaseStudy,
  CaseProposal,
  CaseType,
  CaseDifficulty,
} from '@/types/workflow';
import { useGeneration, GenerationProgressBar } from '@/contexts/GenerationContext';

interface Props {
  workflow: CurriculumWorkflow;
  onComplete: () => void;
  onRefresh: () => void;
}

// Case type colors and labels
const CASE_TYPE_COLORS: Record<CaseType, string> = {
  practice: 'bg-green-500/20 text-green-400 border-green-500/30',
  discussion: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  assessment_ready: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

const CASE_TYPE_LABELS: Record<CaseType, string> = {
  practice: 'Practice',
  discussion: 'Discussion',
  assessment_ready: 'Assessment-Ready',
};

const _CASE_TYPE_DESCRIPTIONS: Record<CaseType, string> = {
  practice: 'Ungraded learning activity - build confidence, allow trial and error',
  discussion: 'Forum prompt - graded on participation, encourage perspective-sharing',
  assessment_ready: 'Structured scenario with hooks for future question development',
};

// Difficulty colors
const DIFFICULTY_COLORS: Record<CaseDifficulty, string> = {
  entry: 'bg-green-500/20 text-green-400',
  intermediate: 'bg-amber-500/20 text-amber-400',
  advanced: 'bg-red-500/20 text-red-400',
};

// Case Proposal Card (Stage 1) - kept for future two-stage implementation
function _ProposalCard({
  proposal,
  isSelected,
  onToggle,
}: {
  proposal: CaseProposal;
  isSelected: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      onClick={onToggle}
      className={`rounded-lg p-4 border cursor-pointer transition-all ${
        isSelected
          ? 'bg-cyan-500/10 border-cyan-500'
          : 'bg-slate-900/30 border-slate-700 hover:border-slate-600'
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <h4 className="text-white font-medium">{proposal.title}</h4>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded ${CASE_TYPE_COLORS[proposal.caseType]}`}>
            {CASE_TYPE_LABELS[proposal.caseType]}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded ${DIFFICULTY_COLORS[proposal.difficulty]}`}>
            {proposal.difficulty}
          </span>
        </div>
      </div>
      <p className="text-sm text-slate-300 mb-2">{proposal.abstract}</p>
      <p className="text-xs text-slate-500">{proposal.mappingSummary}</p>
      {isSelected && (
        <div className="mt-2 pt-2 border-t border-cyan-500/30">
          <span className="text-xs text-cyan-400">✓ Selected for development</span>
        </div>
      )}
    </div>
  );
}

// Full Case Study Card (Stage 2)
function CaseStudyCard({ caseStudy }: { caseStudy: CaseStudy }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-slate-900/50 rounded-lg border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h4 className="text-white font-medium">{caseStudy.title}</h4>
            <p className="text-sm text-slate-400">{caseStudy.moduleTitle || caseStudy.moduleId}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span
              className={`text-xs px-2 py-1 rounded border ${CASE_TYPE_COLORS[caseStudy.caseType]}`}
            >
              {CASE_TYPE_LABELS[caseStudy.caseType]}
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded ${DIFFICULTY_COLORS[caseStudy.difficulty]}`}
            >
              {caseStudy.difficulty}
            </span>
          </div>
        </div>

        {/* Organizational Context */}
        <div className="bg-slate-800/50 rounded-lg p-3 mb-3">
          <p className="text-xs text-slate-500 mb-1">Organizational Context</p>
          <p className="text-sm text-slate-300">{caseStudy.organizationalContext}</p>
        </div>

        {/* Challenge */}
        <div className="mb-3">
          <p className="text-xs text-slate-500 mb-1">Challenge</p>
          <p className="text-sm text-white">{caseStudy.challengeDescription}</p>
        </div>

        {/* Word count indicator */}
        <div className="flex items-center gap-4 text-xs">
          <span
            className={`${caseStudy.wordCount >= 400 && caseStudy.wordCount <= 800 ? 'text-emerald-400' : 'text-amber-400'}`}
          >
            {caseStudy.wordCount} words
          </span>
          <span className="text-slate-500">{caseStudy.industryContext}</span>
          {caseStudy.hasDataAssets && <span className="text-cyan-400">📊 Data Assets</span>}
          {caseStudy.hasHooks && <span className="text-purple-400">🎯 Assessment Hooks</span>}
        </div>
      </div>

      {/* Expand Button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2 flex items-center justify-between text-xs text-slate-400 hover:bg-slate-800/30 transition-colors border-t border-slate-700/50"
      >
        <span>
          MLOs: {caseStudy.linkedMLOs?.join(', ')} |
          {caseStudy.suggestedTiming && ` ${caseStudy.suggestedTiming}`}
        </span>
        <svg
          className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-slate-700/50">
          {/* Full Scenario */}
          <div className="pt-3">
            <p className="text-xs text-slate-500 mb-2">Full Scenario</p>
            <p className="text-sm text-slate-300 whitespace-pre-line">{caseStudy.scenario}</p>
          </div>

          {/* Background */}
          {caseStudy.backgroundInformation && (
            <div>
              <p className="text-xs text-slate-500 mb-1">Background Information</p>
              <p className="text-sm text-slate-400">{caseStudy.backgroundInformation}</p>
            </div>
          )}

          {/* Data Assets */}
          {caseStudy.dataAssets && caseStudy.dataAssets.length > 0 && (
            <div>
              <p className="text-xs text-cyan-400 mb-2">📊 Data Assets</p>
              {caseStudy.dataAssets.map((asset, i) => (
                <div key={i} className="bg-slate-800/50 rounded p-2 mb-2">
                  <p className="text-sm text-white font-medium">{asset.name}</p>
                  <p className="text-xs text-slate-400 mb-2">{asset.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {asset.columns.map((col) => (
                      <span key={col.name} className="text-xs px-2 py-0.5 bg-slate-700 rounded">
                        {col.name}: {col.type}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Assessment Hooks (Assessment-Ready cases) */}
          {caseStudy.assessmentHooks && (
            <div className="bg-purple-500/10 rounded-lg p-3 border border-purple-500/20">
              <p className="text-xs text-purple-400 font-medium mb-3">🎯 Assessment Hooks</p>

              {/* Key Facts */}
              {caseStudy.assessmentHooks.keyFacts?.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-slate-400 mb-1">
                    Key Facts ({caseStudy.assessmentHooks.keyFacts.length}/10-15)
                  </p>
                  <ul className="text-xs text-slate-300 space-y-1">
                    {caseStudy.assessmentHooks.keyFacts.slice(0, 5).map((fact, i) => (
                      <li key={i}>• {fact}</li>
                    ))}
                    {caseStudy.assessmentHooks.keyFacts.length > 5 && (
                      <li className="text-slate-500">
                        +{caseStudy.assessmentHooks.keyFacts.length - 5} more...
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {/* Misconceptions */}
              {caseStudy.assessmentHooks.misconceptions?.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-slate-400 mb-1">
                    Common Misconceptions ({caseStudy.assessmentHooks.misconceptions.length}/5-8)
                  </p>
                  <ul className="text-xs text-amber-400/80 space-y-1">
                    {caseStudy.assessmentHooks.misconceptions.slice(0, 3).map((m, i) => (
                      <li key={i}>⚠ {m}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Decision Points */}
              {caseStudy.assessmentHooks.decisionPoints?.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-slate-400 mb-1">
                    Decision Points ({caseStudy.assessmentHooks.decisionPoints.length}/3-5)
                  </p>
                  <ul className="text-xs text-cyan-400/80 space-y-1">
                    {caseStudy.assessmentHooks.decisionPoints.map((dp, i) => (
                      <li key={i}>→ {dp}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Terminology */}
              {caseStudy.assessmentHooks.terminology?.length > 0 && (
                <div>
                  <p className="text-xs text-slate-400 mb-1">Terminology</p>
                  <div className="flex flex-wrap gap-1">
                    {caseStudy.assessmentHooks.terminology.map((t, i) => (
                      <span
                        key={i}
                        className="text-xs px-2 py-0.5 bg-slate-700 rounded"
                        title={t.definition}
                      >
                        {t.term}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Practice Case: Suggested Approach */}
          {caseStudy.caseType === 'practice' && caseStudy.suggestedApproach && (
            <div className="bg-green-500/10 rounded-lg p-3 border border-green-500/20">
              <p className="text-xs text-green-400 font-medium mb-1">Suggested Approach</p>
              <p className="text-sm text-slate-300">{caseStudy.suggestedApproach}</p>
            </div>
          )}

          {/* Discussion Case: Prompts */}
          {caseStudy.caseType === 'discussion' && caseStudy.discussionPrompts && (
            <div className="bg-blue-500/10 rounded-lg p-3 border border-blue-500/20">
              <p className="text-xs text-blue-400 font-medium mb-1">Discussion Prompts</p>
              <ul className="text-sm text-slate-300 space-y-1">
                {caseStudy.discussionPrompts.map((prompt, i) => (
                  <li key={i}>• {prompt}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Learning Application */}
          {caseStudy.learningApplication && (
            <div>
              <p className="text-xs text-slate-500 mb-1">Learning Application</p>
              <p className="text-sm text-slate-400">{caseStudy.learningApplication}</p>
            </div>
          )}

          {/* Usage Guidance */}
          <div className="pt-2 border-t border-slate-700/50 flex gap-4 text-xs text-slate-500">
            {caseStudy.estimatedDuration && <span>⏱ {caseStudy.estimatedDuration}</span>}
            <span className={caseStudy.ethicsCompliant ? 'text-emerald-400' : 'text-red-400'}>
              {caseStudy.ethicsCompliant ? '✓ Ethics Compliant' : '⚠ Ethics Review Needed'}
            </span>
            {caseStudy.noPII && <span className="text-emerald-400">✓ No PII</span>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Step8View({ workflow, onComplete, onRefresh }: Props) {
  const submitStep8 = useSubmitStep8();
  const approveStep8 = useApproveStep8();
  const [error, setError] = useState<string | null>(null);
  const [_selectedProposals, _setSelectedProposals] = useState<string[]>([]);
  const [filterType, setFilterType] = useState<CaseType | 'all'>('all');
  const { startGeneration, completeGeneration, failGeneration, isGenerating } = useGeneration();

  const isCurrentlyGenerating = isGenerating(workflow._id, 8) || submitStep8.isPending;

  // Check for completion when data appears
  useEffect(() => {
    if (
      (workflow.step8?.caseStudies?.length ?? 0) > 0 ||
      (workflow.step8?.proposals?.length ?? 0) > 0
    ) {
      completeGeneration(workflow._id, 8);
    }
  }, [workflow.step8, workflow._id, completeGeneration]);

  const handleGenerateProposals = async () => {
    setError(null);
    startGeneration(workflow._id, 8, 180); // 3 minutes estimated for case studies
    try {
      await submitStep8.mutateAsync(workflow._id);
      completeGeneration(workflow._id, 8);
      onRefresh();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate case studies';
      console.error('Failed to generate case studies:', err);
      failGeneration(workflow._id, 8, errorMessage);
      setError(errorMessage);
    }
  };

  const handleApprove = async () => {
    setError(null);
    try {
      await approveStep8.mutateAsync(workflow._id);
      onComplete();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to approve Step 8';
      console.error('Failed to approve Step 8:', err);
      setError(errorMessage);
    }
  };

  const hasStep8Data =
    workflow.step8 &&
    (workflow.step8.caseStudies?.length > 0 || workflow.step8.proposals?.length > 0);
  const isApproved = !!workflow.step8?.approvedAt;
  const validation = workflow.step8?.validationReport;

  // Filter cases by type
  const displayedCases =
    filterType === 'all'
      ? workflow.step8?.caseStudies || []
      : workflow.step8?.casesByType?.[filterType] || [];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Show generating state even when navigating back */}
      {isCurrentlyGenerating && !hasStep8Data && (
        <div className="mb-6 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 border-3 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <div>
              <h3 className="text-lg font-semibold text-white">Generating Case Studies...</h3>
              <p className="text-sm text-slate-400">
                This may take 2-3 minutes. You can navigate away and come back.
              </p>
            </div>
          </div>
          <GenerationProgressBar workflowId={workflow._id} step={8} />
        </div>
      )}

      {!hasStep8Data && !isCurrentlyGenerating ? (
        // Pre-Generation View
        <div className="space-y-6">
          {/* About This Step */}
          <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-xl p-5">
            <h3 className="text-purple-400 font-semibold mb-3 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
              Step 8: Case Studies (Practice, Discussion, or Assessment-Ready)
            </h3>
            <p className="text-sm text-slate-300 mb-4">
              Generate realistic, industry-relevant scenarios with optional data assets and
              <strong className="text-purple-400"> assessment hooks</strong>.
              <strong className="text-amber-400">
                {' '}
                This step does NOT generate assessment questions
              </strong>{' '}
              - only hooks for future question development.
            </p>

            {/* Three Case Types */}
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div className="bg-green-500/10 rounded-lg p-3 border border-green-500/20">
                <p className="text-green-400 font-medium mb-2">📚 Practice Cases</p>
                <ul className="text-xs text-slate-400 space-y-1">
                  <li>• Ungraded learning activities</li>
                  <li>• Build confidence</li>
                  <li>• Include suggested approaches</li>
                </ul>
              </div>
              <div className="bg-blue-500/10 rounded-lg p-3 border border-blue-500/20">
                <p className="text-blue-400 font-medium mb-2">💬 Discussion Cases</p>
                <ul className="text-xs text-slate-400 space-y-1">
                  <li>• Forum prompts</li>
                  <li>• Graded on participation</li>
                  <li>• Encourage perspective-sharing</li>
                </ul>
              </div>
              <div className="bg-purple-500/10 rounded-lg p-3 border border-purple-500/20">
                <p className="text-purple-400 font-medium mb-2">🎯 Assessment-Ready</p>
                <ul className="text-xs text-slate-400 space-y-1">
                  <li>• Structured scenarios with hooks</li>
                  <li>• Key facts, misconceptions</li>
                  <li>• Decision points, terminology</li>
                </ul>
              </div>
            </div>

            {/* Two-Stage Process */}
            <div className="mt-4 bg-slate-900/50 rounded-lg p-3">
              <p className="text-slate-400 font-medium mb-2">Two-Stage Process</p>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                    1
                  </span>
                  <span className="text-slate-300">Generate Proposals (1-3 per module)</span>
                </div>
                <span className="text-slate-600">→</span>
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                    2
                  </span>
                  <span className="text-slate-300">Develop Selected Cases (400-800 words)</span>
                </div>
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
            onClick={handleGenerateProposals}
            disabled={isCurrentlyGenerating}
            className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-400 hover:to-pink-500 text-white font-medium rounded-lg transition-all disabled:opacity-50"
          >
            {isCurrentlyGenerating ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generating Case Studies...
              </span>
            ) : (
              'Generate Case Studies'
            )}
          </button>
        </div>
      ) : (
        // Display Generated Content
        <div className="space-y-6">
          {/* Overall Stats */}
          <div className="grid grid-cols-5 gap-4">
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700 text-center">
              <p className="text-3xl font-bold text-white">{workflow.step8?.totalCases || 0}</p>
              <p className="text-xs text-slate-500 mt-1">Total Cases</p>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700 text-center">
              <p className="text-3xl font-bold text-green-400">
                {workflow.step8?.practiceCount || 0}
              </p>
              <p className="text-xs text-slate-500 mt-1">Practice</p>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700 text-center">
              <p className="text-3xl font-bold text-blue-400">
                {workflow.step8?.discussionCount || 0}
              </p>
              <p className="text-xs text-slate-500 mt-1">Discussion</p>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700 text-center">
              <p className="text-3xl font-bold text-purple-400">
                {workflow.step8?.assessmentReadyCount || 0}
              </p>
              <p className="text-xs text-slate-500 mt-1">Assessment-Ready</p>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700 text-center">
              <p
                className={`text-3xl font-bold ${workflow.step8?.isValid ? 'text-emerald-400' : 'text-red-400'}`}
              >
                {workflow.step8?.isValid ? '✓' : '✗'}
              </p>
              <p className="text-xs text-slate-500 mt-1">Valid</p>
            </div>
          </div>

          {/* Validation Report */}
          {validation && (
            <div
              className={`rounded-lg p-4 border ${workflow.step8?.isValid ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}
            >
              <h4
                className={`font-medium mb-3 ${workflow.step8?.isValid ? 'text-emerald-400' : 'text-amber-400'}`}
              >
                Validation Report
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                <span
                  className={validation.allMappedToModule ? 'text-emerald-400' : 'text-red-400'}
                >
                  {validation.allMappedToModule ? '✓' : '✗'} Mapped to Module
                </span>
                <span className={validation.allMappedToMLO ? 'text-emerald-400' : 'text-red-400'}>
                  {validation.allMappedToMLO ? '✓' : '✗'} Mapped to MLO
                </span>
                <span className={validation.wordCountValid ? 'text-emerald-400' : 'text-red-400'}>
                  {validation.wordCountValid ? '✓' : '✗'} Word Count (400-800)
                </span>
                <span className={validation.ethicsCompliant ? 'text-emerald-400' : 'text-red-400'}>
                  {validation.ethicsCompliant ? '✓' : '✗'} Ethics Compliant
                </span>
                <span className={validation.hooksComplete ? 'text-emerald-400' : 'text-red-400'}>
                  {validation.hooksComplete ? '✓' : '✗'} Hooks Complete
                </span>
                <span
                  className={validation.noAssessmentQuestions ? 'text-emerald-400' : 'text-red-400'}
                >
                  {validation.noAssessmentQuestions ? '✓' : '✗'} No Assessment Qs
                </span>
              </div>

              {/* Validation Issues */}
              {workflow.step8?.validationIssues && workflow.step8.validationIssues.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-700/50">
                  <p className="text-amber-400 text-sm font-medium mb-1">Issues:</p>
                  <ul className="text-xs text-slate-400 space-y-1">
                    {workflow.step8.validationIssues.map((issue, i) => (
                      <li key={i}>• {issue}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Type Filter */}
          <div className="flex gap-2 flex-wrap">
            {(['all', 'practice', 'discussion', 'assessment_ready'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  filterType === type
                    ? type === 'all'
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500'
                      : `${CASE_TYPE_COLORS[type]} border`
                    : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
                }`}
              >
                {type === 'all' ? 'All Cases' : CASE_TYPE_LABELS[type]}
              </button>
            ))}
          </div>

          {/* Case Studies */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">
              Case Studies ({displayedCases.length})
            </h3>
            <div className="space-y-4">
              {displayedCases.map((caseStudy) => (
                <CaseStudyCard key={caseStudy.id} caseStudy={caseStudy} />
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
              onClick={handleGenerateProposals}
              disabled={submitStep8.isPending}
              className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
            >
              Regenerate
            </button>
            <div className="flex gap-3">
              {!isApproved && (
                <button
                  onClick={handleApprove}
                  disabled={approveStep8.isPending || !workflow.step8?.isValid}
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-medium rounded-lg transition-all disabled:opacity-50"
                >
                  {approveStep8.isPending ? 'Approving...' : 'Approve & Continue →'}
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

          {!workflow.step8?.isValid && !isApproved && (
            <p className="text-xs text-amber-400 text-center">
              All validation checks must pass before approval.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
