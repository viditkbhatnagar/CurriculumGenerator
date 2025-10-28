# Monitoring and Logging Guide

This document describes the monitoring, logging, and alerting infrastructure for the Curriculum Generator App.

## Overview

The application includes comprehensive monitoring and observability features:

- **Centralized Logging**: Winston with CloudWatch integration
- **Error Tracking**: Sentry for exception tracking and performance monitoring
- **Custom Metrics**: Track curriculum generation, LLM costs, and API performance
- **Health Checks**: Kubernetes-style health endpoints
- **Alerting**: Automated alerts for critical errors and performance degradation

## Services

### 1. Logging Service (`loggingService.ts`)

Provides structured logging with multiple transports:

- Console logging (all environments)
- CloudWatch logging (when configured)

**Usage:**

```typescript
import { loggingService } from './services/loggingService';

// Basic logging
loggingService.info('Operation completed', { userId: '123', duration: 1500 });
loggingService.error('Operation failed', error, { userId: '123' });
loggingService.warn('Slow operation detected', { duration: 5000 });
loggingService.debug('Debug information', { data: someData });

// Specialized logging
loggingService.logRequest(req, res, duration);
loggingService.logCurriculumGeneration('completed', programId, jobId, { duration });
loggingService.logLLMCall('openai', 'gpt-4', tokens, cost, duration);
```

### 2. Monitoring Service (`monitoringService.ts`)

Tracks custom metrics and provides aggregated statistics:

**Metrics Tracked:**
- Curriculum generation success rate
- LLM API costs and token usage
- API response times
- Database query performance
- Cache hit/miss rates
- Error occurrences
- Active users

**Usage:**

```typescript
import { monitoringService } from './services/monitoringService';

// Record metrics
monitoringService.recordCurriculumGeneration(true, duration, programId);
monitoringService.recordLLMCost('openai', 'gpt-4', tokens, cost);
monitoringService.recordResponseTime(endpoint, method, duration, statusCode);
monitoringService.recordError('ValidationError', 'medium');

// Get statistics
const successRate = monitoringService.getCurriculumGenerationSuccessRate();
const avgResponseTime = monitoringService.getAverageResponseTime();
const totalCost = monitoringService.getTotalLLMCost();
const cacheHitRate = monitoringService.getCacheHitRate();
```

### 3. Error Tracking Service (`errorTrackingService.ts`)

Integrates with Sentry for error tracking and performance monitoring:

**Features:**
- Exception capture with context
- Performance transaction tracking
- User context tracking
- Breadcrumb trails for debugging

**Usage:**

```typescript
import { errorTrackingService } from './services/errorTrackingService';

// Capture exceptions
errorTrackingService.captureException(error, {
  component: 'curriculum-generation',
  programId,
  jobId,
});

// Capture messages
errorTrackingService.captureMessage('Warning message', 'warning', { context });

// Track user context
errorTrackingService.setUser(userId, email, username);

// Add breadcrumbs
errorTrackingService.addBreadcrumb('User action', 'user', { action: 'click' });

// Performance monitoring
const transaction = errorTrackingService.startTransaction('Generate Curriculum', 'task');
// ... do work ...
transaction?.finish();
```

### 4. Health Check Service (`healthCheckService.ts`)

Provides comprehensive health monitoring:

**Endpoints:**
- `/health` - Full health check with all services
- `/health/ready` - Readiness check (can handle requests?)
- `/health/live` - Liveness check (is service running?)

**Usage:**

```typescript
import { healthCheckService } from './services/healthCheckService';

const health = await healthCheckService.performHealthCheck();
const isReady = await healthCheckService.performReadinessCheck();
const isAlive = healthCheckService.performLivenessCheck();
```

### 5. Alerting Service (`alertingService.ts`)

Monitors metrics and triggers alerts when thresholds are exceeded:

**Alert Conditions:**
- High error rate (> 10 errors/minute)
- Slow response time (> 3 seconds)
- High curriculum failure rate (> 20%)
- High LLM costs (> $100/hour)

**Usage:**

```typescript
import { alertingService } from './services/alertingService';

// Manually trigger alert
alertingService.triggerAlert(
  'critical',
  'Database Connection Lost',
  'Unable to connect to PostgreSQL',
  { attempts: 3 }
);

// Get recent alerts
const alerts = alertingService.getRecentAlerts(10);
const criticalAlerts = alertingService.getAlertsBySeverity('critical');
```

## Environment Variables

### Required for CloudWatch

```bash
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
CLOUDWATCH_LOG_GROUP=curriculum-generator-app
LOG_LEVEL=info  # debug, info, warn, error
```

### Required for Sentry

```bash
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
APP_VERSION=1.0.0
NODE_ENV=production
```

### Alert Thresholds

```bash
ALERT_ERROR_RATE=10          # errors per minute
ALERT_RESPONSE_TIME=3000     # milliseconds
ALERT_FAILURE_RATE=20        # percentage
ALERT_LLM_COST=100          # dollars per hour
```

## API Endpoints

### Health and Status

#### GET /health
Comprehensive health check with all service statuses and metrics.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "uptime": 3600,
  "version": "1.0.0",
  "services": {
    "database": {
      "status": "healthy",
      "responseTime": 15,
      "lastChecked": "2024-01-15T10:30:00Z"
    },
    "cache": {
      "status": "healthy",
      "responseTime": 5,
      "lastChecked": "2024-01-15T10:30:00Z"
    }
  },
  "metrics": {
    "successRate": 95.5,
    "avgResponseTime": 1250,
    "totalLLMCost": 45.67,
    "cacheHitRate": 78.3,
    "errorCount": 2
  }
}
```

#### GET /health/ready
Kubernetes-style readiness probe.

**Response:**
```json
{
  "status": "ready",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### GET /health/live
Kubernetes-style liveness probe.

**Response:**
```json
{
  "status": "alive",
  "timestamp": "2024-01-15T10:30:00Z",
  "uptime": 3600
}
```

#### GET /metrics?window=3600000
Get metrics for a specific time window (default: 1 hour).

**Response:**
```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "timeWindowMs": 3600000,
  "curriculum": {
    "successRate": 95.5
  },
  "api": {
    "avgResponseTime": 1250
  },
  "llm": {
    "totalCost": 45.67
  },
  "cache": {
    "hitRate": 78.3
  },
  "all": {
    "CurriculumGenerationSuccess": {
      "count": 20,
      "sum": 19,
      "min": 0,
      "max": 1,
      "avg": 0.95
    }
  }
}
```

#### GET /alerts?limit=10&severity=critical
Get recent alerts, optionally filtered by severity.

**Response:**
```json
{
  "alerts": [
    {
      "id": "high-error-rate-1234567890",
      "severity": "high",
      "title": "High Error Rate Detected",
      "message": "Error rate (52 errors in 5 minutes) exceeds threshold of 10 per minute",
      "timestamp": "2024-01-15T10:25:00Z",
      "metadata": {
        "errorCount": 52,
        "threshold": 10
      }
    }
  ],
  "stats": {
    "total": 5,
    "bySeverity": {
      "low": 1,
      "medium": 2,
      "high": 2,
      "critical": 0
    }
  }
}
```

#### GET /status
Get service configuration status.

**Response:**
```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "uptime": 3600,
  "version": "1.0.0",
  "environment": "production",
  "services": {
    "logging": {
      "cloudWatch": true
    },
    "errorTracking": {
      "sentry": true
    }
  }
}
```

## Monitoring Best Practices

### 1. Log Levels

Use appropriate log levels:
- **DEBUG**: Detailed information for debugging
- **INFO**: General informational messages
- **WARN**: Warning messages for potentially harmful situations
- **ERROR**: Error events that might still allow the application to continue

### 2. Structured Logging

Always include relevant context in logs:

```typescript
loggingService.info('Curriculum generated', {
  programId,
  jobId,
  duration,
  userId,
  requestId,
});
```

### 3. Error Context

Provide rich context when capturing errors:

```typescript
errorTrackingService.captureException(error, {
  component: 'curriculum-generation',
  programId,
  jobId,
  stage: 'content-generation',
  userId,
});
```

### 4. Performance Monitoring

Track performance for critical operations:

```typescript
const startTime = Date.now();
// ... perform operation ...
const duration = Date.now() - startTime;
monitoringService.recordResponseTime(endpoint, method, duration, statusCode);
```

### 5. Alert Fatigue

Configure appropriate thresholds to avoid alert fatigue:
- Set thresholds based on baseline metrics
- Use cooldown periods to prevent duplicate alerts
- Prioritize critical alerts over warnings

## Dashboard Integration

### CloudWatch Dashboards

Create custom dashboards in CloudWatch to visualize:
- API response times (p50, p95, p99)
- Error rates by endpoint
- Curriculum generation success rate
- LLM costs over time
- Cache hit rates

### Sentry Dashboards

Monitor in Sentry:
- Error frequency and trends
- Performance issues
- Release health
- User impact

## Troubleshooting

### CloudWatch Not Receiving Logs

1. Verify AWS credentials are configured
2. Check IAM permissions for CloudWatch Logs
3. Verify log group exists or service has permission to create it
4. Check application logs for CloudWatch errors

### Sentry Not Capturing Errors

1. Verify SENTRY_DSN is configured correctly
2. Check network connectivity to Sentry
3. Verify error is being thrown (not just logged)
4. Check Sentry project settings and rate limits

### High Alert Volume

1. Review alert thresholds - may need adjustment
2. Check for underlying issues causing alerts
3. Implement alert cooldown periods
4. Group related alerts together

### Missing Metrics

1. Verify monitoring service is initialized
2. Check that metrics are being recorded in code
3. Review metric retention settings
4. Check for errors in monitoring service

## Future Enhancements

Potential improvements to the monitoring system:

1. **Distributed Tracing**: Add OpenTelemetry for distributed tracing
2. **Custom Dashboards**: Build admin UI for viewing metrics
3. **Notification Channels**: Add Slack, email, and PagerDuty integrations
4. **Anomaly Detection**: Implement ML-based anomaly detection
5. **Cost Optimization**: Add detailed cost breakdown by feature
6. **User Analytics**: Track user behavior and engagement patterns
7. **A/B Testing**: Add framework for testing prompt variations
8. **SLA Monitoring**: Track and report on SLA compliance
