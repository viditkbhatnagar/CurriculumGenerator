/**
 * Programs API Integration Tests
 * Tests for program creation and upload flow
 */

import request from 'supertest';
import express from 'express';
import programRoutes from '../../routes/programs';
import { programService } from '../../services/programService';
import { uploadService } from '../../services/uploadService';

// Mock services
jest.mock('../../services/programService');
jest.mock('../../services/uploadService');
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

describe('Programs API Integration Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/programs', programRoutes);
    jest.clearAllMocks();
  });

  describe('POST /api/programs/create', () => {
    it('should create a new program successfully', async () => {
      const mockProgram = {
        id: 'program-123',
        program_name: 'Test Program',
        qualification_level: 'Level 5',
        qualification_type: 'Certificate',
        total_credits: 120,
        industry_sector: 'Technology',
        status: 'draft',
        created_at: new Date(),
      };

      (programService.createProgram as jest.Mock).mockResolvedValue(mockProgram);

      const response = await request(app)
        .post('/api/programs/create')
        .send({
          program_name: 'Test Program',
          qualification_level: 'Level 5',
          qualification_type: 'Certificate',
          total_credits: 120,
          industry_sector: 'Technology',
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Program created successfully');
      expect(response.body.data.id).toBe('program-123');
      expect(response.body.data.programName).toBe('Test Program');
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/programs/create')
        .send({
          program_name: 'Test Program',
          // Missing other required fields
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/programs', () => {
    it('should list all programs', async () => {
      const mockPrograms = [
        {
          id: 'program-1',
          program_name: 'Program 1',
          qualification_level: 'Level 5',
          qualification_type: 'Certificate',
          total_credits: 120,
          industry_sector: 'Technology',
          status: 'draft',
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 'program-2',
          program_name: 'Program 2',
          qualification_level: 'Level 6',
          qualification_type: 'Diploma',
          total_credits: 120,
          industry_sector: 'Business',
          status: 'completed',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      (programService.listPrograms as jest.Mock).mockResolvedValue(mockPrograms);

      const response = await request(app).get('/api/programs');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].programName).toBe('Program 1');
    });

    it('should filter programs by status', async () => {
      const mockPrograms = [
        {
          id: 'program-1',
          program_name: 'Program 1',
          qualification_level: 'Level 5',
          qualification_type: 'Certificate',
          total_credits: 120,
          industry_sector: 'Technology',
          status: 'completed',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      (programService.listPrograms as jest.Mock).mockResolvedValue(mockPrograms);

      const response = await request(app).get('/api/programs?status=completed');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].status).toBe('completed');
    });
  });

  describe('GET /api/programs/:id', () => {
    it('should get program details', async () => {
      const mockProgram = {
        id: 'program-123',
        program_name: 'Test Program',
        qualification_level: 'Level 5',
        qualification_type: 'Certificate',
        total_credits: 120,
        industry_sector: 'Technology',
        status: 'draft',
        created_at: new Date(),
        updated_at: new Date(),
        modules: [],
      };

      (programService.getProgramWithDetails as jest.Mock).mockResolvedValue(mockProgram);

      const response = await request(app).get('/api/programs/program-123');

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe('program-123');
      expect(response.body.data.programName).toBe('Test Program');
    });

    it('should return 404 for non-existent program', async () => {
      (programService.getProgramWithDetails as jest.Mock).mockResolvedValue(null);

      const response = await request(app).get('/api/programs/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('PROGRAM_NOT_FOUND');
    });
  });

  describe('PUT /api/programs/:id', () => {
    it('should update program successfully', async () => {
      const existingProgram = {
        id: 'program-123',
        program_name: 'Old Name',
        qualification_level: 'Level 5',
        qualification_type: 'Certificate',
        total_credits: 120,
        industry_sector: 'Technology',
        status: 'draft',
        created_at: new Date(),
        updated_at: new Date(),
      };

      const updatedProgram = {
        ...existingProgram,
        program_name: 'New Name',
        updated_at: new Date(),
      };

      (programService.getProgram as jest.Mock).mockResolvedValue(existingProgram);
      (programService.updateProgram as jest.Mock).mockResolvedValue(updatedProgram);

      const response = await request(app)
        .put('/api/programs/program-123')
        .send({
          program_name: 'New Name',
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Program updated successfully');
      expect(response.body.data.programName).toBe('New Name');
    });

    it('should return 404 when updating non-existent program', async () => {
      (programService.getProgram as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .put('/api/programs/non-existent')
        .send({
          program_name: 'New Name',
        });

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('PROGRAM_NOT_FOUND');
    });
  });

  describe('GET /api/programs/:id/status', () => {
    it('should get program status', async () => {
      const mockProgram = {
        id: 'program-123',
        status: 'processing',
        updated_at: new Date(),
      };

      (programService.getProgram as jest.Mock).mockResolvedValue(mockProgram);

      const response = await request(app).get('/api/programs/program-123/status');

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('processing');
    });
  });
});
