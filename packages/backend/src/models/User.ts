import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  // 'faculty' = authorized teaching staff who can use the workflow
  // 'administrator' = manages the faculty allowlist + system config
  // 'sme' / 'student' = legacy roles, retained for compatibility
  role: 'administrator' | 'faculty' | 'sme' | 'student';
  authProviderId: string;
  // Whether this user was admin-invited (faculty allowlist) vs. self-registered.
  // Used to enforce "only invited faculty can sign in" once Auth0 is enabled.
  invited?: boolean;
  invitedBy?: mongoose.Types.ObjectId;
  invitedAt?: Date;
  profile: {
    firstName?: string;
    lastName?: string;
    organization?: string;
  };
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
        message: 'Invalid email format',
      },
    },
    role: {
      type: String,
      enum: ['administrator', 'faculty', 'sme', 'student'],
      required: true,
      index: true,
    },
    // authProviderId is required for users who have actually logged in. For
    // admin-invited faculty who haven't completed first-login yet, we store a
    // pending placeholder (`pending:<email>`) — still unique, so the index
    // isn't violated.
    authProviderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    invited: { type: Boolean, default: false, index: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    invitedAt: { type: Date },
    profile: {
      firstName: {
        type: String,
        trim: true,
      },
      lastName: {
        type: String,
        trim: true,
      },
      organization: {
        type: String,
        trim: true,
      },
    },
    lastLogin: {
      type: Date,
    },
  },
  {
    timestamps: true,
    collection: 'users',
  }
);

// Compound indexes for common queries
UserSchema.index({ role: 1, createdAt: -1 });

export const User = mongoose.model<IUser>('User', UserSchema);
