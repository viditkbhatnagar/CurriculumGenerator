/**
 * Workflow Step 10 API Endpoint Tests
 * Tests for Step 10 API routes (POST and GET /api/v3/workflow/:id/step10)
 *
 * Requirements:
 * - 1.1: Test step 10 generation endpoint
 * - 1.1: Test step 10 retrieval endpoint
 */

import request from 'supertest';
import express, { Express } from 'express';
import mongoose from 'mongoose';
import { CurriculumWorkflow, ICurriculumWorkflow } from '../models/CurriculumWorkflow';
import { workflowService } from '../services/workflowService';

// Mock the services
jest.mock('../services/workflowService', () => ({
  workflowService: {
    processStep10: jest.fn(),
  },
}));

jest.mock('../services/loggingService', () => ({
  loggingService: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../services/wordExportService', () => ({
  wordExportService: {
    generateDocument: jest.fn(),
  },
}));

jest.mock('../services/analyticsStorageService', () => ({
  analyticsStorageService: {
    recordEvent: jest.fn(),
  },
}));

jest.mock('../middleware/auth', () => ({
  validateJWT: (req: any, res: any, next: any) => {
    req.user = { id: 'test-user-id', userId: 'test-user-id' };
    next();
  },
  loadUser: (req: any, res: any, next: any) => {
    req.user = { id: 'test-user-id', userId: 'test-user-id' };
    next();
  },
}));

// Import routes after mocks
import workflowRoutes from '../routes/workflowRoutes';

describe('Workflow Step 10 API Endpoint Tests', () => {
  let app: Express;
  let testWorkflow: ICurriculumWorkflow;
  let testWorkflowId: string;

  beforeAll(async () => {
    // Connect to test database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/test');
    }

    // Setup Express app
    app = express();
    app.use(express.json());
    app.use('/api/v3/workflow', workflowRoutes);
  });

  afterAll(async () => {
    // Clean up and disconnect
    if (testWorkflow) {
      await CurriculumWorkflow.findByIdAndDelete(testWorkflow._id);
    }
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Create a test workflow with step 9 completed
    testWorkflow = await CurriculumWorkflow.create({
      projectName: 'Test Step 10 API Workflow',
      createdBy: new mongoose.Types.ObjectId(),
      currentStep: 9,
      status: 'step9_complete',

      // Minimal step data for testing
      step1: {
        programTitle: 'Test Program',
        academicLevel: 'certificate',
        creditFramework: {
          system: 'uk_credits',
          credits: 60,
          totalHours: 600,
          contactHours: 180,
          independentHours: 420,
        },
      },
      step2: {
        knowledgeItems: [],
        skillItems: [],
        competencyItems: [],
        totalItems: 0,
      },
      step3: {
        outcomes: [],
      },
      step4: {
        modules: [
          {
            id: 'mod1',
            moduleCode: 'TEST101',
            title: 'Test Module',
            contactHours: 30,
            independentHours: 70,
            mlos: [
              {
                id: 'mlo1',
                outcomeNumber: 1,
                statement: 'Test MLO',
                bloomLevel: 'understand',
              },
            ],
          },
        ],
      },
      step5: {
        topicSources: [],
      },
      step6: {
        moduleReadingLists: [],
      },
      step7: {
        formativeAssessments: [],
        summativeAssessments: [],
      },
      step8: {
        caseStudies: [],
      },
      step9: {
        entries: [],
        totalTerms: 0,
      },

      stepProgress: [
        { step: 1, status: 'completed', startedAt: new Date(), completedAt: new Date() },
        { step: 2, status: 'completed', startedAt: new Date(), completedAt: new Date() },
        { step: 3, status: 'completed', startedAt: new Date(), completedAt: new Date() },
        { step: 4, status: 'completed', startedAt: new Date(), completedAt: new Date() },
        { step: 5, status: 'completed', startedAt: new Date(), completedAt: new Date() },
        { step: 6, status: 'completed', startedAt: new Date(), completedAt: new Date() },
        { step: 7, status: 'completed', startedAt: new Date(), completedAt: new Date() },
        { step: 8, status: 'completed', startedAt: new Date(), completedAt: new Date() },
        { step: 9, status: 'completed', startedAt: new Date(), completedAt: new Date() },
        { step: 10, status: 'pending' },
      ],
    });

    testWorkflowId = testWorkflow._id.toString();
  });

  afterEach(async () => {
    // Clean up test workflow
    if (testWorkflow) {
      await CurriculumWorkflow.findByIdAndDelete(testWorkflow._id);
    }
    jest.clearAllMocks();
  });

  describe('POST /api/v3/workflow/:id/step10', () => {
    it('should generate step 10 successfully when step 9 is complete', async () => {
      // Arrange
      const mockStep10Data = {
        moduleLessonPlans: [
          {
            moduleId: 'mod1',
            moduleCode: 'TEST101',
            moduleTitle: 'Test Module',
            totalContactHours: 30,
            totalLessons: 2,
            lessons: [
              {
                lessonId: 'lesson1',
                lessonNumber: 1,
                lessonTitle: 'Introduction',
                duration: 90,
                linkedMLOs: ['mlo1'],
                objectives: ['Test objective'],
                activities: [],
                materials: {
                  pptDeckRef: 'deck1',
                  caseFiles: [],
                  readingReferences: [],
                },
                instructorNotes: {
                  pedagogicalGuidance: 'Test guidance',
                  pacingSuggestions: 'Test pacing',
                  adaptationOptions: [],
                  commonMisconceptions: [],
                  discussionPrompts: [],
                },
                independentStudy: {
                  coreReadings: [],
                  supplementaryReadings: [],
                  estimatedEffort: 60,
                },
                formativeChecks: [],
              },
            ],
            pptDecks: [
              {
                deckId: 'deck1',
                lessonId: 'lesson1',
                lessonNumber: 1,
                slideCount: 20,
              },
            ],
          },
        ],
        validation: {
          allModulesHaveLessonPlans: true,
          allLessonDurationsValid: true,
          totalHoursMatch: true,
          allMLOsCovered: true,
          caseStudiesIntegrated: true,
          assessmentsIntegrated: true,
        },
        summary: {
          totalLessons: 2,
          totalContactHours: 30,
          averageLessonDuration: 90,
          caseStudiesIncluded: 0,
          formativeChecksIncluded: 0,
        },
        generatedAt: new Date(),
      };

      const mockUpdatedWorkflow = {
        ...testWorkflow.toObject(),
        step10: mockStep10Data,
        currentStep: 10,
        status: 'step10_complete',
      };

      (workflowService.processStep10 as jest.Mock).mockResolvedValue(mockUpdatedWorkflow);

      // Act
      const response = await request(app)
        .post(`/api/v3/workflow/${testWorkflowId}/step10`)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.step10).toBeDefined();
      expect(response.body.data.currentStep).toBe(10);
      expect(response.body.data.status).toBe('step10_complete');
      expect(response.body.data.totalLessons).toBe(2);
      expect(response.body.data.totalContactHours).toBe(30);
      expect(response.body.message).toContain('Step 10 complete');

      // Verify service was called with correct workflow ID
      expect(workflowService.processStep10).toHaveBeenCalledWith(testWorkflowId);
    });

    it('should return 404 when workflow does not exist', async () => {
      // Arrange
      const nonExistentId = new mongoose.Types.ObjectId().toString();

      // Act
      const response = await request(app)
        .post(`/api/v3/workflow/${nonExistentId}/step10`)
        .expect(404);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Workflow not found');
    });

    it('should return 400 when step 9 is not complete', async () => {
      // Arrange - create workflow without step 9
      const incompleteWorkflow = await CurriculumWorkflow.create({
        projectName: 'Incomplete Workflow',
        createdBy: new mongoose.Types.ObjectId(),
        currentStep: 8,
        status: 'step8_complete',
        step1: testWorkflow.step1,
        step2: testWorkflow.step2,
        step3: testWorkflow.step3,
        step4: testWorkflow.step4,
        step5: testWorkflow.step5,
        step6: testWorkflow.step6,
        step7: testWorkflow.step7,
        step8: testWorkflow.step8,
        // No step9
      });

      // Act
      const response = await request(app)
        .post(`/api/v3/workflow/${incompleteWorkflow._id}/step10`)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Step 9 must be completed');

      // Clean up
      await CurriculumWorkflow.findByIdAndDelete(incompleteWorkflow._id);
    });

    it('should return 500 when service throws an error', async () => {
      // Arrange
      (workflowService.processStep10 as jest.Mock).mockRejectedValue(new Error('Service error'));

      // Act
      const response = await request(app)
        .post(`/api/v3/workflow/${testWorkflowId}/step10`)
        .expect(500);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Service error');
    });
  });

  describe('GET /api/v3/workflow/:id/step10', () => {
    it('should retrieve step 10 data successfully', async () => {
      // Arrange - add step10 data to workflow
      const step10Data = {
        moduleLessonPlans: [
          {
            moduleId: 'mod1',
            moduleCode: 'TEST101',
            moduleTitle: 'Test Module',
            totalContactHours: 30,
            totalLessons: 2,
            lessons: [],
            pptDecks: [],
          },
        ],
        validation: {
          allModulesHaveLessonPlans: true,
          allLessonDurationsValid: true,
          totalHoursMatch: true,
          allMLOsCovered: true,
          caseStudiesIntegrated: true,
          assessmentsIntegrated: true,
        },
        summary: {
          totalLessons: 2,
          totalContactHours: 30,
          averageLessonDuration: 90,
          caseStudiesIncluded: 0,
          formativeChecksIncluded: 0,
        },
        generatedAt: new Date(),
      };

      testWorkflow.step10 = step10Data as any;
      testWorkflow.currentStep = 10;
      testWorkflow.status = 'step10_complete';
      await testWorkflow.save();

      // Act
      const response = await request(app)
        .get(`/api/v3/workflow/${testWorkflowId}/step10`)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.step10).toBeDefined();
      expect(response.body.data.step10.moduleLessonPlans).toBeDefined();
      expect(response.body.data.step10.moduleLessonPlans.length).toBe(1);
      expect(response.body.data.currentStep).toBe(10);
      expect(response.body.data.status).toBe('step10_complete');
    });

    it('should return 404 when workflow does not exist', async () => {
      // Arrange
      const nonExistentId = new mongoose.Types.ObjectId().toString();

      // Act
      const response = await request(app)
        .get(`/api/v3/workflow/${nonExistentId}/step10`)
        .expect(404);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Workflow not found');
    });

    it('should return 404 when step 10 data does not exist', async () => {
      // Act - workflow exists but has no step10 data
      const response = await request(app)
        .get(`/api/v3/workflow/${testWorkflowId}/step10`)
        .expect(404);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Step 10 data not found');
    });

    it('should include lesson plans and PPT references in response', async () => {
      // Arrange - add step10 data with PPT references
      const step10Data = {
        moduleLessonPlans: [
          {
            moduleId: 'mod1',
            moduleCode: 'TEST101',
            moduleTitle: 'Test Module',
            totalContactHours: 30,
            totalLessons: 2,
            lessons: [
              {
                lessonId: 'lesson1',
                lessonNumber: 1,
                lessonTitle: 'Introduction',
                duration: 90,
                linkedMLOs: ['mlo1'],
                objectives: ['Test objective'],
                activities: [],
                materials: {
                  pptDeckRef: 'deck1',
                  caseFiles: [],
                  readingReferences: [],
                },
                instructorNotes: {
                  pedagogicalGuidance: 'Test guidance',
                  pacingSuggestions: 'Test pacing',
                  adaptationOptions: [],
                  commonMisconceptions: [],
                  discussionPrompts: [],
                },
                independentStudy: {
                  coreReadings: [],
                  supplementaryReadings: [],
                  estimatedEffort: 60,
                },
                formativeChecks: [],
              },
            ],
            pptDecks: [
              {
                deckId: 'deck1',
                lessonId: 'lesson1',
                lessonNumber: 1,
                slideCount: 20,
              },
            ],
          },
        ],
        validation: {
          allModulesHaveLessonPlans: true,
          allLessonDurationsValid: true,
          totalHoursMatch: true,
          allMLOsCovered: true,
          caseStudiesIntegrated: true,
          assessmentsIntegrated: true,
        },
        summary: {
          totalLessons: 2,
          totalContactHours: 30,
          averageLessonDuration: 90,
          caseStudiesIncluded: 0,
          formativeChecksIncluded: 0,
        },
        generatedAt: new Date(),
      };

      testWorkflow.step10 = step10Data as any;
      testWorkflow.currentStep = 10;
      testWorkflow.status = 'step10_complete';
      await testWorkflow.save();

      // Act
      const response = await request(app)
        .get(`/api/v3/workflow/${testWorkflowId}/step10`)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.step10.moduleLessonPlans[0].lessons).toBeDefined();
      expect(response.body.data.step10.moduleLessonPlans[0].lessons.length).toBe(1);
      expect(response.body.data.step10.moduleLessonPlans[0].pptDecks).toBeDefined();
      expect(response.body.data.step10.moduleLessonPlans[0].pptDecks.length).toBe(1);
      expect(response.body.data.step10.moduleLessonPlans[0].pptDecks[0].deckId).toBe('deck1');
    });
  });
});
