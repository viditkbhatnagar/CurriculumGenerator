import { AuditLog as AuditLogModel, IAuditLog } from '../models/AuditLog';
import mongoose from 'mongoose';

interface CreateAuditLogInput {
  userId: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, any>;
  createdAt: Date;
}

/**
 * Convert Mongoose AuditLog document to AuditLog interface
 */
function toAuditLog(log: IAuditLog): AuditLog {
  return {
    id: log._id.toString(),
    userId: log.userId?.toString() || '',
    action: log.action,
    resourceType: log.resourceType,
    resourceId: log.resourceId?.toString(),
    details: log.details,
    createdAt: log.createdAt,
  };
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(input: CreateAuditLogInput): Promise<AuditLog> {
  const log = new AuditLogModel({
    userId: new mongoose.Types.ObjectId(input.userId),
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId ? new mongoose.Types.ObjectId(input.resourceId) : undefined,
    details: input.details,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });

  await log.save();

  return toAuditLog(log);
}

/**
 * Get audit logs for a specific user
 */
export async function getAuditLogsByUser(
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<{ logs: AuditLog[]; total: number }> {
  const userObjectId = new mongoose.Types.ObjectId(userId);
  
  const [logs, total] = await Promise.all([
    AuditLogModel.find({ userId: userObjectId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(offset),
    AuditLogModel.countDocuments({ userId: userObjectId }),
  ]);

  return {
    logs: logs.map(toAuditLog),
    total,
  };
}

/**
 * Get audit logs for a specific resource
 */
export async function getAuditLogsByResource(
  resourceType: string,
  resourceId: string,
  limit: number = 50,
  offset: number = 0
): Promise<{ logs: AuditLog[]; total: number }> {
  const resourceObjectId = new mongoose.Types.ObjectId(resourceId);
  
  const [logs, total] = await Promise.all([
    AuditLogModel.find({ 
      resourceType, 
      resourceId: resourceObjectId 
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(offset),
    AuditLogModel.countDocuments({ 
      resourceType, 
      resourceId: resourceObjectId 
    }),
  ]);

  return {
    logs: logs.map(toAuditLog),
    total,
  };
}

/**
 * Get all audit logs (admin only)
 */
export async function getAllAuditLogs(
  limit: number = 50,
  offset: number = 0,
  filters?: {
    action?: string;
    resourceType?: string;
    startDate?: Date;
    endDate?: Date;
  }
): Promise<{ logs: AuditLog[]; total: number }> {
  const query: any = {};

  if (filters) {
    if (filters.action) {
      query.action = filters.action;
    }

    if (filters.resourceType) {
      query.resourceType = filters.resourceType;
    }

    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) {
        query.createdAt.$gte = filters.startDate;
      }
      if (filters.endDate) {
        query.createdAt.$lte = filters.endDate;
      }
    }
  }

  const [logs, total] = await Promise.all([
    AuditLogModel.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(offset),
    AuditLogModel.countDocuments(query),
  ]);

  return {
    logs: logs.map(toAuditLog),
    total,
  };
}

/**
 * Delete old audit logs (for cleanup)
 * Note: MongoDB TTL index will auto-delete logs older than 90 days
 * This function is kept for manual cleanup if needed
 */
export async function deleteOldAuditLogs(olderThanDays: number): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  const result = await AuditLogModel.deleteMany({
    createdAt: { $lt: cutoffDate }
  });

  return result.deletedCount || 0;
}
