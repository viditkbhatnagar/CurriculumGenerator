import { createClient, RedisClientType } from 'redis';
import config from '../config';

let redisClient: RedisClientType | null = null;

/**
 * Initialize Redis client for session management
 */
export async function initRedisClient(): Promise<RedisClientType> {
  // Check if Redis URL is configured
  if (!config.redis.url) {
    throw new Error('Redis URL not configured - Redis is disabled');
  }

  if (redisClient) {
    return redisClient;
  }

  const redisOptions: any = {
    url: config.redis.url,
    socket: {
      reconnectStrategy: (retries: number) => {
        if (retries > config.redis.maxRetries) {
          console.error(`Redis reconnection failed after ${config.redis.maxRetries} attempts`);
          return new Error('Redis reconnection limit exceeded');
        }
        return Math.min(retries * config.redis.retryDelay, 5000);
      },
      connectTimeout: 10000,
    },
  };

  // Enable TLS for Render Redis in production
  if (config.redis.tls) {
    redisOptions.socket.tls = true;
    redisOptions.socket.rejectUnauthorized = false; // Render Redis uses self-signed certs
    console.log('Session Redis TLS enabled for Render deployment');
  }

  redisClient = createClient(redisOptions);

  redisClient.on('error', (err) => {
    console.error('Redis Client Error:', err);
  });

  redisClient.on('connect', () => {
    console.log('Redis Client Connected');
  });

  redisClient.on('ready', () => {
    console.log('Redis Client Ready');
  });

  redisClient.on('reconnecting', () => {
    console.log('Redis Client Reconnecting');
  });

  await redisClient.connect();

  return redisClient;
}

/**
 * Get Redis client instance
 */
export function getRedisClient(): RedisClientType {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call initRedisClient() first.');
  }
  return redisClient;
}

/**
 * Close Redis connection
 */
export async function closeRedisClient(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

interface SessionData {
  userId: string;
  email: string;
  role: string;
  lastActivity: string;
}

/**
 * Create or update a session
 */
export async function createSession(
  sessionId: string,
  data: SessionData,
  ttlSeconds: number = 1800 // 30 minutes default
): Promise<void> {
  const client = getRedisClient();
  const key = `session:${sessionId}`;
  
  await client.setEx(
    key,
    ttlSeconds,
    JSON.stringify({
      ...data,
      lastActivity: new Date().toISOString(),
    })
  );
}

/**
 * Get session data
 */
export async function getSession(sessionId: string): Promise<SessionData | null> {
  const client = getRedisClient();
  const key = `session:${sessionId}`;
  
  const data = await client.get(key);
  
  if (!data) {
    return null;
  }

  return JSON.parse(data) as SessionData;
}

/**
 * Update session activity timestamp and extend TTL
 */
export async function refreshSession(
  sessionId: string,
  ttlSeconds: number = 1800
): Promise<boolean> {
  const client = getRedisClient();
  const key = `session:${sessionId}`;
  
  const session = await getSession(sessionId);
  
  if (!session) {
    return false;
  }

  await createSession(sessionId, session, ttlSeconds);
  return true;
}

/**
 * Delete a session (logout)
 */
export async function deleteSession(sessionId: string): Promise<boolean> {
  const client = getRedisClient();
  const key = `session:${sessionId}`;
  
  const result = await client.del(key);
  return result > 0;
}

/**
 * Delete all sessions for a user
 */
export async function deleteUserSessions(userId: string): Promise<number> {
  const client = getRedisClient();
  
  // Scan for all session keys
  const keys: string[] = [];
  let cursor = 0;

  do {
    const result = await client.scan(cursor, {
      MATCH: 'session:*',
      COUNT: 100,
    });

    cursor = result.cursor;
    keys.push(...result.keys);
  } while (cursor !== 0);

  // Filter sessions by userId
  let deletedCount = 0;
  
  for (const key of keys) {
    const data = await client.get(key);
    if (data) {
      const session = JSON.parse(data) as SessionData;
      if (session.userId === userId) {
        await client.del(key);
        deletedCount++;
      }
    }
  }

  return deletedCount;
}

/**
 * Check if session exists and is valid
 */
export async function isSessionValid(sessionId: string): Promise<boolean> {
  const session = await getSession(sessionId);
  return session !== null;
}

/**
 * Get all active sessions count
 */
export async function getActiveSessionsCount(): Promise<number> {
  const client = getRedisClient();
  
  let count = 0;
  let cursor = 0;

  do {
    const result = await client.scan(cursor, {
      MATCH: 'session:*',
      COUNT: 100,
    });

    cursor = result.cursor;
    count += result.keys.length;
  } while (cursor !== 0);

  return count;
}
