'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkflows, useCreateWorkflow, useDeleteWorkflow } from '@/hooks/useWorkflow';
import { CurriculumWorkflow, WorkflowStep, STEP_NAMES, WorkflowStatus } from '@/types/workflow';

// Status badge colors
const STATUS_COLORS: Record<string, string> = {
  step1_pending: 'bg-amber-100 text-amber-800',
  step1_complete: 'bg-blue-100 text-blue-800',
  step2_pending: 'bg-amber-100 text-amber-800',
  step2_complete: 'bg-blue-100 text-blue-800',
  step3_pending: 'bg-amber-100 text-amber-800',
  step3_complete: 'bg-blue-100 text-blue-800',
  step4_pending: 'bg-amber-100 text-amber-800',
  step4_complete: 'bg-blue-100 text-blue-800',
  step5_pending: 'bg-amber-100 text-amber-800',
  step5_complete: 'bg-blue-100 text-blue-800',
  step6_pending: 'bg-amber-100 text-amber-800',
  step6_complete: 'bg-blue-100 text-blue-800',
  step7_pending: 'bg-amber-100 text-amber-800',
  step7_complete: 'bg-blue-100 text-blue-800',
  step8_pending: 'bg-amber-100 text-amber-800',
  step8_complete: 'bg-blue-100 text-blue-800',
  step9_pending: 'bg-amber-100 text-amber-800',
  step9_complete: 'bg-emerald-100 text-emerald-800',
  review_pending: 'bg-purple-100 text-purple-800',
  published: 'bg-green-100 text-green-800',
};

function formatStatus(status: WorkflowStatus): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

function getProgressPercent(workflow: CurriculumWorkflow): number {
  const completedSteps = workflow.stepProgress.filter(
    (p) => p.status === 'completed' || p.status === 'approved'
  ).length;
  return Math.round((completedSteps / 9) * 100);
}

export default function WorkflowListPage() {
  const router = useRouter();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    show: boolean;
    workflow?: CurriculumWorkflow;
  }>({ show: false });

  const { data: workflows, isLoading, error } = useWorkflows();
  const createWorkflow = useCreateWorkflow();
  const deleteWorkflow = useDeleteWorkflow();

  const handleCreateWorkflow = async () => {
    if (!newProjectName.trim()) return;

    try {
      const workflow = await createWorkflow.mutateAsync(newProjectName);
      setShowCreateModal(false);
      setNewProjectName('');
      router.push(`/workflow/${workflow._id}`);
    } catch (err) {
      console.error('Failed to create workflow:', err);
    }
  };

  const handleDeleteWorkflow = async () => {
    if (!deleteConfirmModal.workflow) return;

    try {
      await deleteWorkflow.mutateAsync(deleteConfirmModal.workflow._id);
      setDeleteConfirmModal({ show: false });
    } catch (err) {
      console.error('Failed to delete workflow:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-300">Loading workflows...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center text-red-400">
          <p>Failed to load workflows</p>
          <p className="text-sm mt-2">{(error as Error).message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700/50 backdrop-blur-sm bg-slate-900/50 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              Curriculum Workflows
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              9-Step AI-Integrated Curriculum Generation
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/workflow/admin')}
              className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-all flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              Dashboard
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium rounded-lg transition-all shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40"
            >
              + New Curriculum
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <p className="text-slate-400 text-sm">Total Workflows</p>
            <p className="text-3xl font-bold text-white mt-1">{workflows?.length || 0}</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <p className="text-slate-400 text-sm">In Progress</p>
            <p className="text-3xl font-bold text-amber-400 mt-1">
              {workflows?.filter((w) => !w.status.includes('published')).length || 0}
            </p>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <p className="text-slate-400 text-sm">Completed</p>
            <p className="text-3xl font-bold text-emerald-400 mt-1">
              {workflows?.filter(
                (w) => w.status === 'step9_complete' || w.status === 'review_pending'
              ).length || 0}
            </p>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <p className="text-slate-400 text-sm">Published</p>
            <p className="text-3xl font-bold text-green-400 mt-1">
              {workflows?.filter((w) => w.status === 'published').length || 0}
            </p>
          </div>
        </div>

        {/* Workflows Grid */}
        {workflows && workflows.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workflows.map((workflow) => (
              <div
                key={workflow._id}
                className="bg-slate-800/50 rounded-xl border border-slate-700/50 hover:border-cyan-500/50 transition-all group overflow-hidden relative"
              >
                {/* Delete button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteConfirmModal({ show: true, workflow });
                  }}
                  className="absolute top-3 right-3 z-10 p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete workflow"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>

                <div
                  onClick={() => router.push(`/workflow/${workflow._id}`)}
                  className="cursor-pointer"
                >
                  {/* Progress bar at top */}
                  <div className="h-1 bg-slate-700">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all"
                      style={{ width: `${getProgressPercent(workflow)}%` }}
                    />
                  </div>

                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-semibold text-white group-hover:text-cyan-400 transition-colors pr-8">
                        {workflow.projectName}
                      </h3>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          STATUS_COLORS[workflow.status] || 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        {formatStatus(workflow.status)}
                      </span>
                    </div>

                    {/* Current Step */}
                    <div className="mb-4">
                      <p className="text-slate-400 text-sm">Current Step</p>
                      <p className="text-cyan-400 font-medium">
                        {workflow.currentStep}. {STEP_NAMES[workflow.currentStep as WorkflowStep]}
                      </p>
                    </div>

                    {/* Progress */}
                    <div className="mb-4">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-400">Progress</span>
                        <span className="text-white">{getProgressPercent(workflow)}%</span>
                      </div>
                      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all"
                          style={{ width: `${getProgressPercent(workflow)}%` }}
                        />
                      </div>
                    </div>

                    {/* Step indicators */}
                    <div className="flex gap-1 mb-4">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((step) => {
                        const stepProgress = workflow.stepProgress.find((p) => p.step === step);
                        const isComplete =
                          stepProgress?.status === 'completed' ||
                          stepProgress?.status === 'approved';
                        const isCurrent = workflow.currentStep === step;

                        return (
                          <div
                            key={step}
                            className={`h-2 flex-1 rounded-full ${
                              isComplete
                                ? 'bg-emerald-500'
                                : isCurrent
                                  ? 'bg-cyan-500'
                                  : 'bg-slate-700'
                            }`}
                          />
                        );
                      })}
                    </div>

                    {/* Metadata */}
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Created {new Date(workflow.createdAt).toLocaleDateString()}</span>
                      <span>Updated {new Date(workflow.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-slate-800/50 flex items-center justify-center">
              <svg
                className="w-12 h-12 text-slate-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">No workflows yet</h3>
            <p className="text-slate-400 mb-6">
              Create your first curriculum workflow to get started
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium rounded-lg transition-all"
            >
              + Create Your First Curriculum
            </button>
          </div>
        )}
      </main>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-md border border-slate-700 shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-4">Create New Curriculum</h2>
            <p className="text-slate-400 text-sm mb-6">
              Start a new 9-step curriculum generation workflow
            </p>

            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-300 mb-2">Project Name</label>
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="e.g., Data Science Certificate 2024"
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewProjectName('');
                }}
                className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateWorkflow}
                disabled={!newProjectName.trim() || createWorkflow.isPending}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createWorkflow.isPending ? 'Creating...' : 'Create Workflow'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmModal.show && deleteConfirmModal.workflow && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-md border border-slate-700 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-red-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white">Delete Curriculum?</h2>
            </div>

            <p className="text-slate-300 mb-2">
              Are you sure you want to delete{' '}
              <span className="font-semibold text-white">
                "{deleteConfirmModal.workflow.projectName}"
              </span>
              ?
            </p>
            <p className="text-slate-400 text-sm mb-6">
              This action cannot be undone. All workflow data, including all 9 steps, will be
              permanently deleted from the database.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmModal({ show: false })}
                disabled={deleteWorkflow.isPending}
                className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteWorkflow}
                disabled={deleteWorkflow.isPending}
                className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleteWorkflow.isPending ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
