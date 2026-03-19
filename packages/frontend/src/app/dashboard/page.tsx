'use client';

import { useEffect, useState } from 'react';
import {
  TrendingUp,
  DollarSign,
  FileText,
  Users,
  CheckCircle,
  Clock,
  Database,
  Activity,
  ArrowUpRight,
  RefreshCw,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface DashboardMetrics {
  overview: {
    totalProjects: number;
    totalPrograms: number;
    successRate: number;
    avgGenerationTime: number | null;
    totalKBSources: number;
    activeUsers: number;
    totalUsers: number;
    publishedCurricula: number;
  };
  llmMetrics: {
    totalCost: number;
    totalTokens: number;
    avgResponseTime: number;
    cacheHitRate: number;
  };
  recentActivity: Array<{
    date: string;
    projectsCreated: number;
  }>;
}

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
};

const staggerItem = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/analytics/dashboard`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch metrics: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success && data.data) {
        setMetrics(data.data);
        setLastUpdated(new Date());
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      console.error('Error fetching dashboard metrics:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !metrics) {
    return (
      <div className="min-h-screen gradient-mesh flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
          <p className="text-sm text-foreground-muted">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error && !metrics) {
    return (
      <div className="min-h-screen gradient-mesh flex items-center justify-center">
        <div className="card p-8 max-w-md text-center">
          <div className="w-12 h-12 rounded-full bg-error-muted flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6 text-error" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Error Loading Dashboard</h3>
          <p className="text-sm text-foreground-muted mb-4">{error}</p>
          <button onClick={fetchMetrics} className="btn-primary px-5 py-2 text-sm rounded-lg">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-mesh p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Dashboard</h1>
            {lastUpdated && (
              <p className="text-xs text-foreground-muted mt-0.5">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </p>
            )}
          </div>
          <button
            onClick={fetchMetrics}
            disabled={loading}
            className="btn-secondary px-4 py-2 text-sm rounded-lg inline-flex items-center gap-2 self-start"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {/* Main Metrics Bento Grid */}
        <motion.div
          className="grid grid-cols-2 lg:grid-cols-4 gap-3"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={staggerItem}>
            <MetricCard
              title="Total Projects"
              value={metrics?.overview.totalProjects || 0}
              icon={<FileText className="w-5 h-5" />}
              color="primary"
            />
          </motion.div>
          <motion.div variants={staggerItem}>
            <MetricCard
              title="Published"
              value={metrics?.overview.publishedCurricula || 0}
              icon={<CheckCircle className="w-5 h-5" />}
              color="success"
            />
          </motion.div>
          <motion.div variants={staggerItem}>
            <MetricCard
              title="Active Users"
              value={`${metrics?.overview.activeUsers || 0}/${metrics?.overview.totalUsers || 0}`}
              icon={<Users className="w-5 h-5" />}
              color="accent"
            />
          </motion.div>
          <motion.div variants={staggerItem}>
            <MetricCard
              title="Success Rate"
              value={`${metrics?.overview.successRate.toFixed(1) || 0}%`}
              icon={<TrendingUp className="w-5 h-5" />}
              color="primary"
            />
          </motion.div>
        </motion.div>

        {/* AI Usage Section */}
        <motion.div
          className="card p-5 sm:p-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h2 className="text-base font-semibold text-foreground mb-5">AI Usage</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <AIMetric
              icon={<DollarSign className="w-5 h-5 text-warning" />}
              label="API Cost"
              value={`$${metrics?.llmMetrics.totalCost.toFixed(2) || '0.00'}`}
              sub="Last 30 days"
            />
            <AIMetric
              icon={<Database className="w-5 h-5 text-primary" />}
              label="Tokens Used"
              value={(metrics?.llmMetrics.totalTokens || 0).toLocaleString()}
              sub="Last 30 days"
            />
            <AIMetric
              icon={<Clock className="w-5 h-5 text-accent" />}
              label="Avg Response"
              value={`${metrics?.llmMetrics.avgResponseTime.toFixed(0) || 0}ms`}
              sub="Last hour"
            />
            <AIMetric
              icon={<Activity className="w-5 h-5 text-success" />}
              label="Cache Hit Rate"
              value={`${((metrics?.llmMetrics?.cacheHitRate ?? 0) * 100).toFixed(1)}%`}
              sub="Last hour"
            />
          </div>
        </motion.div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Generation Performance */}
          <motion.div
            className="card p-5 sm:p-6"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <h3 className="text-base font-semibold text-foreground mb-4">Generation Performance</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground-muted">Avg. Generation Time</span>
                <span className="text-lg font-semibold text-foreground tabular-nums">
                  {metrics?.overview.avgGenerationTime
                    ? `${metrics.overview.avgGenerationTime.toFixed(1)}m`
                    : 'N/A'}
                </span>
              </div>
              <div className="h-px bg-border-subtle" />
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground-muted">Knowledge Base Sources</span>
                <span className="text-lg font-semibold text-foreground tabular-nums">
                  {metrics?.overview.totalKBSources || 0}
                </span>
              </div>
            </div>
          </motion.div>

          {/* Recent Activity */}
          <motion.div
            className="card p-5 sm:p-6"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <h3 className="text-base font-semibold text-foreground mb-4">
              Recent Activity (7 Days)
            </h3>
            <div className="space-y-0">
              {metrics?.recentActivity.slice(0, 5).map((activity, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between py-2.5 border-b border-border-subtle last:border-0"
                >
                  <span className="text-sm text-foreground-muted">
                    {new Date(activity.date).toLocaleDateString()}
                  </span>
                  <span className="text-sm font-medium text-foreground tabular-nums">
                    {activity.projectsCreated}{' '}
                    {activity.projectsCreated === 1 ? 'project' : 'projects'}
                  </span>
                </div>
              ))}
              {(!metrics?.recentActivity || metrics.recentActivity.length === 0) && (
                <p className="text-sm text-foreground-muted text-center py-8">No recent activity</p>
              )}
            </div>
          </motion.div>
        </div>

        {/* Recent Curricula */}
        <RecentCurricula />
      </div>
    </div>
  );
}

function RecentCurricula() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/v2/projects/published?limit=10`
        );
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) setProjects(data.data);
        }
      } catch (error) {
        console.error('Error fetching recent curricula:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, []);

  return (
    <motion.div
      className="card p-5 sm:p-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-foreground">Recently Published</h3>
        <a
          href="/projects"
          className="text-xs font-medium text-primary hover:text-primary-hover transition-colors inline-flex items-center gap-1"
        >
          View all
          <ArrowUpRight className="w-3 h-3" />
        </a>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-4 flex-1 skeleton" />
              <div className="h-4 w-20 skeleton" />
              <div className="h-5 w-16 skeleton rounded-full" />
            </div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-10">
          <FileText className="w-10 h-10 text-foreground-muted/30 mx-auto mb-2" />
          <p className="text-sm text-foreground-muted">No published curricula yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full min-w-[500px]">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="text-left text-[11px] font-medium text-foreground-muted uppercase tracking-wider pb-3 px-1">
                  Project
                </th>
                <th className="text-left text-[11px] font-medium text-foreground-muted uppercase tracking-wider pb-3 px-1">
                  Code
                </th>
                <th className="text-left text-[11px] font-medium text-foreground-muted uppercase tracking-wider pb-3 px-1">
                  Status
                </th>
                <th className="text-left text-[11px] font-medium text-foreground-muted uppercase tracking-wider pb-3 px-1">
                  Published
                </th>
                <th className="text-right text-[11px] font-medium text-foreground-muted uppercase tracking-wider pb-3 px-1">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr
                  key={project._id}
                  className="border-b border-border-subtle last:border-0 hover:bg-background-secondary/50 transition-colors"
                >
                  <td className="py-3 px-1">
                    <span className="text-sm font-medium text-foreground">
                      {project.projectName}
                    </span>
                  </td>
                  <td className="py-3 px-1">
                    <span className="text-sm text-foreground-muted font-mono">
                      {project.courseCode}
                    </span>
                  </td>
                  <td className="py-3 px-1">
                    <span className="badge badge-success">{project.status}</span>
                  </td>
                  <td className="py-3 px-1 text-sm text-foreground-muted tabular-nums">
                    {project.stageProgress?.stage5?.publishedAt
                      ? new Date(project.stageProgress.stage5.publishedAt).toLocaleDateString()
                      : 'N/A'}
                  </td>
                  <td className="py-3 px-1 text-right">
                    <a
                      href={`/projects/${project._id}`}
                      className="text-sm text-primary hover:text-primary-hover font-medium transition-colors"
                    >
                      View
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  );
}

function MetricCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: 'primary' | 'success' | 'accent' | 'warning';
}) {
  const colorMap = {
    primary: { bg: 'bg-primary/10', text: 'text-primary' },
    success: { bg: 'bg-success/10', text: 'text-success' },
    accent: { bg: 'bg-accent/10', text: 'text-accent' },
    warning: { bg: 'bg-warning/10', text: 'text-warning' },
  };

  const c = colorMap[color];

  return (
    <div className="card p-5 group hover:shadow-card-hover transition-all">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-foreground-muted">{title}</p>
          <p className="text-2xl font-bold text-foreground mt-1.5 tabular-nums">{value}</p>
        </div>
        <div
          className={cn('p-2.5 rounded-xl transition-colors', c.bg, c.text, `group-hover:${c.bg}`)}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function AIMetric({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="p-2 rounded-lg bg-background-secondary flex-shrink-0">{icon}</div>
      <div>
        <p className="text-xs text-foreground-muted">{label}</p>
        <p className="text-lg font-semibold text-foreground tabular-nums">{value}</p>
        <p className="text-[11px] text-foreground-muted/70">{sub}</p>
      </div>
    </div>
  );
}
