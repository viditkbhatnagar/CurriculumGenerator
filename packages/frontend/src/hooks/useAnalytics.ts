import { useQuery } from '@tanstack/react-query';
import { fetchAPI } from '@/lib/api';
import { DashboardMetrics, QualityScoreTrend, UserEngagement } from '@/types/analytics';

export function useDashboardMetrics() {
  return useQuery<DashboardMetrics>({
    queryKey: ['analytics', 'dashboard'],
    queryFn: () => fetchAPI('/api/analytics/dashboard'),
  });
}

export function useQualityScoreTrends(days: number = 30) {
  return useQuery<QualityScoreTrend[]>({
    queryKey: ['analytics', 'quality-trends', days],
    queryFn: () => fetchAPI(`/api/analytics/quality-trends?days=${days}`),
  });
}

export function useUserEngagement() {
  return useQuery<UserEngagement[]>({
    queryKey: ['analytics', 'user-engagement'],
    queryFn: () => fetchAPI('/api/analytics/users'),
  });
}
