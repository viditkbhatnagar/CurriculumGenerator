'use client';

import { useState } from 'react';
import { useSubmitStep2, useApproveStep2, useUpdateKSAItem } from '@/hooks/useWorkflow';
import { CurriculumWorkflow, Step2FormData, KSAItem } from '@/types/workflow';

interface Props {
  workflow: CurriculumWorkflow;
  onComplete: () => void;
  onRefresh: () => void;
}

function KSACard({
  item,
  type,
  onEdit,
}: {
  item: KSAItem;
  type: string;
  onEdit: (item: KSAItem) => void;
}) {
  const importanceColors = {
    critical: 'bg-red-500/20 text-red-400 border-red-500/30',
    important: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    supplementary: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  };

  return (
    <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-white font-medium">{item.statement}</p>
        <span
          className={`text-xs px-2 py-1 rounded-full border ${importanceColors[item.importance]}`}
        >
          {item.importance}
        </span>
      </div>
      <p className="text-sm text-slate-400">{item.description}</p>
      <button
        onClick={() => onEdit(item)}
        className="mt-2 text-xs text-cyan-400 hover:text-cyan-300"
      >
        Edit
      </button>
    </div>
  );
}

export default function Step2Form({ workflow, onComplete, onRefresh }: Props) {
  const submitStep2 = useSubmitStep2();
  const approveStep2 = useApproveStep2();
  const updateKSAItem = useUpdateKSAItem();

  const [formData, setFormData] = useState<Step2FormData>({
    benchmarkPrograms: [],
    industryFrameworks: [],
    institutionalFrameworks: [],
  });

  const [benchmarkInput, setBenchmarkInput] = useState('');
  const [editingItem, setEditingItem] = useState<KSAItem | null>(null);

  const handleGenerate = async () => {
    try {
      await submitStep2.mutateAsync({
        id: workflow._id,
        data: formData,
      });
      onRefresh();
    } catch (err) {
      console.error('Failed to generate KSA:', err);
    }
  };

  const handleApprove = async () => {
    try {
      await approveStep2.mutateAsync(workflow._id);
      onComplete();
    } catch (err) {
      console.error('Failed to approve Step 2:', err);
    }
  };

  const addBenchmark = () => {
    if (benchmarkInput.trim()) {
      setFormData((prev) => ({
        ...prev,
        benchmarkPrograms: [...(prev.benchmarkPrograms || []), benchmarkInput.trim()],
      }));
      setBenchmarkInput('');
    }
  };

  const hasStep2Data = workflow.step2 && workflow.step2.totalItems > 0;
  const isApproved = !!workflow.step2?.approvedAt;

  return (
    <div className="p-6">
      {!hasStep2Data ? (
        // Generation Form
        <div className="space-y-6">
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <h3 className="text-blue-400 font-medium mb-2">About This Step</h3>
            <p className="text-sm text-slate-300">
              The AI will analyze your program foundation and generate a comprehensive Knowledge,
              Skills, and Attitudes (KSA) framework. You can optionally provide benchmark programs
              for reference.
            </p>
          </div>

          {/* Benchmark Programs */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Benchmark Programs (Optional)
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={benchmarkInput}
                onChange={(e) => setBenchmarkInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addBenchmark())}
                placeholder="e.g., MIT Data Science Certificate"
                className="flex-1 px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
              <button
                type="button"
                onClick={addBenchmark}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
              >
                Add
              </button>
            </div>
            {formData.benchmarkPrograms && formData.benchmarkPrograms.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.benchmarkPrograms.map((program, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-slate-800 text-slate-300 rounded-full text-sm flex items-center gap-2"
                  >
                    {program}
                    <button
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          benchmarkPrograms: prev.benchmarkPrograms?.filter((_, i) => i !== index),
                        }))
                      }
                      className="text-slate-500 hover:text-white"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleGenerate}
            disabled={submitStep2.isPending}
            className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium rounded-lg transition-all disabled:opacity-50"
          >
            {submitStep2.isPending ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generating KSA Framework...
              </span>
            ) : (
              'Generate KSA Framework with AI'
            )}
          </button>
        </div>
      ) : (
        // Display Generated KSA
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700 text-center">
              <p className="text-2xl font-bold text-white">{workflow.step2?.totalItems}</p>
              <p className="text-xs text-slate-500">Total Items</p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700 text-center">
              <p className="text-2xl font-bold text-cyan-400">
                {workflow.step2?.knowledgeItems?.length || 0}
              </p>
              <p className="text-xs text-slate-500">Knowledge</p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700 text-center">
              <p className="text-2xl font-bold text-emerald-400">
                {workflow.step2?.skillItems?.length || 0}
              </p>
              <p className="text-xs text-slate-500">Skills</p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700 text-center">
              <p className="text-2xl font-bold text-amber-400">
                {workflow.step2?.attitudeItems?.length || 0}
              </p>
              <p className="text-xs text-slate-500">Attitudes</p>
            </div>
          </div>

          {/* Knowledge Items */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              Knowledge (K)
            </h3>
            <div className="grid gap-3">
              {workflow.step2?.knowledgeItems?.map((item) => (
                <KSACard key={item.id} item={item} type="knowledge" onEdit={setEditingItem} />
              ))}
            </div>
          </div>

          {/* Skills Items */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Skills (S)
            </h3>
            <div className="grid gap-3">
              {workflow.step2?.skillItems?.map((item) => (
                <KSACard key={item.id} item={item} type="skill" onEdit={setEditingItem} />
              ))}
            </div>
          </div>

          {/* Attitude Items */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              Attitudes (A)
            </h3>
            <div className="grid gap-3">
              {workflow.step2?.attitudeItems?.map((item) => (
                <KSACard key={item.id} item={item} type="attitude" onEdit={setEditingItem} />
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-700">
            <button
              onClick={handleGenerate}
              disabled={submitStep2.isPending}
              className="px-4 py-2 text-slate-400 hover:text-white"
            >
              Regenerate
            </button>
            <div className="flex gap-3">
              {!isApproved && (
                <button
                  onClick={handleApprove}
                  disabled={approveStep2.isPending || (workflow.step2?.totalItems || 0) < 10}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-medium rounded-lg transition-all disabled:opacity-50"
                >
                  {approveStep2.isPending ? 'Approving...' : 'Approve & Continue →'}
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
