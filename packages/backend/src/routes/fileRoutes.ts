/**
 * File upload/download routes — SME-uploaded source documents. Files are
 * stored in AWS S3 when it is configured, otherwise in MongoDB GridFS
 * (see sourceFileStore). Mounted at /api/v3/files.
 *
 *   POST   /api/v3/files/upload    multipart "files" (or legacy "file")
 *                                  → { data: <first>, files: [<all>] }
 *   GET    /api/v3/files/:fileId   streams the file back
 *   DELETE /api/v3/files/:fileId   removes the file
 *
 * Used by the Step 5 "add a source" form so faculty can attach one or
 * more actual Word / PDF / PowerPoint / e-book files rather than links.
 */
import { Router, Request, Response } from 'express';
import multer from 'multer';
import { validateJWT, loadUser } from '../middleware/auth';
import { loggingService } from '../services/loggingService';
import {
  uploadBuffer,
  getFileInfo,
  getDownloadStream,
  deleteFile,
} from '../services/sourceFileStore';

const router = Router();

// 25MB ceiling per file — generous for a Word/PDF/PPT/e-book.
const MAX_FILE_BYTES = 25 * 1024 * 1024;

// How many files one "add a source" submission may attach at once.
const MAX_FILES = 10;

// What an SME can attach to a source: documents, slide decks, e-books,
// spreadsheets, plain text. Deliberately excludes executables / scripts.
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword', // .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.ms-powerpoint', // .ppt
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  'application/vnd.ms-excel', // .xls
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/epub+zip', // .epub
  'application/x-mobipocket-ebook', // .mobi
  'text/plain',
  'application/rtf',
  'text/rtf',
]);

const ALLOWED_HINT = 'PDF, Word, PowerPoint, Excel, EPUB, MOBI, RTF or plain text';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type. Allowed: ${ALLOWED_HINT}.`));
    }
  },
});

/**
 * POST /api/v3/files/upload
 * Body: multipart/form-data. Send one or more files under the "files"
 * field (the legacy single "file" field is still accepted). Returns the
 * full list under `files`, plus the first one under `data` for older
 * single-file callers.
 */
router.post('/upload', validateJWT, loadUser, (req: Request, res: Response) => {
  const handler = upload.fields([
    { name: 'files', maxCount: MAX_FILES },
    { name: 'file', maxCount: 1 },
  ]);

  handler(req, res, async (err: unknown) => {
    // Multer surfaces size / count / type errors here.
    if (err) {
      const message = err instanceof Error ? err.message : 'File upload failed';
      const code = err instanceof Error ? (err as { code?: string }).code : undefined;
      let friendly = message;
      if (code === 'LIMIT_FILE_SIZE') {
        friendly = `A file is too large. Maximum size is ${MAX_FILE_BYTES / (1024 * 1024)}MB each.`;
      } else if (code === 'LIMIT_FILE_COUNT') {
        friendly = `Too many files. You can attach up to ${MAX_FILES} at once.`;
      }
      return res.status(400).json({ success: false, error: friendly });
    }

    // upload.fields() groups files by field name — flatten "files" + "file".
    const grouped = (req as Request & { files?: Record<string, Express.Multer.File[]> }).files;
    const files = [...(grouped?.files || []), ...(grouped?.file || [])];

    if (!files.length) {
      return res.status(400).json({ success: false, error: 'No file provided' });
    }

    try {
      const userId = (req as any).user?.id;
      const stored = await Promise.all(
        files.map((f) => uploadBuffer(f.buffer, f.originalname, f.mimetype, userId))
      );
      loggingService.info('Source file(s) uploaded', {
        count: stored.length,
        storage: stored[0]?.storage,
        fileIds: stored.map((s) => s.fileId),
      });
      // `data` = first file (back-compat with single-file callers);
      // `files` = the full list for multi-file callers.
      res.status(201).json({ success: true, data: stored[0], files: stored });
    } catch (uploadErr) {
      loggingService.error('Source file upload failed', { uploadErr });
      res.status(500).json({ success: false, error: 'Failed to store file(s)' });
    }
  });
});

/**
 * GET /api/v3/files/:fileId
 * Streams the stored file with the right content-type. Inline so the
 * browser previews PDFs; the original filename is preserved for saves.
 */
router.get('/:fileId', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const info = await getFileInfo(req.params.fileId);
    if (!info) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }
    res.setHeader('Content-Type', info.mimeType);
    res.setHeader('Content-Length', String(info.size));
    res.setHeader('Content-Disposition', `inline; filename="${info.filename.replace(/"/g, '')}"`);
    const stream = await getDownloadStream(info.fileId);
    stream.on('error', (streamErr) => {
      loggingService.error('File download stream error', { streamErr });
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Failed to read file' });
      } else {
        res.end();
      }
    });
    stream.pipe(res);
  } catch (error) {
    loggingService.error('File download failed', { error });
    res.status(500).json({ success: false, error: 'Failed to download file' });
  }
});

/**
 * DELETE /api/v3/files/:fileId
 */
router.delete('/:fileId', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    await deleteFile(req.params.fileId);
    res.json({ success: true, message: 'File removed' });
  } catch (error) {
    loggingService.error('File delete failed', { error });
    res.status(500).json({ success: false, error: 'Failed to delete file' });
  }
});

export default router;
