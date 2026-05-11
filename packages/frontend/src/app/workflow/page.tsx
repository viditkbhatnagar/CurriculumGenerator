'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkflows, useCreateWorkflow, useDeleteWorkflow } from '@/hooks/useWorkflow';
import { CurriculumWorkflow, WorkflowStep, STEP_NAMES, WorkflowStatus } from '@/types/workflow';
import {
  Plus,
  Trash2,
  BarChart3,
  FolderOpen,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Loader2,
  UserPlus,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import UserMenu from '@/components/auth/UserMenu';
import { useAuth } from '@/components/auth/AuthContext';
import { api } from '@/lib/api';
import { toast } from '@/stores/toastStore';

function formatStatus(status: WorkflowStatus): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

function getProgressPercent(workflow: CurriculumWorkflow): number {
  const totalSteps = 11;
  const completedSteps = workflow.stepProgress.filter(
    (p) => p.status === 'completed' || p.status === 'approved'
  ).length;
  return Math.min(Math.round((completedSteps / totalSteps) * 100), 100);
}

function getStatusBadge(status: string) {
  if (status.includes('complete') || status === 'published') {
    return { className: 'badge-success', icon: CheckCircle2 };
  }
  if (status.includes('pending') || status.includes('review')) {
    return { className: 'badge-warning', icon: Clock };
  }
  return { className: 'badge-primary', icon: Clock };
}

export default function WorkflowListPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === 'administrator';
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    show: boolean;
    workflow?: CurriculumWorkflow;
  }>({ show: false });

  // Assign-to-faculty modal state (admin only)
  const [assignModal, setAssignModal] = useState<{
    show: boolean;
    workflow?: CurriculumWorkflow;
  }>({ show: false });
  const [facultyOptions, setFacultyOptions] = useState<Array<{ id: string; email: string }>>([]);
  const [assignTargetId, setAssignTargetId] = useState<string>('');
  const [assigning, setAssigning] = useState(false);

  const { data: workflows, isLoading, error } = useWorkflows();
  const createWorkflow = useCreateWorkflow();
  const deleteWorkflow = useDeleteWorkflow();

  // Pre-load the faculty roster when an admin opens the page so the
  // assign modal can render instantly when triggered.
  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    (async () => {
      try {
        const resp = await api.get('/api/users?role=faculty&limit=200');
        if (!cancelled) {
          setFacultyOptions(
            (resp.data?.users || []).map((u: { id: string; email: string }) => ({
              id: u.id,
              email: u.email,
            }))
          );
        }
      } catch {
        // Non-fatal — admin can still type an email if the list is empty
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const handleAssign = async () => {
    if (!assignModal.workflow || !assignTargetId) return;
    setAssigning(true);
    try {
      const resp = await api.post(`/api/v3/workflow/${assignModal.workflow._id}/assign`, {
        userId: assignTargetId,
      });
      const newOwner = resp.data?.data?.newOwner;
      toast.success(
        'Workflow reassigned',
        `${assignModal.workflow.projectName} is now owned by ${newOwner?.email || 'the selected faculty'}.`
      );
      setAssignModal({ show: false });
      setAssignTargetId('');
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (err as any).response?.data?.error
          : null;
      toast.error('Reassign failed', message || 'Could not reassign workflow');
    } finally {
      setAssigning(false);
    }
  };

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

  // Loading state with skeletons
  if (isLoading) {
    return (
      <div className="min-h-screen gradient-mesh">
        <header className="sticky top-0 z-10 glass border-b border-border/30">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div>
              <div className="h-7 w-48 skeleton mb-2" />
              <div className="h-4 w-64 skeleton" />
            </div>
            <div className="h-10 w-36 skeleton rounded-xl" />
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-6 py-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="card p-5">
                <div className="h-4 w-20 skeleton mb-2" />
                <div className="h-8 w-12 skeleton" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card p-5">
                <div className="h-5 w-3/4 skeleton mb-4" />
                <div className="h-3 w-full skeleton mb-2" />
                <div className="h-3 w-2/3 skeleton" />
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen gradient-mesh flex items-center justify-center">
        <div className="card p-8 max-w-md text-center">
          <div className="w-12 h-12 rounded-full bg-error-muted flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6 text-error" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Failed to load workflows</h3>
          <p className="text-sm text-foreground-muted">{(error as Error).message}</p>
        </div>
      </div>
    );
  }

  const totalWorkflows = workflows?.length || 0;
  const inProgress = workflows?.filter((w) => !w.status.includes('published')).length || 0;
  const completed =
    workflows?.filter((w) => w.status === 'step9_complete' || w.status === 'review_pending')
      .length || 0;
  const published = workflows?.filter((w) => w.status === 'published').length || 0;

  return (
    <div className="min-h-screen gradient-mesh">
      {/* Header */}
      <header className="sticky top-0 z-10 glass border-b border-border/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
              Curriculum Workflows
            </h1>
            <p className="text-sm text-foreground-muted mt-0.5">11-Step AI-Integrated Generation</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push('/dashboard')}
              className="btn-secondary px-3 py-2 text-sm rounded-lg inline-flex items-center gap-2"
            >
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary px-4 py-2 text-sm rounded-lg inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New Curriculum
            </button>
            <UserMenu />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            { label: 'Total', value: totalWorkflows, color: 'text-foreground' },
            { label: 'In Progress', value: inProgress, color: 'text-warning' },
            { label: 'Completed', value: completed, color: 'text-success' },
            { label: 'Published', value: published, color: 'text-primary' },
          ].map((stat) => (
            <div key={stat.label} className="card p-4">
              <p className="text-xs text-foreground-muted font-medium">{stat.label}</p>
              <p className={cn('text-2xl font-bold mt-1', stat.color)}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Workflow Grid */}
        {workflows && workflows.length > 0 ? (
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            initial="hidden"
            animate="visible"
            variants={{
              visible: { transition: { staggerChildren: 0.05 } },
            }}
          >
            {workflows.map((workflow) => {
              const progress = getProgressPercent(workflow);
              const badge = getStatusBadge(workflow.status);
              const BadgeIcon = badge.icon;

              return (
                <motion.div
                  key={workflow._id}
                  variants={{
                    hidden: { opacity: 0, y: 12 },
                    visible: { opacity: 1, y: 0 },
                  }}
                  className="card-interactive group relative overflow-hidden"
                >
                  {/* Progress bar accent at top */}
                  <div className="h-0.5 bg-border-subtle">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  {/* Admin-only: assign workflow to a faculty member */}
                  {isAdmin && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setAssignModal({ show: true, workflow });
                        setAssignTargetId('');
                      }}
                      className="absolute top-3 right-11 z-10 p-1.5 rounded-md bg-teal-50 text-teal-700 opacity-0 group-hover:opacity-100 hover:bg-teal-100 transition-all"
                      title="Assign to faculty"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Delete button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirmModal({ show: true, workflow });
                    }}
                    className="absolute top-3 right-3 z-10 p-1.5 rounded-md bg-error-muted text-error opacity-0 group-hover:opacity-100 hover:bg-error/20 transition-all"
                    title="Delete workflow"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  <div
                    onClick={() => router.push(`/workflow/${workflow._id}`)}
                    className="cursor-pointer p-5"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors pr-8 truncate">
                        {workflow.projectName}
                      </h3>
                    </div>

                    <div className={cn('badge gap-1 mb-3', badge.className)}>
                      <BadgeIcon className="w-3 h-3" />
                      {formatStatus(workflow.status)}
                    </div>

                    {/* Current Step */}
                    <div className="mb-4">
                      <p className="text-xs text-foreground-muted mb-0.5">Current Step</p>
                      <p className="text-sm font-medium text-foreground">
                        {workflow.currentStep}. {STEP_NAMES[workflow.currentStep as WorkflowStep]}
                      </p>
                    </div>

                    {/* Progress */}
                    <div className="mb-4">
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-foreground-muted">Progress</span>
                        <span className="font-medium text-foreground">{progress}%</span>
                      </div>
                      <div className="h-1.5 bg-background-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Step indicators */}
                    <div className="flex gap-0.5 mb-4">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((step) => {
                        const stepProgress = workflow.stepProgress.find((p) => p.step === step);
                        const isComplete =
                          stepProgress?.status === 'completed' ||
                          stepProgress?.status === 'approved';
                        const isCurrent = workflow.currentStep === step;

                        return (
                          <div
                            key={step}
                            className={cn(
                              'h-1 flex-1 rounded-full transition-colors',
                              isComplete
                                ? 'bg-primary'
                                : isCurrent
                                  ? 'bg-primary/40'
                                  : 'bg-border-subtle'
                            )}
                          />
                        );
                      })}
                    </div>

                    {/* Metadata */}
                    <div className="flex items-center justify-between text-[11px] text-foreground-muted">
                      <span>Created {new Date(workflow.createdAt).toLocaleDateString()}</span>
                      <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-primary" />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        ) : (
          /* Empty State */
          <div className="text-center py-24">
            <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-primary/10 flex items-center justify-center">
              <FolderOpen className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No workflows yet</h3>
            <p className="text-sm text-foreground-muted mb-6 max-w-xs mx-auto">
              Create your first curriculum workflow to get started with AI-powered generation.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary px-6 py-2.5 text-sm rounded-xl inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Your First Curriculum
            </button>
          </div>
        )}
      </main>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-foreground/20 backdrop-blur-sm"
              onClick={() => {
                setShowCreateModal(false);
                setNewProjectName('');
              }}
            />
            <motion.div
              className="card relative p-6 w-full max-w-md shadow-modal"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewProjectName('');
                }}
                className="absolute top-4 right-4 btn-ghost p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>

              <h2 className="text-lg font-semibold text-foreground mb-1">Create New Curriculum</h2>
              <p className="text-sm text-foreground-muted mb-5">
                Start a new 11-step curriculum generation workflow
              </p>

              <div className="mb-5">
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Project Name
                </label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateWorkflow()}
                  placeholder="e.g., Data Science Certificate 2024"
                  className="input"
                  autoFocus
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewProjectName('');
                  }}
                  className="btn-secondary flex-1 py-2.5 text-sm rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateWorkflow}
                  disabled={!newProjectName.trim() || createWorkflow.isPending}
                  className="btn-primary flex-1 py-2.5 text-sm rounded-lg inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {createWorkflow.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Workflow'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmModal.show && deleteConfirmModal.workflow && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-foreground/20 backdrop-blur-sm"
              onClick={() => setDeleteConfirmModal({ show: false })}
            />
            <motion.div
              className="card relative p-6 w-full max-w-md shadow-modal"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-error-muted flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-error" />
                </div>
                <h2 className="text-lg font-semibold text-foreground">Delete Curriculum?</h2>
              </div>

              <p className="text-sm text-foreground mb-1">
                Are you sure you want to delete{' '}
                <span className="font-semibold">
                  &ldquo;{deleteConfirmModal.workflow.projectName}&rdquo;
                </span>
                ?
              </p>
              <p className="text-xs text-foreground-muted mb-5">
                This action cannot be undone. All workflow data will be permanently deleted.
              </p>

              <div className="flex gap-2">
                <button
                  onClick={() => setDeleteConfirmModal({ show: false })}
                  disabled={deleteWorkflow.isPending}
                  className="btn-secondary flex-1 py-2.5 text-sm rounded-lg disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteWorkflow}
                  disabled={deleteWorkflow.isPending}
                  className="flex-1 py-2.5 text-sm rounded-lg font-medium bg-error text-white hover:bg-error/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                >
                  {deleteWorkflow.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    'Delete Permanently'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Assign-to-Faculty Modal (admin only) */}
      <AnimatePresence>
        {assignModal.show && assignModal.workflow && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-foreground/20 backdrop-blur-sm"
              onClick={() => !assigning && setAssignModal({ show: false })}
            />
            <motion.div
              className="card relative p-6 w-full max-w-md shadow-modal"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center">
                  <UserPlus className="w-5 h-5 text-teal-700" />
                </div>
                <h2 className="text-lg font-semibold text-foreground">Assign to faculty</h2>
              </div>

              <p className="text-sm text-foreground mb-1">
                <span className="font-semibold">
                  &ldquo;{assignModal.workflow.projectName}&rdquo;
                </span>
              </p>
              <p className="text-xs text-foreground-muted mb-4">
                The selected faculty member will become the owner and see this programme on their
                Workflows page. You&rsquo;ll still see it (admins see everything).
              </p>

              <label className="block text-xs font-medium text-foreground-muted mb-1.5">
                Faculty member
              </label>
              <select
                value={assignTargetId}
                onChange={(e) => setAssignTargetId(e.target.value)}
                disabled={assigning || facultyOptions.length === 0}
                className="w-full px-3 py-2 mb-5 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary"
              >
                <option value="">
                  {facultyOptions.length === 0
                    ? 'No faculty invited yet — go to Faculty management first'
                    : 'Choose a faculty member…'}
                </option>
                {facultyOptions.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.email}
                  </option>
                ))}
              </select>

              <div className="flex gap-2">
                <button
                  onClick={() => setAssignModal({ show: false })}
                  disabled={assigning}
                  className="btn-secondary flex-1 py-2.5 text-sm rounded-lg disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssign}
                  disabled={assigning || !assignTargetId}
                  className="flex-1 py-2.5 text-sm rounded-lg font-medium bg-teal-700 text-white hover:bg-teal-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                >
                  {assigning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Assigning…
                    </>
                  ) : (
                    'Assign'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
