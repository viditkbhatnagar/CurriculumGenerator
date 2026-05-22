/**
 * Folder routes — organizing curriculum workflows on the dashboard.
 * Mounted at /api/v3/folders.
 *
 *   GET    /users      users list for the "share folder" picker
 *   GET    /           folders the caller owns or that are shared with them
 *   POST   /           create a folder
 *   PATCH  /:id        rename / reparent / recolor / reorder (owner only)
 *   PATCH  /:id/share  set the shared-user list (owner only)
 *   DELETE /:id        delete; children + workflows re-parent upward
 */
import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { validateJWT, loadUser } from '../middleware/auth';
import { loggingService } from '../services/loggingService';
import Folder from '../models/Folder';
import { CurriculumWorkflow } from '../models/CurriculumWorkflow';
import { User } from '../models/User';

const router = Router();

function currentUserId(req: Request): string {
  return (req as any).user?.id || (req as any).user?.userId;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeFolder(f: any, userId: string) {
  return {
    id: String(f._id),
    name: f.name,
    parentFolderId: f.parentFolderId ? String(f.parentFolderId) : null,
    color: f.color || '',
    position: f.position || 0,
    owner: String(f.owner),
    sharedWith: (f.sharedWith || []).map((u: any) => String(u)),
    isOwner: String(f.owner) === String(userId),
    createdAt: f.createdAt,
  };
}

/**
 * GET /api/v3/folders/users
 * Lightweight users list for the "share folder" picker. Registered
 * before the /:id routes so "users" is never read as a folder id.
 */
router.get('/users', validateJWT, loadUser, async (_req: Request, res: Response) => {
  try {
    const users = await User.find({}).select('email role profile').sort({ email: 1 }).limit(500);
    res.json({
      success: true,
      data: users.map((u: any) => ({
        id: String(u._id),
        email: u.email,
        name: [u.profile?.firstName, u.profile?.lastName].filter(Boolean).join(' ') || u.email,
        role: u.role,
      })),
    });
  } catch (error) {
    loggingService.error('Error listing users for folder sharing', { error });
    res.status(500).json({ success: false, error: 'Failed to list users' });
  }
});

/**
 * GET /api/v3/folders
 * Folders the caller owns or that have been shared with them.
 */
router.get('/', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const userId = currentUserId(req);
    const folders = await Folder.find({
      $or: [{ owner: userId }, { sharedWith: userId }],
    }).sort({ position: 1, createdAt: 1 });
    res.json({ success: true, data: folders.map((f) => serializeFolder(f, userId)) });
  } catch (error) {
    loggingService.error('Error listing folders', { error });
    res.status(500).json({ success: false, error: 'Failed to list folders' });
  }
});

/**
 * POST /api/v3/folders
 * Body: { name, parentFolderId?, color? }
 */
router.post('/', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const userId = currentUserId(req);
    const { name, parentFolderId, color } = req.body;
    const cleanName = typeof name === 'string' ? name.trim() : '';
    if (!cleanName) {
      return res.status(400).json({ success: false, error: 'Folder name is required' });
    }

    let parent: string | null = null;
    if (parentFolderId) {
      if (!mongoose.isValidObjectId(parentFolderId)) {
        return res.status(400).json({ success: false, error: 'Invalid parent folder' });
      }
      const parentFolder = await Folder.findById(parentFolderId);
      if (!parentFolder) {
        return res.status(400).json({ success: false, error: 'Parent folder not found' });
      }
      parent = parentFolderId;
    }

    const siblingCount = await Folder.countDocuments({ owner: userId, parentFolderId: parent });
    const folder = await Folder.create({
      name: cleanName,
      owner: userId as any,
      parentFolderId: parent as any,
      color: typeof color === 'string' ? color : '',
      position: siblingCount,
    });
    loggingService.info('Folder created', { folderId: String(folder._id), userId });
    res.status(201).json({ success: true, data: serializeFolder(folder, userId) });
  } catch (error) {
    loggingService.error('Error creating folder', { error });
    res.status(500).json({ success: false, error: 'Failed to create folder' });
  }
});

/**
 * Walk up the parent chain from `startId`; returns true if `targetId`
 * appears — used to reject a reparent that would create a cycle.
 */
async function isDescendantOf(startId: string, targetId: string): Promise<boolean> {
  let current: string | null = startId;
  let guard = 0;
  while (current && guard < 100) {
    if (String(current) === String(targetId)) return true;
    const f: any = await Folder.findById(current).select('parentFolderId');
    current = f?.parentFolderId ? String(f.parentFolderId) : null;
    guard += 1;
  }
  return false;
}

/**
 * PATCH /api/v3/folders/:id
 * Owner-only: rename / reparent / recolor / reorder.
 */
router.patch('/:id', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const userId = currentUserId(req);
    const folder = await Folder.findById(req.params.id);
    if (!folder) {
      return res.status(404).json({ success: false, error: 'Folder not found' });
    }
    if (String(folder.owner) !== String(userId)) {
      return res.status(403).json({ success: false, error: 'Only the folder owner can change it' });
    }

    const { name, parentFolderId, color, position } = req.body;
    if (typeof name === 'string' && name.trim()) folder.name = name.trim();
    if (typeof color === 'string') folder.color = color;
    if (typeof position === 'number') folder.position = position;

    if (parentFolderId !== undefined) {
      if (!parentFolderId) {
        folder.parentFolderId = null;
      } else if (String(parentFolderId) === String(folder._id)) {
        return res.status(400).json({ success: false, error: 'A folder cannot be its own parent' });
      } else if (await isDescendantOf(parentFolderId, String(folder._id))) {
        return res.status(400).json({
          success: false,
          error: 'Cannot move a folder into one of its own subfolders',
        });
      } else {
        folder.parentFolderId = parentFolderId as any;
      }
    }

    await folder.save();
    res.json({ success: true, data: serializeFolder(folder, userId) });
  } catch (error) {
    loggingService.error('Error updating folder', { error });
    res.status(500).json({ success: false, error: 'Failed to update folder' });
  }
});

/**
 * PATCH /api/v3/folders/:id/share
 * Owner-only. Body: { userIds: string[] }
 */
router.patch('/:id/share', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const userId = currentUserId(req);
    const folder = await Folder.findById(req.params.id);
    if (!folder) {
      return res.status(404).json({ success: false, error: 'Folder not found' });
    }
    if (String(folder.owner) !== String(userId)) {
      return res.status(403).json({ success: false, error: 'Only the folder owner can share it' });
    }
    const { userIds } = req.body;
    const cleaned = Array.isArray(userIds)
      ? userIds.filter(
          (u: unknown): u is string =>
            typeof u === 'string' && mongoose.isValidObjectId(u) && u !== String(userId)
        )
      : [];
    folder.sharedWith = cleaned as any;
    await folder.save();
    res.json({ success: true, data: serializeFolder(folder, userId) });
  } catch (error) {
    loggingService.error('Error sharing folder', { error });
    res.status(500).json({ success: false, error: 'Failed to update folder sharing' });
  }
});

/**
 * DELETE /api/v3/folders/:id
 * Owner-only. Child folders + contained workflows re-parent to this
 * folder's parent — workflows themselves are never deleted.
 */
router.delete('/:id', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const userId = currentUserId(req);
    const folder = await Folder.findById(req.params.id);
    if (!folder) {
      return res.status(404).json({ success: false, error: 'Folder not found' });
    }
    if (String(folder.owner) !== String(userId)) {
      return res.status(403).json({ success: false, error: 'Only the folder owner can delete it' });
    }
    const newParent = folder.parentFolderId || null;
    await Folder.updateMany({ parentFolderId: folder._id }, { parentFolderId: newParent });
    await CurriculumWorkflow.updateMany({ folderId: folder._id }, { folderId: newParent });
    await folder.deleteOne();
    loggingService.info('Folder deleted', { folderId: req.params.id, userId });
    res.json({ success: true, message: 'Folder deleted' });
  } catch (error) {
    loggingService.error('Error deleting folder', { error });
    res.status(500).json({ success: false, error: 'Failed to delete folder' });
  }
});

export default router;
