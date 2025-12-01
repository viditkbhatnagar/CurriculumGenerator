'use client';

import { useSubmitStep4, useApproveStep4 } from '@/hooks/useWorkflow';
import { CurriculumWorkflow, Module } from '@/types/workflow';

interface Props {
  workflow: CurriculumWorkflow;
  onComplete: () => void;
  onRefresh: () => void;
}

function ModuleCard({ module }: { module: Module }) {
  return (
    <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <span className="text-xs font-mono text-slate-500">{module.code}</span>
          <h4 className="text-white font-medium">{module.title}</h4>
        </div>
        <div className="text-right">
          <p className="text-cyan-400 font-bold">{module.credits} credits</p>
          <p className="text-xs text-slate-500">{module.totalHours} hours</p>
        </div>
      </div>
      <p className="text-sm text-slate-400 mb-3">{module.description}</p>

      {/* Hours breakdown */}
      <div className="flex gap-4 text-xs text-slate-500 mb-3">
        <span>Contact: {module.contactHours}h</span>
        <span>Self-study: {module.selfStudyHours}h</span>
      </div>

      {/* MLOs */}
      {module.mlos && module.mlos.length > 0 && (
        <div className="border-t border-slate-700 pt-3 mt-3">
          <p className="text-xs text-slate-500 mb-2">
            Module Learning Outcomes ({module.mlos.length})
          </p>
          <div className="space-y-1">
            {module.mlos.slice(0, 3).map((mlo) => (
              <p key={mlo.id} className="text-xs text-slate-400">
                <span className="text-cyan-400">{mlo.code}:</span> {mlo.statement.slice(0, 80)}...
              </p>
            ))}
            {module.mlos.length > 3 && (
              <p className="text-xs text-slate-500">+{module.mlos.length - 3} more</p>
            )}
          </div>
        </div>
      )}

      {/* Topics */}
      {module.topics && module.topics.length > 0 && (
        <div className="border-t border-slate-700 pt-3 mt-3">
          <p className="text-xs text-slate-500 mb-2">Topics ({module.topics.length})</p>
          <div className="flex flex-wrap gap-2">
            {module.topics.map((topic) => (
              <span
                key={topic.id}
                className="text-xs px-2 py-1 bg-slate-800 rounded text-slate-400"
              >
                {topic.title}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Step4View({ workflow, onComplete, onRefresh }: Props) {
  const submitStep4 = useSubmitStep4();
  const approveStep4 = useApproveStep4();

  const handleGenerate = async () => {
    try {
      await submitStep4.mutateAsync(workflow._id);
      onRefresh();
    } catch (err) {
      console.error('Failed to generate course framework:', err);
    }
  };

  const handleApprove = async () => {
    try {
      await approveStep4.mutateAsync(workflow._id);
      onComplete();
    } catch (err) {
      console.error('Failed to approve Step 4:', err);
    }
  };

  const hasStep4Data = workflow.step4 && workflow.step4.modules?.length > 0;
  const isApproved = !!workflow.step4?.approvedAt;

  return (
    <div className="p-6">
      {!hasStep4Data ? (
        <div className="space-y-6">
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
            <h3 className="text-green-400 font-medium mb-2">About Course Framework</h3>
            <p className="text-sm text-slate-300">
              The AI will generate a structured course framework with modules, topics, and Module
              Learning Outcomes (MLOs) based on your PLOs. It will ensure proper hour distribution
              and PLO coverage.
            </p>
          </div>

          <button
            onClick={handleGenerate}
            disabled={submitStep4.isPending}
            className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium rounded-lg transition-all disabled:opacity-50"
          >
            {submitStep4.isPending ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generating Course Framework...
              </span>
            ) : (
              'Generate Course Framework & MLOs'
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700 text-center">
              <p className="text-2xl font-bold text-white">
                {workflow.step4?.modules?.length || 0}
              </p>
              <p className="text-xs text-slate-500">Modules</p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700 text-center">
              <p className="text-2xl font-bold text-cyan-400">
                {workflow.step4?.totalProgramHours || 0}
              </p>
              <p className="text-xs text-slate-500">Total Hours</p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700 text-center">
              <p className="text-2xl font-bold text-emerald-400">
                {workflow.step4?.totalContactHours || 0}
              </p>
              <p className="text-xs text-slate-500">Contact Hours</p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700 text-center">
              <p
                className={`text-2xl font-bold ${workflow.step4?.hoursIntegrity ? 'text-emerald-400' : 'text-red-400'}`}
              >
                {workflow.step4?.hoursIntegrity ? '✓' : '✗'}
              </p>
              <p className="text-xs text-slate-500">Hours Integrity</p>
            </div>
          </div>

          {/* Modules */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-3">Modules</h3>
            <div className="grid gap-4">
              {workflow.step4?.modules?.map((module) => (
                <ModuleCard key={module.id} module={module} />
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-700">
            <button
              onClick={handleGenerate}
              disabled={submitStep4.isPending}
              className="px-4 py-2 text-slate-400 hover:text-white"
            >
              Regenerate
            </button>
            <div className="flex gap-3">
              {!isApproved && (
                <button
                  onClick={handleApprove}
                  disabled={approveStep4.isPending || !workflow.step4?.hoursIntegrity}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-medium rounded-lg transition-all disabled:opacity-50"
                >
                  {approveStep4.isPending ? 'Approving...' : 'Approve & Continue →'}
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
