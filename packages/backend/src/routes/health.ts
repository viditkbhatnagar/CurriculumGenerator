import { Router } from 'express';
import { healthCheckService } from '../services/healthCheckService';
import { monitoringService } from '../services/monitoringService';
import { alertingService } from '../services/alertingService';
import { loggingService } from '../services/loggingService';
import { errorTrackingService } from '../services/errorTrackingService';

const router = Router();

// Comprehensive health check endpoint
router.get('/health', async (req, res) => {
  try {
    const healthStatus = await healthCheckService.performHealthCheck();

    const statusCode = healthStatus.status === 'healthy' ? 200 : 
                       healthStatus.status === 'degraded' ? 200 : 503;

    res.status(statusCode).json(healthStatus);
  } catch (error: any) {
    loggingService.error('Health check failed', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

// Readiness check (Kubernetes-style)
router.get('/health/ready', async (req, res) => {
  try {
    const isReady = await healthCheckService.performReadinessCheck();

    if (isReady) {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        status: 'not ready',
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error: any) {
    loggingService.error('Readiness check failed', error);
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

// Liveness check (Kubernetes-style)
router.get('/health/live', (req, res) => {
  const isAlive = healthCheckService.performLivenessCheck();

  if (isAlive) {
    res.status(200).json({
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: healthCheckService.getUptime(),
    });
  } else {
    res.status(503).json({
      status: 'dead',
      timestamp: new Date().toISOString(),
    });
  }
});

// Metrics endpoint
router.get('/metrics', (req, res) => {
  try {
    const timeWindow = parseInt(req.query.window as string) || 3600000; // Default 1 hour

    const metrics = {
      timestamp: new Date().toISOString(),
      timeWindowMs: timeWindow,
      curriculum: {
        successRate: monitoringService.getCurriculumGenerationSuccessRate(timeWindow),
      },
      api: {
        avgResponseTime: monitoringService.getAverageResponseTime(timeWindow),
      },
      llm: {
        totalCost: monitoringService.getTotalLLMCost(timeWindow),
      },
      cache: {
        hitRate: monitoringService.getCacheHitRate(timeWindow),
      },
      all: monitoringService.getAllMetrics(timeWindow),
    };

    res.json(metrics);
  } catch (error: any) {
    loggingService.error('Failed to retrieve metrics', error);
    res.status(500).json({
      error: 'Failed to retrieve metrics',
      message: error.message,
    });
  }
});

// Alerts endpoint
router.get('/alerts', (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const severity = req.query.severity as string;

    let alerts;
    if (severity) {
      alerts = alertingService.getAlertsBySeverity(severity as any);
    } else {
      alerts = alertingService.getRecentAlerts(limit);
    }

    const stats = alertingService.getAlertStats();

    res.json({
      alerts,
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    loggingService.error('Failed to retrieve alerts', error);
    res.status(500).json({
      error: 'Failed to retrieve alerts',
      message: error.message,
    });
  }
});

// Service status endpoint
router.get('/status', (req, res) => {
  try {
    const status = {
      timestamp: new Date().toISOString(),
      uptime: healthCheckService.getUptime(),
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services: {
        logging: {
          cloudWatch: loggingService.isCloudWatchConfigured(),
        },
        errorTracking: {
          sentry: errorTrackingService.isConfigured(),
        },
      },
    };

    res.json(status);
  } catch (error: any) {
    loggingService.error('Failed to retrieve status', error);
    res.status(500).json({
      error: 'Failed to retrieve status',
      message: error.message,
    });
  }
});

export default router;
