import dotenv from 'dotenv';

dotenv.config();

interface Config {
  port: number;
  nodeEnv: string;
  database: {
    mongoUri: string; // MongoDB connection string
  };
  redis: {
    url: string;
    tls: boolean;
    maxRetries: number;
    retryDelay: number;
  };
  openai: {
    apiKey: string;
    embeddingModel: string;
    chatModel: string;
  };
  auth0: {
    domain: string;
    audience: string;
  };
  storage: {
    type: 'render_disk' | 'cloudinary' | 'local';
    uploadDir: string;
    maxFileSize: number;
  };
  monitoring: {
    sentryDsn: string;
    logLevel: string;
  };
  alerts: {
    errorRate: number;
    responseTime: number;
    curriculumFailureRate: number;
    llmCostPerHour: number;
  };
  encryption: {
    key: string;
  };
  security: {
    corsOrigins: string[];
    rateLimitWindowMs: number;
    rateLimitMaxRequests: number;
    enableHttps: boolean;
    apiSigningSecret: string;
  };
}

const config: Config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  database: {
    mongoUri:
      process.env.MONGODB_URI ||
      'mongodb+srv://agi_admin:X7UJ82nzrrtORPNM@dev.gdddmth.mongodb.net/curriculum_generator?retryWrites=true&w=majority&appName=dev',
  },
  redis: {
    url: process.env.REDIS_URL || '', // Empty string means Redis is disabled
    tls: process.env.REDIS_TLS === 'true' || process.env.NODE_ENV === 'production', // Enable TLS for Render Redis in production
    maxRetries: parseInt(process.env.REDIS_MAX_RETRIES || '3', 10),
    retryDelay: parseInt(process.env.REDIS_RETRY_DELAY || '1000', 10),
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-large',
    chatModel: process.env.OPENAI_CHAT_MODEL || 'gpt-5',
  },
  auth0: {
    domain: process.env.AUTH0_DOMAIN || '',
    audience: process.env.AUTH0_AUDIENCE || '',
  },
  storage: {
    type: (process.env.STORAGE_TYPE as 'render_disk' | 'cloudinary' | 'local') || 'local',
    uploadDir: process.env.UPLOAD_DIR || './uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '52428800', 10), // 50MB default
  },
  monitoring: {
    sentryDsn: process.env.SENTRY_DSN || '',
    logLevel: process.env.LOG_LEVEL || 'info',
  },
  alerts: {
    errorRate: parseFloat(process.env.ALERT_ERROR_RATE || '10'),
    responseTime: parseFloat(process.env.ALERT_RESPONSE_TIME || '3000'),
    curriculumFailureRate: parseFloat(process.env.ALERT_FAILURE_RATE || '20'),
    llmCostPerHour: parseFloat(process.env.ALERT_LLM_COST || '100'),
  },
  encryption: {
    key: process.env.ENCRYPTION_KEY || 'default-dev-key-change-in-production',
  },
  security: {
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    enableHttps: process.env.ENABLE_HTTPS === 'true',
    apiSigningSecret:
      process.env.API_SIGNING_SECRET || 'default-signing-secret-change-in-production',
  },
};

// Validate required environment variables in production
function validateConfig(): void {
  const errors: string[] = [];

  if (config.nodeEnv === 'production') {
    // Required for production
    if (!process.env.MONGODB_URI) {
      errors.push('MONGODB_URI is required in production');
    }

    if (!process.env.OPENAI_API_KEY) {
      errors.push('OPENAI_API_KEY is required in production');
    }

    if (!process.env.AUTH0_DOMAIN || !process.env.AUTH0_AUDIENCE) {
      console.warn('Warning: AUTH0_DOMAIN/AUTH0_AUDIENCE not set. Auth disabled.');
    }

    if (config.encryption.key === 'default-dev-key-change-in-production') {
      errors.push('ENCRYPTION_KEY must be set to a secure value in production');
    }

    if (config.security.apiSigningSecret === 'default-signing-secret-change-in-production') {
      errors.push('API_SIGNING_SECRET must be set to a secure value in production');
    }

    if (!process.env.SENTRY_DSN) {
      console.warn('Warning: SENTRY_DSN is not set. Error tracking will be disabled.');
    }

    if (!process.env.REDIS_URL) {
      console.warn('Warning: REDIS_URL is not set. Caching and job queue will be disabled.');
    }
  }

  // Validate MongoDB URI format
  if (
    config.database.mongoUri &&
    !config.database.mongoUri.startsWith('mongodb://') &&
    !config.database.mongoUri.startsWith('mongodb+srv://')
  ) {
    errors.push('MONGODB_URI must start with mongodb:// or mongodb+srv://');
  }

  // Validate storage configuration
  if (
    config.storage.type === 'render_disk' &&
    !config.storage.uploadDir.startsWith('/app/uploads')
  ) {
    console.warn(
      'Warning: Using render_disk storage type but UPLOAD_DIR is not set to /app/uploads'
    );
  }

  // Validate encryption key length
  if (config.nodeEnv === 'production' && config.encryption.key.length < 32) {
    errors.push('ENCRYPTION_KEY must be at least 32 characters long');
  }

  if (errors.length > 0) {
    console.error('Configuration validation failed:');
    errors.forEach((error) => console.error(`  - ${error}`));
    throw new Error('Invalid configuration. Please check environment variables.');
  }
}

// Run validation
validateConfig();

export default config;
