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

  return input
    .trim()
    // Remove null bytes
    .replace(/\0/g, '')
    // Remove control characters except newlines and tabs
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Escape HTML special characters
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

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
    return obj.map(item => sanitizeObject(item));
  }

  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
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
      if (!req.body || req.body[field] === undefined || req.body[field] === null || req.body[field] === '') {
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
export const validateFieldTypes = (schema: Record<string, 'string' | 'number' | 'boolean' | 'object' | 'array'>) => {
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
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
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
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
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
  const isValid = verifyRequestSignature(
    req.method,
    req.path,
    req.body,
    timestamp,
    signature
  );
  
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
 * Prevent SQL injection by validating input doesn't contain SQL keywords
 */
export const preventSQLInjection = (req: Request, res: Response, next: NextFunction): void => {
  const sqlKeywords = [
    'DROP', 'DELETE', 'TRUNCATE', 'ALTER', 'EXEC', 'EXECUTE',
    'UNION', 'INSERT', 'UPDATE', '--', ';--', '/*', '*/',
    'xp_', 'sp_', 'SCRIPT', 'JAVASCRIPT', 'ONERROR'
  ];
  
  const checkForSQLInjection = (obj: any): boolean => {
    if (typeof obj === 'string') {
      const upperStr = obj.toUpperCase();
      return sqlKeywords.some(keyword => upperStr.includes(keyword));
    }
    
    if (Array.isArray(obj)) {
      return obj.some(item => checkForSQLInjection(item));
    }
    
    if (typeof obj === 'object' && obj !== null) {
      return Object.values(obj).some(value => checkForSQLInjection(value));
    }
    
    return false;
  };
  
  if (checkForSQLInjection(req.body) || checkForSQLInjection(req.query) || checkForSQLInjection(req.params)) {
    loggingService.warn('Potential SQL injection attempt detected', {
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
 * Prevent XSS attacks by checking for script tags and event handlers
 */
export const preventXSS = (req: Request, res: Response, next: NextFunction): void => {
  const xssPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi, // Event handlers like onclick=
    /<iframe/gi,
    /<object/gi,
    /<embed/gi,
  ];
  
  const checkForXSS = (obj: any): boolean => {
    if (typeof obj === 'string') {
      return xssPatterns.some(pattern => pattern.test(obj));
    }
    
    if (Array.isArray(obj)) {
      return obj.some(item => checkForXSS(item));
    }
    
    if (typeof obj === 'object' && obj !== null) {
      return Object.values(obj).some(value => checkForXSS(value));
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
export const securityValidation = [
  sanitizeInput,
  preventSQLInjection,
  preventXSS,
];
