import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLog extends Document {
  userId?: mongoose.Types.ObjectId;
  action: string;
  resourceType?: string;
  resourceId?: mongoose.Types.ObjectId;
  details: any;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    userId: { 
      type: Schema.Types.ObjectId, 
      ref: 'User', 
      index: true 
    },
    action: { 
      type: String, 
      required: true, 
      index: true,
      trim: true 
    },
    resourceType: { 
      type: String,
      trim: true,
      index: true 
    },
    resourceId: { 
      type: Schema.Types.ObjectId 
    },
    details: { 
      type: Schema.Types.Mixed 
    },
    ipAddress: { 
      type: String,
      trim: true 
    },
    userAgent: { 
      type: String,
      trim: true 
    },
  },
  { 
    timestamps: { 
      createdAt: true, 
      updatedAt: false 
    },
    collection: 'auditLogs'
  }
);

// Compound indexes for common queries
AuditLogSchema.index({ userId: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });
AuditLogSchema.index({ resourceType: 1, resourceId: 1, createdAt: -1 });

// TTL index to auto-delete logs older than 90 days (7776000 seconds)
AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
