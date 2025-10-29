import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import https from 'https';
import fs from 'fs';
import config from './config';
import { initRedisClient, closeRedisClient } from './services/sessionService';
import { cacheService } from './services/cacheService';
import { websocketService } from './services/websocketService';
// import { jobQueueService } from './services/jobQueueService'; // Requires Redis - lazy load when needed
import { loggingService } from './services/loggingService';
import { errorTrackingService } from './services/errorTrackingService';
import { alertingService } from './services/alertingService';
import { db } from './db';
import {
  requestLoggingMiddleware,
  errorTrackingMiddleware,
  performanceMonitoringMiddleware,
  userContextMiddleware,
} from './middleware/monitoring';
import { securityValidation } from './middleware/security';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import programRoutes from './routes/programs';
import curriculumRoutes from './routes/curriculum';
import exportRoutes from './routes/export';
import benchmarkRoutes from './routes/benchmarks';
import analyticsRoutes from './routes/analytics';
import healthRoutes from './routes/health';
import { createKnowledgeBaseRouter } from './routes/knowledgeBase';
import { createRAGRouter } from './routes/rag';
import { createTutorBotRouter } from './routes/tutorBot';
import { createSimulationsRouter } from './routes/simulations';
import newWorkflowRoutes from './routes/newWorkflowRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Create HTTP or HTTPS server based on configuration
let httpServer: any;
if (config.security.enableHttps) {
  try {
    const httpsOptions = {
      key: fs.readFileSync(process.env.SSL_KEY_PATH || './certs/key.pem'),
      cert: fs.readFileSync(process.env.SSL_CERT_PATH || './certs/cert.pem'),
    };
    httpServer = https.createServer(httpsOptions, app);
    loggingService.info('HTTPS enabled');
  } catch (error) {
    loggingService.warn('HTTPS certificates not found, falling back to HTTP', {
      error: String(error),
    });
    httpServer = createServer(app);
  }
} else {
  httpServer = createServer(app);
}

// Rate limiting middleware - per user when authenticated, per IP otherwise
const limiter = rateLimit({
  windowMs: config.security.rateLimitWindowMs,
  max: config.security.rateLimitMaxRequests,
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise use IP
    return req.user?.id || req.ip || 'unknown';
  },
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/metrics';
  },
});

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  })
);

// CORS configuration with specific origins
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) {
        return callback(null, true);
      }

      if (config.security.corsOrigins.includes(origin)) {
        callback(null, true);
      } else {
        loggingService.warn('CORS blocked request from unauthorized origin', { origin });
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Request-ID',
      'X-API-Signature',
      'X-API-Timestamp',
    ],
    exposedHeaders: ['X-Request-ID'],
    maxAge: 86400, // 24 hours
  })
);

// Body parser with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Apply rate limiting
app.use(limiter);

// Sentry request handler (must be first)
app.use(errorTrackingService.getRequestHandler());
app.use(errorTrackingService.getTracingHandler());

// Request ID middleware
app.use((req, res, next) => {
  req.headers['x-request-id'] =
    req.headers['x-request-id'] || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  next();
});

// Monitoring middleware
app.use(requestLoggingMiddleware);
app.use(performanceMonitoringMiddleware);
app.use(userContextMiddleware);

// Security validation middleware (applied to all routes except health checks)
app.use((req, res, next) => {
  if (req.path === '/health' || req.path === '/metrics') {
    return next();
  }
  securityValidation[0](req, res, () => {
    securityValidation[1](req, res, () => {
      securityValidation[2](req, res, next);
    });
  });
});

// Health check and monitoring routes
app.use('/', healthRoutes);

// API routes
app.get('/api', (req, res) => {
  res.json({ message: 'Curriculum Generator API' });
});

// Auth routes
app.use('/api/auth', authRoutes);

// User management routes
app.use('/api/users', userRoutes);

// Program management routes
app.use('/api/programs', programRoutes);

// Curriculum generation routes
app.use('/api/curriculum', curriculumRoutes);

// Document export routes
app.use('/api/export', exportRoutes);

// Benchmarking routes
app.use('/api/benchmarks', benchmarkRoutes);

// Analytics routes
app.use('/api/analytics', analyticsRoutes);

// Knowledge base routes
const knowledgeBaseRouter = createKnowledgeBaseRouter();
app.use('/api/knowledge-base', knowledgeBaseRouter);

// RAG engine routes
const ragRouter = createRAGRouter();
app.use('/api/rag', ragRouter);

// Tutor bot routes
const tutorBotRouter = createTutorBotRouter();
app.use('/api/tutor', tutorBotRouter);

// Simulation engine routes
const simulationsRouter = createSimulationsRouter();
app.use('/api/simulations', simulationsRouter);

// New 5-stage workflow routes (v2 API)
app.use('/api/v2', newWorkflowRoutes);

// Sentry error handler (must be before other error handlers)
app.use(errorTrackingService.getErrorHandler());

// Error tracking middleware
app.use(errorTrackingMiddleware);

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  loggingService.error('Unhandled error', err, {
    requestId: req.headers['x-request-id'] as string,
    method: req.method,
    url: req.url,
    userId: req.user?.id,
  });

  res.status(err.status || 500).json({
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.message || 'An unexpected error occurred',
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] || 'unknown',
    },
  });
});

// Initialize services and start server
async function startServer() {
  try {
    loggingService.info('Starting Curriculum Generator API...', {
      port: PORT,
      environment: process.env.NODE_ENV,
      version: process.env.APP_VERSION || '1.0.0',
    });

    // Connect to MongoDB with retry logic
    let mongoConnected = false;
    let mongoRetries = 0;
    const maxMongoRetries = 5;

    while (!mongoConnected && mongoRetries < maxMongoRetries) {
      try {
        await db.connect();
        mongoConnected = true;
        loggingService.info('MongoDB connected successfully', {
          host: db.getStats()?.host,
          database: db.getStats()?.name,
        });
      } catch (error) {
        mongoRetries++;
        loggingService.error(`MongoDB connection attempt ${mongoRetries} failed`, error, {
          retries: mongoRetries,
          maxRetries: maxMongoRetries,
        });

        if (mongoRetries >= maxMongoRetries) {
          loggingService.error('MongoDB connection failed after maximum retries', error);
          errorTrackingService.captureException(error as Error, {
            component: 'mongodb-connection',
            retries: mongoRetries,
          });
          alertingService.triggerAlert(
            'critical',
            'MongoDB Connection Failed',
            'Failed to connect to MongoDB after multiple retries',
            { error: String(error), retries: mongoRetries }
          );
          throw new Error('Failed to connect to MongoDB - server cannot start');
        }

        // Wait before retrying (exponential backoff)
        const waitTime = Math.min(1000 * Math.pow(2, mongoRetries - 1), 10000);
        loggingService.info(`Waiting ${waitTime}ms before retry...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

    // Initialize file storage service
    try {
      const { fileStorageService } = await import('./services/fileStorageService');
      await fileStorageService.initialize();
      loggingService.info('File storage service initialized', {
        uploadDir: config.nodeEnv === 'production' ? '/app/uploads' : 'uploads',
      });
    } catch (error) {
      loggingService.error('Failed to initialize file storage service', error);
      errorTrackingService.captureException(error as Error, {
        component: 'file-storage-initialization',
      });
      throw new Error('Failed to initialize file storage - server cannot start');
    }

    // Initialize Redis for session management (optional)
    try {
      await initRedisClient();
      loggingService.info('Redis client initialized for session management');
    } catch (error) {
      loggingService.warn('Redis not available, continuing without session management', {
        error: String(error),
      });
    }

    // Initialize cache service (optional)
    try {
      await cacheService.connect();
      loggingService.info('Cache service initialized');
    } catch (error) {
      loggingService.warn('Cache service not available, continuing without caching', {
        error: String(error),
      });
    }

    // Initialize WebSocket server
    websocketService.initialize(httpServer);
    loggingService.info('WebSocket server initialized');

    // Start curriculum generation worker
    try {
      const { curriculumWorker } = await import('./workers/curriculumWorker');
      curriculumWorker.start();
      loggingService.info('Curriculum generation worker started');
    } catch (error) {
      loggingService.warn('Failed to start curriculum worker', { error: String(error) });
    }

    // Start HTTP server
    httpServer.listen(PORT, () => {
      loggingService.info('Server started successfully', {
        port: PORT,
        apiUrl: `http://localhost:${PORT}`,
        websocketUrl: `ws://localhost:${PORT}/ws`,
        healthCheck: `http://localhost:${PORT}/health`,
        metrics: `http://localhost:${PORT}/metrics`,
        sentryEnabled: errorTrackingService.isConfigured(),
        cloudWatchEnabled: loggingService.isCloudWatchConfigured(),
        mongoConnected: true,
        redisConnected: true, // Redis is connected if we got here
      });
    });

    // Handle HTTP server errors
    httpServer.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        loggingService.error(`Port ${PORT} is already in use`, error);
        alertingService.triggerAlert(
          'critical',
          'Port Already In Use',
          `Cannot start server - port ${PORT} is already in use`,
          { port: PORT }
        );
      } else {
        loggingService.error('HTTP server error', error);
      }
      errorTrackingService.captureException(error, {
        component: 'http-server',
      });
      process.exit(1);
    });
  } catch (error) {
    loggingService.error('Failed to start server', error);
    errorTrackingService.captureException(error as Error, {
      component: 'server-startup',
    });
    alertingService.triggerAlert(
      'critical',
      'Server Startup Failed',
      'Failed to start Curriculum Generator API',
      { error: String(error) }
    );
    process.exit(1);
  }
}

// Graceful shutdown handler
async function gracefulShutdown(signal: string) {
  loggingService.info(`${signal} received, shutting down gracefully...`);

  let exitCode = 0;

  try {
    // Stop accepting new connections
    httpServer.close(() => {
      loggingService.info('HTTP server closed - no longer accepting connections');
    });

    // Stop curriculum worker
    try {
      const { curriculumWorker } = await import('./workers/curriculumWorker');
      curriculumWorker.stop();
      loggingService.info('Curriculum worker stopped');
    } catch (error) {
      loggingService.error('Error stopping curriculum worker', error);
      exitCode = 1;
    }

    // Close WebSocket connections
    try {
      websocketService.close();
      loggingService.info('WebSocket connections closed');
    } catch (error) {
      loggingService.error('Error closing WebSocket connections', error);
      exitCode = 1;
    }

    // Disconnect from MongoDB
    try {
      await db.disconnect();
      loggingService.info('MongoDB disconnected');
    } catch (error) {
      loggingService.error('Error disconnecting from MongoDB', error);
      exitCode = 1;
    }

    // Disconnect from cache service
    try {
      await cacheService.disconnect();
      loggingService.info('Cache service disconnected');
    } catch (error) {
      loggingService.error('Error disconnecting cache service', error);
      exitCode = 1;
    }

    // Close Redis client
    try {
      await closeRedisClient();
      loggingService.info('Redis client closed');
    } catch (error) {
      loggingService.error('Error closing Redis client', error);
      exitCode = 1;
    }

    loggingService.info('Graceful shutdown completed', { exitCode });

    // Give time for final logs to flush
    setTimeout(() => {
      process.exit(exitCode);
    }, 1000);
  } catch (error) {
    loggingService.error('Error during graceful shutdown', error);
    errorTrackingService.captureException(error as Error, {
      component: 'graceful-shutdown',
    });
    process.exit(1);
  }
}

// Graceful shutdown on SIGTERM (e.g., from Render or Kubernetes)
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Graceful shutdown on SIGINT (e.g., Ctrl+C)
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  loggingService.error('Uncaught exception', error);
  errorTrackingService.captureException(error, {
    component: 'uncaught-exception',
  });
  alertingService.triggerAlert('critical', 'Uncaught Exception', error.message, {
    stack: error.stack,
  });
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  loggingService.error('Unhandled promise rejection', reason);
  errorTrackingService.captureException(
    reason instanceof Error ? reason : new Error(String(reason)),
    {
      component: 'unhandled-rejection',
    }
  );
  alertingService.triggerAlert('critical', 'Unhandled Promise Rejection', String(reason), {
    promise: String(promise),
  });
});

startServer();
