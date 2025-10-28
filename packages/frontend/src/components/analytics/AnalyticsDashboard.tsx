'use client';

import { MetricsCard } from './MetricsCard';
import { QualityTrendChart } from './QualityTrendChart';
import { UserEngagementTable } from './UserEngagementTable';
import { useDashboardMetrics } from '@/hooks/useAnalytics';

export function AnalyticsDashboard() {
  const { data: metrics, isLoading } = useDashboardMetrics();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricsCard
          title="Total Programs"
          value={metrics?.totalPrograms || 0}
          icon="📚"
        />
        <MetricsCard
          title="Success Rate"
          value={`${metrics?.successRate || 0}%`}
          icon="✅"
        />
        <MetricsCard
          title="Avg. Generation Time"
          value={`${metrics?.averageGenerationTime || 0}m`}
          icon="⏱️"
        />
        <MetricsCard
          title="Active Users"
          value={metrics?.activeUsers || 0}
          icon="👥"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <QualityTrendChart />
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Programs Per User
          </h3>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <p className="text-5xl font-bold text-blue-600">
                {metrics?.programsPerUser?.toFixed(1) || '0.0'}
              </p>
              <p className="text-gray-500 mt-2">Average programs per user</p>
            </div>
          </div>
        </div>
      </div>

      <UserEngagementTable />
    </div>
  );
}
