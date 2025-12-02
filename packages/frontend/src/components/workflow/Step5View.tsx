'use client';

import { useState, useEffect } from 'react';
import { useSubmitStep5, useApproveStep5 } from '@/hooks/useWorkflow';
import {
  CurriculumWorkflow,
  Source,
  ModuleSourceSummary,
  SourceCategory,
  SourceType,
} from '@/types/workflow';
import { useGeneration, GenerationProgressBar } from '@/contexts/GenerationContext';

interface Props {
  workflow: CurriculumWorkflow;
  onComplete: () => void;
  onRefresh: () => void;
}

// Category colors and labels
const CATEGORY_LABELS: Record<SourceCategory, string> = {
  peer_reviewed_journal: 'Peer-Reviewed',
  academic_textbook: 'Academic Text',
  professional_body: 'Professional Body',
  open_access: 'Open Access',
  institutional: 'Institutional',
};

const CATEGORY_COLORS: Record<SourceCategory, string> = {
  peer_reviewed_journal: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  academic_textbook: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  professional_body: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  open_access: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  institutional: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
};

const TYPE_LABELS: Record<SourceType, string> = {
  academic: 'Academic',
  applied: 'Applied',
  industry: 'Industry',
};

// Source Card Component
function SourceCard({ source }: { source: Source }) {
  const [expanded, setExpanded] = useState(false);
  const currentYear = new Date().getFullYear();
  const isRecent = currentYear - source.year <= 5;

  return (
    <div className="bg-slate-900/50 rounded-lg border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1">
            <h4 className="text-white font-medium leading-tight">{source.title}</h4>
            <p className="text-sm text-slate-400 mt-1">
              {source.authors?.join(', ')} ({source.year})
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span
              className={`text-xs px-2 py-1 rounded-full border ${CATEGORY_COLORS[source.category] || 'bg-slate-700 text-slate-400'}`}
            >
              {CATEGORY_LABELS[source.category] || source.category}
            </span>
            <span
              className={`text-xs ${source.agiCompliant ? 'text-emerald-400' : 'text-red-400'}`}
            >
              {source.agiCompliant ? '✓ AGI Compliant' : '✗ Non-compliant'}
            </span>
          </div>
        </div>

        {/* Citation */}
        <p className="text-xs text-slate-500 font-mono bg-slate-800/50 p-2 rounded mt-2">
          {source.citation}
        </p>

        {/* Compliance Badges */}
        <div className="flex flex-wrap gap-2 mt-3">
          {source.complianceBadges?.peerReviewed && (
            <span className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded">
              ✓ Peer-Reviewed
            </span>
          )}
          {source.complianceBadges?.academicText && (
            <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded">
              ✓ Academic Text
            </span>
          )}
          {source.complianceBadges?.professionalBody && (
            <span className="text-xs px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded">
              ✓ Professional Body
            </span>
          )}
          {isRecent ? (
            <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded">
              ✓ Recent (&lt;5 years)
            </span>
          ) : source.isSeminal ? (
            <span className="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded">
              ⚠ Seminal (&gt;5 years)
            </span>
          ) : (
            <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded">
              ✗ Outdated
            </span>
          )}
          {source.complianceBadges?.verifiedAccess && (
            <span className="text-xs px-2 py-0.5 bg-cyan-500/20 text-cyan-400 rounded">
              ✓ Verified Access
            </span>
          )}
          {source.complianceBadges?.apaValidated && (
            <span className="text-xs px-2 py-0.5 bg-slate-500/20 text-slate-400 rounded">
              ✓ APA Validated
            </span>
          )}
        </div>
      </div>

      {/* Expand Button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2 flex items-center justify-between text-xs text-slate-400 hover:bg-slate-800/30 transition-colors border-t border-slate-700/50"
      >
        <span>
          {TYPE_LABELS[source.type]} | {source.complexityLevel} |
          {source.estimatedReadingHours ? ` ${source.estimatedReadingHours}h reading` : ''}
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

      {/* Expanded Details */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-700/50">
          {/* DOI/URL */}
          {(source.doi || source.url) && (
            <div className="text-xs">
              {source.doi && <p className="text-cyan-400">DOI: {source.doi}</p>}
              {source.url && (
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline"
                >
                  {source.url}
                </a>
              )}
            </div>
          )}

          {/* Seminal Justification */}
          {source.isSeminal && source.seminalJustification && (
            <div className="bg-amber-500/10 rounded-lg p-2 text-xs">
              <p className="text-amber-400 font-medium mb-1">Seminal Work Justification:</p>
              <p className="text-slate-400">{source.seminalJustification}</p>
              {source.pairedRecentSourceId && (
                <p className="text-slate-500 mt-1">
                  Paired with recent source: {source.pairedRecentSourceId}
                </p>
              )}
            </div>
          )}

          {/* MLO Links */}
          {source.linkedMLOs && source.linkedMLOs.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 mb-1">Supports MLOs:</p>
              <div className="flex flex-wrap gap-1">
                {source.linkedMLOs.map((mlo) => (
                  <span
                    key={mlo}
                    className="text-xs px-2 py-0.5 bg-slate-700 rounded text-slate-300"
                  >
                    {mlo}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Topics */}
          {source.relevantTopics && source.relevantTopics.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 mb-1">Relevant Topics:</p>
              <p className="text-xs text-slate-400">{source.relevantTopics.join(', ')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Module Summary Card
function ModuleSummaryCard({ summary }: { summary: ModuleSourceSummary }) {
  return (
    <div
      className={`bg-slate-900/30 rounded-lg p-4 border ${summary.agiCompliant ? 'border-emerald-500/30' : 'border-amber-500/30'}`}
    >
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-white font-medium">{summary.moduleTitle}</h4>
        <span
          className={`text-xs px-2 py-1 rounded ${summary.agiCompliant ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}
        >
          {summary.agiCompliant ? '✓ Compliant' : '⚠ Review'}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2 text-center text-xs">
        <div>
          <p className="text-lg font-bold text-white">{summary.totalSources}</p>
          <p className="text-slate-500">Sources</p>
        </div>
        <div>
          <p
            className={`text-lg font-bold ${summary.peerReviewedPercent >= 50 ? 'text-emerald-400' : 'text-amber-400'}`}
          >
            {summary.peerReviewedPercent}%
          </p>
          <p className="text-slate-500">Peer-Reviewed</p>
        </div>
        <div>
          <p className="text-lg font-bold text-cyan-400">{summary.recentCount}</p>
          <p className="text-slate-500">Recent</p>
        </div>
        <div>
          <p
            className={`text-lg font-bold ${summary.allMLOsSupported ? 'text-emerald-400' : 'text-red-400'}`}
          >
            {summary.allMLOsSupported ? '✓' : '✗'}
          </p>
          <p className="text-slate-500">MLOs</p>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-center justify-between text-xs">
        <span className="text-slate-500">
          Academic: {summary.academicCount} | Applied: {summary.appliedCount}
        </span>
        <span className="text-slate-500">
          {summary.totalReadingHours}h / {summary.allocatedIndependentHours}h
        </span>
      </div>
    </div>
  );
}

export default function Step5View({ workflow, onComplete, onRefresh }: Props) {
  const submitStep5 = useSubmitStep5();
  const approveStep5 = useApproveStep5();
  const [error, setError] = useState<string | null>(null);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const { startGeneration, completeGeneration, failGeneration, isGenerating } = useGeneration();

  const isCurrentlyGenerating = isGenerating(workflow._id, 5) || submitStep5.isPending;

  // Check for completion when data appears
  useEffect(() => {
    if ((workflow.step5?.sources?.length ?? 0) > 0 || (workflow.step5?.totalSources ?? 0) > 0) {
      completeGeneration(workflow._id, 5);
    }
  }, [workflow.step5, workflow._id, completeGeneration]);

  const handleGenerate = async () => {
    setError(null);
    startGeneration(workflow._id, 5, 120); // 2 minutes estimated
    try {
      await submitStep5.mutateAsync(workflow._id);
      completeGeneration(workflow._id, 5);
      onRefresh();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate sources';
      console.error('Failed to generate sources:', err);
      failGeneration(workflow._id, 5, errorMessage);
      setError(errorMessage);
    }
  };

  const handleApprove = async () => {
    setError(null);
    try {
      await approveStep5.mutateAsync(workflow._id);
      onComplete();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to approve Step 5';
      console.error('Failed to approve Step 5:', err);
      setError(errorMessage);
    }
  };

  const hasStep5Data =
    workflow.step5 && (workflow.step5.sources?.length > 0 || workflow.step5.totalSources > 0);
  const isApproved = !!workflow.step5?.approvedAt;
  const validation = workflow.step5?.validationReport;

  // Get sources for selected module or all
  const displayedSources =
    selectedModule && workflow.step5?.sourcesByModule
      ? workflow.step5.sourcesByModule[selectedModule] || []
      : workflow.step5?.sources || [];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Show generating state even when navigating back */}
      {isCurrentlyGenerating && !hasStep5Data && (
        <div className="mb-6 bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <div>
              <h3 className="text-lg font-semibold text-white">
                Generating Topic-Level Sources...
              </h3>
              <p className="text-sm text-slate-400">
                This may take 2 minutes. You can navigate away and come back.
              </p>
            </div>
          </div>
          <GenerationProgressBar workflowId={workflow._id} step={5} />
        </div>
      )}

      {!hasStep5Data && !isCurrentlyGenerating ? (
        // Generation Form
        <div className="space-y-6">
          {/* About This Step */}
          <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl p-5">
            <h3 className="text-amber-400 font-semibold mb-3 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
              Step 5: Topic-Level Sources (AGI Academic Standards)
            </h3>
            <p className="text-sm text-slate-300 mb-4">
              The AI will identify high-quality academic and professional sources for each module,
              validated against <strong className="text-amber-300">AGI Academic Standards</strong>{' '}
              with APA 7th edition citations.
            </p>

            {/* AGI Standards Summary */}
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="bg-slate-900/50 rounded-lg p-3">
                <p className="text-emerald-400 font-medium mb-2">✓ Approved Sources</p>
                <ul className="text-xs text-slate-400 space-y-1">
                  <li>• Peer-reviewed academic journals</li>
                  <li>• Published academic textbooks</li>
                  <li>• Professional body publications (SHRM, PMI, etc.)</li>
                  <li>• Open-access repositories (DOAJ, PubMed)</li>
                </ul>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-3">
                <p className="text-red-400 font-medium mb-2">✗ Prohibited Sources</p>
                <ul className="text-xs text-slate-400 space-y-1">
                  <li>• Blogs, Wikipedia, Medium</li>
                  <li>• AI-generated content</li>
                  <li>• Marketing materials</li>
                  <li>• Unverified sources</li>
                </ul>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-3">
                <p className="text-cyan-400 font-medium mb-2">📅 Recency Rules</p>
                <ul className="text-xs text-slate-400 space-y-1">
                  <li>• Standard: Within past 5 years</li>
                  <li>• Seminal: &gt;5 years with justification + recent pairing</li>
                </ul>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-3">
                <p className="text-purple-400 font-medium mb-2">📊 Requirements</p>
                <ul className="text-xs text-slate-400 space-y-1">
                  <li>• 2-3 sources per topic</li>
                  <li>• ≥50% peer-reviewed per module</li>
                  <li>• Academic + Applied balance</li>
                </ul>
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
            disabled={isCurrentlyGenerating}
            className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-medium rounded-lg transition-all disabled:opacity-50"
          >
            {isCurrentlyGenerating ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generating AGI-Compliant Sources...
              </span>
            ) : (
              'Generate Topic-Level Sources'
            )}
          </button>
        </div>
      ) : (
        // Display Generated Sources
        <div className="space-y-6">
          {/* Overall Stats */}
          <div className="grid grid-cols-5 gap-4">
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700 text-center">
              <p className="text-3xl font-bold text-white">
                {workflow.step5?.totalSources || workflow.step5?.sources?.length || 0}
              </p>
              <p className="text-xs text-slate-500 mt-1">Total Sources</p>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700 text-center">
              <p
                className={`text-3xl font-bold ${(workflow.step5?.peerReviewedPercent || 0) >= 50 ? 'text-emerald-400' : 'text-amber-400'}`}
              >
                {workflow.step5?.peerReviewedPercent || 0}%
              </p>
              <p className="text-xs text-slate-500 mt-1">Peer-Reviewed</p>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700 text-center">
              <p className="text-3xl font-bold text-cyan-400">
                {workflow.step5?.recentSourcesPercent || 0}%
              </p>
              <p className="text-xs text-slate-500 mt-1">Recent (&lt;5yr)</p>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700 text-center">
              <p
                className={`text-3xl font-bold ${workflow.step5?.academicAppliedBalance ? 'text-emerald-400' : 'text-amber-400'}`}
              >
                {workflow.step5?.academicAppliedBalance ? '✓' : '⚠'}
              </p>
              <p className="text-xs text-slate-500 mt-1">Balance</p>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700 text-center">
              <p
                className={`text-3xl font-bold ${workflow.step5?.agiCompliant ? 'text-emerald-400' : 'text-red-400'}`}
              >
                {workflow.step5?.agiCompliant ? '✓' : '✗'}
              </p>
              <p className="text-xs text-slate-500 mt-1">AGI Compliant</p>
            </div>
          </div>

          {/* Validation Report */}
          {validation && (
            <div
              className={`rounded-lg p-4 border ${workflow.step5?.agiCompliant ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}
            >
              <h4
                className={`font-medium mb-3 ${workflow.step5?.agiCompliant ? 'text-emerald-400' : 'text-amber-400'}`}
              >
                AGI Standards Validation
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <span
                  className={validation.allSourcesApproved ? 'text-emerald-400' : 'text-red-400'}
                >
                  {validation.allSourcesApproved ? '✓' : '✗'} Approved Sources
                </span>
                <span
                  className={validation.recencyCompliance ? 'text-emerald-400' : 'text-red-400'}
                >
                  {validation.recencyCompliance ? '✓' : '✗'} Recency
                </span>
                <span
                  className={
                    validation.minimumSourcesPerTopic ? 'text-emerald-400' : 'text-red-400'
                  }
                >
                  {validation.minimumSourcesPerTopic ? '✓' : '✗'} Min Sources
                </span>
                <span
                  className={
                    validation.academicAppliedBalance ? 'text-emerald-400' : 'text-red-400'
                  }
                >
                  {validation.academicAppliedBalance ? '✓' : '✗'} Balance
                </span>
                <span className={validation.peerReviewRatio ? 'text-emerald-400' : 'text-red-400'}>
                  {validation.peerReviewRatio ? '✓' : '✗'} Peer-Review ≥50%
                </span>
                <span
                  className={validation.completeCitations ? 'text-emerald-400' : 'text-red-400'}
                >
                  {validation.completeCitations ? '✓' : '✗'} Complete Citations
                </span>
                <span className={validation.apaAccuracy ? 'text-emerald-400' : 'text-red-400'}>
                  {validation.apaAccuracy ? '✓' : '✗'} APA ≥95%
                </span>
                <span
                  className={validation.everyMLOSupported ? 'text-emerald-400' : 'text-red-400'}
                >
                  {validation.everyMLOSupported ? '✓' : '✗'} All MLOs Supported
                </span>
              </div>

              {/* Compliance Issues */}
              {workflow.step5?.complianceIssues && workflow.step5.complianceIssues.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-700/50">
                  <p className="text-amber-400 text-sm font-medium mb-2">Issues to Resolve:</p>
                  <ul className="text-xs text-slate-400 space-y-1">
                    {workflow.step5.complianceIssues.map((issue, i) => (
                      <li key={i}>• {issue}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Module Summaries */}
          {workflow.step5?.moduleSummaries && workflow.step5.moduleSummaries.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Module Summaries</h3>
              <div className="grid md:grid-cols-2 gap-4">
                {workflow.step5.moduleSummaries.map((summary) => (
                  <ModuleSummaryCard key={summary.moduleId} summary={summary} />
                ))}
              </div>
            </div>
          )}

          {/* Module Filter */}
          {workflow.step5?.sourcesByModule &&
            Object.keys(workflow.step5.sourcesByModule).length > 0 && (
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setSelectedModule(null)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    selectedModule === null
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500'
                      : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
                  }`}
                >
                  All Modules
                </button>
                {Object.keys(workflow.step5.sourcesByModule).map((modId) => (
                  <button
                    key={modId}
                    onClick={() => setSelectedModule(modId)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      selectedModule === modId
                        ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500'
                        : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    {modId}
                  </button>
                ))}
              </div>
            )}

          {/* Sources List */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">
              Sources ({displayedSources.length})
            </h3>
            <div className="space-y-3">
              {displayedSources.map((source) => (
                <SourceCard key={source.id} source={source} />
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
              disabled={submitStep5.isPending}
              className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
            >
              Regenerate
            </button>
            <div className="flex gap-3">
              {!isApproved && (
                <button
                  onClick={handleApprove}
                  disabled={
                    approveStep5.isPending ||
                    (!workflow.step5?.agiCompliant && !workflow.step5?.adminOverrideApprovedBy)
                  }
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-medium rounded-lg transition-all disabled:opacity-50"
                >
                  {approveStep5.isPending ? 'Approving...' : 'Approve & Continue →'}
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

          {!workflow.step5?.agiCompliant &&
            !workflow.step5?.adminOverrideApprovedBy &&
            !isApproved && (
              <p className="text-xs text-amber-400 text-center">
                AGI Standards must be met or admin override required before approval.
              </p>
            )}
        </div>
      )}
    </div>
  );
}
