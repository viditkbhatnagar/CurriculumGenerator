/**
 * Analytics shapes that match the actual backend responses (under
 * `/api/analytics/*`). Endpoints wrap everything in `{ success, data }` —
 * the `useAnalytics` hooks unwrap `.data` so consumers get the inner
 * objects directly.
 */

export interface DashboardOverview {
  totalProjects: number;
  totalPrograms: number;
  projectsByStatus: Record<string, number>;
  programsByStatus: Record<string, number>;
  successRate: number;
  /** Average generation time in minutes. Null when no completed jobs yet. */
  avgGenerationTime: number | null;
  totalKBSources: number;
  activeUsers: number;
  totalUsers: number;
  publishedCurricula: number;
}

export interface DashboardLLMMetrics {
  totalCost: number;
  totalTokens: number;
  /** Avg LLM call response time in milliseconds. */
  avgResponseTime: number;
  cacheHitRate: number;
}

export interface DashboardActivity {
  date: string;
  projectsCreated: number;
}

export interface DashboardMetrics {
  overview: DashboardOverview;
  llmMetrics: DashboardLLMMetrics;
  recentActivity: DashboardActivity[];
  timestamp: string;
}

export interface QualityScoreTrend {
  date: string;
  score: number;
}

export interface UserEngagement {
  userId: string;
  email: string;
  programsGenerated: number;
  lastActive: string;
}
