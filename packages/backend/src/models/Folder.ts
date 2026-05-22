/**
 * A user-created folder for organizing curriculum workflows on the
 * dashboard. Folders nest via `parentFolderId` and can be shared with
 * other users via `sharedWith`.
 *
 * Deleting a folder never deletes workflows — its child folders and
 * contained workflows are re-parented upward (see folderRoutes DELETE).
 */
import mongoose, { Schema, Document } from 'mongoose';

export interface IFolder extends Document {
  name: string;
  owner: mongoose.Types.ObjectId;
  parentFolderId?: mongoose.Types.ObjectId | null;
  sharedWith: mongoose.Types.ObjectId[];
  color: string;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

const FolderSchema = new Schema<IFolder>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    parentFolderId: { type: Schema.Types.ObjectId, ref: 'Folder', default: null, index: true },
    sharedWith: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    color: { type: String, default: '' },
    position: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Listing folders for a user: owned (ordered) and shared-with.
FolderSchema.index({ owner: 1, parentFolderId: 1, position: 1 });
FolderSchema.index({ sharedWith: 1 });

export const Folder = mongoose.model<IFolder>('Folder', FolderSchema);
export default Folder;
