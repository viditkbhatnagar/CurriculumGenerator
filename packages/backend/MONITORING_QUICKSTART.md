# Monitoring Quick Start Guide

## Setup

### 1. Install Dependencies

Dependencies are already included in `package.json`:
- `winston` - Logging framework
- `winston-cloudwatch` - CloudWatch integration
- `@sentry/node` - Error tracking
- `@sentry/profiling-node` - Performance profiling

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Required for CloudWatch (optional)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
CLOUDWATCH_LOG_GROUP=curriculum-generator-app

# Required for Sentry (optional)
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id

# Logging
LOG_LEVEL=info  # debug, info, warn, error
APP_VERSION=1.0.0

# Alert Thresholds
ALERT_ERROR_RATE=10          # errors per minute
ALERT_RESPONSE_TIME=3000     # milliseconds
ALERT_FAILURE_RATE=20        # percentage
ALERT_LLM_COST=100          # dollars per hour
```

### 3. Start the Server

```bash
npm run dev
```

The monitoring services will automatically initialize on startup.

## Quick Test

### Check Health Status

```bash
curl http://localhost:4000/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "uptime": 60,
  "version": "1.0.0",
  "services": {
    "database": { "status": "healthy", "responseTime": 15 },
    "cache": { "status": "healthy", "responseTime": 5 }
  },
  "metrics": {
    "successRate": 100,
    "avgResponseTime": 0,
    "totalLLMCost": 0,
    "cacheHitRate": 0,
    "errorCount": 0
  }
}
```

### Check Metrics

```bash
curl http://localhost:4000/metrics
```

### Check Alerts

```bash
curl http://localhost:4000/alerts
```

### Check Service Status

```bash
curl http://localhost:4000/status
```

## Monitoring Features

### ✅ Implemented

1. **Centralized Logging**
   - Console logging (all environments)
   - CloudWatch logging (when configured)
   - Structured JSON logs
   - Request/response logging

2. **Error Tracking**
   - Sentry integration
   - Exception capture with context
   - Performance monitoring
   - User tracking
   - Breadcrumb trails

3. **Custom Metrics**
   - Curriculum generation success rate
   - LLM API costs and token usage
   - API response times
   - Database query performance
   - Cache hit/miss rates
   - Error occurrences
   - Active users

4. **Health Checks**
   - `/health` - Comprehensive health check
   - `/health/ready` - Readiness probe
   - `/health/live` - Liveness probe
   - Database connectivity check
   - Cache connectivity check

5. **Alerting**
   - High error rate detection
   - Slow response time detection
   - Curriculum failure rate monitoring
   - LLM cost monitoring
   - Alert cooldown periods
   - Severity levels (low, medium, high, critical)

## Usage Examples

### In Your Code

```typescript
import { loggingService } from './services/loggingService';
import { monitoringService } from './services/monitoringService';
import { errorTrackingService } from './services/errorTrackingService';

// Log information
loggingService.info('Operation completed', { userId, duration });

// Record metrics
monitoringService.recordCurriculumGeneration(true, duration, programId);
monitoringService.recordLLMCost('openai', 'gpt-4', tokens, cost);

// Track errors
errorTrackingService.captureException(error, {
  component: 'my-component',
  userId,
  programId,
});
```

## Kubernetes Integration

### Liveness Probe

```yaml
livenessProbe:
  httpGet:
    path: /health/live
    port: 4000
  initialDelaySeconds: 30
  periodSeconds: 10
```

### Readiness Probe

```yaml
readinessProbe:
  httpGet:
    path: /health/ready
    port: 4000
  initialDelaySeconds: 10
  periodSeconds: 5
```

## CloudWatch Setup

### Create Log Group

```bash
aws logs create-log-group --log-group-name curriculum-generator-app
```

### IAM Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogStreams"
      ],
      "Resource": "arn:aws:logs:*:*:log-group:curriculum-generator-app:*"
    }
  ]
}
```

## Sentry Setup

### Create Project

1. Go to https://sentry.io
2. Create a new project
3. Select "Node.js" as the platform
4. Copy the DSN
5. Add to `.env` file

### Configure Alerts

In Sentry dashboard:
1. Go to Alerts → Create Alert Rule
2. Set conditions (e.g., error rate > 10/minute)
3. Configure notification channels

## Monitoring Dashboard

### Key Metrics to Monitor

1. **Availability**
   - Service uptime
   - Health check status
   - Error rate

2. **Performance**
   - API response time (p50, p95, p99)
   - Database query time
   - Cache hit rate

3. **Business Metrics**
   - Curriculum generation success rate
   - Average generation time
   - LLM costs

4. **Resource Usage**
   - Memory usage
   - CPU usage
   - Database connections

## Troubleshooting

### Logs Not Appearing in CloudWatch

1. Check AWS credentials
2. Verify IAM permissions
3. Check log group exists
4. Review application logs for errors

### Sentry Not Capturing Errors

1. Verify SENTRY_DSN is set
2. Check network connectivity
3. Verify error is thrown (not just logged)
4. Check Sentry rate limits

### High Memory Usage

1. Check metrics retention settings
2. Review alert history size
3. Monitor for memory leaks

## Next Steps

1. Set up CloudWatch dashboards
2. Configure Sentry alert rules
3. Add custom metrics for your features
4. Set up notification channels (Slack, email)
5. Review and adjust alert thresholds

## Support

For detailed documentation, see [MONITORING.md](./MONITORING.md)
