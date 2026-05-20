/**
 * GridFS-backed file storage for SME-uploaded source documents.
 *
 * Why GridFS: Render's web-service disk is ephemeral (wiped on every
 * deploy/restart), so files written to local disk silently vanish.
 * GridFS stores the bytes inside the MongoDB the app already uses —
 * durable, no extra service, no new credentials. Suitable for the
 * occasional Word / PDF / PowerPoint / e-book an SME attaches to a
 * Step 5 source.
 *
 * Bucket: `sourceFiles` (chunks in sourceFiles.chunks, metadata in
 * sourceFiles.files).
 */
import mongoose from 'mongoose';
import { GridFSBucket, ObjectId } from 'mongodb';
import { Readable } from 'stream';

const BUCKET_NAME = 'sourceFiles';

function getBucket(): GridFSBucket {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('MongoDB connection not ready — cannot access GridFS');
  }
  return new GridFSBucket(db, { bucketName: BUCKET_NAME });
}

export interface StoredFile {
  fileId: string;
  filename: string;
  mimeType: string;
  size: number;
}

/**
 * Stream a buffer into GridFS. Resolves once the whole file is written.
 */
export async function uploadBuffer(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  metadata: Record<string, unknown> = {}
): Promise<StoredFile> {
  const bucket = getBucket();
  return new Promise<StoredFile>((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(filename, {
      contentType: mimeType,
      metadata: { ...metadata, uploadedAt: new Date() },
    });
    Readable.from(buffer)
      .pipe(uploadStream)
      .on('error', reject)
      .on('finish', () => {
        resolve({
          fileId: uploadStream.id.toString(),
          filename,
          mimeType,
          size: buffer.length,
        });
      });
  });
}

/**
 * Look up a stored file's metadata. Returns null if the id is malformed
 * or no file matches.
 */
export async function getFileInfo(fileId: string): Promise<StoredFile | null> {
  if (!ObjectId.isValid(fileId)) return null;
  const bucket = getBucket();
  const files = await bucket.find({ _id: new ObjectId(fileId) }).toArray();
  if (!files.length) return null;
  const f = files[0];
  return {
    fileId: f._id.toString(),
    filename: f.filename,
    mimeType: f.contentType || 'application/octet-stream',
    size: f.length,
  };
}

/**
 * Open a download stream for a stored file. Caller is responsible for
 * having checked existence via getFileInfo first.
 */
export function downloadStream(fileId: string): NodeJS.ReadableStream {
  const bucket = getBucket();
  return bucket.openDownloadStream(new ObjectId(fileId));
}

/**
 * Delete a stored file (both metadata + chunks). Swallows "not found"
 * so callers can delete idempotently.
 */
export async function deleteFile(fileId: string): Promise<void> {
  if (!ObjectId.isValid(fileId)) return;
  const bucket = getBucket();
  try {
    await bucket.delete(new ObjectId(fileId));
  } catch {
    // File already gone — nothing to do.
  }
}
