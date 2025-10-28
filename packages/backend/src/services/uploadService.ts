import { fileStorageService } from './fileStorageService';
import { FileUpload, IFileUpload } from '../models/FileUpload';
import config from '../config';

export interface FileUploadMetadata {
  id: string;
  programId?: string;
  originalFilename: string;
  storedFilename: string;
  fileSize: number;
  mimeType: string;
  storagePath: string;
  storageType: 'render_disk' | 'cloudinary' | 'local';
  uploadStatus: 'completed'; // Always completed for MongoDB-based uploads
  uploadedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUploadParams {
  programId?: string;
  originalFilename: string;
  fileSize: number;
  mimeType: string;
  uploadedBy?: string;
  buffer: Buffer;
}

export class UploadService {
  /**
   * Create a new file upload record and store the file
   */
  async createUpload(params: CreateUploadParams): Promise<FileUploadMetadata> {
    const { programId, originalFilename, fileSize, mimeType, uploadedBy, buffer } = params;

    // Validate file size (max 50MB)
    const maxSize = config.storage.maxFileSize;
    if (fileSize > maxSize) {
      throw new Error(`File size exceeds maximum allowed size of ${maxSize / (1024 * 1024)}MB`);
    }

    // Validate file type (only Excel files)
    const allowedMimeTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
    ];
    if (!allowedMimeTypes.includes(mimeType)) {
      throw new Error('Invalid file type. Only Excel files (.xlsx, .xls) are allowed');
    }

    try {
      // Create a mock file object for the storage service
      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: originalFilename,
        encoding: '7bit',
        mimetype: mimeType,
        size: fileSize,
        buffer: buffer,
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      // Store the file using the new file storage service
      const fileUpload = await fileStorageService.saveFile(
        file,
        uploadedBy || '',
        programId
      );

      return this.mapDocumentToMetadata(fileUpload);
    } catch (error) {
      console.error('Failed to create upload:', error);
      throw new Error('Failed to upload file');
    }
  }

  /**
   * Get file upload metadata by ID
   */
  async getUploadById(uploadId: string): Promise<FileUploadMetadata | null> {
    try {
      const fileUpload = await fileStorageService.getFileMetadata(uploadId);
      if (!fileUpload) {
        return null;
      }
      return this.mapDocumentToMetadata(fileUpload);
    } catch (error) {
      console.error('Failed to get upload by ID:', error);
      return null;
    }
  }

  /**
   * Get all uploads for a program
   */
  async getUploadsByProgramId(programId: string): Promise<FileUploadMetadata[]> {
    try {
      const fileUploads = await fileStorageService.getFilesByProgramId(programId);
      return fileUploads.map(doc => this.mapDocumentToMetadata(doc));
    } catch (error) {
      console.error('Failed to get uploads by program ID:', error);
      return [];
    }
  }

  /**
   * Delete upload record and file
   */
  async deleteUpload(uploadId: string): Promise<void> {
    try {
      await fileStorageService.deleteFile(uploadId);
    } catch (error) {
      console.error('Failed to delete upload:', error);
      throw new Error('Failed to delete upload');
    }
  }

  /**
   * Get file buffer from storage
   */
  async getFileBuffer(uploadId: string): Promise<Buffer> {
    try {
      return await fileStorageService.getFile(uploadId);
    } catch (error) {
      console.error('Failed to get file buffer:', error);
      throw new Error('Failed to get file buffer');
    }
  }

  /**
   * Map MongoDB document to FileUploadMetadata
   */
  private mapDocumentToMetadata(doc: IFileUpload): FileUploadMetadata {
    return {
      id: doc._id.toString(),
      programId: doc.programId?.toString(),
      originalFilename: doc.originalName,
      storedFilename: doc.filename,
      fileSize: doc.size,
      mimeType: doc.mimeType,
      storagePath: doc.storagePath,
      storageType: doc.storageType,
      uploadStatus: 'completed', // Always completed for MongoDB-based uploads
      uploadedBy: doc.uploadedBy?.toString(),
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}

export const uploadService = new UploadService();
