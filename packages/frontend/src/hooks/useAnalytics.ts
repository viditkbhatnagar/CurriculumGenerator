import { useQuery } from '@tanstack/react-query';
import { fetchAPI } from '@/lib/api';
import { DashboardMetrics, QualityScoreTrend, UserEngagement } from '@/types/analytics';

/** Backend wraps every analytics response in `{ success, data }`. Pull `.data` so consumers don't have to. */
async function fetchUnwrapped<T>(path: string): Promise<T> {
  const r = await fetchAPI(path);
  // Some legacy endpoints return raw arrays; new ones use { success, data }.
  return (r?.data ?? r) as T;
}

export function useDashboardMetrics() {
  return useQuery<DashboardMetrics>({
    queryKey: ['analytics', 'dashboard'],
    queryFn: () => fetchUnwrapped<DashboardMetrics>('/api/analytics/dashboard'),
  });
}

export function useQualityScoreTrends(days: number = 30) {
  return useQuery<QualityScoreTrend[]>({
    queryKey: ['analytics', 'quality-trends', days],
    queryFn: async () => {
      const r = await fetchUnwrapped<QualityScoreTrend[] | { trends?: QualityScoreTrend[] }>(
        `/api/analytics/quality-trends?days=${days}`
      );
      // Tolerate both shapes the backend may return
      if (Array.isArray(r)) return r;
      return (r as { trends?: QualityScoreTrend[] })?.trends || [];
    },
  });
}

export function useUserEngagement() {
  return useQuery<UserEngagement[]>({
    queryKey: ['analytics', 'user-engagement'],
    queryFn: async () => {
      const r = await fetchUnwrapped<UserEngagement[] | { users?: UserEngagement[] }>(
        '/api/analytics/users'
      );
      if (Array.isArray(r)) return r;
      return (r as { users?: UserEngagement[] })?.users || [];
    },
  });
}
