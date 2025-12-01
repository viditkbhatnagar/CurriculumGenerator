'use client';

import { useState } from 'react';
import { useSubmitStep3, useApproveStep3 } from '@/hooks/useWorkflow';
import {
  CurriculumWorkflow,
  Step3FormData,
  BloomLevel,
  BLOOM_LEVELS,
  BLOOM_VERBS,
  PLO,
} from '@/types/workflow';

interface Props {
  workflow: CurriculumWorkflow;
  onComplete: () => void;
  onRefresh: () => void;
}

const BLOOM_COLORS: Record<BloomLevel, string> = {
  remember: 'bg-red-500/20 text-red-400 border-red-500/30',
  understand: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  apply: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  analyze: 'bg-green-500/20 text-green-400 border-green-500/30',
  evaluate: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  create: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

function PLOCard({ plo }: { plo: PLO }) {
  return (
    <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-xs font-mono text-slate-500">{plo.code || 'PLO'}</span>
        <span
          className={`text-xs px-2 py-1 rounded-full border capitalize ${BLOOM_COLORS[plo.bloomLevel] || 'bg-slate-700 text-slate-400'}`}
        >
          {plo.bloomLevel || 'N/A'}
        </span>
      </div>
      <p className="text-white">{plo.statement || 'No statement'}</p>
      <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
        {plo.verb && (
          <span>
            Verb: <span className="text-cyan-400">{plo.verb}</span>
          </span>
        )}
        {plo.linkedKSAs && plo.linkedKSAs.length > 0 && (
          <span>Links {plo.linkedKSAs.length} KSAs</span>
        )}
        {plo.measurable && <span className="text-emerald-400">✓ Measurable</span>}
        {plo.assessable && <span className="text-emerald-400">✓ Assessable</span>}
      </div>
    </div>
  );
}

export default function Step3Form({ workflow, onComplete, onRefresh }: Props) {
  const submitStep3 = useSubmitStep3();
  const approveStep3 = useApproveStep3();

  const [formData, setFormData] = useState<Step3FormData>({
    bloomLevels: ['apply', 'analyze'],
    targetCount: 6,
    outcomeEmphasis: 'mixed',
  });

  const handleGenerate = async () => {
    try {
      await submitStep3.mutateAsync({
        id: workflow._id,
        data: formData,
      });
      onRefresh();
    } catch (err) {
      console.error('Failed to generate PLOs:', err);
    }
  };

  const handleApprove = async () => {
    try {
      await approveStep3.mutateAsync(workflow._id);
      onComplete();
    } catch (err) {
      console.error('Failed to approve Step 3:', err);
    }
  };

  const toggleBloomLevel = (level: BloomLevel) => {
    setFormData((prev) => ({
      ...prev,
      bloomLevels: prev.bloomLevels.includes(level)
        ? prev.bloomLevels.filter((l) => l !== level)
        : [...prev.bloomLevels, level],
    }));
  };

  const hasStep3Data = workflow.step3 && workflow.step3.outcomes?.length > 0;
  const isApproved = !!workflow.step3?.approvedAt;

  return (
    <div className="p-6">
      {!hasStep3Data ? (
        // Generation Form
        <div className="space-y-6">
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
            <h3 className="text-purple-400 font-medium mb-2">About Program Learning Outcomes</h3>
            <p className="text-sm text-slate-300">
              PLOs define what learners will be able to do upon completing the program. They use
              Bloom&apos;s Taxonomy verbs to ensure measurability and are mapped to your KSA
              framework.
            </p>
          </div>

          {/* Bloom's Levels Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">
              Select Bloom&apos;s Taxonomy Levels <span className="text-red-400">*</span>
              <span className="text-slate-500 font-normal ml-2">(at least 2)</span>
            </label>
            <div className="grid grid-cols-3 gap-3">
              {BLOOM_LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => toggleBloomLevel(level)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    formData.bloomLevels.includes(level)
                      ? BLOOM_COLORS[level]
                      : 'bg-slate-800/50 border-slate-700 text-slate-400'
                  }`}
                >
                  <p className="font-medium capitalize">{level}</p>
                  <p className="text-xs mt-1 opacity-70">
                    {BLOOM_VERBS[level].slice(0, 3).join(', ')}...
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Target Count */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Number of PLOs <span className="text-red-400">*</span>
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={4}
                max={8}
                value={formData.targetCount}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, targetCount: parseInt(e.target.value) }))
                }
                className="flex-1 accent-cyan-500"
              />
              <span className="text-2xl font-bold text-white w-8 text-center">
                {formData.targetCount}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Recommended: 4-8 PLOs for optimal coverage
            </p>
          </div>

          {/* Outcome Emphasis */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Outcome Emphasis
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: 'cognitive', label: 'Cognitive', desc: 'Focus on theoretical knowledge' },
                { value: 'practical', label: 'Practical', desc: 'Focus on applied skills' },
                { value: 'mixed', label: 'Mixed', desc: 'Balanced approach' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, outcomeEmphasis: option.value as any }))
                  }
                  className={`p-3 rounded-lg border text-left transition-all ${
                    formData.outcomeEmphasis === option.value
                      ? 'bg-cyan-500/20 border-cyan-500 text-white'
                      : 'bg-slate-800/50 border-slate-700 text-slate-400'
                  }`}
                >
                  <p className="font-medium">{option.label}</p>
                  <p className="text-xs mt-1 opacity-70">{option.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={submitStep3.isPending || formData.bloomLevels.length < 2}
            className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium rounded-lg transition-all disabled:opacity-50"
          >
            {submitStep3.isPending ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generating PLOs...
              </span>
            ) : (
              'Generate Program Learning Outcomes'
            )}
          </button>
        </div>
      ) : (
        // Display Generated PLOs
        <div className="space-y-6">
          {/* Bloom Distribution */}
          <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
            <h4 className="text-sm font-medium text-slate-300 mb-3">
              Bloom&apos;s Taxonomy Distribution
            </h4>
            <div className="flex gap-2">
              {BLOOM_LEVELS.map((level) => {
                const count = workflow.step3?.bloomDistribution?.[level] || 0;
                return (
                  <div key={level} className="flex-1 text-center">
                    <div
                      className={`h-2 rounded-full mb-1 ${
                        count > 0 ? BLOOM_COLORS[level].split(' ')[0] : 'bg-slate-700'
                      }`}
                    />
                    <p className="text-xs text-slate-500 capitalize">{level}</p>
                    <p className="text-lg font-bold text-white">{count}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* PLO List */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-3">
              Program Learning Outcomes ({workflow.step3?.outcomes?.length || 0})
            </h3>
            <div className="grid gap-3">
              {workflow.step3?.outcomes?.map((plo) => (
                <PLOCard key={plo.id} plo={plo} />
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-700">
            <button
              onClick={handleGenerate}
              disabled={submitStep3.isPending}
              className="px-4 py-2 text-slate-400 hover:text-white"
            >
              Regenerate
            </button>
            <div className="flex gap-3">
              {!isApproved && (
                <button
                  onClick={handleApprove}
                  disabled={approveStep3.isPending || (workflow.step3?.outcomes?.length || 0) < 4}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-medium rounded-lg transition-all disabled:opacity-50"
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
        </div>
      )}
    </div>
  );
}
