'use client';

import { MetricsCard } from './MetricsCard';
import { QualityTrendChart } from './QualityTrendChart';
import { UserEngagementTable } from './UserEngagementTable';
import { useDashboardMetrics } from '@/hooks/useAnalytics';

/**
 * Top-level analytics dashboard. Reads the `{ overview, llmMetrics,
 * recentActivity }` shape from `/api/analytics/dashboard` (the hook
 * unwraps `data` for us). All numeric reads use nullish-coalescing so
 * a stalled OpenAI metric or empty job history doesn't crash render.
 */
export function AnalyticsDashboard() {
  const { data: metrics, isLoading, error } = useDashboardMetrics();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-4">
        Couldn’t load analytics: {error instanceof Error ? error.message : 'unknown error'}
      </div>
    );
  }

  const overview = metrics?.overview;
  const llm = metrics?.llmMetrics;
  const avgGenMin = overview?.avgGenerationTime; // null when no completed runs
  const successRate = overview?.successRate ?? 0;
  const totalCostStr = llm?.totalCost != null ? `$${llm.totalCost.toFixed(2)}` : '—';
  const cacheHitStr = llm?.cacheHitRate != null ? `${Math.round(llm.cacheHitRate * 100)}%` : '—';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricsCard title="Total Programs" value={overview?.totalPrograms ?? 0} icon="📚" />
        <MetricsCard title="Success Rate" value={`${Math.round(successRate)}%`} icon="✅" />
        <MetricsCard
          title="Avg. Generation Time"
          value={avgGenMin != null ? `${Math.round(avgGenMin)}m` : '—'}
          icon="⏱️"
        />
        <MetricsCard title="Active Users" value={overview?.activeUsers ?? 0} icon="👥" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricsCard title="Knowledge Sources" value={overview?.totalKBSources ?? 0} icon="📖" />
        <MetricsCard
          title="Published Curricula"
          value={overview?.publishedCurricula ?? 0}
          icon="🎓"
        />
        <MetricsCard title="LLM Spend" value={totalCostStr} icon="💸" />
        <MetricsCard title="Cache Hit Rate" value={cacheHitStr} icon="⚡" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <QualityTrendChart />
        <RecentActivityCard items={metrics?.recentActivity ?? []} />
      </div>

      <UserEngagementTable />
    </div>
  );
}

/**
 * Inline replacement for the old "Programs Per User" card — that field
 * never existed in the API response, which is what was crashing the page.
 * Showing the recent-activity timeline instead is more useful and uses a
 * real field from the dashboard payload.
 */
function RecentActivityCard({
  items,
}: {
  items: Array<{ date: string; projectsCreated: number }>;
}) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
      {items.length === 0 ? (
        <p className="text-sm text-gray-500">No projects created in the last 14 days.</p>
      ) : (
        <ul className="space-y-2">
          {items.slice(0, 14).map((row) => (
            <li key={row.date} className="flex items-center justify-between text-sm text-gray-700">
              <span>{new Date(row.date).toLocaleDateString()}</span>
              <span className="font-mono text-gray-900">
                {row.projectsCreated} new {row.projectsCreated === 1 ? 'project' : 'projects'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
