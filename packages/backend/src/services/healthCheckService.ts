import { db } from '../db';
import { cacheService } from './cacheService';
import { monitoringService } from './monitoringService';
import { loggingService } from './loggingService';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  services: {
    database: ServiceHealth;
    cache: ServiceHealth;
    llm?: ServiceHealth;
    vectorDb?: ServiceHealth;
  };
  metrics: {
    successRate: number;
    avgResponseTime: number;
    totalLLMCost: number;
    cacheHitRate: number;
    errorCount: number;
  };
}

interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime?: number;
  message?: string;
  lastChecked: string;
}

class HealthCheckService {
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  // Perform comprehensive health check
  async performHealthCheck(): Promise<HealthStatus> {
    const timestamp = new Date().toISOString();
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);

    const [databaseHealth, cacheHealth] = await Promise.all([
      this.checkDatabase(),
      this.checkCache(),
    ]);

    const metrics = monitoringService.getHealthMetrics();

    // Determine overall status
    const services = {
      database: databaseHealth,
      cache: cacheHealth,
    };

    const overallStatus = this.determineOverallStatus(services, metrics);

    const healthStatus: HealthStatus = {
      status: overallStatus,
      timestamp,
      uptime,
      version: process.env.APP_VERSION || '1.0.0',
      services,
      metrics,
    };

    // Log health check results
    if (overallStatus !== 'healthy') {
      loggingService.warn('Health check detected issues', {
        status: overallStatus,
        services,
        metrics,
      });
    }

    return healthStatus;
  }

  // Check database connectivity and performance
  private async checkDatabase(): Promise<ServiceHealth> {
    const startTime = Date.now();

    try {
      const isHealthy = await db.healthCheck();
      const responseTime = Date.now() - startTime;

      if (!isHealthy) {
        return {
          status: 'unhealthy',
          message: 'MongoDB is not connected',
          lastChecked: new Date().toISOString(),
        };
      }

      if (responseTime > 1000) {
        return {
          status: 'degraded',
          responseTime,
          message: 'Database response time is slow',
          lastChecked: new Date().toISOString(),
        };
      }

      return {
        status: 'healthy',
        responseTime,
        lastChecked: new Date().toISOString(),
      };
    } catch (error: any) {
      loggingService.error('Database health check failed', error);
      return {
        status: 'unhealthy',
        message: error.message,
        lastChecked: new Date().toISOString(),
      };
    }
  }

  // Check cache connectivity and performance
  private async checkCache(): Promise<ServiceHealth> {
    const startTime = Date.now();

    try {
      const isHealthy = await cacheService.healthCheck();
      const responseTime = Date.now() - startTime;

      if (!isHealthy) {
        return {
          status: 'unhealthy',
          message: 'Cache is not responding',
          lastChecked: new Date().toISOString(),
        };
      }

      if (responseTime > 500) {
        return {
          status: 'degraded',
          responseTime,
          message: 'Cache response time is slow',
          lastChecked: new Date().toISOString(),
        };
      }

      return {
        status: 'healthy',
        responseTime,
        lastChecked: new Date().toISOString(),
      };
    } catch (error: any) {
      loggingService.error('Cache health check failed', error);
      return {
        status: 'unhealthy',
        message: error.message,
        lastChecked: new Date().toISOString(),
      };
    }
  }

  // Determine overall system status
  private determineOverallStatus(
    services: Record<string, ServiceHealth>,
    metrics: any
  ): 'healthy' | 'degraded' | 'unhealthy' {
    // Check if any critical service is unhealthy
    const criticalServices = ['database', 'cache'];
    const hasUnhealthyService = criticalServices.some(
      (service) => services[service]?.status === 'unhealthy'
    );

    if (hasUnhealthyService) {
      return 'unhealthy';
    }

    // Check if any service is degraded
    const hasDegradedService = Object.values(services).some(
      (service) => service.status === 'degraded'
    );

    // Check if error rate is high
    const hasHighErrorRate = metrics.errorCount > 10; // More than 10 errors in last 5 minutes

    // Check if response time is slow
    const hasSlowResponseTime = metrics.avgResponseTime > 2000; // More than 2 seconds

    if (hasDegradedService || hasHighErrorRate || hasSlowResponseTime) {
      return 'degraded';
    }

    return 'healthy';
  }

  // Perform readiness check (can the service handle requests?)
  async performReadinessCheck(): Promise<boolean> {
    try {
      const [dbHealthy, cacheHealthy] = await Promise.all([
        this.checkDatabase().then((h) => h.status !== 'unhealthy'),
        this.checkCache().then((h) => h.status !== 'unhealthy'),
      ]);

      return dbHealthy && cacheHealthy;
    } catch (error) {
      loggingService.error('Readiness check failed', error);
      return false;
    }
  }

  // Perform liveness check (is the service running?)
  performLivenessCheck(): boolean {
    return true; // If this code is executing, the service is alive
  }

  // Get uptime in seconds
  getUptime(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }
}

export const healthCheckService = new HealthCheckService();
