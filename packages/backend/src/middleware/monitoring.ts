import { Request, Response, NextFunction } from 'express';
import { loggingService } from '../services/loggingService';
import { monitoringService } from '../services/monitoringService';
import { errorTrackingService } from '../services/errorTrackingService';

// Extend Express Request type to include user
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string;
        username?: string;
      };
    }
  }
}

// Request logging middleware
export function requestLoggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  // Log when response finishes
  res.on('finish', () => {
    const duration = Date.now() - startTime;

    // Log the request
    loggingService.logRequest(req, res, duration);

    // Record metrics
    monitoringService.recordResponseTime(req.path, req.method, duration, res.statusCode);

    // Track active users
    if (req.user?.id) {
      monitoringService.recordActiveUser(req.user.id);
    }

    // Record errors
    if (res.statusCode >= 400) {
      const severity = res.statusCode >= 500 ? 'high' : 'medium';
      monitoringService.recordError(`HTTP_${res.statusCode}`, severity);
    }
  });

  next();
}

// Error tracking middleware
export function errorTrackingMiddleware(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Capture error in Sentry
  errorTrackingService.captureException(err, {
    component: 'api',
    requestId: req.headers['x-request-id'] as string,
    userId: req.user?.id,
    method: req.method,
    url: req.url,
    statusCode: res.statusCode,
  });

  // Record error metric
  monitoringService.recordError(err.name || 'UnknownError', 'high');

  // Log error
  loggingService.error('Request error', err, {
    requestId: req.headers['x-request-id'] as string,
    method: req.method,
    url: req.url,
    userId: req.user?.id,
  });

  next(err);
}

// Performance monitoring middleware
export function performanceMonitoringMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();

  // Start Sentry transaction
  const transaction = errorTrackingService.startTransaction(
    `${req.method} ${req.path}`,
    'http.server'
  );

  if (transaction) {
    res.on('finish', () => {
      transaction.setHttpStatus(res.statusCode);
      transaction.finish();
    });
  }

  // Add breadcrumb
  errorTrackingService.addBreadcrumb(`${req.method} ${req.path}`, 'http', {
    method: req.method,
    url: req.url,
    statusCode: res.statusCode,
  });

  next();
}

// User context middleware
export function userContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.id) {
    errorTrackingService.setUser(req.user.id, req.user.email, req.user.username);
  }

  res.on('finish', () => {
    errorTrackingService.clearUser();
  });

  next();
}
