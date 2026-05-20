/**
 * Storage facade for SME-uploaded Step 5 source documents.
 *
 * New uploads go to AWS S3 when it is configured (S3_BUCKET + both
 * credentials present); otherwise they fall back to MongoDB GridFS.
 * Reads and deletes route to whichever backend a file actually lives
 * in, detected from the fileId shape:
 *
 *   - GridFS ids are 24-char hex MongoDB ObjectIds
 *   - S3 keys are UUID-based ("…-….ext") — never valid ObjectIds
 *
 * so files stored in GridFS before the switch to S3 keep working.
 *
 * (Distinct from the legacy disk-based fileStorageService — this one
 * backs the Step 5 "add a source" file attachments only.)
 */
import * as gridfs from './gridfsService';
import * as s3 from './s3Service';

export type StorageBackend = 's3' | 'gridfs';

export interface StoredFile {
  fileId: string;
  filename: string;
  mimeType: string;
  size: number;
  storage: StorageBackend;
}

/** A bare 24-char hex string is a GridFS ObjectId; anything else is an S3 key. */
function backendFor(fileId: string): StorageBackend {
  return /^[a-f0-9]{24}$/i.test(fileId) ? 'gridfs' : 's3';
}

/** Which backend new uploads are written to right now. */
export function activeBackend(): StorageBackend {
  return s3.isS3Configured() ? 's3' : 'gridfs';
}

/** Store a buffer in the active backend (S3 if configured, else GridFS). */
export async function uploadBuffer(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  uploadedBy?: string
): Promise<StoredFile> {
  if (s3.isS3Configured()) {
    const stored = await s3.uploadBuffer(buffer, filename, mimeType, {
      uploadedby: uploadedBy || 'unknown',
    });
    return { ...stored, storage: 's3' };
  }
  const stored = await gridfs.uploadBuffer(buffer, filename, mimeType, {
    uploadedBy: uploadedBy || 'unknown',
  });
  return { ...stored, storage: 'gridfs' };
}

/** Look up a file's metadata in whichever backend it lives in. */
export async function getFileInfo(fileId: string): Promise<StoredFile | null> {
  if (backendFor(fileId) === 's3') {
    if (!s3.isS3Configured()) return null;
    const info = await s3.getFileInfo(fileId);
    return info ? { ...info, storage: 's3' } : null;
  }
  const info = await gridfs.getFileInfo(fileId);
  return info ? { ...info, storage: 'gridfs' } : null;
}

/** Open a download stream for a file in whichever backend it lives in. */
export async function getDownloadStream(fileId: string): Promise<NodeJS.ReadableStream> {
  if (backendFor(fileId) === 's3') {
    return s3.downloadStream(fileId);
  }
  return gridfs.downloadStream(fileId);
}

/** Delete a file from whichever backend it lives in (idempotent). */
export async function deleteFile(fileId: string): Promise<void> {
  if (backendFor(fileId) === 's3') {
    if (s3.isS3Configured()) await s3.deleteFile(fileId);
    return;
  }
  await gridfs.deleteFile(fileId);
}
