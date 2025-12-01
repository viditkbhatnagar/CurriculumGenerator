'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface DashboardData {
  overview: {
    totalWorkflows: number;
    completedWorkflows: number;
    inProgressWorkflows: number;
    publishedWorkflows: number;
    avgCompletionTime: number;
    thisWeekWorkflows: number;
    growthPercentage: number;
  };
  statusBreakdown: Record<string, number>;
  workflowsPerDay: Array<{ date: string; count: number }>;
  stepDistribution: Array<{ step: number; count: number }>;
  recentWorkflows: Array<{
    id: string;
    name: string;
    status: string;
    currentStep: number;
    createdAt: string;
    updatedAt: string;
  }>;
  costs: {
    totalApiCost: string;
    totalTokens: number;
    avgPerWorkflow: string;
    model: string;
    costPer1kTokens: number;
  };
}

const STEP_NAMES: Record<number, string> = {
  1: 'Program Foundation',
  2: 'KSA Framework',
  3: 'PLOs',
  4: 'Course Framework',
  5: 'Sources',
  6: 'Reading Lists',
  7: 'Assessments',
  8: 'Case Studies',
  9: 'Glossary',
};

export default function AdminDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/v3/workflow/analytics/dashboard`, {
        credentials: 'include',
      });
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-300">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center text-red-400">
          <p>{error}</p>
          <button
            onClick={() => router.push('/workflow')}
            className="mt-4 px-4 py-2 bg-slate-700 rounded-lg text-white"
          >
            Back to Workflows
          </button>
        </div>
      </div>
    );
  }

  const maxDailyCount = Math.max(...(data?.workflowsPerDay?.map((d) => d.count) || [1]));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700/50 backdrop-blur-sm bg-slate-900/50 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/workflow')}
              className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
            >
              <svg
                className="w-5 h-5 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
                📊 Admin Dashboard
              </h1>
              <p className="text-slate-400 text-sm mt-1">Workflow Analytics & Metrics</p>
            </div>
          </div>
          <button
            onClick={fetchDashboardData}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <MetricCard
            title="Total Workflows"
            value={data?.overview.totalWorkflows || 0}
            icon="📁"
            color="cyan"
          />
          <MetricCard
            title="Completed"
            value={data?.overview.completedWorkflows || 0}
            icon="✅"
            color="emerald"
          />
          <MetricCard
            title="In Progress"
            value={data?.overview.inProgressWorkflows || 0}
            icon="⏳"
            color="amber"
          />
          <MetricCard
            title="This Week"
            value={data?.overview.thisWeekWorkflows || 0}
            icon="📈"
            color="purple"
            change={data?.overview.growthPercentage}
          />
        </div>

        {/* Second Row - Larger Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <MetricCard
            title="Avg. Completion Time"
            value={`${data?.overview.avgCompletionTime || 0}m`}
            icon="⏱️"
            color="blue"
            subtitle="minutes per workflow"
          />
          <MetricCard
            title="Total API Cost"
            value={`$${parseFloat(data?.costs.totalApiCost || '0').toFixed(2)}`}
            icon="💰"
            color="green"
            subtitle={`via ${data?.costs.model || 'gpt-4-turbo'}`}
          />
          <MetricCard
            title="Total Tokens"
            value={data?.costs.totalTokens?.toLocaleString() || '0'}
            icon="🔢"
            color="cyan"
            subtitle="last 30 days"
          />
          <MetricCard
            title="Cost per Workflow"
            value={`$${parseFloat(data?.costs.avgPerWorkflow || '0').toFixed(2)}`}
            icon="📊"
            color="pink"
            subtitle="average per curriculum"
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Workflows Per Day Chart */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">
              Workflows Created (Last 30 Days)
            </h3>
            <div className="h-48 flex items-end gap-1">
              {data?.workflowsPerDay?.slice(-30).map((day, idx) => (
                <div
                  key={idx}
                  className="flex-1 bg-gradient-to-t from-cyan-500 to-blue-500 rounded-t hover:from-cyan-400 hover:to-blue-400 transition-colors relative group"
                  style={{
                    height: `${(day.count / maxDailyCount) * 100}%`,
                    minHeight: day.count > 0 ? '8px' : '2px',
                  }}
                >
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-700 rounded text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {day.date}: {day.count}
                  </div>
                </div>
              ))}
              {(!data?.workflowsPerDay || data.workflowsPerDay.length === 0) && (
                <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
                  No data available
                </div>
              )}
            </div>
            <div className="flex justify-between mt-2 text-xs text-slate-500">
              <span>30 days ago</span>
              <span>Today</span>
            </div>
          </div>

          {/* Step Distribution */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Current Step Distribution</h3>
            <div className="space-y-3">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((step) => {
                const stepData = data?.stepDistribution?.find((s) => s.step === step);
                const count = stepData?.count || 0;
                const maxCount = Math.max(...(data?.stepDistribution?.map((s) => s.count) || [1]));
                const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;

                return (
                  <div key={step} className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 w-8">S{step}</span>
                    <div className="flex-1 h-6 bg-slate-700/50 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-sm text-white w-8 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Status Breakdown & Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Status Donut */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Status Breakdown</h3>
            <div className="flex flex-col items-center">
              <div className="relative w-40 h-40">
                <svg className="w-full h-full transform -rotate-90">
                  {(() => {
                    const statuses = Object.entries(data?.statusBreakdown || {});
                    const total = statuses.reduce((sum, [, count]) => sum + count, 0);
                    let cumulativePercent = 0;
                    const colors = [
                      '#06b6d4',
                      '#10b981',
                      '#f59e0b',
                      '#8b5cf6',
                      '#ec4899',
                      '#6366f1',
                    ];

                    return statuses.map(([status, count], idx) => {
                      const percent = total > 0 ? (count / total) * 100 : 0;
                      const strokeDasharray = `${percent * 3.14} ${314 - percent * 3.14}`;
                      const strokeDashoffset = -cumulativePercent * 3.14;
                      cumulativePercent += percent;

                      return (
                        <circle
                          key={status}
                          cx="80"
                          cy="80"
                          r="60"
                          fill="none"
                          stroke={colors[idx % colors.length]}
                          strokeWidth="20"
                          strokeDasharray={strokeDasharray}
                          strokeDashoffset={strokeDashoffset}
                        />
                      );
                    });
                  })()}
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-white">
                      {data?.overview.totalWorkflows || 0}
                    </p>
                    <p className="text-xs text-slate-400">Total</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 w-full">
                {Object.entries(data?.statusBreakdown || {})
                  .slice(0, 6)
                  .map(([status, count], idx) => (
                    <div key={status} className="flex items-center gap-2 text-xs">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{
                          backgroundColor: [
                            '#06b6d4',
                            '#10b981',
                            '#f59e0b',
                            '#8b5cf6',
                            '#ec4899',
                            '#6366f1',
                          ][idx % 6],
                        }}
                      />
                      <span className="text-slate-400 truncate">{status.replace(/_/g, ' ')}</span>
                      <span className="text-white ml-auto">{count}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="lg:col-span-2 bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Recent Workflows</h3>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {data?.recentWorkflows?.map((workflow) => (
                <div
                  key={workflow.id}
                  onClick={() => router.push(`/workflow/${workflow.id}`)}
                  className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg hover:bg-slate-700/50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center text-cyan-400">
                      {workflow.currentStep}
                    </div>
                    <div>
                      <p className="font-medium text-white">{workflow.name}</p>
                      <p className="text-xs text-slate-400">
                        Step {workflow.currentStep}: {STEP_NAMES[workflow.currentStep]}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        workflow.status.includes('complete') || workflow.status === 'published'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-amber-500/20 text-amber-400'
                      }`}
                    >
                      {workflow.status.replace(/_/g, ' ')}
                    </span>
                    <p className="text-xs text-slate-500 mt-1">
                      {new Date(workflow.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
              {(!data?.recentWorkflows || data.recentWorkflows.length === 0) && (
                <p className="text-center text-slate-500 py-8">No workflows yet</p>
              )}
            </div>
          </div>
        </div>

        {/* Quick Stats Footer */}
        <div className="bg-gradient-to-r from-slate-800/50 to-slate-700/50 rounded-xl border border-slate-700/50 p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <p className="text-4xl font-bold text-cyan-400">
                {data?.overview.publishedWorkflows || 0}
              </p>
              <p className="text-sm text-slate-400 mt-1">Published Curricula</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-emerald-400">
                {data?.overview.totalWorkflows && data?.overview.completedWorkflows
                  ? Math.round(
                      (data.overview.completedWorkflows / data.overview.totalWorkflows) * 100
                    )
                  : 0}
                %
              </p>
              <p className="text-sm text-slate-400 mt-1">Completion Rate</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-purple-400">9</p>
              <p className="text-sm text-slate-400 mt-1">Workflow Steps</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-pink-400">~2h</p>
              <p className="text-sm text-slate-400 mt-1">Avg. Total Time</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: string;
  color: 'cyan' | 'emerald' | 'amber' | 'purple' | 'blue' | 'green' | 'pink';
  change?: number;
  subtitle?: string;
}

function MetricCard({ title, value, icon, color, change, subtitle }: MetricCardProps) {
  const colorClasses = {
    cyan: 'from-cyan-500/20 to-blue-500/20 text-cyan-400',
    emerald: 'from-emerald-500/20 to-green-500/20 text-emerald-400',
    amber: 'from-amber-500/20 to-orange-500/20 text-amber-400',
    purple: 'from-purple-500/20 to-pink-500/20 text-purple-400',
    blue: 'from-blue-500/20 to-indigo-500/20 text-blue-400',
    green: 'from-green-500/20 to-emerald-500/20 text-green-400',
    pink: 'from-pink-500/20 to-rose-500/20 text-pink-400',
  };

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-2xl">{icon}</span>
        {typeof change === 'number' && (
          <span
            className={`text-xs px-2 py-1 rounded-full ${
              change >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
            }`}
          >
            {change >= 0 ? '+' : ''}
            {change}%
          </span>
        )}
      </div>
      <p
        className={`text-3xl font-bold bg-gradient-to-r ${colorClasses[color]} bg-clip-text text-transparent`}
      >
        {value}
      </p>
      <p className="text-sm text-slate-400 mt-1">{title}</p>
      {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
    </div>
  );
}
