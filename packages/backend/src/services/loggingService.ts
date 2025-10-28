import winston from 'winston';
import WinstonCloudWatch from 'winston-cloudwatch';

interface LogMetadata {
  requestId?: string;
  userId?: string;
  programId?: string;
  jobId?: string;
  duration?: number;
  statusCode?: number;
  [key: string]: any;
}

class LoggingService {
  private logger: winston.Logger;
  private isCloudWatchEnabled: boolean;

  constructor() {
    this.isCloudWatchEnabled = !!(
      process.env.AWS_REGION &&
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      process.env.CLOUDWATCH_LOG_GROUP
    );

    const transports: winston.transport[] = [
      // Console transport for all environments
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp(),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
            return `${timestamp} [${level}]: ${message} ${metaStr}`;
          })
        ),
      }),
    ];

    // Add CloudWatch transport if configured
    if (this.isCloudWatchEnabled) {
      transports.push(
        new WinstonCloudWatch({
          logGroupName: process.env.CLOUDWATCH_LOG_GROUP || 'curriculum-generator-app',
          logStreamName: `${process.env.NODE_ENV || 'development'}-${new Date().toISOString().split('T')[0]}`,
          awsRegion: process.env.AWS_REGION,
          awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
          awsSecretKey: process.env.AWS_SECRET_ACCESS_KEY,
          messageFormatter: ({ level, message, ...meta }) => {
            return JSON.stringify({
              level,
              message,
              timestamp: new Date().toISOString(),
              ...meta,
            });
          },
        })
      );
    }

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports,
    });
  }

  info(message: string, meta?: LogMetadata): void {
    this.logger.info(message, meta);
  }

  error(message: string, error?: Error | any, meta?: LogMetadata): void {
    this.logger.error(message, {
      ...meta,
      error: error?.message,
      stack: error?.stack,
      errorDetails: error,
    });
  }

  warn(message: string, meta?: LogMetadata): void {
    this.logger.warn(message, meta);
  }

  debug(message: string, meta?: LogMetadata): void {
    this.logger.debug(message, meta);
  }

  // Log HTTP requests
  logRequest(req: any, res: any, duration: number): void {
    this.info('HTTP Request', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      requestId: req.headers['x-request-id'],
      userId: req.user?.id,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
  }

  // Log curriculum generation events
  logCurriculumGeneration(
    event: 'started' | 'completed' | 'failed',
    programId: string,
    jobId: string,
    meta?: LogMetadata
  ): void {
    this.info(`Curriculum generation ${event}`, {
      programId,
      jobId,
      event,
      ...meta,
    });
  }

  // Log LLM API calls
  logLLMCall(
    provider: string,
    model: string,
    tokens: number,
    cost: number,
    duration: number,
    meta?: LogMetadata
  ): void {
    this.info('LLM API call', {
      provider,
      model,
      tokens,
      cost,
      duration,
      ...meta,
    });
  }

  // Log database queries
  logDatabaseQuery(query: string, duration: number, meta?: LogMetadata): void {
    this.debug('Database query', {
      query: query.substring(0, 200), // Truncate long queries
      duration,
      ...meta,
    });
  }

  // Log cache operations
  logCacheOperation(
    operation: 'hit' | 'miss' | 'set' | 'delete',
    key: string,
    meta?: LogMetadata
  ): void {
    this.debug(`Cache ${operation}`, {
      operation,
      key,
      ...meta,
    });
  }

  isCloudWatchConfigured(): boolean {
    return this.isCloudWatchEnabled;
  }
}

export const loggingService = new LoggingService();
