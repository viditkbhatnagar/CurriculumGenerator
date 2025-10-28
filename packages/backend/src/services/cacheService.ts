import { createClient, RedisClientType } from 'redis';
import config from '../config';

/**
 * Cache Service
 * Implements Redis caching with different TTL strategies
 * Implements Requirements 12.1, 12.4
 */

export enum CacheNamespace {
  API_RESPONSE = 'api',
  KNOWLEDGE_BASE = 'kb',
  GENERATED_CONTENT = 'content',
  EMBEDDINGS = 'embeddings',
  LLM_RESPONSE = 'llm',
}

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  namespace?: CacheNamespace;
}

export class CacheService {
  private client: RedisClientType;
  private isConnected: boolean = false;

  // Default TTL values (in seconds)
  private readonly defaultTTLs: Record<CacheNamespace, number> = {
    [CacheNamespace.API_RESPONSE]: 300, // 5 minutes
    [CacheNamespace.KNOWLEDGE_BASE]: 3600, // 1 hour
    [CacheNamespace.GENERATED_CONTENT]: 86400, // 24 hours
    [CacheNamespace.EMBEDDINGS]: 604800, // 7 days (embeddings rarely change)
    [CacheNamespace.LLM_RESPONSE]: 3600, // 1 hour
  };

  constructor() {
    // Only create client if Redis URL is configured
    if (config.redis.url) {
      const redisOptions: any = {
        url: config.redis.url,
        socket: {
          reconnectStrategy: (retries: number) => {
            if (retries > config.redis.maxRetries) {
              console.error(`Redis reconnection failed after ${config.redis.maxRetries} attempts`);
              return new Error('Redis reconnection limit exceeded');
            }
            // Exponential backoff with configured delay
            return Math.min(retries * config.redis.retryDelay, 5000);
          },
          connectTimeout: 10000, // 10 seconds
        },
      };

      // Enable TLS for Render Redis in production
      if (config.redis.tls) {
        redisOptions.socket.tls = true;
        redisOptions.socket.rejectUnauthorized = false; // Render Redis uses self-signed certs
        console.log('Redis TLS enabled for Render deployment');
      }

      this.client = createClient(redisOptions);
    } else {
      // Create a mock client that does nothing
      this.client = null as any;
    }

    this.setupEventHandlers();
  }

  /**
   * Setup Redis event handlers
   */
  private setupEventHandlers(): void {
    if (!this.client) return; // Skip if Redis is disabled

    this.client.on('error', (err) => {
      console.error('Redis Client Error:', err);
      this.isConnected = false;
    });

    this.client.on('connect', () => {
      console.log('Redis Client Connected');
      this.isConnected = true;
    });

    this.client.on('ready', () => {
      console.log('Redis Client Ready');
      this.isConnected = true;
    });

    this.client.on('reconnecting', () => {
      console.log('Redis Client Reconnecting');
      this.isConnected = false;
    });
  }

  /**
   * Connect to Redis
   */
  async connect(): Promise<void> {
    if (!this.client) {
      throw new Error('Redis is not configured');
    }
    if (!this.isConnected) {
      await this.client.connect();
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.quit();
      this.isConnected = false;
    }
  }

  /**
   * Generate cache key with namespace
   */
  private generateKey(key: string, namespace: CacheNamespace): string {
    return `${namespace}:${key}`;
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    if (!this.isConnected) {
      console.warn('Redis not connected, skipping cache get');
      return null;
    }

    try {
      const namespace = options.namespace || CacheNamespace.API_RESPONSE;
      const cacheKey = this.generateKey(key, namespace);
      const value = await this.client.get(cacheKey);

      if (value === null) {
        return null;
      }

      return JSON.parse(value) as T;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    if (!this.isConnected) {
      console.warn('Redis not connected, skipping cache set');
      return;
    }

    try {
      const namespace = options.namespace || CacheNamespace.API_RESPONSE;
      const ttl = options.ttl || this.defaultTTLs[namespace];
      const cacheKey = this.generateKey(key, namespace);
      const serializedValue = JSON.stringify(value);

      await this.client.setEx(cacheKey, ttl, serializedValue);
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string, options: CacheOptions = {}): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      const namespace = options.namespace || CacheNamespace.API_RESPONSE;
      const cacheKey = this.generateKey(key, namespace);
      await this.client.del(cacheKey);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  /**
   * Delete all keys matching a pattern
   */
  async deletePattern(pattern: string, options: CacheOptions = {}): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      const namespace = options.namespace || CacheNamespace.API_RESPONSE;
      const cachePattern = this.generateKey(pattern, namespace);
      
      // Use SCAN to find matching keys
      const keys: string[] = [];
      for await (const key of this.client.scanIterator({ MATCH: cachePattern })) {
        keys.push(key);
      }

      if (keys.length > 0) {
        await this.client.del(keys);
      }
    } catch (error) {
      console.error('Cache delete pattern error:', error);
    }
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: string, options: CacheOptions = {}): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    try {
      const namespace = options.namespace || CacheNamespace.API_RESPONSE;
      const cacheKey = this.generateKey(key, namespace);
      const result = await this.client.exists(cacheKey);
      return result === 1;
    } catch (error) {
      console.error('Cache exists error:', error);
      return false;
    }
  }

  /**
   * Get or set pattern: get from cache, or compute and cache if not found
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.get<T>(key, options);
    if (cached !== null) {
      return cached;
    }

    // Compute value
    const value = await factory();

    // Cache the result
    await this.set(key, value, options);

    return value;
  }

  /**
   * Increment a counter in cache
   */
  async increment(key: string, options: CacheOptions = {}): Promise<number> {
    if (!this.isConnected) {
      return 0;
    }

    try {
      const namespace = options.namespace || CacheNamespace.API_RESPONSE;
      const cacheKey = this.generateKey(key, namespace);
      const value = await this.client.incr(cacheKey);

      // Set expiry if specified
      const ttl = options.ttl || this.defaultTTLs[namespace];
      await this.client.expire(cacheKey, ttl);

      return value;
    } catch (error) {
      console.error('Cache increment error:', error);
      return 0;
    }
  }

  /**
   * Get multiple values from cache
   */
  async mget<T>(keys: string[], options: CacheOptions = {}): Promise<(T | null)[]> {
    if (!this.isConnected || keys.length === 0) {
      return keys.map(() => null);
    }

    try {
      const namespace = options.namespace || CacheNamespace.API_RESPONSE;
      const cacheKeys = keys.map(key => this.generateKey(key, namespace));
      const values = await this.client.mGet(cacheKeys);

      return values.map(value => {
        if (value === null) {
          return null;
        }
        try {
          return JSON.parse(value) as T;
        } catch {
          return null;
        }
      });
    } catch (error) {
      console.error('Cache mget error:', error);
      return keys.map(() => null);
    }
  }

  /**
   * Set multiple values in cache
   */
  async mset<T>(entries: Array<{ key: string; value: T }>, options: CacheOptions = {}): Promise<void> {
    if (!this.isConnected || entries.length === 0) {
      return;
    }

    try {
      const namespace = options.namespace || CacheNamespace.API_RESPONSE;
      const ttl = options.ttl || this.defaultTTLs[namespace];

      // Use pipeline for better performance
      const pipeline = this.client.multi();

      for (const entry of entries) {
        const cacheKey = this.generateKey(entry.key, namespace);
        const serializedValue = JSON.stringify(entry.value);
        pipeline.setEx(cacheKey, ttl, serializedValue);
      }

      await pipeline.exec();
    } catch (error) {
      console.error('Cache mset error:', error);
    }
  }

  /**
   * Clear all cache in a namespace
   */
  async clearNamespace(namespace: CacheNamespace): Promise<void> {
    await this.deletePattern('*', { namespace });
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    connected: boolean;
    dbSize: number;
    memoryUsed: string;
  }> {
    if (!this.isConnected) {
      return {
        connected: false,
        dbSize: 0,
        memoryUsed: '0',
      };
    }

    try {
      const dbSize = await this.client.dbSize();
      const info = await this.client.info('memory');
      
      // Parse memory info
      const memoryMatch = info.match(/used_memory_human:(.+)/);
      const memoryUsed = memoryMatch ? memoryMatch[1].trim() : '0';

      return {
        connected: true,
        dbSize,
        memoryUsed,
      };
    } catch (error) {
      console.error('Cache stats error:', error);
      return {
        connected: this.isConnected,
        dbSize: 0,
        memoryUsed: '0',
      };
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      console.error('Cache health check error:', error);
      return false;
    }
  }
}

// Singleton instance
export const cacheService = new CacheService();
