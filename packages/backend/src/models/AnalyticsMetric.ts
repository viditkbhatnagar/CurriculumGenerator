import mongoose, { Schema, Document } from 'mongoose';

/**
 * Analytics Metric Model
 * Stores historical analytics data for dashboard metrics
 * Includes token usage, API costs, and performance metrics
 */

export interface IAnalyticsMetric extends Document {
  metricType: 'token_usage' | 'api_cost' | 'generation' | 'response_time' | 'cache_hit';

  // Token usage metrics
  tokensUsed?: number;
  provider?: string; // 'openai', 'anthropic', etc.
  model?: string; // 'gpt-4', 'gpt-3.5-turbo', etc.

  // Cost metrics
  cost?: number;
  currency?: string;

  // Generation metrics
  projectId?: mongoose.Types.ObjectId;
  duration?: number; // milliseconds
  success?: boolean;

  // Performance metrics
  responseTime?: number; // milliseconds
  cacheHit?: boolean;
  endpoint?: string;

  // Metadata
  metadata?: {
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
    requestId?: string;
    [key: string]: any;
  };

  // Timestamp
  recordedAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

const AnalyticsMetricSchema = new Schema<IAnalyticsMetric>(
  {
    metricType: {
      type: String,
      enum: ['token_usage', 'api_cost', 'generation', 'response_time', 'cache_hit'],
      required: true,
      index: true,
    },

    tokensUsed: {
      type: Number,
      min: 0,
    },

    provider: {
      type: String,
      trim: true,
    },

    model: {
      type: String,
      trim: true,
    },

    cost: {
      type: Number,
      min: 0,
    },

    currency: {
      type: String,
      default: 'USD',
      trim: true,
    },

    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'CurriculumProject',
      index: true,
    },

    duration: {
      type: Number,
      min: 0,
    },

    success: {
      type: Boolean,
    },

    responseTime: {
      type: Number,
      min: 0,
    },

    cacheHit: {
      type: Boolean,
    },

    endpoint: {
      type: String,
      trim: true,
    },

    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },

    recordedAt: {
      type: Date,
      default: Date.now,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'analyticsmetrics',
  }
);

// Compound indexes for efficient queries
AnalyticsMetricSchema.index({ metricType: 1, recordedAt: -1 });
AnalyticsMetricSchema.index({ projectId: 1, metricType: 1 });
AnalyticsMetricSchema.index({ recordedAt: -1 });
AnalyticsMetricSchema.index({ metricType: 1, provider: 1, recordedAt: -1 });

// TTL index to auto-delete old metrics (optional - keep 90 days)
AnalyticsMetricSchema.index({ recordedAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 }); // 90 days

export const AnalyticsMetric = mongoose.model<IAnalyticsMetric>(
  'AnalyticsMetric',
  AnalyticsMetricSchema
);
