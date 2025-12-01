'use client';

import { useSubmitStep5, useApproveStep5 } from '@/hooks/useWorkflow';
import { CurriculumWorkflow, Source } from '@/types/workflow';

interface Props {
  workflow: CurriculumWorkflow;
  onComplete: () => void;
  onRefresh: () => void;
}

function SourceCard({ source }: { source: Source }) {
  const typeColors = {
    primary: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    secondary: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    grey_literature: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  };

  return (
    <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1">
          <h4 className="text-white font-medium">{source.title}</h4>
          <p className="text-sm text-slate-400">
            {source.authors.join(', ')} ({source.year})
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`text-xs px-2 py-1 rounded-full border ${typeColors[source.type]}`}>
            {source.type.replace('_', ' ')}
          </span>
          {source.agiCompliant ? (
            <span className="text-xs text-emerald-400">✓ AGI Compliant</span>
          ) : (
            <span className="text-xs text-red-400">⚠ Non-compliant</span>
          )}
        </div>
      </div>
      <p className="text-xs text-slate-500 font-mono">{source.citation}</p>
      {source.doi && <p className="text-xs text-cyan-400 mt-1">DOI: {source.doi}</p>}
    </div>
  );
}

export default function Step5View({ workflow, onComplete, onRefresh }: Props) {
  const submitStep5 = useSubmitStep5();
  const approveStep5 = useApproveStep5();

  const handleGenerate = async () => {
    try {
      await submitStep5.mutateAsync(workflow._id);
      onRefresh();
    } catch (err) {
      console.error('Failed to generate sources:', err);
    }
  };

  const handleApprove = async () => {
    try {
      await approveStep5.mutateAsync(workflow._id);
      onComplete();
    } catch (err) {
      console.error('Failed to approve Step 5:', err);
    }
  };

  const hasStep5Data = workflow.step5 && workflow.step5.sources?.length > 0;
  const isApproved = !!workflow.step5?.approvedAt;

  return (
    <div className="p-6">
      {!hasStep5Data ? (
        <div className="space-y-6">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
            <h3 className="text-amber-400 font-medium mb-2">AGI Academic Standards</h3>
            <p className="text-sm text-slate-300 mb-3">
              Sources are validated against AGI Academic Standards:
            </p>
            <ul className="text-sm text-slate-400 space-y-1 list-disc list-inside">
              <li>Primary sources: Peer-reviewed journals within 5 years</li>
              <li>Secondary sources: Reputable textbooks within 10 years</li>
              <li>Grey literature: Industry reports, white papers (limited use)</li>
              <li>All sources must have verifiable citations</li>
            </ul>
          </div>

          <button
            onClick={handleGenerate}
            disabled={submitStep5.isPending}
            className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium rounded-lg transition-all disabled:opacity-50"
          >
            {submitStep5.isPending ? (
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
        <div className="space-y-6">
          {/* Compliance Summary */}
          <div
            className={`rounded-lg p-4 border ${
              workflow.step5?.agiCompliant
                ? 'bg-emerald-500/10 border-emerald-500/30'
                : 'bg-amber-500/10 border-amber-500/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <h4
                  className={`font-medium ${workflow.step5?.agiCompliant ? 'text-emerald-400' : 'text-amber-400'}`}
                >
                  {workflow.step5?.agiCompliant ? '✓ AGI Compliant' : '⚠ Compliance Issues'}
                </h4>
                {workflow.step5?.complianceIssues && workflow.step5.complianceIssues.length > 0 && (
                  <ul className="text-sm text-slate-400 mt-2 list-disc list-inside">
                    {workflow.step5.complianceIssues.map((issue, i) => (
                      <li key={i}>{issue}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-white">
                  {workflow.step5?.sources?.length || 0}
                </p>
                <p className="text-xs text-slate-500">Total Sources</p>
              </div>
            </div>
          </div>

          {/* Sources by Type */}
          <div className="grid grid-cols-3 gap-4">
            {(['primary', 'secondary', 'grey_literature'] as const).map((type) => {
              const count = workflow.step5?.sources?.filter((s) => s.type === type).length || 0;
              return (
                <div
                  key={type}
                  className="bg-slate-900/50 rounded-lg p-4 border border-slate-700 text-center"
                >
                  <p className="text-2xl font-bold text-white">{count}</p>
                  <p className="text-xs text-slate-500 capitalize">{type.replace('_', ' ')}</p>
                </div>
              );
            })}
          </div>

          {/* Sources List */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-3">Sources</h3>
            <div className="grid gap-3">
              {workflow.step5?.sources?.map((source) => (
                <SourceCard key={source.id} source={source} />
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-700">
            <button
              onClick={handleGenerate}
              disabled={submitStep5.isPending}
              className="px-4 py-2 text-slate-400 hover:text-white"
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
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-medium rounded-lg transition-all disabled:opacity-50"
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
        </div>
      )}
    </div>
  );
}
