import { loggingService } from './loggingService';
import { errorTrackingService } from './errorTrackingService';
import { monitoringService } from './monitoringService';

interface Alert {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

interface AlertThresholds {
  errorRate: number; // errors per minute
  responseTime: number; // milliseconds
  curriculumFailureRate: number; // percentage
  llmCostPerHour: number; // dollars
}

class AlertingService {
  private alerts: Alert[] = [];
  private alertThresholds: AlertThresholds;
  private checkIntervalMs: number = 60000; // 1 minute
  private alertCooldownMs: number = 300000; // 5 minutes
  private lastAlertTimes: Map<string, number> = new Map();

  constructor() {
    this.alertThresholds = {
      errorRate: parseFloat(process.env.ALERT_ERROR_RATE || '10'),
      responseTime: parseFloat(process.env.ALERT_RESPONSE_TIME || '3000'),
      curriculumFailureRate: parseFloat(process.env.ALERT_FAILURE_RATE || '20'),
      llmCostPerHour: parseFloat(process.env.ALERT_LLM_COST || '100'),
    };

    this.startAlertMonitoring();
  }

  // Start periodic monitoring for alert conditions
  private startAlertMonitoring(): void {
    setInterval(() => {
      this.checkAlertConditions();
    }, this.checkIntervalMs);

    loggingService.info('Alert monitoring started', {
      thresholds: this.alertThresholds,
      checkInterval: this.checkIntervalMs,
    });
  }

  // Check all alert conditions
  private async checkAlertConditions(): Promise<void> {
    try {
      await Promise.all([
        this.checkErrorRate(),
        this.checkResponseTime(),
        this.checkCurriculumFailureRate(),
        this.checkLLMCosts(),
      ]);
    } catch (error) {
      loggingService.error('Error checking alert conditions', error);
    }
  }

  // Check if error rate exceeds threshold
  private async checkErrorRate(): Promise<void> {
    const metrics = monitoringService.getHealthMetrics();
    const errorRate = metrics.errorCount; // Errors in last 5 minutes

    if (errorRate > this.alertThresholds.errorRate * 5) {
      // Multiply by 5 for 5-minute window
      this.createAlert(
        'high-error-rate',
        'high',
        'High Error Rate Detected',
        `Error rate (${errorRate} errors in 5 minutes) exceeds threshold of ${this.alertThresholds.errorRate} per minute`,
        { errorCount: errorRate, threshold: this.alertThresholds.errorRate }
      );
    }
  }

  // Check if response time exceeds threshold
  private async checkResponseTime(): Promise<void> {
    const avgResponseTime = monitoringService.getAverageResponseTime(300000); // Last 5 minutes

    if (avgResponseTime > this.alertThresholds.responseTime) {
      this.createAlert(
        'slow-response-time',
        'medium',
        'Slow Response Time Detected',
        `Average response time (${avgResponseTime.toFixed(0)}ms) exceeds threshold of ${this.alertThresholds.responseTime}ms`,
        { avgResponseTime, threshold: this.alertThresholds.responseTime }
      );
    }
  }

  // Check curriculum generation failure rate
  private async checkCurriculumFailureRate(): Promise<void> {
    const successRate = monitoringService.getCurriculumGenerationSuccessRate(3600000); // Last hour
    const failureRate = 100 - successRate;

    if (failureRate > this.alertThresholds.curriculumFailureRate) {
      this.createAlert(
        'high-curriculum-failure-rate',
        'critical',
        'High Curriculum Generation Failure Rate',
        `Curriculum generation failure rate (${failureRate.toFixed(1)}%) exceeds threshold of ${this.alertThresholds.curriculumFailureRate}%`,
        { failureRate, successRate, threshold: this.alertThresholds.curriculumFailureRate }
      );
    }
  }

  // Check LLM costs
  private async checkLLMCosts(): Promise<void> {
    const totalCost = monitoringService.getTotalLLMCost(3600000); // Last hour

    if (totalCost > this.alertThresholds.llmCostPerHour) {
      this.createAlert(
        'high-llm-costs',
        'medium',
        'High LLM Costs Detected',
        `LLM costs ($${totalCost.toFixed(2)}/hour) exceed threshold of $${this.alertThresholds.llmCostPerHour}/hour`,
        { totalCost, threshold: this.alertThresholds.llmCostPerHour }
      );
    }
  }

  // Create and send an alert
  private createAlert(
    alertKey: string,
    severity: Alert['severity'],
    title: string,
    message: string,
    metadata?: Record<string, any>
  ): void {
    // Check cooldown period
    const lastAlertTime = this.lastAlertTimes.get(alertKey);
    if (lastAlertTime && Date.now() - lastAlertTime < this.alertCooldownMs) {
      return; // Skip alert due to cooldown
    }

    const alert: Alert = {
      id: `${alertKey}-${Date.now()}`,
      severity,
      title,
      message,
      timestamp: new Date(),
      metadata,
    };

    this.alerts.push(alert);
    this.lastAlertTimes.set(alertKey, Date.now());

    // Log the alert
    loggingService.warn(`ALERT: ${title}`, {
      severity,
      message,
      ...metadata,
    });

    // Send to Sentry for critical alerts
    if (severity === 'critical' || severity === 'high') {
      errorTrackingService.captureMessage(
        `ALERT: ${title} - ${message}`,
        severity === 'critical' ? 'error' : 'warning',
        {
          component: 'alerting',
          alertKey,
          ...metadata,
        }
      );
    }

    // In production, you would also send alerts via:
    // - Email (using SendGrid, AWS SES, etc.)
    // - Slack (using Slack webhooks)
    // - PagerDuty (for critical alerts)
    // - SMS (using Twilio)

    this.sendAlertNotification(alert);
  }

  // Send alert notification (placeholder for actual implementation)
  private sendAlertNotification(alert: Alert): void {
    // This is where you would integrate with notification services
    // For now, we just log it
    loggingService.info('Alert notification sent', {
      alertId: alert.id,
      severity: alert.severity,
      title: alert.title,
    });

    // Example integrations you could add:
    /*
    if (process.env.SLACK_WEBHOOK_URL) {
      await axios.post(process.env.SLACK_WEBHOOK_URL, {
        text: `🚨 ${alert.title}`,
        attachments: [{
          color: this.getSeverityColor(alert.severity),
          text: alert.message,
          fields: Object.entries(alert.metadata || {}).map(([key, value]) => ({
            title: key,
            value: String(value),
            short: true,
          })),
        }],
      });
    }

    if (alert.severity === 'critical' && process.env.PAGERDUTY_API_KEY) {
      // Trigger PagerDuty incident
    }
    */
  }

  // Get recent alerts
  getRecentAlerts(limit: number = 10): Alert[] {
    return this.alerts.slice(-limit).reverse();
  }

  // Get alerts by severity
  getAlertsBySeverity(severity: Alert['severity']): Alert[] {
    return this.alerts.filter((alert) => alert.severity === severity);
  }

  // Clear old alerts
  clearOldAlerts(olderThanMs: number = 86400000): void {
    // Default: 24 hours
    const cutoffTime = new Date(Date.now() - olderThanMs);
    this.alerts = this.alerts.filter((alert) => alert.timestamp >= cutoffTime);
  }

  // Manually trigger an alert
  triggerAlert(
    severity: Alert['severity'],
    title: string,
    message: string,
    metadata?: Record<string, any>
  ): void {
    this.createAlert(`manual-${Date.now()}`, severity, title, message, metadata);
  }

  // Get alert statistics
  getAlertStats(timeWindowMs: number = 3600000): {
    total: number;
    bySeverity: Record<string, number>;
  } {
    const cutoffTime = new Date(Date.now() - timeWindowMs);
    const recentAlerts = this.alerts.filter((alert) => alert.timestamp >= cutoffTime);

    const bySeverity: Record<string, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    recentAlerts.forEach((alert) => {
      bySeverity[alert.severity]++;
    });

    return {
      total: recentAlerts.length,
      bySeverity,
    };
  }
}

export const alertingService = new AlertingService();
