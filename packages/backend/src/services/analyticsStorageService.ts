import { AnalyticsMetric, IAnalyticsMetric } from '../models/AnalyticsMetric';
import { loggingService } from './loggingService';

/**
 * Analytics Storage Service
 * Persists analytics data to MongoDB for long-term storage
 * Called by monitoring service and other services to record metrics
 */

class AnalyticsStorageService {
  /**
   * Record token usage to database
   */
  async recordTokenUsage(data: {
    tokensUsed: number;
    provider: string;
    model: string;
    cost?: number;
    projectId?: string;
    metadata?: any;
  }): Promise<void> {
    try {
      await AnalyticsMetric.create({
        metricType: 'token_usage',
        tokensUsed: data.tokensUsed,
        provider: data.provider,
        model: data.model,
        cost: data.cost,
        currency: 'USD',
        projectId: data.projectId,
        metadata: data.metadata,
        recordedAt: new Date(),
      });
    } catch (error) {
      loggingService.error('Error recording token usage', { error, data });
    }
  }

  /**
   * Record API cost to database
   */
  async recordApiCost(data: {
    cost: number;
    provider: string;
    model: string;
    tokensUsed?: number;
    projectId?: string;
    metadata?: any;
  }): Promise<void> {
    try {
      await AnalyticsMetric.create({
        metricType: 'api_cost',
        cost: data.cost,
        currency: 'USD',
        provider: data.provider,
        model: data.model,
        tokensUsed: data.tokensUsed,
        projectId: data.projectId,
        metadata: data.metadata,
        recordedAt: new Date(),
      });
    } catch (error) {
      loggingService.error('Error recording API cost', { error, data });
    }
  }

  /**
   * Record curriculum generation metrics
   */
  async recordGeneration(data: {
    projectId: string;
    duration: number;
    success: boolean;
    metadata?: any;
  }): Promise<void> {
    try {
      await AnalyticsMetric.create({
        metricType: 'generation',
        projectId: data.projectId,
        duration: data.duration,
        success: data.success,
        metadata: data.metadata,
        recordedAt: new Date(),
      });
    } catch (error) {
      loggingService.error('Error recording generation', { error, data });
    }
  }

  /**
   * Record API response time
   */
  async recordResponseTime(data: {
    endpoint: string;
    responseTime: number;
    projectId?: string;
    metadata?: any;
  }): Promise<void> {
    try {
      await AnalyticsMetric.create({
        metricType: 'response_time',
        endpoint: data.endpoint,
        responseTime: data.responseTime,
        projectId: data.projectId,
        metadata: data.metadata,
        recordedAt: new Date(),
      });
    } catch (error) {
      loggingService.error('Error recording response time', { error, data });
    }
  }

  /**
   * Record cache hit/miss
   */
  async recordCacheHit(data: {
    cacheHit: boolean;
    endpoint?: string;
    metadata?: any;
  }): Promise<void> {
    try {
      await AnalyticsMetric.create({
        metricType: 'cache_hit',
        cacheHit: data.cacheHit,
        endpoint: data.endpoint,
        metadata: data.metadata,
        recordedAt: new Date(),
      });
    } catch (error) {
      loggingService.error('Error recording cache hit', { error, data });
    }
  }

  /**
   * Get total token usage for a time period
   */
  async getTotalTokens(startDate: Date, endDate: Date = new Date()): Promise<number> {
    try {
      const result = await AnalyticsMetric.aggregate([
        {
          $match: {
            metricType: 'token_usage',
            recordedAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: null,
            totalTokens: { $sum: '$tokensUsed' },
          },
        },
      ]);

      return result.length > 0 ? result[0].totalTokens : 0;
    } catch (error) {
      loggingService.error('Error getting total tokens', { error });
      return 0;
    }
  }

  /**
   * Get total API cost for a time period
   */
  async getTotalCost(startDate: Date, endDate: Date = new Date()): Promise<number> {
    try {
      const result = await AnalyticsMetric.aggregate([
        {
          $match: {
            metricType: 'api_cost',
            recordedAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: null,
            totalCost: { $sum: '$cost' },
          },
        },
      ]);

      return result.length > 0 ? result[0].totalCost : 0;
    } catch (error) {
      loggingService.error('Error getting total cost', { error });
      return 0;
    }
  }

  /**
   * Get token usage by provider/model
   */
  async getTokensByProvider(startDate: Date, endDate: Date = new Date()): Promise<any[]> {
    try {
      return await AnalyticsMetric.aggregate([
        {
          $match: {
            metricType: 'token_usage',
            recordedAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: { provider: '$provider', model: '$model' },
            totalTokens: { $sum: '$tokensUsed' },
            totalCost: { $sum: '$cost' },
            count: { $sum: 1 },
          },
        },
        {
          $sort: { totalTokens: -1 },
        },
      ]);
    } catch (error) {
      loggingService.error('Error getting tokens by provider', { error });
      return [];
    }
  }

  /**
   * Get cost breakdown by provider/model
   */
  async getCostByProvider(startDate: Date, endDate: Date = new Date()): Promise<any[]> {
    try {
      return await AnalyticsMetric.aggregate([
        {
          $match: {
            metricType: 'api_cost',
            recordedAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: { provider: '$provider', model: '$model' },
            totalCost: { $sum: '$cost' },
            totalTokens: { $sum: '$tokensUsed' },
            count: { $sum: 1 },
          },
        },
        {
          $sort: { totalCost: -1 },
        },
      ]);
    } catch (error) {
      loggingService.error('Error getting cost by provider', { error });
      return [];
    }
  }

  /**
   * Get daily cost/token trends
   */
  async getDailyTrends(
    startDate: Date,
    endDate: Date = new Date()
  ): Promise<{ date: string; tokens: number; cost: number }[]> {
    try {
      const result = await AnalyticsMetric.aggregate([
        {
          $match: {
            metricType: { $in: ['token_usage', 'api_cost'] },
            recordedAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$recordedAt' } },
              type: '$metricType',
            },
            totalTokens: { $sum: '$tokensUsed' },
            totalCost: { $sum: '$cost' },
          },
        },
        {
          $group: {
            _id: '$_id.date',
            tokens: { $sum: '$totalTokens' },
            cost: { $sum: '$totalCost' },
          },
        },
        {
          $sort: { _id: 1 },
        },
        {
          $project: {
            date: '$_id',
            tokens: 1,
            cost: 1,
            _id: 0,
          },
        },
      ]);

      return result;
    } catch (error) {
      loggingService.error('Error getting daily trends', { error });
      return [];
    }
  }

  /**
   * Get metrics for a specific project
   */
  async getProjectMetrics(projectId: string): Promise<{
    totalTokens: number;
    totalCost: number;
    generationDuration: number | null;
    success: boolean;
  }> {
    try {
      const [tokenResult, costResult, generationResult] = await Promise.all([
        AnalyticsMetric.aggregate([
          {
            $match: {
              metricType: 'token_usage',
              projectId: projectId,
            },
          },
          {
            $group: {
              _id: null,
              totalTokens: { $sum: '$tokensUsed' },
            },
          },
        ]),
        AnalyticsMetric.aggregate([
          {
            $match: {
              metricType: 'api_cost',
              projectId: projectId,
            },
          },
          {
            $group: {
              _id: null,
              totalCost: { $sum: '$cost' },
            },
          },
        ]),
        AnalyticsMetric.findOne({
          metricType: 'generation',
          projectId: projectId,
        }).sort({ recordedAt: -1 }),
      ]);

      return {
        totalTokens: tokenResult.length > 0 ? tokenResult[0].totalTokens : 0,
        totalCost: costResult.length > 0 ? costResult[0].totalCost : 0,
        generationDuration: generationResult?.duration || null,
        success: generationResult?.success || false,
      };
    } catch (error) {
      loggingService.error('Error getting project metrics', { error, projectId });
      return {
        totalTokens: 0,
        totalCost: 0,
        generationDuration: null,
        success: false,
      };
    }
  }
}

export const analyticsStorageService = new AnalyticsStorageService();
