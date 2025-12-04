'use client';

import { useState } from 'react';
import { useSubmitStep4, useApproveStep4 } from '@/hooks/useWorkflow';
import {
  CurriculumWorkflow,
  Module,
  MLO,
  BloomLevel,
  BLOOM_LEVELS,
  ModulePhase,
} from '@/types/workflow';
import EditWithAIButton, { EditTarget } from './EditWithAIButton';

interface Props {
  workflow: CurriculumWorkflow;
  onComplete: () => void;
  onRefresh: () => void;
  onOpenCanvas?: (target: EditTarget) => void;
}

// Bloom's level colors
const BLOOM_COLORS: Record<BloomLevel, string> = {
  remember: 'bg-red-500/20 text-red-400',
  understand: 'bg-orange-500/20 text-orange-400',
  apply: 'bg-yellow-500/20 text-yellow-400',
  analyze: 'bg-green-500/20 text-green-400',
  evaluate: 'bg-blue-500/20 text-blue-400',
  create: 'bg-purple-500/20 text-purple-400',
};

// Phase colors
const PHASE_COLORS: Record<ModulePhase, string> = {
  early: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  middle: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  late: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

const PHASE_LABELS: Record<ModulePhase, string> = {
  early: 'Foundation',
  middle: 'Application',
  late: 'Synthesis',
};

// MLO Card Component
function MLOCard({ mlo }: { mlo: MLO }) {
  return (
    <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="text-xs font-mono text-slate-500">{mlo.code}</span>
        <span className={`text-xs px-2 py-0.5 rounded capitalize ${BLOOM_COLORS[mlo.bloomLevel]}`}>
          {mlo.bloomLevel}
        </span>
      </div>
      <p className="text-sm text-slate-300">{mlo.statement}</p>
      {mlo.linkedPLOs && mlo.linkedPLOs.length > 0 && (
        <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
          <span>→</span>
          {mlo.linkedPLOs.map((plo) => (
            <span key={plo} className="px-1.5 py-0.5 bg-slate-700 rounded">
              {plo}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// Module Card Component
function ModuleCard({
  module,
  totalProgramHours,
  contactPercent,
  onEdit,
}: {
  module: Module;
  totalProgramHours: number;
  contactPercent: number;
  onEdit?: (target: EditTarget) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hoursPercent =
    totalProgramHours > 0 ? Math.round((module.totalHours / totalProgramHours) * 100) : 0;

  return (
    <div className="bg-slate-900/50 rounded-xl border border-slate-700 overflow-hidden group">
      {/* Header */}
      <div className="p-4 border-b border-slate-700/50">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <span className="text-2xl font-bold text-white">{module.sequence}</span>
              <span
                className={`text-xs px-2 py-0.5 rounded border ${PHASE_COLORS[module.phase || 'middle']}`}
              >
                {PHASE_LABELS[module.phase || 'middle']}
              </span>
            </div>
            <div>
              <span className="text-xs font-mono text-slate-500">{module.code}</span>
              <h4 className="text-white font-semibold text-lg">{module.title}</h4>
              <p className="text-sm text-slate-400 mt-1">{module.description}</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="flex items-start gap-2 justify-end mb-1">
              {onEdit && (
                <EditWithAIButton
                  target={{
                    type: 'item',
                    stepNumber: 4,
                    itemId: module.id,
                    originalContent: module,
                    fieldPath: `Module ${module.sequence}: ${module.title}`,
                  }}
                  onEdit={onEdit}
                  size="sm"
                  variant="icon"
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                />
              )}
            </div>
            <p className="text-cyan-400 font-bold text-xl">{module.totalHours}h</p>
            <p className="text-xs text-slate-500">{hoursPercent}% of program</p>
            {module.credits > 0 && (
              <p className="text-xs text-slate-500 mt-1">{module.credits} credits</p>
            )}
          </div>
        </div>
      </div>

      {/* Hours Breakdown */}
      <div className="px-4 py-3 bg-slate-800/30 border-b border-slate-700/50">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-lg font-semibold text-white">{module.totalHours}h</p>
            <p className="text-xs text-slate-500">Total Hours</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-emerald-400">{module.contactHours}h</p>
            <p className="text-xs text-slate-500">Contact ({contactPercent}%)</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-amber-400">{module.selfStudyHours}h</p>
            <p className="text-xs text-slate-500">Independent ({100 - contactPercent}%)</p>
          </div>
        </div>

        {/* Hours bar */}
        <div className="flex h-2 rounded-full overflow-hidden mt-3">
          <div
            className="bg-emerald-500"
            style={{ width: `${contactPercent}%` }}
            title={`Contact: ${module.contactHours}h`}
          />
          <div
            className="bg-amber-500"
            style={{ width: `${100 - contactPercent}%` }}
            title={`Independent: ${module.selfStudyHours}h`}
          />
        </div>
      </div>

      {/* Prerequisites */}
      {module.prerequisites && module.prerequisites.length > 0 && (
        <div className="px-4 py-2 bg-slate-800/20 border-b border-slate-700/50 text-xs">
          <span className="text-slate-500">Prerequisites: </span>
          {module.prerequisites.map((prereq, i) => (
            <span key={prereq}>
              <span className="text-cyan-400">{prereq}</span>
              {i < module.prerequisites.length - 1 && ', '}
            </span>
          ))}
        </div>
      )}

      {/* Expand/Collapse */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2 flex items-center justify-between text-sm text-slate-400 hover:bg-slate-800/30 transition-colors"
      >
        <span>
          {module.mlos?.length || 0} MLOs • {module.topics?.length || 0} Topics
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
        <div className="p-4 space-y-4 border-t border-slate-700/50">
          {/* MLOs */}
          {module.mlos && module.mlos.length > 0 && (
            <div>
              <h5 className="text-sm font-medium text-slate-300 mb-2">
                Module Learning Outcomes ({module.mlos.length})
              </h5>
              <div className="space-y-2">
                {module.mlos.map((mlo) => (
                  <MLOCard key={mlo.id} mlo={mlo} />
                ))}
              </div>
            </div>
          )}

          {/* Topics */}
          {module.topics && module.topics.length > 0 && (
            <div>
              <h5 className="text-sm font-medium text-slate-300 mb-2">
                Topics ({module.topics.length})
              </h5>
              <div className="grid gap-2">
                {module.topics.map((topic) => (
                  <div
                    key={topic.id}
                    className="flex items-center justify-between p-2 bg-slate-800/50 rounded-lg"
                  >
                    <div>
                      <span className="text-xs text-slate-500 mr-2">#{topic.sequence}</span>
                      <span className="text-sm text-white">{topic.title}</span>
                    </div>
                    <span className="text-xs text-slate-400">{topic.hours}h</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PLO Coverage */}
          {module.linkedPLOs && module.linkedPLOs.length > 0 && (
            <div className="pt-2 border-t border-slate-700/50">
              <p className="text-xs text-slate-500">
                Addresses PLOs: {module.linkedPLOs.join(', ')}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Step4View({ workflow, onComplete, onRefresh, onOpenCanvas }: Props) {
  const submitStep4 = useSubmitStep4();
  const approveStep4 = useApproveStep4();
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setError(null);
    try {
      await submitStep4.mutateAsync(workflow._id);
      onRefresh();
    } catch (err: any) {
      console.error('Failed to generate course framework:', err);
      setError(err.message || 'Failed to generate course framework');
    }
  };

  const handleApprove = async () => {
    setError(null);
    try {
      await approveStep4.mutateAsync(workflow._id);
      onComplete();
    } catch (err: any) {
      console.error('Failed to approve Step 4:', err);
      setError(err.message || 'Failed to approve Step 4');
    }
  };

  const hasStep4Data = workflow.step4 && workflow.step4.modules?.length > 0;
  const isApproved = !!workflow.step4?.approvedAt;

  // Get contact hours percent from Step 1 or default to 30%
  const contactPercent =
    (workflow.step4 as any)?.contactHoursPercent || (workflow.step1 as any)?.contactPercent || 30;

  // Calculate totals
  const totalModuleHours = workflow.step4?.modules?.reduce((sum, m) => sum + m.totalHours, 0) || 0;
  const totalModuleContactHours =
    workflow.step4?.modules?.reduce((sum, m) => sum + m.contactHours, 0) || 0;
  const totalMLOs =
    workflow.step4?.modules?.reduce((sum, m) => sum + (m.mlos?.length || 0), 0) || 0;

  // Validation
  const validation = (workflow.step4 as any)?.validationReport;
  const progressiveComplexity = (workflow.step4 as any)?.progressiveComplexity;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {!hasStep4Data ? (
        // Generation Form
        <div className="space-y-6">
          {/* About This Step */}
          <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-xl p-5">
            <h3 className="text-green-400 font-semibold mb-3 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 10h16M4 14h16M4 18h16"
                />
              </svg>
              Step 4: Course Framework & Module Learning Outcomes
            </h3>
            <p className="text-sm text-slate-300 mb-4">
              The AI will organize your program into{' '}
              <strong className="text-green-300">6-8 modules</strong> with clear sequencing, precise
              hours allocation, and specific Module Learning Outcomes (MLOs) that build toward your
              Program Learning Outcomes.
            </p>

            {/* Key Points */}
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="bg-slate-900/50 rounded-lg p-3">
                <p className="text-slate-400 font-medium mb-2">Module Count</p>
                <p className="text-white">6-8 modules using 15-hour guideline</p>
                <p className="text-xs text-slate-500 mt-1">Hours are distributed proportionally</p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-3">
                <p className="text-slate-400 font-medium mb-2">Hours Breakdown</p>
                <p className="text-white">
                  {contactPercent}% Contact / {100 - contactPercent}% Independent
                </p>
                <p className="text-xs text-slate-500 mt-1">Based on your Step 1 settings</p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-3">
                <p className="text-slate-400 font-medium mb-2">Progressive Complexity</p>
                <ul className="text-xs text-slate-400 space-y-1">
                  <li>
                    <span className="text-amber-400">Early (1-2):</span> ≥60% Understand/Apply
                  </li>
                  <li>
                    <span className="text-cyan-400">Middle (3-5):</span> Apply/Analyze focus
                  </li>
                  <li>
                    <span className="text-purple-400">Late (6-8):</span> ≥30%
                    Analyze/Evaluate/Create
                  </li>
                </ul>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-3">
                <p className="text-slate-400 font-medium mb-2">Hours Integrity</p>
                <p className="text-white">Σ module hours = program hours</p>
                <p className="text-xs text-red-400 mt-1">No tolerance - must match exactly</p>
              </div>
            </div>
          </div>

          {/* Program Summary from previous steps */}
          <div className="bg-slate-900/30 rounded-lg p-4 border border-slate-700">
            <h4 className="text-sm font-medium text-slate-400 mb-3">From Previous Steps</h4>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-white">
                  {(workflow.step1 as any)?.creditCalculation?.totalHours ||
                    (workflow.step1 as any)?.totalHours ||
                    120}
                  h
                </p>
                <p className="text-xs text-slate-500">Total Program Hours</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-400">
                  {workflow.step3?.outcomes?.length || 0}
                </p>
                <p className="text-xs text-slate-500">PLOs to Address</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-cyan-400">
                  {(workflow.step1 as any)?.deliveryMode || 'Hybrid'}
                </p>
                <p className="text-xs text-slate-500">Delivery Mode</p>
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
            disabled={submitStep4.isPending}
            className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-medium rounded-lg transition-all disabled:opacity-50"
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
        // Display Generated Framework
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-5 gap-4">
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700 text-center">
              <p className="text-3xl font-bold text-white">
                {workflow.step4?.modules?.length || 0}
              </p>
              <p className="text-xs text-slate-500 mt-1">Modules</p>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700 text-center">
              <p className="text-3xl font-bold text-cyan-400">{totalModuleHours}h</p>
              <p className="text-xs text-slate-500 mt-1">Total Hours</p>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700 text-center">
              <p className="text-3xl font-bold text-emerald-400">{totalModuleContactHours}h</p>
              <p className="text-xs text-slate-500 mt-1">Contact Hours</p>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700 text-center">
              <p className="text-3xl font-bold text-purple-400">{totalMLOs}</p>
              <p className="text-xs text-slate-500 mt-1">Total MLOs</p>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700 text-center">
              <p
                className={`text-3xl font-bold ${workflow.step4?.hoursIntegrity ? 'text-emerald-400' : 'text-red-400'}`}
              >
                {workflow.step4?.hoursIntegrity ? '✓' : '✗'}
              </p>
              <p className="text-xs text-slate-500 mt-1">Hours Integrity</p>
            </div>
          </div>

          {/* Hours Integrity Warning */}
          {!workflow.step4?.hoursIntegrity && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-400 font-medium">⚠ Hours Integrity Failed</p>
              <p className="text-sm text-slate-400 mt-1">
                Module hours ({totalModuleHours}h) do not match program hours (
                {workflow.step4?.totalProgramHours}h). Approval is blocked until this is resolved.
              </p>
            </div>
          )}

          {/* Validation Report */}
          {validation && (
            <div className="bg-slate-900/30 rounded-lg p-4 border border-slate-700">
              <h4 className="text-sm font-medium text-slate-400 mb-3">Validation Report</h4>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3 text-xs">
                <div
                  className={`flex items-center gap-1 ${validation.hoursMatch ? 'text-emerald-400' : 'text-red-400'}`}
                >
                  {validation.hoursMatch ? '✓' : '✗'} Hours Match
                </div>
                <div
                  className={`flex items-center gap-1 ${validation.contactHoursMatch ? 'text-emerald-400' : 'text-red-400'}`}
                >
                  {validation.contactHoursMatch ? '✓' : '✗'} Contact Hours
                </div>
                <div
                  className={`flex items-center gap-1 ${validation.allPLOsCovered ? 'text-emerald-400' : 'text-amber-400'}`}
                >
                  {validation.allPLOsCovered ? '✓' : '⚠'} PLO Coverage
                </div>
                <div
                  className={`flex items-center gap-1 ${validation.progressionValid ? 'text-emerald-400' : 'text-amber-400'}`}
                >
                  {validation.progressionValid ? '✓' : '⚠'} Progression
                </div>
                <div
                  className={`flex items-center gap-1 ${validation.noCircularDeps ? 'text-emerald-400' : 'text-red-400'}`}
                >
                  {validation.noCircularDeps ? '✓' : '✗'} No Circular Deps
                </div>
                <div
                  className={`flex items-center gap-1 ${validation.minMLOsPerModule ? 'text-emerald-400' : 'text-amber-400'}`}
                >
                  {validation.minMLOsPerModule ? '✓' : '⚠'} Min MLOs
                </div>
              </div>
            </div>
          )}

          {/* Progressive Complexity */}
          {progressiveComplexity && (
            <div className="bg-slate-900/30 rounded-lg p-4 border border-slate-700">
              <h4 className="text-sm font-medium text-slate-400 mb-3">Progressive Complexity</h4>
              <div className="flex gap-4">
                <div
                  className={`flex-1 p-3 rounded-lg border ${progressiveComplexity.earlyModulesValid ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-amber-500/30 bg-amber-500/10'}`}
                >
                  <p className="text-amber-400 font-medium text-sm">Early (1-2)</p>
                  <p className="text-xs text-slate-400 mt-1">≥60% at Understand/Apply</p>
                  <p
                    className={`text-xs mt-1 ${progressiveComplexity.earlyModulesValid ? 'text-emerald-400' : 'text-amber-400'}`}
                  >
                    {progressiveComplexity.earlyModulesValid ? '✓ Valid' : '⚠ Review'}
                  </p>
                </div>
                <div
                  className={`flex-1 p-3 rounded-lg border ${progressiveComplexity.middleModulesValid ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-amber-500/30 bg-amber-500/10'}`}
                >
                  <p className="text-cyan-400 font-medium text-sm">Middle (3-5)</p>
                  <p className="text-xs text-slate-400 mt-1">Balanced Apply/Analyze</p>
                  <p
                    className={`text-xs mt-1 ${progressiveComplexity.middleModulesValid ? 'text-emerald-400' : 'text-amber-400'}`}
                  >
                    {progressiveComplexity.middleModulesValid ? '✓ Valid' : '⚠ Review'}
                  </p>
                </div>
                <div
                  className={`flex-1 p-3 rounded-lg border ${progressiveComplexity.lateModulesValid ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-amber-500/30 bg-amber-500/10'}`}
                >
                  <p className="text-purple-400 font-medium text-sm">Late (6-8)</p>
                  <p className="text-xs text-slate-400 mt-1">≥30% at Analyze/Evaluate/Create</p>
                  <p
                    className={`text-xs mt-1 ${progressiveComplexity.lateModulesValid ? 'text-emerald-400' : 'text-amber-400'}`}
                  >
                    {progressiveComplexity.lateModulesValid ? '✓ Valid' : '⚠ Review'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Modules List */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">
              Modules ({workflow.step4?.modules?.length || 0})
            </h3>
            <div className="space-y-4">
              {workflow.step4?.modules?.map((module) => (
                <ModuleCard
                  key={module.id}
                  module={module}
                  totalProgramHours={workflow.step4?.totalProgramHours || totalModuleHours}
                  contactPercent={contactPercent}
                  onEdit={onOpenCanvas}
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
          <div className="flex items-center justify-between pt-6 border-t border-slate-700">
            <button
              onClick={handleGenerate}
              disabled={submitStep4.isPending}
              className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
            >
              Regenerate
            </button>
            <div className="flex gap-3">
              {!isApproved && (
                <button
                  onClick={handleApprove}
                  disabled={approveStep4.isPending || !workflow.step4?.hoursIntegrity}
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-medium rounded-lg transition-all disabled:opacity-50"
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

          {!workflow.step4?.hoursIntegrity && !isApproved && (
            <p className="text-xs text-red-400 text-center">
              Hours integrity must be valid before approval. Module hours must exactly match program
              hours.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
