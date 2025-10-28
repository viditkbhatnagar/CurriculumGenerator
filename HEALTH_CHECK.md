# Health Check Endpoints

This document describes the health check endpoints available in the Curriculum Generator API for monitoring and deployment platforms like Render.

## Endpoints

### 1. Main Health Check - `/health`

**Purpose:** Comprehensive health check that verifies all critical services.

**Response Codes:**
- `200` - System is healthy or degraded but operational
- `503` - System is unhealthy and cannot serve requests

**Response Format:**
```json
{
  "status": "healthy" | "degraded" | "unhealthy",
  "timestamp": "2025-10-28T12:00:00.000Z",
  "uptime": 3600,
  "version": "1.0.0",
  "services": {
    "database": {
      "status": "healthy",
      "responseTime": 45,
      "lastChecked": "2025-10-28T12:00:00.000Z"
    },
    "cache": {
      "status": "healthy",
      "responseTime": 12,
      "lastChecked": "2025-10-28T12:00:00.000Z"
    }
  },
  "metrics": {
    "successRate": 0.98,
    "avgResponseTime": 250,
    "totalLLMCost": 12.50,
    "cacheHitRate": 0.85,
    "errorCount": 2
  }
}
```

**Checks Performed:**
- MongoDB connection and response time
- Redis connection and response time
- System metrics (error rate, response time)

**Use Case:** Render health check configuration

---

### 2. Readiness Check - `/health/ready`

**Purpose:** Kubernetes-style readiness probe to determine if the service can handle requests.

**Response Codes:**
- `200` - Service is ready to accept traffic
- `503` - Service is not ready (still initializing or dependencies unavailable)

**Response Format:**
```json
{
  "status": "ready",
  "timestamp": "2025-10-28T12:00:00.000Z"
}
```

**Checks Performed:**
- MongoDB is connected and responsive
- Redis is connected and responsive

**Use Case:** Load balancer health checks, deployment readiness gates

---

### 3. Liveness Check - `/health/live`

**Purpose:** Kubernetes-style liveness probe to determine if the service is alive.

**Response Codes:**
- `200` - Service is alive
- `503` - Service is dead (should be restarted)

**Response Format:**
```json
{
  "status": "alive",
  "timestamp": "2025-10-28T12:00:00.000Z",
  "uptime": 3600
}
```

**Checks Performed:**
- Process is running and responding

**Use Case:** Container orchestration liveness probes

---

### 4. Metrics Endpoint - `/metrics`

**Purpose:** Retrieve system metrics for monitoring and alerting.

**Query Parameters:**
- `window` - Time window in milliseconds (default: 3600000 = 1 hour)

**Response Format:**
```json
{
  "timestamp": "2025-10-28T12:00:00.000Z",
  "timeWindowMs": 3600000,
  "curriculum": {
    "successRate": 0.95
  },
  "api": {
    "avgResponseTime": 250
  },
  "llm": {
    "totalCost": 12.50
  },
  "cache": {
    "hitRate": 0.85
  },
  "all": {
    // Detailed metrics object
  }
}
```

**Use Case:** Monitoring dashboards, alerting systems

---

### 5. Status Endpoint - `/status`

**Purpose:** Get service status and configuration information.

**Response Format:**
```json
{
  "timestamp": "2025-10-28T12:00:00.000Z",
  "uptime": 3600,
  "version": "1.0.0",
  "environment": "production",
  "services": {
    "logging": {
      "cloudWatch": false
    },
    "errorTracking": {
      "sentry": true
    }
  }
}
```

**Use Case:** Service discovery, configuration verification

---

## Render Configuration

For Render deployment, use the main health check endpoint:

```yaml
healthCheckPath: /health
```

This is already configured in the `render.yaml` file for the backend API service.

## Health Status Definitions

### Healthy
All services are operational and performing within acceptable parameters:
- Database response time < 1000ms
- Cache response time < 500ms
- Error count < 10 in last 5 minutes
- Average response time < 2000ms

### Degraded
Services are operational but performance is suboptimal:
- Database response time > 1000ms
- Cache response time > 500ms
- Error count > 10 in last 5 minutes
- Average response time > 2000ms

### Unhealthy
Critical services are not operational:
- MongoDB is not connected
- Redis is not responding (non-critical, but logged)

## Monitoring Best Practices

1. **Use `/health` for Render health checks** - Comprehensive check that verifies all dependencies
2. **Monitor `/metrics` regularly** - Track performance trends and costs
3. **Set up alerts on `/health` status changes** - Get notified when system becomes degraded or unhealthy
4. **Use `/health/ready` for deployment gates** - Ensure service is ready before routing traffic
5. **Check `/status` after deployments** - Verify configuration and service versions

## Example Health Check Requests

```bash
# Check overall health
curl https://your-api.onrender.com/health

# Check if service is ready
curl https://your-api.onrender.com/health/ready

# Check if service is alive
curl https://your-api.onrender.com/health/live

# Get metrics for last hour
curl https://your-api.onrender.com/metrics

# Get metrics for last 5 minutes
curl https://your-api.onrender.com/metrics?window=300000

# Get service status
curl https://your-api.onrender.com/status
```

## Troubleshooting

### Health Check Returns 503

**Possible Causes:**
1. MongoDB connection failed - Check `MONGODB_URI` environment variable
2. Redis connection failed - Check `REDIS_URL` environment variable
3. High error rate - Check application logs for errors
4. Slow response times - Check database performance and query optimization

**Resolution Steps:**
1. Check Render logs for error messages
2. Verify environment variables are set correctly
3. Check MongoDB Atlas network access whitelist
4. Verify Redis add-on is provisioned and running
5. Check for resource constraints (CPU, memory)

### Health Check Times Out

**Possible Causes:**
1. Database query is hanging
2. Network connectivity issues
3. Service is overloaded

**Resolution Steps:**
1. Check MongoDB Atlas status
2. Verify network connectivity between Render and MongoDB Atlas
3. Scale up service resources if needed
4. Check for slow queries in MongoDB

## Integration with Monitoring Tools

### Sentry
Error tracking is automatically integrated. Errors are captured and sent to Sentry if `SENTRY_DSN` is configured.

### Custom Monitoring
Use the `/metrics` endpoint to integrate with custom monitoring solutions:
- Poll metrics at regular intervals
- Store metrics in time-series database
- Create dashboards and alerts based on metrics

### Render Monitoring
Render provides built-in monitoring:
- Service logs
- Resource usage (CPU, memory)
- Request metrics
- Health check status

Access these through the Render dashboard for each service.
