/**
 * S3-backed file storage for SME-uploaded source documents.
 *
 * Mirrors gridfsService's interface so fileStorageService can route to
 * either backend. The bucket is private (block-all-public-access) — the
 * bytes are streamed back through the authenticated /api/v3/files route,
 * never served publicly.
 *
 * Object key: a UUID + the original extension (e.g. "a1b2…e9.pdf").
 * Keys are flat and slash-free, so the key doubles as a URL-safe fileId.
 */
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { randomUUID } from 'crypto';
import path from 'path';
import config from '../config';

export interface StoredFile {
  fileId: string;
  filename: string;
  mimeType: string;
  size: number;
}

let client: S3Client | null = null;

/** True when the S3 bucket + credentials are all configured. */
export function isS3Configured(): boolean {
  return config.s3.enabled;
}

/** Lazily build (and memoise) the S3 client. */
function getClient(): S3Client {
  if (!config.s3.enabled) {
    throw new Error(
      'S3 is not configured — set S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY'
    );
  }
  if (!client) {
    client = new S3Client({
      region: config.s3.region,
      credentials: {
        accessKeyId: config.s3.accessKeyId,
        secretAccessKey: config.s3.secretAccessKey,
      },
    });
  }
  return client;
}

/** The shared, memoised S3 client — for other S3-backed services. */
export function getS3Client(): S3Client {
  return getClient();
}

/**
 * Upload a buffer to S3. The returned fileId is the object key. The
 * original filename is preserved in object metadata (URL-encoded so a
 * non-ASCII name stays header-safe).
 */
export async function uploadBuffer(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  metadata: Record<string, string> = {}
): Promise<StoredFile> {
  // Keep the extension for readability in the S3 console; guard against
  // an absurdly long "extension" from a filename with no real one.
  const ext = path.extname(filename).slice(0, 12);
  const key = `${randomUUID()}${ext}`;
  await getClient().send(
    new PutObjectCommand({
      Bucket: config.s3.bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      Metadata: {
        ...metadata,
        filename: encodeURIComponent(filename),
        uploadedat: new Date().toISOString(),
      },
    })
  );
  return { fileId: key, filename, mimeType, size: buffer.length };
}

function decodeFilename(raw: string | undefined, fallback: string): string {
  if (!raw) return fallback;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** Look up a stored file's metadata. Returns null if it doesn't exist. */
export async function getFileInfo(fileId: string): Promise<StoredFile | null> {
  try {
    const head = await getClient().send(
      new HeadObjectCommand({ Bucket: config.s3.bucket, Key: fileId })
    );
    return {
      fileId,
      filename: decodeFilename(head.Metadata?.filename, fileId),
      mimeType: head.ContentType || 'application/octet-stream',
      size: head.ContentLength || 0,
    };
  } catch (err: any) {
    // NotFound / NoSuchKey → treat as a missing file; rethrow anything else.
    const code = err?.name || err?.Code;
    if (code === 'NotFound' || code === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404) {
      return null;
    }
    throw err;
  }
}

/**
 * Open a download stream for a stored file. Caller should have checked
 * existence via getFileInfo first.
 */
export async function downloadStream(fileId: string): Promise<Readable> {
  const out = await getClient().send(
    new GetObjectCommand({ Bucket: config.s3.bucket, Key: fileId })
  );
  return out.Body as Readable;
}

/**
 * Delete a stored file. Swallows "not found" so callers can delete
 * idempotently.
 */
export async function deleteFile(fileId: string): Promise<void> {
  try {
    await getClient().send(new DeleteObjectCommand({ Bucket: config.s3.bucket, Key: fileId }));
  } catch {
    // File already gone — nothing to do.
  }
}
