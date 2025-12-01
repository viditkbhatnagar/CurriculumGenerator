'use client';

import { useSubmitStep6, useApproveStep6 } from '@/hooks/useWorkflow';
import { CurriculumWorkflow, ReadingItem } from '@/types/workflow';

interface Props {
  workflow: CurriculumWorkflow;
  onComplete: () => void;
  onRefresh: () => void;
}

export default function Step6View({ workflow, onComplete, onRefresh }: Props) {
  const submitStep6 = useSubmitStep6();
  const approveStep6 = useApproveStep6();

  const handleGenerate = async () => {
    try {
      await submitStep6.mutateAsync(workflow._id);
      onRefresh();
    } catch (err) {
      console.error('Failed to generate reading lists:', err);
    }
  };

  const handleApprove = async () => {
    try {
      await approveStep6.mutateAsync(workflow._id);
      onComplete();
    } catch (err) {
      console.error('Failed to approve Step 6:', err);
    }
  };

  const hasStep6Data = workflow.step6 && workflow.step6.readings?.length > 0;
  const isApproved = !!workflow.step6?.approvedAt;

  return (
    <div className="p-6">
      {!hasStep6Data ? (
        <div className="space-y-6">
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <h3 className="text-blue-400 font-medium mb-2">About Reading Lists</h3>
            <p className="text-sm text-slate-300">
              Reading lists are organized by module with Core (essential) and Supplementary
              (recommended) categories. They are generated from your approved sources in Step 5.
            </p>
          </div>

          <button
            onClick={handleGenerate}
            disabled={submitStep6.isPending}
            className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium rounded-lg transition-all disabled:opacity-50"
          >
            {submitStep6.isPending ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generating Reading Lists...
              </span>
            ) : (
              'Generate Reading Lists'
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700 text-center">
              <p className="text-2xl font-bold text-white">
                {workflow.step6?.readings?.length || 0}
              </p>
              <p className="text-xs text-slate-500">Total Readings</p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700 text-center">
              <p className="text-2xl font-bold text-cyan-400">{workflow.step6?.coreCount || 0}</p>
              <p className="text-xs text-slate-500">Core Readings</p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700 text-center">
              <p className="text-2xl font-bold text-amber-400">
                {workflow.step6?.supplementaryCount || 0}
              </p>
              <p className="text-xs text-slate-500">Supplementary</p>
            </div>
          </div>

          {/* Readings by Module */}
          {workflow.step6?.moduleReadings &&
            Object.entries(workflow.step6.moduleReadings).map(([moduleId, readings]) => (
              <div
                key={moduleId}
                className="bg-slate-900/50 rounded-lg p-4 border border-slate-700"
              >
                <h4 className="text-white font-medium mb-3">Module: {moduleId}</h4>
                <div className="space-y-2">
                  {(readings as ReadingItem[]).map((reading) => (
                    <div
                      key={reading.id}
                      className="flex items-center justify-between p-2 bg-slate-800/50 rounded"
                    >
                      <div>
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            reading.category === 'core'
                              ? 'bg-cyan-500/20 text-cyan-400'
                              : 'bg-slate-700 text-slate-400'
                          }`}
                        >
                          {reading.category}
                        </span>
                        <p className="text-sm text-slate-300 mt-1">{reading.sourceId}</p>
                        {reading.specificChapters && (
                          <p className="text-xs text-slate-500">{reading.specificChapters}</p>
                        )}
                      </div>
                      <span
                        className={`text-xs ${
                          reading.importance === 'essential'
                            ? 'text-emerald-400'
                            : reading.importance === 'recommended'
                              ? 'text-amber-400'
                              : 'text-slate-500'
                        }`}
                      >
                        {reading.importance}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-700">
            <button
              onClick={handleGenerate}
              disabled={submitStep6.isPending}
              className="px-4 py-2 text-slate-400 hover:text-white"
            >
              Regenerate
            </button>
            <div className="flex gap-3">
              {!isApproved && (
                <button
                  onClick={handleApprove}
                  disabled={approveStep6.isPending}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-medium rounded-lg transition-all disabled:opacity-50"
                >
                  {approveStep6.isPending ? 'Approving...' : 'Approve & Continue →'}
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
