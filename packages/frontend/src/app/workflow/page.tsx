'use client';

import { useEffect, useRef, useState } from 'react';
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
  ChevronDown,
  X,
  Search,
  Layers,
  Sparkles,
  Rocket,
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
  const [assignDropdownOpen, setAssignDropdownOpen] = useState(false);
  const assignDropdownRef = useRef<HTMLDivElement>(null);

  // Toolbar state — search + status filter chips
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'in_progress' | 'completed' | 'published'
  >('all');

  // Close the assign dropdown when clicking anywhere outside it.
  useEffect(() => {
    if (!assignDropdownOpen) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (assignDropdownRef.current && !assignDropdownRef.current.contains(e.target as Node)) {
        setAssignDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [assignDropdownOpen]);

  // Reset dropdown state whenever the modal opens or closes.
  useEffect(() => {
    if (!assignModal.show) {
      setAssignDropdownOpen(false);
      setAssignTargetId('');
    }
  }, [assignModal.show]);

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

  // Classify workflows into mutually-exclusive buckets so the filter chip
  // counts add up to the total — the previous logic let a single workflow
  // count in both "In Progress" and "Completed".
  const classify = (w: CurriculumWorkflow): 'in_progress' | 'completed' | 'published' => {
    if (w.status === 'published') return 'published';
    if (w.status.includes('complete') || w.status === 'review_pending') return 'completed';
    return 'in_progress';
  };

  const totalWorkflows = workflows?.length || 0;
  const inProgress = workflows?.filter((w) => classify(w) === 'in_progress').length || 0;
  const completed = workflows?.filter((w) => classify(w) === 'completed').length || 0;
  const published = workflows?.filter((w) => classify(w) === 'published').length || 0;

  // Apply search + filter to derive the visible list
  const visibleWorkflows = (workflows || []).filter((w) => {
    if (statusFilter !== 'all' && classify(w) !== statusFilter) return false;
    const q = searchQuery.trim().toLowerCase();
    if (q && !w.projectName.toLowerCase().includes(q)) return false;
    return true;
  });

  const filterChips = [
    { key: 'all' as const, label: 'All', count: totalWorkflows, icon: Layers },
    { key: 'in_progress' as const, label: 'In progress', count: inProgress, icon: Clock },
    { key: 'completed' as const, label: 'Completed', count: completed, icon: CheckCircle2 },
    { key: 'published' as const, label: 'Published', count: published, icon: Rocket },
  ];

  const statCards = [
    {
      label: 'Total',
      value: totalWorkflows,
      icon: Layers,
      tint: 'rgba(15,118,110,0.10)',
      iconColor: 'rgb(15 118 110)',
    },
    {
      label: 'In progress',
      value: inProgress,
      icon: Clock,
      tint: 'rgba(234,179,8,0.12)',
      iconColor: 'rgb(180 83 9)',
    },
    {
      label: 'Completed',
      value: completed,
      icon: CheckCircle2,
      tint: 'rgba(22,163,74,0.12)',
      iconColor: 'rgb(21 128 61)',
    },
    {
      label: 'Published',
      value: published,
      icon: Rocket,
      tint: 'rgba(124,58,237,0.12)',
      iconColor: 'rgb(109 40 217)',
    },
  ];

  return (
    <div className="min-h-screen gradient-mesh">
      {/* Header — glass strip with brand mark + actions */}
      <header className="sticky top-0 z-30 glass border-b border-border/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="hidden sm:flex h-9 w-9 items-center justify-center rounded-xl shrink-0"
              style={{
                background: 'linear-gradient(135deg, rgb(15 118 110) 0%, rgb(124 58 237) 100%)',
              }}
            >
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-lg sm:text-xl font-medium text-foreground tracking-tight truncate">
                Curriculum Workflows
              </h1>
              <p className="text-[11px] sm:text-xs text-foreground-muted mt-0.5 truncate">
                13-Step AI-Integrated Generation
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => router.push('/dashboard')}
              className="btn-secondary px-3 py-2 text-sm rounded-lg inline-flex items-center gap-2"
            >
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary px-4 py-2 text-sm rounded-lg inline-flex items-center gap-2 shadow-glow-sm"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Curriculum</span>
              <span className="sm:hidden">New</span>
            </button>
            <UserMenu />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Stats — gradient-tinted cards */}
        <motion.div
          className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {statCards.map((s) => (
            <div
              key={s.label}
              className="relative overflow-hidden card p-4 sm:p-5 hover:shadow-card-hover transition-shadow"
            >
              <div
                aria-hidden
                className="absolute -top-12 -right-12 w-32 h-32 rounded-full pointer-events-none"
                style={{ background: `radial-gradient(circle, ${s.tint} 0%, transparent 70%)` }}
              />
              <div className="relative flex items-start justify-between">
                <div>
                  <p className="text-[11px] tracking-[0.12em] uppercase font-medium text-foreground-muted">
                    {s.label}
                  </p>
                  <p className="font-display text-3xl sm:text-4xl font-medium text-foreground mt-1 tracking-tight tabular-nums">
                    {s.value}
                  </p>
                </div>
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: s.tint }}
                >
                  <s.icon className="w-4 h-4" style={{ color: s.iconColor }} />
                </div>
              </div>
            </div>
          ))}
        </motion.div>

        {/* Toolbar — search + filter chips */}
        <div className="flex flex-col lg:flex-row gap-3 mb-6">
          {/* Search */}
          <div className="relative flex-1 lg:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search programmes by name…"
              className="w-full pl-10 pr-9 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-foreground-muted/60 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-background-secondary text-foreground-muted hover:text-foreground transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter chips */}
          <div className="flex gap-2 flex-wrap">
            {filterChips.map((f) => {
              const Icon = f.icon;
              const active = statusFilter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all',
                    active
                      ? 'bg-foreground text-background shadow-sm'
                      : 'bg-card border border-border text-foreground-muted hover:text-foreground hover:border-foreground/20'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {f.label}
                  <span
                    className={cn(
                      'inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-[10px] font-semibold tabular-nums',
                      active
                        ? 'bg-background/20 text-background'
                        : 'bg-background-secondary text-foreground-muted'
                    )}
                  >
                    {f.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Workflow Grid */}
        {workflows && workflows.length > 0 && visibleWorkflows.length > 0 ? (
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            initial="hidden"
            animate="visible"
            variants={{
              visible: { transition: { staggerChildren: 0.05 } },
            }}
          >
            {visibleWorkflows.map((workflow) => {
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
        ) : workflows && workflows.length > 0 ? (
          /* Filter / search returned nothing */
          <div className="text-center py-20">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-background-secondary flex items-center justify-center">
              <Search className="w-6 h-6 text-foreground-muted" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-1.5">No matches</h3>
            <p className="text-sm text-foreground-muted mb-5 max-w-sm mx-auto">
              {searchQuery
                ? `Nothing matches "${searchQuery}"${statusFilter !== 'all' ? ' with that status' : ''}.`
                : 'No programmes in this status yet.'}
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
              }}
              className="btn-secondary px-4 py-2 text-sm rounded-lg inline-flex items-center gap-2"
            >
              Clear filters
            </button>
          </div>
        ) : (
          /* No workflows exist at all */
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
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
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
              <div ref={assignDropdownRef} className="relative mb-5">
                <button
                  type="button"
                  onClick={() => {
                    if (assigning || facultyOptions.length === 0) return;
                    setAssignDropdownOpen((o) => !o);
                  }}
                  disabled={assigning || facultyOptions.length === 0}
                  className="w-full flex items-center justify-between px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground hover:border-primary/60 focus:outline-none focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  <span className={cn('truncate', !assignTargetId && 'text-foreground-muted')}>
                    {facultyOptions.length === 0
                      ? 'No faculty invited yet — go to Faculty management first'
                      : assignTargetId
                        ? facultyOptions.find((f) => f.id === assignTargetId)?.email ||
                          'Choose a faculty member…'
                        : 'Choose a faculty member…'}
                  </span>
                  <ChevronDown
                    className={cn(
                      'w-4 h-4 text-foreground-muted transition-transform',
                      assignDropdownOpen && 'rotate-180'
                    )}
                  />
                </button>
                <AnimatePresence>
                  {assignDropdownOpen && facultyOptions.length > 0 && (
                    <motion.ul
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.12 }}
                      className="absolute z-20 mt-1 left-0 right-0 max-h-56 overflow-auto bg-background border border-border rounded-lg shadow-modal py-1"
                    >
                      {facultyOptions.map((f) => (
                        <li key={f.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setAssignTargetId(f.id);
                              setAssignDropdownOpen(false);
                            }}
                            className={cn(
                              'w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors truncate',
                              assignTargetId === f.id && 'bg-accent text-primary'
                            )}
                          >
                            {f.email}
                          </button>
                        </li>
                      ))}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </div>

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
