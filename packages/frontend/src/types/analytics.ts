export interface DashboardMetrics {
  totalPrograms: number;
  successRate: number;
  averageGenerationTime: number;
  activeUsers: number;
  programsPerUser: number;
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
