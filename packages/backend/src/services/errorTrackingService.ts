import * as Sentry from '@sentry/node';
import { loggingService } from './loggingService';

// Conditionally import profiling integration
let ProfilingIntegration: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ProfilingIntegration = require('@sentry/profiling-node').ProfilingIntegration;
} catch {
  // Profiling integration not available, will skip it
  ProfilingIntegration = null;
}

interface ErrorContext {
  userId?: string;
  programId?: string;
  jobId?: string;
  requestId?: string;
  [key: string]: any;
}

class ErrorTrackingService {
  private isInitialized: boolean = false;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    const sentryDsn = process.env.SENTRY_DSN;
    const environment = process.env.NODE_ENV || 'development';

    if (!sentryDsn) {
      loggingService.warn('Sentry DSN not configured, error tracking disabled');
      return;
    }

    try {
      const integrations = [];
      if (ProfilingIntegration) {
        integrations.push(new ProfilingIntegration());
      }

      Sentry.init({
        dsn: sentryDsn,
        environment,
        integrations,
        // Performance Monitoring
        tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
        // Profiling
        profilesSampleRate: environment === 'production' ? 0.1 : 1.0,
        // Release tracking
        release: process.env.APP_VERSION || 'unknown',
        // Before send hook to filter sensitive data
        beforeSend(event, hint) {
          // Remove sensitive data from event
          if (event.request?.headers) {
            delete event.request.headers['authorization'];
            delete event.request.headers['cookie'];
          }
          return event;
        },
      });

      this.isInitialized = true;
      loggingService.info('Sentry error tracking initialized', { environment });
    } catch (error) {
      loggingService.error('Failed to initialize Sentry', error);
    }
  }

  // Capture an exception
  captureException(error: Error, context?: ErrorContext): string | undefined {
    if (!this.isInitialized) {
      loggingService.error('Error occurred (Sentry not initialized)', error, context);
      return undefined;
    }

    return Sentry.captureException(error, {
      tags: {
        component: context?.component || 'unknown',
      },
      extra: context,
      user: context?.userId ? { id: context.userId } : undefined,
    });
  }

  // Capture a message
  captureMessage(
    message: string,
    level: Sentry.SeverityLevel = 'info',
    context?: ErrorContext
  ): string | undefined {
    if (!this.isInitialized) {
      loggingService.info(`Message (Sentry not initialized): ${message}`, context);
      return undefined;
    }

    return Sentry.captureMessage(message, {
      level,
      tags: {
        component: context?.component || 'unknown',
      },
      extra: context,
    });
  }

  // Set user context
  setUser(userId: string, email?: string, username?: string): void {
    if (!this.isInitialized) return;

    Sentry.setUser({
      id: userId,
      email,
      username,
    });
  }

  // Clear user context
  clearUser(): void {
    if (!this.isInitialized) return;
    Sentry.setUser(null);
  }

  // Add breadcrumb for debugging
  addBreadcrumb(message: string, category: string, data?: Record<string, any>): void {
    if (!this.isInitialized) return;

    Sentry.addBreadcrumb({
      message,
      category,
      data,
      level: 'info',
      timestamp: Date.now() / 1000,
    });
  }

  // Start a transaction for performance monitoring
  startTransaction(name: string, op: string): Sentry.Transaction | undefined {
    if (!this.isInitialized) return undefined;

    return Sentry.startTransaction({
      name,
      op,
    });
  }

  // Capture curriculum generation errors
  captureCurriculumGenerationError(
    error: Error,
    programId: string,
    jobId: string,
    stage: string
  ): void {
    this.captureException(error, {
      component: 'curriculum-generation',
      programId,
      jobId,
      stage,
    });

    loggingService.error('Curriculum generation error', error, {
      programId,
      jobId,
      stage,
    });
  }

  // Capture LLM API errors
  captureLLMError(error: Error, provider: string, model: string, prompt?: string): void {
    this.captureException(error, {
      component: 'llm-service',
      provider,
      model,
      promptLength: prompt?.length,
    });

    loggingService.error('LLM API error', error, {
      provider,
      model,
    });
  }

  // Capture database errors
  captureDatabaseError(error: Error, query?: string): void {
    this.captureException(error, {
      component: 'database',
      queryLength: query?.length,
    });

    loggingService.error('Database error', error);
  }

  // Capture validation errors
  captureValidationError(message: string, validationErrors: any): void {
    this.captureMessage(message, 'warning', {
      component: 'validation',
      validationErrors,
    });

    loggingService.warn(message, { validationErrors });
  }

  // Check if Sentry is initialized
  isConfigured(): boolean {
    return this.isInitialized;
  }

  // Get Sentry request handler middleware
  getRequestHandler(): any {
    if (!this.isInitialized) {
      return (req: any, res: any, next: any) => next();
    }
    return Sentry.Handlers.requestHandler();
  }

  // Get Sentry error handler middleware
  getErrorHandler(): any {
    if (!this.isInitialized) {
      return (err: any, req: any, res: any, next: any) => next(err);
    }
    return Sentry.Handlers.errorHandler();
  }

  // Get Sentry tracing handler middleware
  getTracingHandler(): any {
    if (!this.isInitialized) {
      return (req: any, res: any, next: any) => next();
    }
    return Sentry.Handlers.tracingHandler();
  }
}

export const errorTrackingService = new ErrorTrackingService();
