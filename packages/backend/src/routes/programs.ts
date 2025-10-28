import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { uploadService } from '../services/uploadService';
import { createAuditLog } from '../services/auditService';
import { excelParserService } from '../services/excelParserService';
import { excelValidationService } from '../services/excelValidationService';
import { programService } from '../services/programService';
import { cacheMiddleware, invalidateCacheMiddleware } from '../middleware/cache';
import { CacheNamespace } from '../services/cacheService';
import { 
  validateUUIDParam, 
  validateObjectIdParam,
  validateRequiredFields, 
  validateFieldTypes,
  requireSignature 
} from '../middleware/security';
import { validateJWT, loadUser, requireRole } from '../middleware/auth';
import { UserRole } from '../types/auth';

const router = express.Router();

// Apply authentication to all routes
router.use(validateJWT);
router.use(loadUser);

/**
 * POST /api/programs/create
 * Create a new program
 * Invalidates program list cache
 */
router.post('/create', 
  validateRequiredFields(['program_name', 'qualification_level', 'qualification_type', 'total_credits', 'industry_sector']),
  validateFieldTypes({
    program_name: 'string',
    qualification_level: 'string',
    qualification_type: 'string',
    total_credits: 'number',
    industry_sector: 'string',
  }),
  invalidateCacheMiddleware(['*'], CacheNamespace.API_RESPONSE), 
  async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { program_name, qualification_level, qualification_type, total_credits, industry_sector } = req.body;
    const userId = (req as any).user?.id;

    // Validation
    if (!program_name || !qualification_level || !qualification_type || !total_credits || !industry_sector) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required fields',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'],
        },
      });
    }

    // Create program
    const result = await programService.createProgram({
      program_name,
      qualification_level,
      qualification_type,
      total_credits,
      industry_sector,
      created_by: userId,
    });

    // Log the action
    if (userId) {
      await createAuditLog({
        userId,
        action: 'CREATE_PROGRAM',
        resourceType: 'program',
        resourceId: result.id,
        details: {
          program_name,
          qualification_level,
        },
      });
    }

    res.status(201).json({
      message: 'Program created successfully',
      data: {
        id: result._id.toString(),
        programName: result.programName,
        qualificationLevel: result.qualificationLevel,
        qualificationType: result.qualificationType,
        totalCredits: result.totalCredits,
        industrySector: result.industrySector,
        status: result.status,
        createdAt: result.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/programs
 * List all programs
 * Cached for 5 minutes
 */
router.get('/', cacheMiddleware({ ttl: 300 }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, limit, offset } = req.query;
    const userId = (req as any).user?.id;

    const programs = await programService.listPrograms({
      status: status as string,
      createdBy: userId,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    res.json({
      data: programs.map(program => ({
        id: program.id,
        programName: program.program_name,
        qualificationLevel: program.qualification_level,
        qualificationType: program.qualification_type,
        totalCredits: program.total_credits,
        industrySector: program.industry_sector,
        status: program.status,
        createdAt: program.created_at,
        updatedAt: program.updated_at,
      })),
      pagination: {
        limit: limit ? parseInt(limit as string) : null,
        offset: offset ? parseInt(offset as string) : null,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/programs/:id
 * Get program details
 * Cached for 5 minutes
 */
router.get('/:id', 
  validateObjectIdParam('id'),
  cacheMiddleware({ ttl: 300 }), 
  async (req: Request, res: Response, next: NextFunction) => {
  try {
    const programId = req.params.id;
    const program = await programService.getProgramWithDetails(programId);

    if (!program) {
      return res.status(404).json({
        error: {
          code: 'PROGRAM_NOT_FOUND',
          message: 'Program not found',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'],
        },
      });
    }

    res.json({
      data: {
        id: program._id.toString(),
        programName: program.programName,
        qualificationLevel: program.qualificationLevel,
        qualificationType: program.qualificationType,
        totalCredits: program.totalCredits,
        industrySector: program.industrySector,
        status: program.status,
        createdAt: program.createdAt,
        updatedAt: program.updatedAt,
        modules: program.modules,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/programs/:id/status
 * Get program status
 */
router.get('/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const programId = req.params.id;
    const program = await programService.getProgram(programId);

    if (!program) {
      return res.status(404).json({
        error: {
          code: 'PROGRAM_NOT_FOUND',
          message: 'Program not found',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'],
        },
      });
    }

    res.json({
      data: {
        id: program.id,
        status: program.status,
        updatedAt: program.updated_at,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/programs/:id
 * Update program
 */
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const programId = req.params.id;
    const userId = (req as any).user?.id;
    const { program_name, qualification_level, qualification_type, total_credits, industry_sector, status } = req.body;

    // Check if program exists
    const existingProgram = await programService.getProgram(programId);
    if (!existingProgram) {
      return res.status(404).json({
        error: {
          code: 'PROGRAM_NOT_FOUND',
          message: 'Program not found',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'],
        },
      });
    }

    // Update program
    const updatedProgram = await programService.updateProgram(programId, {
      program_name,
      qualification_level,
      qualification_type,
      total_credits,
      industry_sector,
      status,
    });

    // Log the action
    if (userId) {
      await createAuditLog({
        userId,
        action: 'UPDATE_PROGRAM',
        resourceType: 'program',
        resourceId: programId,
        details: {
          updates: { program_name, qualification_level, qualification_type, total_credits, industry_sector, status },
        },
      });
    }

    res.json({
      message: 'Program updated successfully',
      data: {
        id: updatedProgram.id,
        programName: updatedProgram.program_name,
        qualificationLevel: updatedProgram.qualification_level,
        qualificationType: updatedProgram.qualification_type,
        totalCredits: updatedProgram.total_credits,
        industrySector: updatedProgram.industry_sector,
        status: updatedProgram.status,
        updatedAt: updatedProgram.updated_at,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/programs/:id/generate-curriculum
 * Trigger curriculum generation for a program
 */
router.post('/:id/generate-curriculum', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const programId = req.params.id;
    const userId = (req as any).user?.id;
    const { jobQueueService } = await import('../services/jobQueueService');
    const { getPool } = await import('../db');
    const db = getPool();

    // Get program data
    const programResult = await db.query(
      'SELECT * FROM programs WHERE id = $1',
      [programId]
    );

    if (programResult.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'PROGRAM_NOT_FOUND',
          message: 'Program not found',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'],
        },
      });
    }

    // Get the latest upload for this program
    const uploads = await uploadService.getUploadsByProgramId(programId);
    
    if (uploads.length === 0) {
      return res.status(400).json({
        error: {
          code: 'NO_UPLOAD_FOUND',
          message: 'No Excel file uploaded for this program',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'],
        },
      });
    }

    const latestUpload = uploads[0];

    // Get file buffer and parse
    const buffer = await uploadService.getFileBuffer(latestUpload.id);
    const parsedData = await excelParserService.parseExcelFile(buffer);

    // Create job data
    const jobData = {
      programId,
      userId,
      parsedData,
    };

    // Add job to queue
    const job = await jobQueueService.addJob('curriculum_generation', jobData);

    // Update program status
    await db.query(
      `UPDATE programs SET status = 'processing', updated_at = NOW() WHERE id = $1`,
      [programId]
    );

    // Create generation job record
    await db.query(
      `INSERT INTO generation_jobs (id, program_id, status, progress, started_at)
       VALUES ($1, $2, 'queued', 0, NOW())`,
      [job.id, programId]
    );

    // Log the action
    if (userId) {
      await createAuditLog({
        userId,
        action: 'TRIGGER_CURRICULUM_GENERATION',
        resourceType: 'program',
        resourceId: programId,
        details: { jobId: job.id },
      });
    }

    res.status(202).json({
      message: 'Curriculum generation started',
      data: {
        jobId: job.id,
        programId,
        status: 'queued',
        estimatedCompletion: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      },
    });
  } catch (error: any) {
    console.error('Failed to trigger curriculum generation:', error);
    next(error);
  }
});

/**
 * GET /api/programs/:id/generation-status
 * Get curriculum generation job status
 */
router.get('/:id/generation-status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const programId = req.params.id;
    const { getPool } = await import('../db');
    const db = getPool();

    // Get the latest generation job for this program
    const jobResult = await db.query(
      `SELECT * FROM generation_jobs 
       WHERE program_id = $1 
       ORDER BY started_at DESC 
       LIMIT 1`,
      [programId]
    );

    if (jobResult.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'JOB_NOT_FOUND',
          message: 'No generation job found for this program',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'],
        },
      });
    }

    const job = jobResult.rows[0];

    res.json({
      data: {
        jobId: job.id,
        programId: job.program_id,
        status: job.status,
        progress: job.progress,
        startedAt: job.started_at,
        completedAt: job.completed_at,
        errorMessage: job.error_message,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/programs/:id/curriculum
 * Get generated curriculum for a program
 */
router.get('/:id/curriculum', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const programId = req.params.id;
    const { getPool } = await import('../db');
    const db = getPool();

    // Get program specification
    const programSpecResult = await db.query(
      'SELECT * FROM program_specifications WHERE program_id = $1',
      [programId]
    );

    if (programSpecResult.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'CURRICULUM_NOT_FOUND',
          message: 'Curriculum not found for this program',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'],
        },
      });
    }

    const programSpec = programSpecResult.rows[0];

    // Get unit specifications
    const unitSpecsResult = await db.query(
      'SELECT * FROM unit_specifications WHERE program_id = $1 ORDER BY module_code',
      [programId]
    );

    // Get assessment package
    const assessmentResult = await db.query(
      'SELECT * FROM assessment_packages WHERE program_id = $1',
      [programId]
    );

    // Get skill mappings
    const skillsResult = await db.query(
      'SELECT * FROM skill_mappings WHERE program_id = $1',
      [programId]
    );

    res.json({
      data: {
        programId,
        programSpec: {
          introduction: programSpec.introduction,
          courseOverview: programSpec.course_overview,
          needsAnalysis: programSpec.needs_analysis,
          knowledgeSkillsCompetenciesMatrix: programSpec.ksc_matrix,
          comparativeAnalysis: programSpec.comparative_analysis,
          targetAudience: programSpec.target_audience,
          entryRequirements: programSpec.entry_requirements,
          careerOutcomes: programSpec.career_outcomes,
          generatedAt: programSpec.generated_at,
        },
        unitSpecs: unitSpecsResult.rows.map(row => ({
          unitId: row.unit_id,
          moduleCode: row.module_code,
          unitTitle: row.unit_title,
          unitOverview: row.unit_overview,
          learningOutcomes: row.learning_outcomes,
          indicativeContent: row.indicative_content,
          teachingStrategies: row.teaching_strategies,
          assessmentMethods: row.assessment_methods,
          readingList: row.reading_list,
          generatedAt: row.generated_at,
        })),
        assessmentPackage: assessmentResult.rows.length > 0 ? {
          mcqs: assessmentResult.rows[0].mcqs,
          caseStudies: assessmentResult.rows[0].case_studies,
          rubrics: assessmentResult.rows[0].rubrics,
          markingSchemes: assessmentResult.rows[0].marking_schemes,
          learningOutcomeMappings: assessmentResult.rows[0].learning_outcome_mappings,
          generatedAt: assessmentResult.rows[0].generated_at,
        } : null,
        skillBook: skillsResult.rows.map(row => ({
          skillId: row.id,
          skillName: row.skill_name,
          domain: row.domain,
          activities: row.activities,
          kpis: row.kpis,
          linkedOutcomes: row.linked_outcomes,
          assessmentCriteria: row.assessment_criteria,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/programs/:id/download-specs
 * Download generated curriculum documents
 */
router.get('/:id/download-specs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const programId = req.params.id;
    const { format = 'docx' } = req.query;
    const { documentExportService } = await import('../services/documentExportService');

    // Validate format
    if (format !== 'docx' && format !== 'pdf') {
      return res.status(400).json({
        error: {
          code: 'INVALID_FORMAT',
          message: 'Format must be either "docx" or "pdf"',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'],
        },
      });
    }

    // Check if program exists
    const program = await programService.getProgram(programId);
    if (!program) {
      return res.status(404).json({
        error: {
          code: 'PROGRAM_NOT_FOUND',
          message: 'Program not found',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'],
        },
      });
    }

    // Generate document
    const buffer = await documentExportService.exportProgramSpec(programId, format as 'docx' | 'pdf');

    // Set appropriate headers
    const contentType = format === 'docx' 
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : 'application/pdf';
    
    const filename = `${program.program_name.replace(/[^a-z0-9]/gi, '_')}_specification.${format}`;

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error: any) {
    console.error('Failed to download specs:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: {
          code: 'CURRICULUM_NOT_FOUND',
          message: 'Curriculum not generated for this program',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'],
        },
      });
    }

    next(error);
  }
});

/**
 * DELETE /api/programs/:id
 * Delete a program
 * Requires API signature for security
 */
router.delete('/:id',
  validateObjectIdParam('id'),
  requireRole(UserRole.ADMINISTRATOR),
  requireSignature,
  async (req: Request, res: Response, next: NextFunction) => {
  try {
    const programId = req.params.id;
    const userId = (req as any).user?.id;

    await programService.deleteProgram(programId);

    // Log the deletion
    if (userId) {
      await createAuditLog({
        userId,
        action: 'DELETE_PROGRAM',
        resourceType: 'program',
        resourceId: programId,
        details: {},
      });
    }

    res.json({
      message: 'Program deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

// Configure multer for memory storage
// Files are stored in memory temporarily and then saved to disk via fileStorageService
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB (matches config.storage.maxFileSize)
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only Excel files (.xlsx, .xls) are allowed'));
    }
  },
});

/**
 * POST /api/programs/:id/upload-sme-data
 * Upload Excel file for a program
 */
router.post(
  '/:id/upload-sme-data',
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const programId = req.params.id;
      const file = req.file;
      const userId = (req as any).user?.id; // From auth middleware

      if (!file) {
        return res.status(400).json({
          error: {
            code: 'FILE_REQUIRED',
            message: 'No file uploaded',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'],
          },
        });
      }

      // Create upload record and store file
      const uploadMetadata = await uploadService.createUpload({
        programId,
        originalFilename: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadedBy: userId,
        buffer: file.buffer,
      });

      // Log the upload action
      if (userId) {
        await createAuditLog({
          userId,
          action: 'UPLOAD_SME_DATA',
          resourceType: 'program',
          resourceId: programId,
          details: {
            uploadId: uploadMetadata.id,
            filename: file.originalname,
            fileSize: file.size,
          },
        });
      }

      res.status(201).json({
        message: 'File uploaded successfully',
        data: {
          uploadId: uploadMetadata.id,
          programId: uploadMetadata.programId,
          filename: uploadMetadata.originalFilename,
          fileSize: uploadMetadata.fileSize,
          uploadStatus: uploadMetadata.uploadStatus,
          createdAt: uploadMetadata.createdAt,
        },
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      
      if (error.message.includes('File size exceeds') || error.message.includes('Invalid file type')) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: error.message,
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'],
          },
        });
      }

      next(error);
    }
  }
);

/**
 * GET /api/programs/:id/uploads
 * Get all uploads for a program
 */
router.get('/:id/uploads', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const programId = req.params.id;
    const uploads = await uploadService.getUploadsByProgramId(programId);

    res.json({
      data: uploads.map(upload => ({
        uploadId: upload.id,
        filename: upload.originalFilename,
        fileSize: upload.fileSize,
        uploadStatus: upload.uploadStatus,
        createdAt: upload.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/programs/uploads/:uploadId
 * Get upload metadata by ID
 */
router.get('/uploads/:uploadId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const uploadId = req.params.uploadId;
    const upload = await uploadService.getUploadById(uploadId);

    if (!upload) {
      return res.status(404).json({
        error: {
          code: 'UPLOAD_NOT_FOUND',
          message: 'Upload not found',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'],
        },
      });
    }

    res.json({
      data: {
        uploadId: upload.id,
        programId: upload.programId,
        filename: upload.originalFilename,
        fileSize: upload.fileSize,
        mimeType: upload.mimeType,
        uploadStatus: upload.uploadStatus,
        createdAt: upload.createdAt,
        updatedAt: upload.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/programs/uploads/:uploadId
 * Delete an upload
 */
router.delete('/uploads/:uploadId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const uploadId = req.params.uploadId;
    const userId = (req as any).user?.id;

    await uploadService.deleteUpload(uploadId);

    // Log the deletion
    if (userId) {
      await createAuditLog({
        userId,
        action: 'DELETE_UPLOAD',
        resourceType: 'file_upload',
        resourceId: uploadId,
        details: {},
      });
    }

    res.json({
      message: 'Upload deleted successfully',
    });
  } catch (error: any) {
    if (error.message === 'Upload not found') {
      return res.status(404).json({
        error: {
          code: 'UPLOAD_NOT_FOUND',
          message: error.message,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'],
        },
      });
    }
    next(error);
  }
});

/**
 * POST /api/programs/uploads/:uploadId/validate
 * Validate uploaded Excel file
 */
router.post('/uploads/:uploadId/validate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const uploadId = req.params.uploadId;

    // Get the file buffer
    const buffer = await uploadService.getFileBuffer(uploadId);

    // Parse the Excel file
    const parsedData = await excelParserService.parseExcelFile(buffer);

    // Validate the parsed data
    const validationResult = excelValidationService.validate(parsedData);

    res.json({
      isValid: validationResult.isValid,
      errors: validationResult.errors,
      warnings: validationResult.warnings,
      summary: {
        totalErrors: validationResult.errors.length,
        totalWarnings: validationResult.warnings.length,
        sheetsProcessed: [
          'Program Overview',
          'Competency Framework',
          'Learning Outcomes',
          'Course Framework',
          'Topic Sources',
          'Reading Lists',
          'Assessments',
          'Glossary',
          'Case Studies',
          'Delivery Specifications',
        ],
      },
    });
  } catch (error: any) {
    console.error('Validation error:', error);

    if (error.message === 'Upload not found') {
      return res.status(404).json({
        error: {
          code: 'UPLOAD_NOT_FOUND',
          message: error.message,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'],
        },
      });
    }

    if (error.message.includes('Excel validation failed')) {
      return res.status(422).json({
        error: {
          code: 'VALIDATION_FAILED',
          message: error.message,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'],
        },
      });
    }

    next(error);
  }
});

/**
 * POST /api/programs/uploads/:uploadId/process
 * Process and store validated Excel data
 */
router.post('/uploads/:uploadId/process', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const uploadId = req.params.uploadId;
    const userId = (req as any).user?.id;

    // Get the file buffer
    const buffer = await uploadService.getFileBuffer(uploadId);

    // Parse the Excel file
    const parsedData = await excelParserService.parseExcelFile(buffer);

    // Validate the parsed data
    const validationResult = excelValidationService.validate(parsedData);

    if (!validationResult.isValid) {
      return res.status(422).json({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Excel data validation failed. Please fix errors and try again.',
          details: {
            errors: validationResult.errors,
            warnings: validationResult.warnings,
          },
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'],
        },
      });
    }

    // Store the parsed data
    const result = await programService.storeParsedData(parsedData, uploadId, userId);

    // Log the action
    if (userId) {
      await createAuditLog({
        userId,
        action: 'PROCESS_SME_DATA',
        resourceType: 'program',
        resourceId: result.programId,
        details: {
          uploadId,
          stats: result.stats,
        },
      });
    }

    res.status(201).json({
      message: result.message,
      data: {
        programId: result.programId,
        stats: result.stats,
      },
    });
  } catch (error: any) {
    console.error('Processing error:', error);

    if (error.message === 'Upload not found') {
      return res.status(404).json({
        error: {
          code: 'UPLOAD_NOT_FOUND',
          message: error.message,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'],
        },
      });
    }

    if (error.message.includes('Excel validation failed')) {
      return res.status(422).json({
        error: {
          code: 'VALIDATION_FAILED',
          message: error.message,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'],
        },
      });
    }

    if (error.message.includes('Failed to store program data')) {
      return res.status(500).json({
        error: {
          code: 'STORAGE_FAILED',
          message: 'Failed to store program data in database',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'],
        },
      });
    }

    next(error);
  }
});

export default router;
