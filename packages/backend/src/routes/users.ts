import { Router, Request, Response } from 'express';
import { validateJWT, loadUser, requireRole, auditAction, handleAuthError } from '../middleware/auth';
import { UserRole } from '../types/auth';
import {
  getUserById,
  listUsers,
  updateUserRole,
  deleteUser,
} from '../services/userService';
import { getAuditLogsByUser } from '../services/auditService';

const router = Router();

// All user routes require authentication
router.use(validateJWT, loadUser);

/**
 * List all users (admin only)
 */
router.get(
  '/',
  requireRole(UserRole.ADMINISTRATOR),
  auditAction('LIST_USERS', 'users'),
  async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const { users, total } = await listUsers(limit, offset);

      res.json({
        users: users.map((u) => ({
          id: u.id,
          email: u.email,
          role: u.role,
        })),
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      });
    } catch (error) {
      console.error('Error listing users:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to list users',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown',
        },
      });
    }
  }
);

/**
 * Get user by ID (admin only)
 */
router.get(
  '/:id',
  requireRole(UserRole.ADMINISTRATOR),
  auditAction('GET_USER', 'users'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const user = await getUserById(id);

      if (!user) {
        res.status(404).json({
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
        return;
      }

      res.json({
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      });
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch user',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown',
        },
      });
    }
  }
);

/**
 * Update user role (admin only)
 */
router.put(
  '/:id/role',
  requireRole(UserRole.ADMINISTRATOR),
  auditAction('UPDATE_USER_ROLE', 'users'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { role } = req.body;

      if (!role || !Object.values(UserRole).includes(role)) {
        res.status(400).json({
          error: {
            code: 'INVALID_ROLE',
            message: 'Invalid role. Must be one of: administrator, sme, student',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
        return;
      }

      const user = await updateUserRole(id, role);

      if (!user) {
        res.status(404).json({
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
        return;
      }

      res.json({
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      });
    } catch (error) {
      console.error('Error updating user role:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update user role',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown',
        },
      });
    }
  }
);

/**
 * Delete user (admin only)
 */
router.delete(
  '/:id',
  requireRole(UserRole.ADMINISTRATOR),
  auditAction('DELETE_USER', 'users'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Prevent self-deletion
      if (req.user?.id === id) {
        res.status(400).json({
          error: {
            code: 'CANNOT_DELETE_SELF',
            message: 'Cannot delete your own account',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
        return;
      }

      const deleted = await deleteUser(id);

      if (!deleted) {
        res.status(404).json({
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
        return;
      }

      res.json({
        success: true,
        message: 'User deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to delete user',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown',
        },
      });
    }
  }
);

/**
 * Get user audit logs (admin or own logs)
 */
router.get(
  '/:id/audit-logs',
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Users can only view their own logs unless they're admin
      if (req.user?.role !== UserRole.ADMINISTRATOR && req.user?.id !== id) {
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

      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const { logs, total } = await getAuditLogsByUser(id, limit, offset);

      res.json({
        logs,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      });
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch audit logs',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown',
        },
      });
    }
  }
);

// Error handler for user routes
router.use(handleAuthError);

export default router;
