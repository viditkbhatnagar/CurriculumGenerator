import { Router, Request, Response } from 'express';
import { validateJWT, loadUser, handleAuthError } from '../middleware/auth';
import { createSession, deleteSession, refreshSession } from '../services/sessionService';
import { createAuditLog } from '../services/auditService';

const router = Router();

/**
 * Get current user profile
 */
router.get('/me', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown',
        },
      });
      return;
    }

    res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role,
      },
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch user profile',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown',
      },
    });
  }
});

/**
 * Create session after authentication
 */
router.post('/session', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown',
        },
      });
      return;
    }

    // Generate session ID (in production, use a more secure method)
    const sessionId = `${req.user.id}-${Date.now()}`;

    // Create session in Redis
    await createSession(
      sessionId,
      {
        userId: req.user.id,
        email: req.user.email,
        role: req.user.role,
        lastActivity: new Date().toISOString(),
      },
      1800 // 30 minutes
    );

    // Log session creation
    await createAuditLog({
      userId: req.user.id,
      action: 'SESSION_CREATED',
      details: {
        sessionId,
        timestamp: new Date().toISOString(),
      },
    });

    res.json({
      sessionId,
      expiresIn: 1800,
    });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create session',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown',
      },
    });
  }
});

/**
 * Refresh session
 */
router.post('/session/refresh', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Session ID is required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown',
        },
      });
      return;
    }

    const refreshed = await refreshSession(sessionId, 1800);

    if (!refreshed) {
      res.status(404).json({
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'Session not found or expired',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown',
        },
      });
      return;
    }

    res.json({
      success: true,
      expiresIn: 1800,
    });
  } catch (error) {
    console.error('Error refreshing session:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to refresh session',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown',
      },
    });
  }
});

/**
 * Logout (delete session)
 */
router.post('/logout', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;

    if (sessionId) {
      await deleteSession(sessionId);
    }

    if (req.user) {
      // Log logout
      await createAuditLog({
        userId: req.user.id,
        action: 'LOGOUT',
        details: {
          sessionId,
          timestamp: new Date().toISOString(),
        },
      });
    }

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('Error during logout:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to logout',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown',
      },
    });
  }
});

// Error handler for auth routes
router.use(handleAuthError);

export default router;
