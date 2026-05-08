import { Request, Response, NextFunction } from 'express';
import { expressjwt, GetVerificationKey } from 'express-jwt';
import jwksRsa from 'jwks-rsa';
import config from '../config';
import { UserRole, AuthUser } from '../types/auth';
import {
  getUserByAuthProviderId,
  getUserByEmail,
  createUser,
  updateLastLogin,
} from '../services/userService';
import { User } from '../models/User';
import { userFromToken as userFromOurToken } from '../services/passwordAuthService';
import { createAuditLog } from '../services/auditService';

// Extend Express Request type to include auth
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: {
        sub: string;
        [key: string]: any;
      };
      user?: AuthUser;
    }
  }
}

// Check if Auth0 is configured
const isAuth0Configured = config.auth0.domain && config.auth0.audience;

// Auth bypass middleware when Auth0 is not configured
const authBypass = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  if (!isAuth0Configured) {
    // Create a mock auth object when Auth0 is disabled
    req.auth = {
      sub: 'anonymous-user',
      email: 'anonymous@curriculum-app.com',
    };
    next();
  } else {
    next();
  }
};

/**
 * JWT validation middleware. Tries three things in order:
 *   1. Our built-in HS256 JWT (issued by /api/auth/login). If present and
 *      valid, attaches req.auth + skips Auth0.
 *   2. Auth0 RS256 JWT, if AUTH0_DOMAIN+AUDIENCE are set.
 *   3. Mock-admin bypass when neither is configured (preserves dev path).
 */
export const validateJWT = (req: Request, res: Response, next: NextFunction): void => {
  // Try our built-in JWT first — covers the email+password login path
  const authHeader = req.headers.authorization;
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (bearer) {
    userFromOurToken(bearer)
      .then((user) => {
        if (user) {
          req.auth = { sub: user.authProviderId || `local:${user.email}`, email: user.email };
          // Stash the resolved user so loadUser can skip the DB hop
          (req as any)._resolvedUser = user;
          return next();
        }
        // Token didn't decode/find user — fall through to Auth0 if configured
        return continueWithAuth0OrBypass(req, res, next);
      })
      .catch(() => continueWithAuth0OrBypass(req, res, next));
    return;
  }

  continueWithAuth0OrBypass(req, res, next);
};

function continueWithAuth0OrBypass(req: Request, res: Response, next: NextFunction): void {
  if (!isAuth0Configured) {
    authBypass(req, res, next);
    return;
  }

  // Use Auth0 JWT validation
  expressjwt({
    secret: jwksRsa.expressJwtSecret({
      cache: true,
      rateLimit: true,
      jwksRequestsPerMinute: 5,
      jwksUri: `https://${config.auth0.domain}/.well-known/jwks.json`,
    }) as GetVerificationKey,
    audience: config.auth0.audience,
    issuer: `https://${config.auth0.domain}/`,
    algorithms: ['RS256'],
  })(req, res, next);
}

/**
 * Middleware to load user from database and attach to request
 */
export const loadUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Fast path: our built-in JWT already resolved the user in validateJWT
    const preResolved = (req as any)._resolvedUser as AuthUser | undefined;
    if (preResolved) {
      req.user = preResolved;
      return next();
    }

    if (!req.auth?.sub) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown',
        },
      });
      return;
    }

    const authProviderId = req.auth.sub;
    const email = req.auth.email || req.auth['https://curriculum-app.com/email'];

    // Create a mock admin user when Auth0 is not configured (any environment)
    if (!isAuth0Configured) {
      req.user = {
        id: '507f1f77bcf86cd799439011', // Valid MongoDB ObjectId for anonymous mode
        email: email || 'anonymous@curriculum-app.com',
        role: UserRole.ADMINISTRATOR, // Admin role for full access when auth disabled
        authProviderId,
      };
      next();
      return;
    }

    // Try to get existing user
    let user = await getUserByAuthProviderId(authProviderId);

    // If no user matches the Auth0 sub yet, look for an admin-invited record
    // by email. If we find one with a "pending:<email>" placeholder, promote
    // it to the real Auth0 sub now (faculty allowlist first-login flow).
    if (!user && email) {
      const invited = await getUserByEmail(email);
      if (invited && invited.authProviderId.startsWith('pending:')) {
        await User.findByIdAndUpdate(invited.id, {
          authProviderId,
          lastLogin: new Date(),
        });
        user = await getUserByAuthProviderId(authProviderId);
      }
    }

    // Optional faculty allowlist enforcement. When FACULTY_ALLOWLIST_ENFORCED
    // is set, any first-time login from an email that an admin has NOT
    // invited is rejected. Default behaviour (env unset) preserves the
    // legacy auto-provision-as-SME flow so existing deployments keep working.
    const allowlistEnforced =
      (process.env.FACULTY_ALLOWLIST_ENFORCED || '').toLowerCase() === 'true';
    if (!user && allowlistEnforced) {
      res.status(403).json({
        error: {
          code: 'NOT_INVITED',
          message:
            'This email is not on the authorized faculty list. Please contact an administrator.',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown',
        },
      });
      return;
    }

    // If user still doesn't exist, create them with the legacy default role
    if (!user && email) {
      user = await createUser({
        email,
        role: UserRole.SME, // Default role, can be changed by admin
        authProviderId,
      });
    }

    if (!user) {
      res.status(401).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found in system',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown',
        },
      });
      return;
    }

    // Update last login
    await updateLastLogin(user.id);

    // Attach user to request
    req.user = user;

    next();
  } catch (error) {
    console.error('Error loading user:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to load user',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown',
      },
    });
  }
};

/**
 * Middleware to check if user has required role(s)
 */
export const requireRole = (...roles: UserRole[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
        return;
      }

      if (!roles.includes(req.user.role)) {
        // Log unauthorized access attempt
        await createAuditLog({
          userId: req.user.id,
          action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
          resourceType: req.path,
          details: {
            requiredRoles: roles,
            userRole: req.user.role,
            method: req.method,
            path: req.path,
          },
        });

        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Insufficient permissions',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
        return;
      }

      next();
    } catch (error) {
      console.error('Error checking role:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to verify permissions',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown',
        },
      });
    }
  };
};

/**
 * Middleware to audit authenticated actions
 */
export const auditAction = (action: string, resourceType?: string) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (req.user) {
        // Store original send function
        const originalSend = res.send;

        // Override send to capture response
        res.send = function (data: any): Response {
          // Only log successful actions (2xx status codes)
          if (res.statusCode >= 200 && res.statusCode < 300) {
            createAuditLog({
              userId: req.user!.id,
              action,
              resourceType: resourceType || req.path,
              resourceId: req.params.id || undefined,
              details: {
                method: req.method,
                path: req.path,
                params: req.params,
                query: req.query,
                statusCode: res.statusCode,
              },
            }).catch((error) => {
              console.error('Failed to create audit log:', error);
            });
          }

          // Call original send
          return originalSend.call(this, data);
        };
      }

      next();
    } catch (error) {
      console.error('Error in audit middleware:', error);
      next(); // Don't block request if audit fails
    }
  };
};

/**
 * Error handler for JWT validation errors
 */
export const handleAuthError = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (err.name === 'UnauthorizedError') {
    res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired token',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown',
      },
    });
    return;
  }

  next(err);
};
