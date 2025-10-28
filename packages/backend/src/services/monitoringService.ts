import { loggingService } from './loggingService';

interface Metric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  dimensions?: Record<string, string>;
}

interface MetricStats {
  count: number;
  sum: number;
  min: number;
  max: number;
  avg: number;
}

class MonitoringService {
  private metrics: Map<string, Metric[]>;
  private metricsRetentionMs: number = 3600000; // 1 hour
  private flushIntervalMs: number = 60000; // 1 minute

  constructor() {
    this.metrics = new Map();
    this.startMetricsFlusher();
  }

  // Record a custom metric
  recordMetric(
    name: string,
    value: number,
    unit: string = 'Count',
    dimensions?: Record<string, string>
  ): void {
    const metric: Metric = {
      name,
      value,
      unit,
      timestamp: new Date(),
      dimensions,
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    this.metrics.get(name)!.push(metric);
    this.cleanOldMetrics(name);
  }

  // Record curriculum generation success/failure
  recordCurriculumGeneration(success: boolean, duration: number, programId: string): void {
    this.recordMetric('CurriculumGenerationSuccess', success ? 1 : 0, 'Count', {
      status: success ? 'success' : 'failure',
    });
    this.recordMetric('CurriculumGenerationDuration', duration, 'Milliseconds', {
      programId,
    });

    loggingService.info('Curriculum generation metric recorded', {
      success,
      duration,
      programId,
    });
  }

  // Record LLM API costs
  recordLLMCost(provider: string, model: string, tokens: number, cost: number): void {
    this.recordMetric('LLMTokensUsed', tokens, 'Count', { provider, model });
    this.recordMetric('LLMCost', cost, 'Dollars', { provider, model });

    loggingService.info('LLM cost metric recorded', {
      provider,
      model,
      tokens,
      cost,
    });
  }

  // Record API response times
  recordResponseTime(endpoint: string, method: string, duration: number, statusCode: number): void {
    this.recordMetric('APIResponseTime', duration, 'Milliseconds', {
      endpoint,
      method,
      statusCode: statusCode.toString(),
    });
  }

  // Record database query performance
  recordDatabaseQuery(queryType: string, duration: number): void {
    this.recordMetric('DatabaseQueryDuration', duration, 'Milliseconds', {
      queryType,
    });
  }

  // Record cache hit/miss rates
  recordCacheOperation(operation: 'hit' | 'miss', key: string): void {
    this.recordMetric('CacheOperation', 1, 'Count', {
      operation,
      keyPrefix: key.split(':')[0] || 'unknown',
    });
  }

  // Record error occurrences
  recordError(errorType: string, severity: 'low' | 'medium' | 'high' | 'critical'): void {
    this.recordMetric('ErrorOccurrence', 1, 'Count', {
      errorType,
      severity,
    });
  }

  // Record active users
  recordActiveUser(userId: string): void {
    this.recordMetric('ActiveUsers', 1, 'Count', { userId });
  }

  // Get metric statistics
  getMetricStats(metricName: string, timeWindowMs: number = 3600000): MetricStats | null {
    const metrics = this.metrics.get(metricName);
    if (!metrics || metrics.length === 0) {
      return null;
    }

    const cutoffTime = new Date(Date.now() - timeWindowMs);
    const recentMetrics = metrics.filter((m) => m.timestamp >= cutoffTime);

    if (recentMetrics.length === 0) {
      return null;
    }

    const values = recentMetrics.map((m) => m.value);
    const sum = values.reduce((a, b) => a + b, 0);

    return {
      count: recentMetrics.length,
      sum,
      min: Math.min(...values),
      max: Math.max(...values),
      avg: sum / recentMetrics.length,
    };
  }

  // Get all metrics for a time window
  getAllMetrics(timeWindowMs: number = 3600000): Record<string, MetricStats> {
    const result: Record<string, MetricStats> = {};

    Array.from(this.metrics.keys()).forEach((name) => {
      const stats = this.getMetricStats(name, timeWindowMs);
      if (stats) {
        result[name] = stats;
      }
    });

    return result;
  }

  // Calculate curriculum generation success rate
  getCurriculumGenerationSuccessRate(timeWindowMs: number = 3600000): number {
    const stats = this.getMetricStats('CurriculumGenerationSuccess', timeWindowMs);
    if (!stats || stats.count === 0) {
      return 0;
    }
    return (stats.sum / stats.count) * 100;
  }

  // Calculate average response time
  getAverageResponseTime(timeWindowMs: number = 3600000): number {
    const stats = this.getMetricStats('APIResponseTime', timeWindowMs);
    return stats?.avg || 0;
  }

  // Calculate total LLM costs
  getTotalLLMCost(timeWindowMs: number = 3600000): number {
    const stats = this.getMetricStats('LLMCost', timeWindowMs);
    return stats?.sum || 0;
  }

  // Calculate cache hit rate
  getCacheHitRate(timeWindowMs: number = 3600000): number {
    const metrics = this.metrics.get('CacheOperation');
    if (!metrics || metrics.length === 0) {
      return 0;
    }

    const cutoffTime = new Date(Date.now() - timeWindowMs);
    const recentMetrics = metrics.filter((m) => m.timestamp >= cutoffTime);

    const hits = recentMetrics.filter((m) => m.dimensions?.operation === 'hit').length;
    const total = recentMetrics.length;

    return total > 0 ? (hits / total) * 100 : 0;
  }

  // Clean old metrics to prevent memory leaks
  private cleanOldMetrics(metricName: string): void {
    const metrics = this.metrics.get(metricName);
    if (!metrics) return;

    const cutoffTime = new Date(Date.now() - this.metricsRetentionMs);
    const filteredMetrics = metrics.filter((m) => m.timestamp >= cutoffTime);

    this.metrics.set(metricName, filteredMetrics);
  }

  // Periodically flush metrics to logs
  private startMetricsFlusher(): void {
    setInterval(() => {
      this.flushMetrics();
    }, this.flushIntervalMs);
  }

  private flushMetrics(): void {
    const allMetrics = this.getAllMetrics(this.flushIntervalMs);

    if (Object.keys(allMetrics).length > 0) {
      loggingService.info('Metrics summary', {
        metrics: allMetrics,
        successRate: this.getCurriculumGenerationSuccessRate(this.flushIntervalMs),
        avgResponseTime: this.getAverageResponseTime(this.flushIntervalMs),
        totalLLMCost: this.getTotalLLMCost(this.flushIntervalMs),
        cacheHitRate: this.getCacheHitRate(this.flushIntervalMs),
      });
    }
  }

  // Get health metrics for health check endpoint
  getHealthMetrics(): {
    successRate: number;
    avgResponseTime: number;
    totalLLMCost: number;
    cacheHitRate: number;
    errorCount: number;
  } {
    const errorStats = this.getMetricStats('ErrorOccurrence', 300000); // Last 5 minutes

    return {
      successRate: this.getCurriculumGenerationSuccessRate(3600000),
      avgResponseTime: this.getAverageResponseTime(3600000),
      totalLLMCost: this.getTotalLLMCost(3600000),
      cacheHitRate: this.getCacheHitRate(3600000),
      errorCount: errorStats?.count || 0,
    };
  }
}

export const monitoringService = new MonitoringService();
