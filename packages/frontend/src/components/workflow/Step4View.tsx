'use client';

import { useState, useEffect } from 'react';
import { useSubmitStep4, useApproveStep4 } from '@/hooks/useWorkflow';
import { api } from '@/lib/api';
import { useStepStatus } from '@/hooks/useStepStatus';
import { useGeneration, GenerationProgressBar } from '@/contexts/GenerationContext';
import {
  CurriculumWorkflow,
  Module,
  MLO,
  BloomLevel,
  BLOOM_LEVELS,
  BLOOM_VERBS,
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

// Module Edit Modal Component
function ModuleEditModal({
  module,
  onSave,
  onCancel,
  isSaving,
}: {
  module: Module;
  onSave: (updatedModule: Partial<Module>) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [title, setTitle] = useState(module.title || '');
  const [description, setDescription] = useState(module.description || '');
  const [totalHours, setTotalHours] = useState(module.totalHours || 0);
  const [contactHours, setContactHours] = useState(module.contactHours || 0);
  const [selfStudyHours, setSelfStudyHours] = useState(module.selfStudyHours || 0);
  const [credits, setCredits] = useState(module.credits || 0);
  const [phase, setPhase] = useState<ModulePhase>(module.phase || 'middle');

  const handleSave = () => {
    onSave({
      title,
      description,
      totalHours,
      contactHours,
      selfStudyHours,
      credits,
      phase,
    });
  };

  // Auto-calculate self-study hours
  const handleContactHoursChange = (value: number) => {
    setContactHours(value);
    setSelfStudyHours(totalHours - value);
  };

  const handleTotalHoursChange = (value: number) => {
    setTotalHours(value);
    setSelfStudyHours(value - contactHours);
  };

  return (
    <div className="fixed inset-0 bg-teal-900/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl border border-teal-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-teal-200">
          <h3 className="text-lg font-semibold text-teal-800 flex items-center gap-2">
            Edit Module <span className="text-green-400">{module.code}</span>
          </h3>
        </div>

        <div className="p-6 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">Module Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-teal-500"
              placeholder="Enter module title..."
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-teal-500 resize-none"
              placeholder="Enter module description..."
            />
          </div>

          {/* Phase */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">Module Phase</label>
            <div className="grid grid-cols-3 gap-2">
              {(['early', 'middle', 'late'] as ModulePhase[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPhase(p)}
                  className={`py-2 px-3 rounded-lg border text-sm transition-all ${
                    phase === p
                      ? PHASE_COLORS[p]
                      : 'bg-white border-teal-300 text-teal-600 hover:border-teal-400'
                  }`}
                >
                  {PHASE_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          {/* Hours */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-teal-700 mb-2">Total Hours</label>
              <input
                type="number"
                value={totalHours}
                onChange={(e) => handleTotalHoursChange(parseInt(e.target.value) || 0)}
                className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 focus:outline-none focus:border-teal-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-teal-700 mb-2">Contact Hours</label>
              <input
                type="number"
                value={contactHours}
                onChange={(e) => handleContactHoursChange(parseInt(e.target.value) || 0)}
                className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 focus:outline-none focus:border-teal-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-teal-700 mb-2">
                Self-Study Hours
              </label>
              <input
                type="number"
                value={selfStudyHours}
                onChange={(e) => setSelfStudyHours(parseInt(e.target.value) || 0)}
                className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>

          {/* Credits */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">Credits</label>
            <input
              type="number"
              value={credits}
              onChange={(e) => setCredits(parseInt(e.target.value) || 0)}
              className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 focus:outline-none focus:border-teal-500"
            />
          </div>
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
            disabled={isSaving || !title.trim()}
            className="px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-teal-800 font-medium rounded-lg transition-all disabled:opacity-50 flex items-center gap-2"
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

// MLO Edit Modal Component
function MLOEditModal({
  mlo,
  moduleCode,
  onSave,
  onCancel,
  isSaving,
}: {
  mlo: MLO;
  moduleCode: string;
  onSave: (updatedMlo: Partial<MLO>) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [statement, setStatement] = useState(mlo.statement || '');
  const [code, setCode] = useState(mlo.code || '');
  const [bloomLevel, setBloomLevel] = useState<BloomLevel>(mlo.bloomLevel || 'apply');
  const [verb, setVerb] = useState(mlo.verb || '');

  const handleSave = () => {
    onSave({
      statement,
      code,
      bloomLevel,
      verb,
    });
  };

  return (
    <div className="fixed inset-0 bg-teal-900/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl border border-teal-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-teal-200">
          <h3 className="text-lg font-semibold text-teal-800 flex items-center gap-2">
            Edit MLO <span className="text-cyan-400">{mlo.code}</span>
            <span className="text-teal-500 text-sm">in {moduleCode}</span>
          </h3>
        </div>

        <div className="p-6 space-y-5">
          {/* Code */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">MLO Code</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-teal-500"
              placeholder="e.g., MLO1.1"
            />
          </div>

          {/* Statement */}
          <div>
            <label className="block text-sm font-medium text-teal-700 mb-2">MLO Statement</label>
            <textarea
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 bg-white border border-teal-300 rounded-lg text-teal-800 placeholder-teal-400 focus:outline-none focus:border-teal-500 resize-none"
              placeholder="Enter the MLO statement..."
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

          {/* Linked PLOs (read-only) */}
          {mlo.linkedPLOs && mlo.linkedPLOs.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-teal-700 mb-2">Linked PLOs</label>
              <div className="flex flex-wrap gap-2">
                {mlo.linkedPLOs.map((plo) => (
                  <span
                    key={plo}
                    className="px-3 py-1 bg-teal-100 text-teal-700 rounded-full text-sm"
                  >
                    {plo}
                  </span>
                ))}
              </div>
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
            className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-teal-800 font-medium rounded-lg transition-all disabled:opacity-50 flex items-center gap-2"
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

// MLO Card Component
function MLOCard({ mlo, onEdit }: { mlo: MLO; onEdit?: (mlo: MLO) => void }) {
  return (
    <div className="bg-teal-50 rounded-lg p-3 border border-teal-200/50 group">
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="text-xs font-mono text-teal-500">{mlo.code}</span>
        <div className="flex items-center gap-2">
          <span
            className={`text-xs px-2 py-0.5 rounded capitalize ${BLOOM_COLORS[mlo.bloomLevel]}`}
          >
            {mlo.bloomLevel}
          </span>
          {onEdit && (
            <button
              onClick={() => onEdit(mlo)}
              className="px-2 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded transition-colors text-xs font-medium flex items-center gap-1"
              title="Edit MLO"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              Edit
            </button>
          )}
        </div>
      </div>
      <p className="text-sm text-teal-700">{mlo.statement}</p>
      {mlo.linkedPLOs && mlo.linkedPLOs.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-teal-500 mt-2">
          <span>→</span>
          {mlo.linkedPLOs.map((plo) => (
            <span key={plo} className="px-1.5 py-0.5 bg-teal-100 rounded">
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
  onEditModule,
  onEditMlo,
}: {
  module: Module;
  totalProgramHours: number;
  contactPercent: number;
  onEdit?: (target: EditTarget) => void;
  onEditModule?: (module: Module) => void;
  onEditMlo?: (mlo: MLO, moduleId: string, moduleCode: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hoursPercent =
    totalProgramHours > 0 ? Math.round((module.totalHours / totalProgramHours) * 100) : 0;

  return (
    <div className="bg-white rounded-xl border border-teal-200 overflow-hidden group">
      {/* Header */}
      <div className="p-4 border-b border-teal-200/50">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <span className="text-2xl font-bold text-teal-800">{module.sequence}</span>
              <span
                className={`text-xs px-2 py-0.5 rounded border ${PHASE_COLORS[module.phase || 'middle']}`}
              >
                {PHASE_LABELS[module.phase || 'middle']}
              </span>
            </div>
            <div>
              <span className="text-xs font-mono text-teal-500">{module.code}</span>
              <h4 className="text-teal-800 font-semibold text-lg">{module.title}</h4>
              <p className="text-sm text-teal-600 mt-1">{module.description}</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="flex items-start gap-2 justify-end mb-1">
              {onEditModule && (
                <button
                  onClick={() => onEditModule(module)}
                  className="px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg transition-colors text-sm font-medium flex items-center gap-1"
                  title="Edit module"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                  Edit
                </button>
              )}
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
            <p className="text-xs text-teal-500">{hoursPercent}% of program</p>
            {module.credits > 0 && (
              <p className="text-xs text-teal-500 mt-1">{module.credits} credits</p>
            )}
          </div>
        </div>
      </div>

      {/* Hours Breakdown */}
      <div className="px-4 py-3 bg-teal-50/30 border-b border-teal-200/50">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-lg font-semibold text-teal-800">{module.totalHours}h</p>
            <p className="text-xs text-teal-500">Total Hours</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-emerald-400">{module.contactHours}h</p>
            <p className="text-xs text-teal-500">Contact ({contactPercent}%)</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-amber-400">{module.selfStudyHours}h</p>
            <p className="text-xs text-teal-500">Independent ({100 - contactPercent}%)</p>
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
        <div className="px-4 py-2 bg-white/20 border-b border-teal-200/50 text-xs">
          <span className="text-teal-500">Prerequisites: </span>
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
        className="w-full px-4 py-2 flex items-center justify-between text-sm text-teal-600 hover:bg-teal-50/30 transition-colors"
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
        <div className="p-4 space-y-4 border-t border-teal-200/50">
          {/* MLOs */}
          {module.mlos && module.mlos.length > 0 && (
            <div>
              <h5 className="text-sm font-medium text-teal-700 mb-2">
                Module Learning Outcomes ({module.mlos.length})
              </h5>
              <div className="space-y-2">
                {module.mlos.map((mlo) => (
                  <MLOCard
                    key={mlo.id}
                    mlo={mlo}
                    onEdit={onEditMlo ? (m) => onEditMlo(m, module.id, module.code) : undefined}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Topics */}
          {module.topics && module.topics.length > 0 && (
            <div>
              <h5 className="text-sm font-medium text-teal-700 mb-2">
                Topics ({module.topics.length})
              </h5>
              <div className="grid gap-2">
                {module.topics.map((topic) => (
                  <div
                    key={topic.id}
                    className="flex items-center justify-between p-2 bg-teal-50 rounded-lg"
                  >
                    <div>
                      <span className="text-xs text-teal-500 mr-2">#{topic.sequence}</span>
                      <span className="text-sm text-teal-800">{topic.title}</span>
                    </div>
                    <span className="text-xs text-teal-600">{topic.hours}h</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PLO Coverage */}
          {module.linkedPLOs && module.linkedPLOs.length > 0 && (
            <div className="pt-2 border-t border-teal-200/50">
              <p className="text-xs text-teal-500">
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

  const { startGeneration, completeGeneration, failGeneration, isGenerating } = useGeneration();

  // Background job polling for Step 4
  const {
    status: stepStatus,
    startPolling,
    isPolling,
    isGenerationActive: isQueueActive,
  } = useStepStatus(workflow._id, 4, {
    pollInterval: 10000,
    autoStart: true,
    onComplete: () => {
      completeGeneration(workflow._id, 4);
      onRefresh();
    },
    onFailed: (err) => {
      failGeneration(workflow._id, 4, err);
      setError(err);
    },
  });

  // Edit state for modules and MLOs
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [editingMlo, setEditingMlo] = useState<MLO | null>(null);
  const [editingMloModuleId, setEditingMloModuleId] = useState<string>('');
  const [editingMloModuleCode, setEditingMloModuleCode] = useState<string>('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const isCurrentlyGenerating =
    isGenerating(workflow._id, 4) || submitStep4.isPending || isPolling || isQueueActive;

  // Check for completion when data appears
  useEffect(() => {
    if (workflow.step4 && workflow.step4.modules?.length > 0) {
      completeGeneration(workflow._id, 4);
    }
  }, [workflow.step4, workflow._id, completeGeneration]);

  const handleGenerate = async () => {
    setError(null);
    try {
      startGeneration(workflow._id, 4);
      const response = await submitStep4.mutateAsync(workflow._id);
      if ((response as any)?.data?.jobId) {
        startPolling();
      } else {
        completeGeneration(workflow._id, 4);
        onRefresh();
      }
    } catch (err: any) {
      console.error('Failed to generate course framework:', err);
      failGeneration(workflow._id, 4, err.message || 'Failed to generate course framework');
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

  // Handle editing a module
  const handleEditModule = (module: Module) => {
    setEditingModule(module);
  };

  // Handle saving edited module
  const handleSaveModule = async (updates: Partial<Module>) => {
    if (!editingModule) return;

    setIsSavingEdit(true);
    setError(null);

    console.log('Saving module:', editingModule.id, updates);

    try {
      const response = await api.put(
        `/api/v3/workflow/${workflow._id}/step4/module/${editingModule.id}`,
        updates
      );
      console.log('Save response:', response.data);

      setEditingModule(null);
      await onRefresh();
    } catch (err: any) {
      console.error('Failed to save module:', err);
      setError(err.response?.data?.error || err.message || 'Failed to save changes');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Handle editing an MLO
  const handleEditMlo = (mlo: MLO, moduleId: string, moduleCode: string) => {
    setEditingMlo(mlo);
    setEditingMloModuleId(moduleId);
    setEditingMloModuleCode(moduleCode);
  };

  // Handle saving edited MLO
  const handleSaveMlo = async (updates: Partial<MLO>) => {
    if (!editingMlo || !editingMloModuleId) return;

    setIsSavingEdit(true);
    setError(null);

    console.log('Saving MLO:', editingMlo.id, updates);

    try {
      const response = await api.put(
        `/api/v3/workflow/${workflow._id}/step4/module/${editingMloModuleId}/mlo/${editingMlo.id}`,
        updates
      );
      console.log('Save response:', response.data);

      setEditingMlo(null);
      setEditingMloModuleId('');
      setEditingMloModuleCode('');
      await onRefresh();
    } catch (err: any) {
      console.error('Failed to save MLO:', err);
      setError(err.response?.data?.error || err.message || 'Failed to save changes');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Handle canceling edits
  const handleCancelModuleEdit = () => {
    setEditingModule(null);
  };

  const handleCancelMloEdit = () => {
    setEditingMlo(null);
    setEditingMloModuleId('');
    setEditingMloModuleCode('');
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
      {isCurrentlyGenerating && !hasStep4Data && (
        <div className="mb-6 bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 border-[3px] border-green-500 border-t-transparent rounded-full animate-spin" />
            <div>
              <h3 className="text-lg font-semibold text-teal-800">
                Generating Course Framework...
              </h3>
              <p className="text-sm text-teal-600">
                This may take 90 seconds. You can navigate away and come back.
              </p>
            </div>
          </div>
          <GenerationProgressBar
            workflowId={workflow._id}
            step={4}
            queueStatus={stepStatus?.status}
          />
        </div>
      )}

      {!hasStep4Data && !isCurrentlyGenerating ? (
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
            <p className="text-sm text-teal-700 mb-4">
              The AI will organize your program into{' '}
              <strong className="text-green-300">6-8 modules</strong> with clear sequencing, precise
              hours allocation, and specific Module Learning Outcomes (MLOs) that build toward your
              Program Learning Outcomes.
            </p>

            {/* Key Points */}
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="bg-white rounded-lg p-3">
                <p className="text-teal-600 font-medium mb-2">Module Count</p>
                <p className="text-teal-800">6-8 modules using 15-hour guideline</p>
                <p className="text-xs text-teal-500 mt-1">Hours are distributed proportionally</p>
              </div>
              <div className="bg-white rounded-lg p-3">
                <p className="text-teal-600 font-medium mb-2">Hours Breakdown</p>
                <p className="text-teal-800">
                  {contactPercent}% Contact / {100 - contactPercent}% Independent
                </p>
                <p className="text-xs text-teal-500 mt-1">Based on your Step 1 settings</p>
              </div>
              <div className="bg-white rounded-lg p-3">
                <p className="text-teal-600 font-medium mb-2">Progressive Complexity</p>
                <ul className="text-xs text-teal-600 space-y-1">
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
              <div className="bg-white rounded-lg p-3">
                <p className="text-teal-600 font-medium mb-2">Hours Integrity</p>
                <p className="text-teal-800">Σ module hours = program hours</p>
                <p className="text-xs text-red-400 mt-1">No tolerance - must match exactly</p>
              </div>
            </div>
          </div>

          {/* Program Summary from previous steps */}
          <div className="bg-teal-50/50 rounded-lg p-4 border border-teal-200">
            <h4 className="text-sm font-medium text-teal-600 mb-3">From Previous Steps</h4>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-teal-800">
                  {(workflow.step1 as any)?.creditCalculation?.totalHours ||
                    (workflow.step1 as any)?.totalHours ||
                    120}
                  h
                </p>
                <p className="text-xs text-teal-500">Total Program Hours</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-400">
                  {workflow.step3?.outcomes?.length || 0}
                </p>
                <p className="text-xs text-teal-500">PLOs to Address</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-cyan-400">
                  {(workflow.step1 as any)?.deliveryMode || 'Hybrid'}
                </p>
                <p className="text-xs text-teal-500">Delivery Mode</p>
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
            className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-teal-800 font-medium rounded-lg transition-all disabled:opacity-50"
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
            <div className="bg-white rounded-xl p-4 border border-teal-200 text-center">
              <p className="text-3xl font-bold text-teal-800">
                {workflow.step4?.modules?.length || 0}
              </p>
              <p className="text-xs text-teal-500 mt-1">Modules</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-teal-200 text-center">
              <p className="text-3xl font-bold text-cyan-400">{totalModuleHours}h</p>
              <p className="text-xs text-teal-500 mt-1">Total Hours</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-teal-200 text-center">
              <p className="text-3xl font-bold text-emerald-400">{totalModuleContactHours}h</p>
              <p className="text-xs text-teal-500 mt-1">Contact Hours</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-teal-200 text-center">
              <p className="text-3xl font-bold text-purple-400">{totalMLOs}</p>
              <p className="text-xs text-teal-500 mt-1">Total MLOs</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-teal-200 text-center">
              <p
                className={`text-3xl font-bold ${workflow.step4?.hoursIntegrity ? 'text-emerald-400' : 'text-red-400'}`}
              >
                {workflow.step4?.hoursIntegrity ? '✓' : '✗'}
              </p>
              <p className="text-xs text-teal-500 mt-1">Hours Integrity</p>
            </div>
          </div>

          {/* Hours Integrity Warning */}
          {!workflow.step4?.hoursIntegrity && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-400 font-medium">⚠ Hours Integrity Failed</p>
              <p className="text-sm text-teal-600 mt-1">
                Module hours ({totalModuleHours}h) do not match program hours (
                {workflow.step4?.totalProgramHours}h). Approval is blocked until this is resolved.
              </p>
            </div>
          )}

          {/* Validation Report */}
          {validation && (
            <div className="bg-teal-50/50 rounded-lg p-4 border border-teal-200">
              <h4 className="text-sm font-medium text-teal-600 mb-3">Validation Report</h4>
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
            <div className="bg-teal-50/50 rounded-lg p-4 border border-teal-200">
              <h4 className="text-sm font-medium text-teal-600 mb-3">Progressive Complexity</h4>
              <div className="flex gap-4">
                <div
                  className={`flex-1 p-3 rounded-lg border ${progressiveComplexity.earlyModulesValid ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-amber-500/30 bg-amber-500/10'}`}
                >
                  <p className="text-amber-400 font-medium text-sm">Early (1-2)</p>
                  <p className="text-xs text-teal-600 mt-1">≥60% at Understand/Apply</p>
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
                  <p className="text-xs text-teal-600 mt-1">Balanced Apply/Analyze</p>
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
                  <p className="text-xs text-teal-600 mt-1">≥30% at Analyze/Evaluate/Create</p>
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
            <h3 className="text-lg font-semibold text-teal-800 mb-4">
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
                  onEditModule={handleEditModule}
                  onEditMlo={handleEditMlo}
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
              disabled={submitStep4.isPending}
              className="px-4 py-2 text-teal-600 hover:text-teal-600 transition-colors"
            >
              Regenerate
            </button>
            <div className="flex gap-3">
              {!isApproved && (
                <button
                  onClick={handleApprove}
                  disabled={approveStep4.isPending || !workflow.step4?.hoursIntegrity}
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-teal-800 font-medium rounded-lg transition-all disabled:opacity-50"
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

      {/* Module Edit Modal */}
      {editingModule && (
        <ModuleEditModal
          module={editingModule}
          onSave={handleSaveModule}
          onCancel={handleCancelModuleEdit}
          isSaving={isSavingEdit}
        />
      )}

      {/* MLO Edit Modal */}
      {editingMlo && (
        <MLOEditModal
          mlo={editingMlo}
          moduleCode={editingMloModuleCode}
          onSave={handleSaveMlo}
          onCancel={handleCancelMloEdit}
          isSaving={isSavingEdit}
        />
      )}
    </div>
  );
}
