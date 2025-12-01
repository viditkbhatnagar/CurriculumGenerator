import fs from 'fs/promises';
import path from 'path';
import { FileUpload, IFileUpload } from '../models/FileUpload';
import config from '../config';

export class FileStorageService {
  private uploadDir: string;
  private initialized: boolean = false;

  constructor() {
    // Use config uploadDir or default to relative uploads folder
    this.uploadDir = config.storage.uploadDir || path.join(process.cwd(), 'uploads');
  }

  /**
   * Initialize the file storage service by ensuring upload directory exists
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
      this.initialized = true;
      console.log(`File storage initialized at: ${this.uploadDir}`);
    } catch (error) {
      // Non-fatal - just warn and continue (file uploads will fail but app will run)
      console.warn('Warning: File storage initialization failed. File uploads disabled.', error);
      this.initialized = false;
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Save a file to disk and create a database record
   */
  async saveFile(
    file: Express.Multer.File,
    userId: string,
    programId?: string
  ): Promise<IFileUpload> {
    try {
      // Generate unique filename
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 15);
      const extension = path.extname(file.originalname);
      const filename = `${timestamp}-${randomString}${extension}`;
      const filepath = path.join(this.uploadDir, filename);

      // Save file to disk
      await fs.writeFile(filepath, file.buffer);

      // Create database record
      const fileUpload = new FileUpload({
        programId: programId || undefined,
        filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        storagePath: filepath,
        storageType: config.nodeEnv === 'production' ? 'render_disk' : 'local',
        uploadedBy: userId,
      });

      await fileUpload.save();
      return fileUpload;
    } catch (error) {
      console.error('Failed to save file:', error);
      throw new Error('Failed to save file');
    }
  }

  /**
   * Get a file from disk by file ID
   */
  async getFile(fileId: string): Promise<Buffer> {
    try {
      const fileUpload = await FileUpload.findById(fileId);
      if (!fileUpload) {
        throw new Error('File not found');
      }

      return await fs.readFile(fileUpload.storagePath);
    } catch (error: any) {
      if (error.message === 'File not found') {
        throw error;
      }
      console.error('Failed to read file:', error);
      throw new Error('Failed to read file');
    }
  }

  /**
   * Get file metadata by file ID
   */
  async getFileMetadata(fileId: string): Promise<IFileUpload | null> {
    try {
      return await FileUpload.findById(fileId);
    } catch (error) {
      console.error('Failed to get file metadata:', error);
      return null;
    }
  }

  /**
   * Delete a file from disk and database
   */
  async deleteFile(fileId: string): Promise<void> {
    try {
      const fileUpload = await FileUpload.findById(fileId);
      if (!fileUpload) {
        throw new Error('File not found');
      }

      // Delete from disk
      try {
        await fs.unlink(fileUpload.storagePath);
      } catch (error) {
        console.error('Failed to delete file from disk:', error);
        // Continue to delete database record even if file deletion fails
      }

      // Delete from database
      await FileUpload.findByIdAndDelete(fileId);
    } catch (error: any) {
      if (error.message === 'File not found') {
        throw error;
      }
      console.error('Failed to delete file:', error);
      throw new Error('Failed to delete file');
    }
  }

  /**
   * Clean up temporary files older than 7 days
   * MongoDB TTL index will auto-delete records, this method cleans up orphaned files on disk
   */
  async cleanupOldFiles(): Promise<void> {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Find temporary files (without programId) older than 7 days
      const oldFiles = await FileUpload.find({
        createdAt: { $lt: sevenDaysAgo },
        programId: { $exists: false },
      });

      let deletedCount = 0;
      let failedCount = 0;

      for (const file of oldFiles) {
        try {
          await fs.unlink(file.storagePath);
          deletedCount++;
        } catch (error) {
          console.error(`Failed to delete file ${file.filename}:`, error);
          failedCount++;
        }
      }

      console.log(`Cleanup completed: ${deletedCount} files deleted, ${failedCount} failed`);
    } catch (error) {
      console.error('Failed to cleanup old files:', error);
      throw new Error('Failed to cleanup old files');
    }
  }

  /**
   * Get all files for a program
   */
  async getFilesByProgramId(programId: string): Promise<IFileUpload[]> {
    try {
      return await FileUpload.find({ programId }).sort({ createdAt: -1 }).exec();
    } catch (error) {
      console.error('Failed to get files by program ID:', error);
      throw new Error('Failed to get files by program ID');
    }
  }

  /**
   * Get all files uploaded by a user
   */
  async getFilesByUserId(userId: string): Promise<IFileUpload[]> {
    try {
      return await FileUpload.find({ uploadedBy: userId }).sort({ createdAt: -1 }).exec();
    } catch (error) {
      console.error('Failed to get files by user ID:', error);
      throw new Error('Failed to get files by user ID');
    }
  }
}

export const fileStorageService = new FileStorageService();
