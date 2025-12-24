/**
 * Workflow Step 10 Integration Tests
 * Tests for Step 10 (Lesson Plans & PPT Generation) processing
 *
 * Requirements:
 * - 1.1: Test full workflow from step 9 to step 10
 * - 1.2: Test context passing from previous steps
 */

import { workflowService } from '../../services/workflowService';
import { CurriculumWorkflow, ICurriculumWorkflow } from '../../models/CurriculumWorkflow';
import mongoose from 'mongoose';

// Mock the services
jest.mock('../../services/openaiService', () => ({
  openaiService: {
    generateContent: jest.fn().mockResolvedValue(
      JSON.stringify({
        objectives: ['Test objective 1', 'Test objective 2'],
        activities: [
          {
            title: 'Introduction',
            description: 'Lesson introduction',
            duration: 15,
            type: 'mini_lecture',
            teachingMethod: 'Direct instruction',
            resources: ['Slides'],
            instructorActions: ['Present content'],
            studentActions: ['Listen and take notes'],
          },
        ],
        pedagogicalGuidance: 'Test guidance',
        pacingSuggestions: 'Test pacing',
        adaptationOptions: ['Option 1'],
        commonMisconceptions: ['Misconception 1'],
        discussionPrompts: ['Prompt 1'],
      })
    ),
  },
}));

jest.mock('../../services/loggingService', () => ({
  loggingService: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('Workflow Step 10 Integration Tests', () => {
  let testWorkflow: ICurriculumWorkflow;

  beforeAll(async () => {
    // Connect to test database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/test');
    }
  });

  afterAll(async () => {
    // Clean up and disconnect
    if (testWorkflow) {
      await CurriculumWorkflow.findByIdAndDelete(testWorkflow._id);
    }
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Create a test workflow with all 9 steps completed
    testWorkflow = await CurriculumWorkflow.create({
      projectName: 'Test Step 10 Workflow',
      createdBy: new mongoose.Types.ObjectId(),
      currentStep: 9,
      status: 'step9_complete',

      // Step 1: Program Foundation
      step1: {
        programTitle: 'Test Program',
        programDescription: 'A test program for Step 10 integration testing',
        academicLevel: 'certificate',
        creditFramework: {
          system: 'uk_credits',
          credits: 60,
          totalHours: 600,
          contactHoursPercent: 30,
          contactHours: 180,
          independentHours: 420,
        },
        targetLearner: {
          ageRange: '25-45',
          educationalBackground: 'Bachelor degree',
          industrySector: 'Technology',
          experienceLevel: 'professional',
        },
        delivery: {
          mode: 'hybrid_blended',
          description: 'Blended learning approach',
        },
        programPurpose: 'To develop professional skills',
        jobRoles: [
          {
            title: 'Software Developer',
            description: 'Develops software applications',
            tasks: ['Write code', 'Test applications'],
          },
        ],
        completenessScore: 100,
        validatedAt: new Date(),
      },

      // Step 2: KSC Framework
      step2: {
        benchmarkPrograms: [],
        knowledgeItems: [
          {
            id: 'k1',
            statement: 'Programming fundamentals',
            description: 'Basic programming concepts',
            importance: 'essential',
          },
        ],
        skillItems: [
          {
            id: 's1',
            statement: 'Code debugging',
            description: 'Ability to debug code',
            importance: 'essential',
          },
        ],
        competencyItems: [
          {
            id: 'c1',
            statement: 'Problem solving',
            description: 'Analytical thinking',
            importance: 'essential',
          },
        ],
        totalItems: 3,
        essentialCount: 3,
        validatedAt: new Date(),
      },

      // Step 3: PLOs
      step3: {
        bloomLevels: ['understand', 'apply', 'analyze'],
        priorityCompetencies: ['c1'],
        outcomeEmphasis: 'technical',
        targetCount: 3,
        outcomes: [
          {
            id: 'plo1',
            outcomeNumber: 1,
            statement: 'Understand programming concepts',
            bloomLevel: 'understand',
            competencyLinks: ['c1'],
            jobTaskMapping: ['Write code'],
          },
          {
            id: 'plo2',
            outcomeNumber: 2,
            statement: 'Apply debugging techniques',
            bloomLevel: 'apply',
            competencyLinks: ['c1'],
            jobTaskMapping: ['Test applications'],
          },
        ],
        validatedAt: new Date(),
      },

      // Step 4: Course Framework
      step4: {
        modules: [
          {
            id: 'mod1',
            moduleCode: 'CS101',
            title: 'Introduction to Programming',
            sequenceOrder: 1,
            totalHours: 100,
            contactHours: 30,
            independentHours: 70,
            isCore: true,
            prerequisites: [],
            mlos: [
              {
                id: 'mlo1',
                outcomeNumber: 1,
                statement: 'Understand basic programming syntax',
                bloomLevel: 'understand',
                linkedPLOs: ['plo1'],
                competencyLinks: ['c1'],
              },
              {
                id: 'mlo2',
                outcomeNumber: 2,
                statement: 'Apply control structures',
                bloomLevel: 'apply',
                linkedPLOs: ['plo2'],
                competencyLinks: ['c1'],
              },
            ],
            contactActivities: ['Lectures', 'Labs'],
            independentActivities: ['Reading', 'Assignments'],
          },
        ],
        totalProgramHours: 600,
        totalContactHours: 180,
        totalIndependentHours: 420,
        ploModuleMapping: [
          {
            ploId: 'plo1',
            moduleIds: ['mod1'],
          },
        ],
        progressiveComplexity: {
          earlyModulesLowerLevel: true,
          laterModulesHigherLevel: true,
        },
        hoursIntegrity: true,
        validatedAt: new Date(),
      },

      // Step 5: Sources
      step5: {
        topicSources: [
          {
            id: 'topic1',
            topic: 'Programming Basics',
            moduleId: 'mod1',
            sources: [
              {
                id: 'src1',
                authors: 'Smith, J.',
                year: 2023,
                title: 'Introduction to Programming',
                publisher: 'Tech Press',
                apaCitation: 'Smith, J. (2023). Introduction to Programming. Tech Press.',
                sourceType: 'academic_text',
                isRecent: true,
                isSeminal: false,
                isVerified: true,
                isAccessible: true,
                apaValidated: true,
                mloIds: ['mlo1'],
                classification: 'academic',
              },
            ],
          },
        ],
        validationSummary: {
          totalSources: 1,
          peerReviewedCount: 0,
          peerReviewedPercent: 0,
          recentCount: 1,
          seminalCount: 0,
          academicCount: 1,
          appliedCount: 0,
          allTopicsHaveMinSources: true,
          allMlosHaveSources: true,
          apaAccuracy: 100,
        },
        agiCompliant: true,
        complianceIssues: [],
        adminOverrideRequired: false,
        validatedAt: new Date(),
      },

      // Step 6: Reading Lists
      step6: {
        moduleReadingLists: [
          {
            moduleId: 'mod1',
            coreReadings: [
              {
                id: 'read1',
                sourceId: 'src1',
                citation: 'Smith, J. (2023). Introduction to Programming. Tech Press.',
                estimatedMinutes: 60,
                complexityLevel: 'introductory',
                mloIds: ['mlo1'],
                assessmentRelevance: 'high',
              },
            ],
            supplementaryReadings: [],
            totalReadingTime: 60,
          },
        ],
        crossModuleRefs: [],
        allModulesHaveCoreReadings: true,
        allCoreMapToMlos: true,
        readingTimeWithinBudget: true,
        validatedAt: new Date(),
      },

      // Step 7: Assessments
      step7: {
        userPreferences: {
          assessmentStructure: 'both_formative_and_summative',
          assessmentBalance: 'blended_mix',
          certificationStyles: [],
          academicTypes: [],
          summativeFormat: 'mcq_exam',
          formativeTypesPerUnit: ['quiz'],
          formativePerModule: 2,
          weightages: {
            formative: 30,
            summative: 70,
          },
          assessmentMappingStrategy: 'hybrid',
          higherOrderPloPolicy: 'yes',
          useRealWorldScenarios: true,
          alignToWorkplacePerformance: true,
          integratedRealWorldSummative: true,
          generateSampleQuestions: true,
        },
        formativeAssessments: [
          {
            id: 'form1',
            moduleId: 'mod1',
            title: 'Programming Quiz 1',
            assessmentType: 'quiz',
            description: 'Test basic programming knowledge',
            instructions: 'Complete the quiz',
            alignedPLOs: ['plo1'],
            alignedMLOs: ['mlo1'],
            assessmentCriteria: ['Accuracy', 'Completeness'],
            maxMarks: 10,
          },
        ],
        summativeAssessments: [],
        sampleQuestions: {
          mcq: [],
          sjt: [],
          caseQuestions: [],
          essayPrompts: [],
          practicalTasks: [],
        },
        validation: {
          allFormativesMapped: true,
          allSummativesMapped: true,
          weightsSum100: true,
          sufficientSampleQuestions: true,
          plosCovered: true,
        },
        generatedAt: new Date(),
        validatedAt: new Date(),
      },

      // Step 8: Case Studies
      step8: {
        caseStudies: [
          {
            id: 'case1',
            type: 'practice',
            title: 'Debugging Challenge',
            industryContext: 'Software Development',
            organizationName: 'Tech Corp',
            scenario: 'A software bug needs to be identified and fixed',
            moduleIds: ['mod1'],
            mloIds: ['mlo2'],
            difficultyLevel: 'intermediate',
            hooks: {
              keyFacts: ['Bug in loop', 'Off-by-one error'],
              misconceptions: ['Syntax error'],
              decisionPoints: ['Where to add breakpoint'],
              terminology: [
                {
                  term: 'Breakpoint',
                  definition: 'A debugging tool',
                },
              ],
            },
            noPII: true,
            brandsAnonymized: true,
          },
        ],
        validation: {
          allMapToModules: true,
          allMapToMlos: true,
          allWithinWordLimit: true,
          allEthicsCompliant: true,
          hooksProvidedForAssessmentReady: true,
        },
        validatedAt: new Date(),
      },

      // Step 9: Glossary
      step9: {
        entries: [
          {
            id: 'term1',
            term: 'Variable',
            definition: 'A named storage location in memory that holds a value',
            exampleSentence: 'The variable x stores the user input',
            relatedTerms: ['Constant', 'Data type'],
            broaderTerms: ['Programming concept'],
            narrowerTerms: ['Local variable', 'Global variable'],
            synonyms: [],
            moduleIds: ['mod1'],
            source: 'mlos',
          },
          {
            id: 'term2',
            term: 'Breakpoint',
            definition: 'A debugging tool that pauses program execution',
            exampleSentence: 'Set a breakpoint to inspect variable values',
            relatedTerms: ['Debugger', 'Step through'],
            broaderTerms: ['Debugging'],
            narrowerTerms: [],
            synonyms: [],
            moduleIds: ['mod1'],
            source: 'case_study',
          },
        ],
        totalTerms: 2,
        assessmentTermsCount: 0,
        competencyTermsCount: 0,
        validation: {
          allAssessmentTermsIncluded: true,
          allDefinitionsWithinLimit: true,
          noCircularDefinitions: true,
          allCrossRefsValid: true,
          consistentSpelling: true,
          allMappedToModules: true,
        },
        generatedAt: new Date(),
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
  });

  afterEach(async () => {
    // Clean up test workflow
    if (testWorkflow) {
      await CurriculumWorkflow.findByIdAndDelete(testWorkflow._id);
    }
  });

  describe('processStep10', () => {
    it('should process Step 10 successfully with all 9 previous steps complete', async () => {
      // Act
      const result = await workflowService.processStep10(testWorkflow._id.toString());

      // Assert
      expect(result).toBeDefined();
      expect(result.step10).toBeDefined();
      expect(result.currentStep).toBe(10);
      expect(result.status).toBe('step10_complete');

      // Verify step10 structure
      expect(result.step10.moduleLessonPlans).toBeDefined();
      expect(Array.isArray(result.step10.moduleLessonPlans)).toBe(true);
      expect(result.step10.moduleLessonPlans.length).toBeGreaterThan(0);

      // Verify validation
      expect(result.step10.validation).toBeDefined();
      expect(result.step10.validation.allModulesHaveLessonPlans).toBe(true);

      // Verify summary
      expect(result.step10.summary).toBeDefined();
      expect(result.step10.summary.totalLessons).toBeGreaterThan(0);
      expect(result.step10.summary.totalContactHours).toBeGreaterThan(0);

      // Verify step progress
      const step10Progress = result.stepProgress.find((p: any) => p.step === 10);
      expect(step10Progress).toBeDefined();
      expect(step10Progress?.status).toBe('completed');
      expect(step10Progress?.completedAt).toBeDefined();
    });

    it('should throw error if Step 9 is not complete', async () => {
      // Arrange - create workflow without step9
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

      // Act & Assert
      await expect(
        workflowService.processStep10(incompleteWorkflow._id.toString())
      ).rejects.toThrow('Workflow not found or Step 9 not complete');

      // Clean up
      await CurriculumWorkflow.findByIdAndDelete(incompleteWorkflow._id);
    });

    it('should pass context from all 9 previous steps to lesson plan generation', async () => {
      // Act
      const result = await workflowService.processStep10(testWorkflow._id.toString());

      // Assert - verify that lesson plans reference data from previous steps
      const modulePlan = result.step10.moduleLessonPlans[0];
      expect(modulePlan).toBeDefined();
      expect(modulePlan.moduleCode).toBe('CS101');
      expect(modulePlan.moduleTitle).toBe('Introduction to Programming');
      expect(modulePlan.lessons).toBeDefined();
      expect(modulePlan.lessons.length).toBeGreaterThan(0);

      // Verify lesson has MLO alignment (from Step 4)
      const lesson = modulePlan.lessons[0];
      expect(lesson.linkedMLOs).toBeDefined();
      expect(lesson.linkedMLOs.length).toBeGreaterThan(0);

      // Verify lesson has objectives
      expect(lesson.objectives).toBeDefined();
      expect(lesson.objectives.length).toBeGreaterThan(0);

      // Verify lesson has activities
      expect(lesson.activities).toBeDefined();
      expect(lesson.activities.length).toBeGreaterThan(0);

      // Verify lesson has materials (references Step 5-6)
      expect(lesson.materials).toBeDefined();
      expect(lesson.materials.readingReferences).toBeDefined();

      // Verify lesson has instructor notes
      expect(lesson.instructorNotes).toBeDefined();
      expect(lesson.instructorNotes.pedagogicalGuidance).toBeDefined();

      // Verify lesson has independent study
      expect(lesson.independentStudy).toBeDefined();
    });

    it('should generate PPT decks for all lessons', async () => {
      // Act
      const result = await workflowService.processStep10(testWorkflow._id.toString());

      // Assert
      const modulePlan = result.step10.moduleLessonPlans[0];
      expect(modulePlan.pptDecks).toBeDefined();
      expect(Array.isArray(modulePlan.pptDecks)).toBe(true);

      // Verify PPT deck references match lessons
      expect(modulePlan.pptDecks.length).toBe(modulePlan.lessons.length);

      // Verify each PPT deck has required properties
      modulePlan.pptDecks.forEach((deck: any) => {
        expect(deck.deckId).toBeDefined();
        expect(deck.lessonId).toBeDefined();
        expect(deck.lessonNumber).toBeDefined();
        expect(deck.slideCount).toBeGreaterThan(0);
      });
    });

    it('should integrate case studies into appropriate lessons', async () => {
      // Act
      const result = await workflowService.processStep10(testWorkflow._id.toString());

      // Assert
      const modulePlan = result.step10.moduleLessonPlans[0];
      const lessonsWithCases = modulePlan.lessons.filter((l: any) => l.caseStudyActivity);

      // Verify at least one lesson has a case study
      expect(lessonsWithCases.length).toBeGreaterThan(0);

      // Verify case study activity structure
      const lessonWithCase = lessonsWithCases[0];
      expect(lessonWithCase.caseStudyActivity).toBeDefined();
      expect(lessonWithCase.caseStudyActivity.caseStudyId).toBe('case1');
      expect(lessonWithCase.caseStudyActivity.caseTitle).toBe('Debugging Challenge');
    });

    it('should integrate formative assessments into lessons', async () => {
      // Act
      const result = await workflowService.processStep10(testWorkflow._id.toString());

      // Assert
      const modulePlan = result.step10.moduleLessonPlans[0];
      const totalFormativeChecks = modulePlan.lessons.reduce(
        (sum: number, lesson: any) => sum + (lesson.formativeChecks?.length || 0),
        0
      );

      // Verify formative checks are integrated
      expect(totalFormativeChecks).toBeGreaterThan(0);
      expect(result.step10.summary.formativeChecksIncluded).toBe(totalFormativeChecks);
    });
  });
});
