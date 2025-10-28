/**
 * End-to-End Tests for Curriculum Generation Flow
 * Tests complete flow: SME upload → generation → export
 */

import request from 'supertest';
import express from 'express';
import { Pool } from 'pg';

// Mock all services and middleware
jest.mock('../../services/programService');
jest.mock('../../services/uploadService');
jest.mock('../../services/excelParserService');
jest.mock('../../services/excelValidationService');
jest.mock('../../services/jobQueueService');
jest.mock('../../services/documentExportService');
jest.mock('../../services/auditService', () => ({
  createAuditLog: jest.fn().mockResolvedValue({}),
}));
jest.mock('../../middleware/auth', () => ({
  validateJWT: (req: any, res: any, next: any) => {
    req.user = { id: 'test-user-123', role: 'administrator' };
    next();
  },
  loadUser: (req: any, res: any, next: any) => next(),
  requireRole: () => (req: any, res: any, next: any) => next(),
}));
jest.mock('../../db', () => ({
  getPool: jest.fn(() => ({
    query: jest.fn(),
    connect: jest.fn(),
  })),
}));

describe('Curriculum Generation E2E Flow', () => {
  let app: express.Application;
  let programId: string;
  let uploadId: string;
  let jobId: string;

  beforeEach(async () => {
    const { default: programRoutes } = await import('../../routes/programs');
    const { programService } = await import('../../services/programService');
    const { uploadService } = await import('../../services/uploadService');
    const { excelParserService } = await import('../../services/excelParserService');
    const { excelValidationService } = await import('../../services/excelValidationService');
    const { jobQueueService } = await import('../../services/jobQueueService');
    const { documentExportService } = await import('../../services/documentExportService');
    const { getPool } = await import('../../db');

    app = express();
    app.use(express.json());
    app.use('/api/programs', programRoutes);

    programId = 'program-e2e-123';
    uploadId = 'upload-e2e-456';
    jobId = 'job-e2e-789';

    jest.clearAllMocks();

    // Setup mocks for the complete flow
    (programService.createProgram as jest.Mock).mockResolvedValue({
      id: programId,
      program_name: 'E2E Test Program',
      qualification_level: 'Level 5',
      qualification_type: 'Certificate',
      total_credits: 120,
      industry_sector: 'Technology',
      status: 'draft',
      created_at: new Date(),
    });

    (uploadService.createUpload as jest.Mock).mockResolvedValue({
      id: uploadId,
      programId,
      originalFilename: 'test-program.xlsx',
      fileSize: 1024000,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      uploadStatus: 'completed',
      createdAt: new Date(),
    });

    (uploadService.getUploadsByProgramId as jest.Mock).mockResolvedValue([
      {
        id: uploadId,
        programId,
        originalFilename: 'test-program.xlsx',
        fileSize: 1024000,
        uploadStatus: 'completed',
        createdAt: new Date(),
      },
    ]);

    (uploadService.getFileBuffer as jest.Mock).mockResolvedValue(Buffer.from('mock excel data'));

    (excelParserService.parseExcelFile as jest.Mock).mockResolvedValue({
      programOverview: {
        programName: 'E2E Test Program',
        qualificationLevel: 'Level 5',
        qualificationType: 'Certificate',
        totalCredits: 120,
        industrySector: 'Technology',
      },
      competencyFramework: [],
      learningOutcomes: [],
      courseFramework: [],
      topicSources: [],
      readingLists: [],
      assessments: [],
      glossary: [],
      caseStudies: [],
      deliverySpecs: {
        deliveryMode: 'Online',
        duration: '12 weeks',
      },
    });

    (excelValidationService.validate as jest.Mock).mockReturnValue({
      isValid: true,
      errors: [],
      warnings: [],
    });

    (jobQueueService.addJob as jest.Mock).mockResolvedValue({
      id: jobId,
      name: 'curriculum_generation',
      data: {},
    });

    const mockDb = getPool() as jest.Mocked<Pool>;
    (mockDb.query as jest.Mock).mockImplementation((query: string) => {
      if (query.includes('SELECT * FROM programs')) {
        return Promise.resolve({
          rows: [{
            id: programId,
            program_name: 'E2E Test Program',
            status: 'draft',
          }],
        });
      }
      if (query.includes('UPDATE programs')) {
        return Promise.resolve({ rows: [] });
      }
      if (query.includes('INSERT INTO generation_jobs')) {
        return Promise.resolve({ rows: [] });
      }
      if (query.includes('SELECT * FROM generation_jobs')) {
        return Promise.resolve({
          rows: [{
            id: jobId,
            program_id: programId,
            status: 'completed',
            progress: 100,
            started_at: new Date(),
            completed_at: new Date(),
          }],
        });
      }
      if (query.includes('SELECT * FROM program_specifications')) {
        return Promise.resolve({
          rows: [{
            program_id: programId,
            introduction: 'Test introduction',
            course_overview: 'Test overview',
            generated_at: new Date(),
          }],
        });
      }
      if (query.includes('SELECT * FROM unit_specifications')) {
        return Promise.resolve({ rows: [] });
      }
      if (query.includes('SELECT * FROM assessment_packages')) {
        return Promise.resolve({ rows: [] });
      }
      if (query.includes('SELECT * FROM skill_mappings')) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    (documentExportService.exportProgramSpec as jest.Mock).mockResolvedValue(
      Buffer.from('mock document content')
    );
  });

  it('should complete full curriculum generation flow', async () => {
    // Step 1: Create program
    const createResponse = await request(app)
      .post('/api/programs/create')
      .send({
        program_name: 'E2E Test Program',
        qualification_level: 'Level 5',
        qualification_type: 'Certificate',
        total_credits: 120,
        industry_sector: 'Technology',
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data.id).toBe(programId);

    // Step 2: Upload Excel file (simulated)
    const { uploadService } = await import('../../services/uploadService');
    const uploadResult = await uploadService.createUpload({
      programId,
      originalFilename: 'test-program.xlsx',
      fileSize: 1024000,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      uploadedBy: 'test-user-123',
      buffer: Buffer.from('mock excel data'),
    });

    expect(uploadResult.id).toBe(uploadId);
    expect(uploadResult.programId).toBe(programId);

    // Step 3: Trigger curriculum generation
    const generateResponse = await request(app)
      .post(`/api/programs/${programId}/generate-curriculum`)
      .send({});

    expect(generateResponse.status).toBe(202);
    expect(generateResponse.body.data.jobId).toBe(jobId);
    expect(generateResponse.body.data.status).toBe('queued');

    // Step 4: Check generation status
    const statusResponse = await request(app)
      .get(`/api/programs/${programId}/generation-status`);

    expect(statusResponse.status).toBe(200);
    expect(statusResponse.body.data.status).toBe('completed');
    expect(statusResponse.body.data.progress).toBe(100);

    // Step 5: Get generated curriculum
    const curriculumResponse = await request(app)
      .get(`/api/programs/${programId}/curriculum`);

    expect(curriculumResponse.status).toBe(200);
    expect(curriculumResponse.body.data.programId).toBe(programId);
    expect(curriculumResponse.body.data.programSpec).toBeDefined();

    // Step 6: Export curriculum document
    const { programService } = await import('../../services/programService');
    (programService.getProgram as jest.Mock).mockResolvedValue({
      id: programId,
      program_name: 'E2E_Test_Program',
    });

    const exportResponse = await request(app)
      .get(`/api/programs/${programId}/download-specs?format=docx`);

    expect(exportResponse.status).toBe(200);
    expect(exportResponse.headers['content-type']).toContain('application/vnd.openxmlformats');
  });

  it('should handle validation errors during upload', async () => {
    const { excelValidationService } = await import('../../services/excelValidationService');
    
    (excelValidationService.validate as jest.Mock).mockReturnValue({
      isValid: false,
      errors: [
        {
          sheet: 'Program Overview',
          field: 'Program Name',
          message: 'Program name is required',
        },
      ],
      warnings: [],
    });

    const { uploadService } = await import('../../services/uploadService');
    (uploadService.getUploadById as jest.Mock).mockResolvedValue({
      id: uploadId,
      programId,
    });

    const validateResponse = await request(app)
      .post(`/api/programs/uploads/${uploadId}/validate`);

    expect(validateResponse.status).toBe(200);
    expect(validateResponse.body.isValid).toBe(false);
    expect(validateResponse.body.errors).toHaveLength(1);
  });

  it('should prevent generation without uploaded file', async () => {
    const { uploadService } = await import('../../services/uploadService');
    (uploadService.getUploadsByProgramId as jest.Mock).mockResolvedValue([]);

    const generateResponse = await request(app)
      .post(`/api/programs/${programId}/generate-curriculum`)
      .send({});

    expect(generateResponse.status).toBe(400);
    expect(generateResponse.body.error.code).toBe('NO_UPLOAD_FOUND');
  });
});
