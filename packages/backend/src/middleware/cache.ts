import { Request, Response, NextFunction } from 'express';
import { cacheService, CacheNamespace } from '../services/cacheService';
import crypto from 'crypto';

/**
 * Cache Middleware
 * Implements API response caching with configurable TTL
 * Implements Requirement 12.1
 */

export interface CacheMiddlewareOptions {
  ttl?: number;
  namespace?: CacheNamespace;
  keyGenerator?: (req: Request) => string;
  shouldCache?: (req: Request, res: Response) => boolean;
}

/**
 * Generate cache key from request
 */
function defaultKeyGenerator(req: Request): string {
  const { method, originalUrl, body, query } = req;
  
  // Include user ID if authenticated
  const userId = (req as any).user?.id || 'anonymous';
  
  // Create a hash of the request details
  const keyData = {
    method,
    url: originalUrl,
    query,
    body: method === 'POST' || method === 'PUT' ? body : undefined,
    userId,
  };
  
  const keyString = JSON.stringify(keyData);
  return crypto.createHash('md5').update(keyString).digest('hex');
}

/**
 * Default cache condition - only cache successful GET requests
 */
function defaultShouldCache(req: Request, res: Response): boolean {
  return req.method === 'GET' && res.statusCode >= 200 && res.statusCode < 300;
}

/**
 * Cache middleware factory
 */
export function cacheMiddleware(options: CacheMiddlewareOptions = {}) {
  const {
    ttl,
    namespace = CacheNamespace.API_RESPONSE,
    keyGenerator = defaultKeyGenerator,
    shouldCache = defaultShouldCache,
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip caching for non-GET requests by default
    if (req.method !== 'GET') {
      return next();
    }

    const cacheKey = keyGenerator(req);

    try {
      // Try to get from cache
      const cachedResponse = await cacheService.get<{
        statusCode: number;
        headers: Record<string, string>;
        body: any;
      }>(cacheKey, { namespace, ttl });

      if (cachedResponse) {
        // Set cached headers
        Object.entries(cachedResponse.headers).forEach(([key, value]) => {
          res.setHeader(key, value);
        });

        // Add cache hit header
        res.setHeader('X-Cache', 'HIT');

        // Send cached response
        return res.status(cachedResponse.statusCode).json(cachedResponse.body);
      }

      // Cache miss - continue to route handler
      res.setHeader('X-Cache', 'MISS');

      // Intercept response to cache it
      const originalJson = res.json.bind(res);
      res.json = function (body: any) {
        // Check if we should cache this response
        if (shouldCache(req, res)) {
          // Cache the response asynchronously (don't wait)
          const responseToCache = {
            statusCode: res.statusCode,
            headers: {
              'Content-Type': res.getHeader('Content-Type') as string || 'application/json',
            },
            body,
          };

          cacheService.set(cacheKey, responseToCache, { namespace, ttl }).catch(err => {
            console.error('Failed to cache response:', err);
          });
        }

        return originalJson(body);
      };

      next();
    } catch (error) {
      console.error('Cache middleware error:', error);
      // Continue without caching on error
      next();
    }
  };
}

/**
 * Cache invalidation middleware
 * Invalidates cache entries when data is modified
 */
export function invalidateCacheMiddleware(patterns: string[], namespace: CacheNamespace = CacheNamespace.API_RESPONSE) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Store original send function
    const originalSend = res.send.bind(res);

    // Override send to invalidate cache after successful response
    res.send = function (body: any) {
      // Only invalidate on successful mutations
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Invalidate cache patterns asynchronously
        Promise.all(
          patterns.map(pattern => cacheService.deletePattern(pattern, { namespace }))
        ).catch(err => {
          console.error('Failed to invalidate cache:', err);
        });
      }

      return originalSend(body);
    };

    next();
  };
}

/**
 * Conditional cache middleware - only cache if condition is met
 */
export function conditionalCache(
  condition: (req: Request) => boolean,
  options: CacheMiddlewareOptions = {}
) {
  const middleware = cacheMiddleware(options);

  return (req: Request, res: Response, next: NextFunction) => {
    if (condition(req)) {
      return middleware(req, res, next);
    }
    next();
  };
}
