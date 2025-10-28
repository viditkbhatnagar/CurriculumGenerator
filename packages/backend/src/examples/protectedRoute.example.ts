/**
 * Example: How to create protected routes with authentication and authorization
 * 
 * This file demonstrates various patterns for protecting API endpoints
 * with authentication, role-based access control, and audit logging.
 */

import { Router, Request, Response } from 'express';
import { validateJWT, loadUser, requireRole, auditAction } from '../middleware/auth';
import { UserRole } from '../types/auth';

const router = Router();

// ============================================================================
// Example 1: Basic Authentication
// ============================================================================
// Requires valid JWT token and loads user from database

router.get('/profile', validateJWT, loadUser, async (req: Request, res: Response) => {
  // req.user is now available with user data
  res.json({
    message: 'This route requires authentication',
    user: {
      id: req.user?.id,
      email: req.user?.email,
      role: req.user?.role,
    },
  });
});

// ============================================================================
// Example 2: Role-Based Access Control (Single Role)
// ============================================================================
// Only administrators can access this route

router.get(
  '/admin/dashboard',
  validateJWT,
  loadUser,
  requireRole(UserRole.ADMINISTRATOR),
  async (req: Request, res: Response) => {
    res.json({
      message: 'Admin-only content',
      data: {
        // Admin dashboard data
      },
    });
  }
);

// ============================================================================
// Example 3: Multiple Roles Allowed
// ============================================================================
// Both administrators and SMEs can access this route

router.post(
  '/programs',
  validateJWT,
  loadUser,
  requireRole(UserRole.ADMINISTRATOR, UserRole.SME),
  async (req: Request, res: Response) => {
    // Create program logic
    res.json({
      message: 'Program created',
      createdBy: req.user?.id,
    });
  }
);

// ============================================================================
// Example 4: With Audit Logging
// ============================================================================
// Logs all successful actions to audit_logs table

router.put(
  '/programs/:id',
  validateJWT,
  loadUser,
  requireRole(UserRole.ADMINISTRATOR, UserRole.SME),
  auditAction('UPDATE_PROGRAM', 'programs'),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    
    // Update program logic
    
    res.json({
      message: 'Program updated',
      programId: id,
      updatedBy: req.user?.id,
    });
  }
);

// ============================================================================
// Example 5: Resource Ownership Check
// ============================================================================
// Users can only access their own resources (unless admin)

router.get(
  '/programs/:id',
  validateJWT,
  loadUser,
  async (req: Request, res: Response) => {
    const { id } = req.params;
    
    // Fetch program from database
    const program = await fetchProgramById(id);
    
    if (!program) {
      res.status(404).json({
        error: {
          code: 'PROGRAM_NOT_FOUND',
          message: 'Program not found',
        },
      });
      return;
    }
    
    // Check ownership (admins can access all, others only their own)
    if (
      req.user?.role !== UserRole.ADMINISTRATOR &&
      program.createdBy !== req.user?.id
    ) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to access this program',
        },
      });
      return;
    }
    
    res.json({ program });
  }
);

// ============================================================================
// Example 6: Conditional Role Requirements
// ============================================================================
// Different logic based on user role

router.get(
  '/programs',
  validateJWT,
  loadUser,
  async (req: Request, res: Response) => {
    let programs;
    
    if (req.user?.role === UserRole.ADMINISTRATOR) {
      // Admins see all programs
      programs = await fetchAllPrograms();
    } else if (req.user?.role === UserRole.SME) {
      // SMEs see only their programs
      programs = await fetchProgramsByUser(req.user.id);
    } else {
      // Students see only published programs
      programs = await fetchPublishedPrograms();
    }
    
    res.json({ programs });
  }
);

// ============================================================================
// Example 7: Custom Permission Check
// ============================================================================
// More complex permission logic

router.delete(
  '/programs/:id',
  validateJWT,
  loadUser,
  auditAction('DELETE_PROGRAM', 'programs'),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    
    const program = await fetchProgramById(id);
    
    if (!program) {
      res.status(404).json({
        error: {
          code: 'PROGRAM_NOT_FOUND',
          message: 'Program not found',
        },
      });
      return;
    }
    
    // Custom permission: Only creator or admin can delete
    const canDelete =
      req.user?.role === UserRole.ADMINISTRATOR ||
      program.createdBy === req.user?.id;
    
    if (!canDelete) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Only the program creator or an administrator can delete this program',
        },
      });
      return;
    }
    
    // Delete program
    await deleteProgram(id);
    
    res.json({
      success: true,
      message: 'Program deleted successfully',
    });
  }
);

// ============================================================================
// Example 8: Public Route (No Authentication)
// ============================================================================
// Some routes don't require authentication

router.get('/public/programs', async (req: Request, res: Response) => {
  const programs = await fetchPublicPrograms();
  res.json({ programs });
});

// ============================================================================
// Example 9: Optional Authentication
// ============================================================================
// Route works with or without authentication, but behavior differs

router.get('/programs/:id/preview', async (req: Request, res: Response) => {
  const { id } = req.params;
  const program = await fetchProgramById(id);
  
  if (!program) {
    res.status(404).json({
      error: {
        code: 'PROGRAM_NOT_FOUND',
        message: 'Program not found',
      },
    });
    return;
  }
  
  // If authenticated, show full details
  // If not authenticated, show limited preview
  const isAuthenticated = req.user !== undefined;
  
  res.json({
    program: isAuthenticated ? program : {
      id: program.id,
      name: program.name,
      description: program.description,
      // Limited fields for unauthenticated users
    },
  });
});

// ============================================================================
// Helper Functions (Mock implementations)
// ============================================================================

async function fetchProgramById(id: string): Promise<any> {
  // Mock implementation - replace with actual database query
  return {
    id,
    name: 'Sample Program',
    createdBy: 'user-123',
    status: 'draft',
  };
}

async function fetchAllPrograms(): Promise<any[]> {
  // Mock implementation
  return [];
}

async function fetchProgramsByUser(userId: string): Promise<any[]> {
  // Mock implementation
  return [];
}

async function fetchPublishedPrograms(): Promise<any[]> {
  // Mock implementation
  return [];
}

async function fetchPublicPrograms(): Promise<any[]> {
  // Mock implementation
  return [];
}

async function deleteProgram(id: string): Promise<void> {
  // Mock implementation
}

export default router;
