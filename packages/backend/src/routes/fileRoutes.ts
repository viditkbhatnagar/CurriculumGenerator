/**
 * File upload/download routes — SME-uploaded source documents stored in
 * MongoDB GridFS. Mounted at /api/v3/files.
 *
 *   POST /api/v3/files/upload     multipart "file" → { fileId, ... }
 *   GET  /api/v3/files/:fileId    streams the file back
 *   DELETE /api/v3/files/:fileId  removes the file
 *
 * Used by the Step 5 "add a source" form so faculty can attach an
 * actual Word / PDF / PowerPoint / e-book rather than only a link.
 */
import { Router, Request, Response } from 'express';
import multer from 'multer';
import { validateJWT, loadUser } from '../middleware/auth';
import { loggingService } from '../services/loggingService';
import { uploadBuffer, getFileInfo, downloadStream, deleteFile } from '../services/gridfsService';

const router = Router();

// 25MB ceiling — generous for a Word/PDF/PPT/e-book, well under the
// point where GridFS storage in the shared cluster becomes a concern.
const MAX_FILE_BYTES = 25 * 1024 * 1024;

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
  limits: { fileSize: MAX_FILE_BYTES },
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
 * Body: multipart/form-data with a single "file" field.
 */
router.post('/upload', validateJWT, loadUser, (req: Request, res: Response) => {
  upload.single('file')(req, res, async (err: unknown) => {
    // Multer surfaces size / type errors here.
    if (err) {
      const message = err instanceof Error ? err.message : 'File upload failed';
      // Size overflow gets a specific multer code.
      const isSize = err instanceof Error && (err as { code?: string }).code === 'LIMIT_FILE_SIZE';
      return res.status(400).json({
        success: false,
        error: isSize
          ? `File is too large. Maximum size is ${MAX_FILE_BYTES / (1024 * 1024)}MB.`
          : message,
      });
    }

    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file) {
      return res.status(400).json({ success: false, error: 'No file provided' });
    }

    try {
      const stored = await uploadBuffer(file.buffer, file.originalname, file.mimetype, {
        uploadedBy: (req as any).user?.id,
      });
      loggingService.info('Source file uploaded to GridFS', {
        fileId: stored.fileId,
        filename: stored.filename,
        size: stored.size,
      });
      res.status(201).json({ success: true, data: stored });
    } catch (uploadErr) {
      loggingService.error('GridFS upload failed', { uploadErr });
      res.status(500).json({ success: false, error: 'Failed to store file' });
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
    const stream = downloadStream(info.fileId);
    stream.on('error', (streamErr) => {
      loggingService.error('GridFS download stream error', { streamErr });
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
