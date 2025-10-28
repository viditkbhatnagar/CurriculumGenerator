import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  role: 'administrator' | 'sme' | 'student';
  authProviderId: string;
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
      enum: ['administrator', 'sme', 'student'],
      required: true,
      index: true,
    },
    authProviderId: { 
      type: String, 
      required: true, 
      unique: true,
      index: true 
    },
    profile: {
      firstName: { 
        type: String,
        trim: true 
      },
      lastName: { 
        type: String,
        trim: true 
      },
      organization: { 
        type: String,
        trim: true 
      },
    },
    lastLogin: { 
      type: Date 
    },
  },
  { 
    timestamps: true,
    collection: 'users'
  }
);

// Compound indexes for common queries
UserSchema.index({ role: 1, createdAt: -1 });

export const User = mongoose.model<IUser>('User', UserSchema);
