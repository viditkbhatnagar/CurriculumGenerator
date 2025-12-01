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
} from 'lucide-react';

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
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/analytics/dashboard`
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

    // Refresh every 30 seconds
    const interval = setInterval(fetchMetrics, 30000);

    return () => clearInterval(interval);
  }, []);

  if (loading && !metrics) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard metrics...</p>
        </div>
      </div>
    );
  }

  if (error && !metrics) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h3 className="text-red-800 font-semibold mb-2">Error Loading Dashboard</h3>
          <p className="text-red-600 text-sm mb-4">{error}</p>
          <button
            onClick={fetchMetrics}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          {lastUpdated && (
            <p className="text-sm text-gray-500 mt-1">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
        <button
          onClick={fetchMetrics}
          disabled={loading}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <Activity className="w-4 h-4" />
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Main Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Projects */}
        <MetricCard
          title="Total Projects"
          value={metrics?.overview.totalProjects || 0}
          icon={<FileText className="w-6 h-6 text-blue-600" />}
          bgColor="bg-blue-50"
        />

        {/* Published Curricula */}
        <MetricCard
          title="Published Curricula"
          value={metrics?.overview.publishedCurricula || 0}
          icon={<CheckCircle className="w-6 h-6 text-green-600" />}
          bgColor="bg-green-50"
        />

        {/* Active Users */}
        <MetricCard
          title="Active Users"
          value={`${metrics?.overview.activeUsers || 0} / ${metrics?.overview.totalUsers || 0}`}
          icon={<Users className="w-6 h-6 text-purple-600" />}
          bgColor="bg-purple-50"
        />

        {/* Success Rate */}
        <MetricCard
          title="Success Rate"
          value={`${metrics?.overview.successRate.toFixed(1) || 0}%`}
          icon={<TrendingUp className="w-6 h-6 text-indigo-600" />}
          bgColor="bg-indigo-50"
        />
      </div>

      {/* LLM Metrics */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">AI Usage Metrics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Cost */}
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-50 rounded-lg">
              <DollarSign className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total API Cost</p>
              <p className="text-2xl font-bold text-gray-900">
                ${metrics?.llmMetrics.totalCost.toFixed(2) || '0.00'}
              </p>
              <p className="text-xs text-gray-400 mt-1">Last 30 days</p>
            </div>
          </div>

          {/* Total Tokens */}
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Database className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Tokens Used</p>
              <p className="text-2xl font-bold text-gray-900">
                {(metrics?.llmMetrics.totalTokens || 0).toLocaleString()}
              </p>
              <p className="text-xs text-gray-400 mt-1">Last 30 days</p>
            </div>
          </div>

          {/* Avg Response Time */}
          <div className="flex items-start gap-3">
            <div className="p-2 bg-green-50 rounded-lg">
              <Clock className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Avg Response Time</p>
              <p className="text-2xl font-bold text-gray-900">
                {metrics?.llmMetrics.avgResponseTime.toFixed(0) || 0}ms
              </p>
              <p className="text-xs text-gray-400 mt-1">Last hour</p>
            </div>
          </div>

          {/* Cache Hit Rate */}
          <div className="flex items-start gap-3">
            <div className="p-2 bg-purple-50 rounded-lg">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Cache Hit Rate</p>
              <p className="text-2xl font-bold text-gray-900">
                {((metrics?.llmMetrics?.cacheHitRate ?? 0) * 100).toFixed(1)}%
              </p>
              <p className="text-xs text-gray-400 mt-1">Last hour</p>
            </div>
          </div>
        </div>
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Generation Time */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Generation Performance</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Avg. Generation Time</span>
              <span className="text-xl font-bold text-gray-900">
                {metrics?.overview.avgGenerationTime
                  ? `${metrics.overview.avgGenerationTime.toFixed(1)}m`
                  : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Knowledge Base Sources</span>
              <span className="text-xl font-bold text-gray-900">
                {metrics?.overview.totalKBSources || 0}
              </span>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity (7 Days)</h3>
          <div className="space-y-2">
            {metrics?.recentActivity.slice(0, 5).map((activity, index) => (
              <div
                key={index}
                className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0"
              >
                <span className="text-sm text-gray-600">
                  {new Date(activity.date).toLocaleDateString()}
                </span>
                <span className="text-sm font-semibold text-gray-900">
                  {activity.projectsCreated}{' '}
                  {activity.projectsCreated === 1 ? 'project' : 'projects'}
                </span>
              </div>
            ))}
            {(!metrics?.recentActivity || metrics.recentActivity.length === 0) && (
              <p className="text-sm text-gray-500 text-center py-4">No recent activity</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Curricula */}
      <RecentCurricula />
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
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v2/projects/published?limit=10`
        );

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            setProjects(data.data);
          }
        }
      } catch (error) {
        console.error('Error fetching recent curricula:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Curricula</h3>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Recently Published Curricula</h3>
        <a href="/projects" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
          View all →
        </a>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-8">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500">No published curricula yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Project Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Course Code
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Published
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {projects.map((project) => (
                <tr key={project._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{project.projectName}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{project.courseCode}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                      {project.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {project.stageProgress?.stage5?.publishedAt
                      ? new Date(project.stageProgress.stage5.publishedAt).toLocaleDateString()
                      : 'N/A'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    <a
                      href={`/projects/${project._id}`}
                      className="text-blue-600 hover:text-blue-900"
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
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon,
  bgColor,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  bgColor: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
        </div>
        <div className={`p-3 ${bgColor} rounded-lg`}>{icon}</div>
      </div>
    </div>
  );
}
