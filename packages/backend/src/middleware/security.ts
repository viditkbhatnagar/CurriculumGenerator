import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';
import config from '../config';
import { loggingService } from '../services/loggingService';

/**
 * Input validation and sanitization middleware
 */

// Common regex patterns for validation
const PATTERNS = {
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  objectId: /^[0-9a-f]{24}$/i, // MongoDB ObjectId format
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  alphanumeric: /^[a-zA-Z0-9\s-_]+$/,
  url: /^https?:\/\/.+/,
  safeString: /^[a-zA-Z0-9\s\-_.,!?()'"]+$/,
};

/**
 * Sanitize string input by removing potentially dangerous characters
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  return (
    input
      .trim()
      // Remove null bytes
      .replace(/\0/g, '')
      // Remove control characters except newlines and tabs
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
  );
  // NOTE: input is intentionally NOT HTML-escaped. Escaping on the way in
  // corrupts stored data — a title "A & B" becomes "A &amp; B" in the DB
  // and in every Word/PDF export. XSS is prevented at render time instead
  // (React escapes by default; exports render text, not HTML).
}

const PROTOTYPE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Sanitize object recursively
 */
export function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item));
  }

  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const key in obj) {
      // A JSON "__proto__" key copied onto a plain object becomes its prototype: a body of
      // {"__proto__":{"role":"administrator"}} made req.body.role read "administrator".
      if (PROTOTYPE_KEYS.has(key)) continue;
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
    }
    return sanitized;
  }

  return obj;
}

/**
 * Validate UUID format
 */
export function isValidUUID(uuid: string): boolean {
  return PATTERNS.uuid.test(uuid);
}

/**
 * Validate MongoDB ObjectId format
 */
export function isValidObjectId(id: string): boolean {
  return PATTERNS.objectId.test(id);
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  return PATTERNS.email.test(email);
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  return PATTERNS.url.test(url);
}

/**
 * Middleware to sanitize request body
 */
export const sanitizeBody = (req: Request, res: Response, next: NextFunction): void => {
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  next();
};

/**
 * Middleware to sanitize query parameters
 */
export const sanitizeQuery = (req: Request, res: Response, next: NextFunction): void => {
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  next();
};

/**
 * Middleware to sanitize URL parameters
 */
export const sanitizeParams = (req: Request, res: Response, next: NextFunction): void => {
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }
  next();
};

/**
 * Comprehensive input sanitization middleware
 */
export const sanitizeInput = (req: Request, res: Response, next: NextFunction): void => {
  sanitizeBody(req, res, () => {});
  sanitizeQuery(req, res, () => {});
  sanitizeParams(req, res, () => {});
  next();
};

/**
 * Validate UUID parameter middleware
 */
export const validateUUIDParam = (paramName: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const value = req.params[paramName];

    if (!value || !isValidUUID(value)) {
      res.status(400).json({
        error: {
          code: 'INVALID_UUID',
          message: `Invalid UUID format for parameter: ${paramName}`,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown',
        },
      });
      return;
    }

    next();
  };
};

/**
 * Validate MongoDB ObjectId parameter middleware
 */
export const validateObjectIdParam = (paramName: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const value = req.params[paramName];

    if (!value || !isValidObjectId(value)) {
      res.status(400).json({
        error: {
          code: 'INVALID_OBJECT_ID',
          message: `Invalid ObjectId format for parameter: ${paramName}`,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown',
        },
      });
      return;
    }

    next();
  };
};

/**
 * Validate required fields in request body
 */
export const validateRequiredFields = (fields: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const missingFields: string[] = [];

    for (const field of fields) {
      if (
        !req.body ||
        req.body[field] === undefined ||
        req.body[field] === null ||
        req.body[field] === ''
      ) {
        missingFields.push(field);
      }
    }

    if (missingFields.length > 0) {
      res.status(400).json({
        error: {
          code: 'MISSING_REQUIRED_FIELDS',
          message: `Missing required fields: ${missingFields.join(', ')}`,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown',
        },
      });
      return;
    }

    next();
  };
};

/**
 * Validate field types in request body
 */
export const validateFieldTypes = (
  schema: Record<string, 'string' | 'number' | 'boolean' | 'object' | 'array'>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const invalidFields: string[] = [];

    for (const [field, expectedType] of Object.entries(schema)) {
      if (req.body && req.body[field] !== undefined) {
        const actualType = Array.isArray(req.body[field]) ? 'array' : typeof req.body[field];

        if (actualType !== expectedType) {
          invalidFields.push(`${field} (expected ${expectedType}, got ${actualType})`);
        }
      }
    }

    if (invalidFields.length > 0) {
      res.status(400).json({
        error: {
          code: 'INVALID_FIELD_TYPES',
          message: `Invalid field types: ${invalidFields.join(', ')}`,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown',
        },
      });
      return;
    }

    next();
  };
};

/**
 * API request signing for sensitive operations
 */
export interface SignedRequest {
  timestamp: number;
  signature: string;
}

/**
 * Generate signature for API request
 */
export function generateRequestSignature(
  method: string,
  path: string,
  body: any,
  timestamp: number,
  secret: string = config.security.apiSigningSecret
): string {
  const payload = `${method}:${path}:${JSON.stringify(body)}:${timestamp}`;
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Verify API request signature
 */
export function verifyRequestSignature(
  method: string,
  path: string,
  body: any,
  timestamp: number,
  signature: string,
  secret: string = config.security.apiSigningSecret
): boolean {
  const expectedSignature = generateRequestSignature(method, path, body, timestamp, secret);

  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  } catch {
    return false;
  }
}

/**
 * Middleware to verify API request signature for sensitive operations
 */
export const requireSignature = (req: Request, res: Response, next: NextFunction): void => {
  const signature = req.headers['x-api-signature'] as string;
  const timestamp = parseInt(req.headers['x-api-timestamp'] as string, 10);

  if (!signature || !timestamp) {
    loggingService.warn('Missing API signature or timestamp', {
      path: req.path,
      method: req.method,
      userId: req.user?.id,
    });

    res.status(401).json({
      error: {
        code: 'MISSING_SIGNATURE',
        message: 'API signature required for this operation',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown',
      },
    });
    return;
  }

  // Check timestamp is within 5 minutes
  const now = Date.now();
  const timeDiff = Math.abs(now - timestamp);
  const maxTimeDiff = 5 * 60 * 1000; // 5 minutes

  if (timeDiff > maxTimeDiff) {
    loggingService.warn('API signature timestamp expired', {
      path: req.path,
      method: req.method,
      timestamp,
      timeDiff,
      userId: req.user?.id,
    });

    res.status(401).json({
      error: {
        code: 'SIGNATURE_EXPIRED',
        message: 'API signature timestamp expired',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown',
      },
    });
    return;
  }

  // Verify signature
  const isValid = verifyRequestSignature(req.method, req.path, req.body, timestamp, signature);

  if (!isValid) {
    loggingService.warn('Invalid API signature', {
      path: req.path,
      method: req.method,
      userId: req.user?.id,
    });

    res.status(401).json({
      error: {
        code: 'INVALID_SIGNATURE',
        message: 'Invalid API signature',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown',
      },
    });
    return;
  }

  next();
};

/**
 * Refuses any field name that starts with "$", anywhere in the body, query or params.
 *
 * MongoDB reads such a key as an operator, so a query string like ?status[$ne]=zzz turned a
 * route's equality filter into "anything but zzz": on production it listed all 46 programmes
 * where ?status=zzz listed none (2026-10-01). No client sends "$" keys; values may contain "$".
 *
 * This replaces a SQL keyword filter: the app has no SQL database, and the filter only ever
 * refused curriculum text such as "INSERT INTO" in a data-analytics lesson.
 */
export const rejectOperatorKeys = (req: Request, res: Response, next: NextFunction): void => {
  if ([req.body, req.query, req.params].some(hasOperatorKey)) {
    res.status(400).json({
      error: {
        code: 'INVALID_INPUT',
        message: 'Field names may not start with "$"',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown',
      },
    });
    return;
  }
  next();
};

/** Whether any key in a value starts with "$", at any depth (walked without recursion). */
function hasOperatorKey(root: unknown): boolean {
  const stack: unknown[] = [root];
  while (stack.length) {
    const value = stack.pop();
    if (!value || typeof value !== 'object') continue;
    if (Array.isArray(value)) {
      for (const item of value) stack.push(item);
      continue;
    }
    for (const key of Object.keys(value)) {
      if (key.startsWith('$')) return true;
      stack.push((value as Record<string, unknown>)[key]);
    }
  }
  return false;
}

/**
 * What the XSS check refuses: markup that could run script if a stored string were ever rendered
 * as HTML. Stored text is rendered as text (React escapes it and the exports write plain runs),
 * so this is a tripwire, not the boundary; links are checked where they are rendered.
 *
 * - An event handler counts only inside a tag (`<img onerror=...>`, `<svg/onload=...>`,
 *   `<img src="x"onerror=...>`). The old rule, any word ending in "on" followed by "=",
 *   refused curriculum prose such as "Conversion = orders / visits" and "Cancellations=72".
 * - Opening tags only, and every gap bounded. These run on every request before routing, and an
 *   unbounded `[^>]*` or a lazy match to a closing tag is quadratic: a 200,000-character
 *   "<a<a<a..." took 9.5 s, stalling the whole API. Each pattern here is linear.
 * - No `g` or `y` flag: the patterns are shared, and a sticky or global pattern keeps its
 *   position between `.test()` calls, so the next request could slip past it.
 */
export const XSS_PATTERNS: readonly RegExp[] = Object.freeze([
  /<script[\s/>]/i,
  /javascript:/i,
  /<[a-z][^>]{0,300}[\s/"']on[a-z]+\s*=/i,
  /<(?:iframe|object|embed)[\s/>]/i,
]);

/** Whether a string holds markup the XSS check refuses. */
export function containsXSS(text: string): boolean {
  return XSS_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Prevent XSS attacks by checking for script tags and event handlers
 */
export const preventXSS = (req: Request, res: Response, next: NextFunction): void => {
  const checkForXSS = (obj: any): boolean => {
    if (typeof obj === 'string') {
      return containsXSS(obj);
    }

    if (Array.isArray(obj)) {
      return obj.some((item) => checkForXSS(item));
    }

    if (typeof obj === 'object' && obj !== null) {
      return Object.values(obj).some((value) => checkForXSS(value));
    }

    return false;
  };

  if (checkForXSS(req.body) || checkForXSS(req.query) || checkForXSS(req.params)) {
    loggingService.warn('Potential XSS attempt detected', {
      path: req.path,
      method: req.method,
      ip: req.ip,
      userId: req.user?.id,
    });

    res.status(400).json({
      error: {
        code: 'INVALID_INPUT',
        message: 'Invalid input detected',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown',
      },
    });
    return;
  }

  next();
};

/**
 * Combined security validation middleware
 */
export const securityValidation = [sanitizeInput, rejectOperatorKeys, preventXSS];
