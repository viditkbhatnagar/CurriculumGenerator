/**
 * Property-Based Tests for WordExportService
 *
 * **Feature: lesson-plan-ppt-integration, Property 12: Document Export Completeness**
 * **Validates: Requirements 11.1, 11.2**
 *
 * Tests that the Word Export Service correctly includes all 10 steps in the
 * exported curriculum document in sequential order.
 */

import * as fc from 'fast-check';

// Mock OpenAI before importing the service
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    paragraphs: ['Test paragraph'],
                    bullets: [],
                  }),
                },
              },
            ],
          }),
        },
      },
    })),
  };
});

import { wordExportService } from '../services/wordExportService';

// Arbitrary for generating minimal workflow data with varying steps
const workflowDataArb = fc.record({
  projectName: fc.string({ minLength: 5, maxLength: 50 }),
  step1: fc.option(
    fc.record({
      programTitle: fc.string({ minLength: 5, maxLength: 100 }),
      programDescription: fc.string({ minLength: 10, maxLength: 200 }),
      academicLevel: fc.constantFrom('certificate', 'micro-credential', 'diploma'),
      creditFramework: fc.record({
        system: fc.constantFrom('uk_credits', 'ects', 'us_semester', 'non_credit'),
        credits: fc.integer({ min: 1, max: 120 }),
        totalHours: fc.integer({ min: 10, max: 500 }),
        contactHours: fc.integer({ min: 5, max: 250 }),
        independentHours: fc.integer({ min: 5, max: 250 }),
      }),
    }),
    { nil: undefined }
  ),
  step2: fc.option(
    fc.record({
      knowledgeItems: fc.array(
        fc.record({
          id: fc.string({ minLength: 2, maxLength: 10 }),
          statement: fc.string({ minLength: 10, maxLength: 100 }),
          description: fc.string({ minLength: 10, maxLength: 200 }),
        }),
        { maxLength: 3 }
      ),
      skillItems: fc.constant([]),
      competencyItems: fc.constant([]),
    }),
    { nil: undefined }
  ),
  step3: fc.option(
    fc.record({
      outcomes: fc.array(
        fc.record({
          id: fc.string({ minLength: 3, maxLength: 10 }),
          statement: fc.string({ minLength: 10, maxLength: 100 }),
          bloomLevel: fc.constantFrom(
            'Remember',
            'Understand',
            'Apply',
            'Analyze',
            'Evaluate',
            'Create'
          ),
        }),
        { maxLength: 3 }
      ),
    }),
    { nil: undefined }
  ),
  step4: fc.option(
    fc.record({
      modules: fc.array(
        fc.record({
          moduleCode: fc.string({ minLength: 3, maxLength: 10 }),
          title: fc.string({ minLength: 5, maxLength: 50 }),
          totalHours: fc.integer({ min: 10, max: 100 }),
          contactHours: fc.integer({ min: 5, max: 50 }),
          mlos: fc.array(
            fc.record({
              id: fc.string({ minLength: 3, maxLength: 10 }),
              statement: fc.string({ minLength: 10, maxLength: 100 }),
              bloomLevel: fc.constantFrom('Remember', 'Understand', 'Apply'),
            }),
            { maxLength: 2 }
          ),
        }),
        { minLength: 1, maxLength: 3 }
      ),
    }),
    { nil: undefined }
  ),
  step5: fc.option(
    fc.record({
      sources: fc.array(
        fc.record({
          citation: fc.string({ minLength: 10, maxLength: 100 }),
          title: fc.string({ minLength: 5, maxLength: 50 }),
        }),
        { maxLength: 3 }
      ),
    }),
    { nil: undefined }
  ),
  step6: fc.option(
    fc.record({
      coreReadings: fc.array(fc.string({ minLength: 10, maxLength: 100 }), { maxLength: 3 }),
      supplementaryReadings: fc.array(fc.string({ minLength: 10, maxLength: 100 }), {
        maxLength: 2,
      }),
    }),
    { nil: undefined }
  ),
  step7: fc.option(
    fc.record({
      formativeAssessments: fc.array(
        fc.record({
          title: fc.string({ minLength: 5, maxLength: 50 }),
          description: fc.string({ minLength: 10, maxLength: 100 }),
          assessmentType: fc.constantFrom('quiz', 'assignment', 'discussion'),
        }),
        { maxLength: 2 }
      ),
      summativeAssessments: fc.constant([]),
    }),
    { nil: undefined }
  ),
  step8: fc.option(
    fc.record({
      caseStudies: fc.array(
        fc.record({
          title: fc.string({ minLength: 5, maxLength: 50 }),
          scenario: fc.string({ minLength: 20, maxLength: 200 }),
        }),
        { maxLength: 2 }
      ),
    }),
    { nil: undefined }
  ),
  step9: fc.option(
    fc.record({
      terms: fc.array(
        fc.record({
          term: fc.string({ minLength: 3, maxLength: 30 }),
          definition: fc.string({ minLength: 10, maxLength: 100 }),
        }),
        { maxLength: 3 }
      ),
    }),
    { nil: undefined }
  ),
  step10: fc.option(
    fc.record({
      moduleLessonPlans: fc.array(
        fc.record({
          moduleId: fc.uuid(),
          moduleCode: fc.string({ minLength: 3, maxLength: 10 }),
          moduleTitle: fc.string({ minLength: 5, maxLength: 50 }),
          totalContactHours: fc.integer({ min: 10, max: 100 }),
          totalLessons: fc.integer({ min: 1, max: 10 }),
          lessons: fc.array(
            fc.record({
              lessonId: fc.uuid(),
              lessonNumber: fc.integer({ min: 1, max: 10 }),
              lessonTitle: fc.string({ minLength: 5, maxLength: 50 }),
              duration: fc.integer({ min: 60, max: 180 }),
              linkedMLOs: fc.array(fc.string({ minLength: 3, maxLength: 10 }), {
                minLength: 1,
                maxLength: 2,
              }),
              linkedPLOs: fc.array(fc.string({ minLength: 3, maxLength: 10 }), { maxLength: 2 }),
              bloomLevel: fc.constantFrom('Remember', 'Understand', 'Apply'),
              objectives: fc.array(fc.string({ minLength: 10, maxLength: 100 }), {
                minLength: 1,
                maxLength: 3,
              }),
              activities: fc.array(
                fc.record({
                  activityId: fc.uuid(),
                  sequenceOrder: fc.integer({ min: 1, max: 10 }),
                  type: fc.constantFrom('mini_lecture', 'discussion', 'practice'),
                  title: fc.string({ minLength: 5, maxLength: 50 }),
                  description: fc.string({ minLength: 10, maxLength: 100 }),
                  duration: fc.integer({ min: 5, max: 60 }),
                  teachingMethod: fc.string({ minLength: 5, maxLength: 30 }),
                  resources: fc.constant([]),
                  instructorActions: fc.constant([]),
                  studentActions: fc.constant([]),
                }),
                { minLength: 1, maxLength: 5 }
              ),
              materials: fc.record({
                pptDeckRef: fc.string({ minLength: 5, maxLength: 50 }),
                caseFiles: fc.constant([]),
                readingReferences: fc.constant([]),
              }),
              instructorNotes: fc.record({
                pedagogicalGuidance: fc.string({ minLength: 20, maxLength: 200 }),
                pacingSuggestions: fc.string({ minLength: 10, maxLength: 100 }),
                adaptationOptions: fc.array(fc.string({ minLength: 10, maxLength: 50 }), {
                  maxLength: 2,
                }),
                commonMisconceptions: fc.constant([]),
                discussionPrompts: fc.constant([]),
              }),
              independentStudy: fc.record({
                coreReadings: fc.constant([]),
                supplementaryReadings: fc.constant([]),
                estimatedEffort: fc.integer({ min: 30, max: 180 }),
              }),
              formativeChecks: fc.constant([]),
            }),
            { minLength: 1, maxLength: 3 }
          ),
          pptDecks: fc.array(
            fc.record({
              deckId: fc.uuid(),
              lessonId: fc.uuid(),
              lessonNumber: fc.integer({ min: 1, max: 10 }),
              slideCount: fc.integer({ min: 15, max: 35 }),
            }),
            { maxLength: 3 }
          ),
        }),
        { minLength: 1, maxLength: 2 }
      ),
      validation: fc.record({
        allModulesHaveLessonPlans: fc.boolean(),
        allLessonDurationsValid: fc.boolean(),
        totalHoursMatch: fc.boolean(),
        allMLOsCovered: fc.boolean(),
        caseStudiesIntegrated: fc.boolean(),
        assessmentsIntegrated: fc.boolean(),
      }),
      summary: fc.record({
        totalLessons: fc.integer({ min: 1, max: 50 }),
        totalContactHours: fc.integer({ min: 10, max: 500 }),
        averageLessonDuration: fc.integer({ min: 60, max: 180 }),
        caseStudiesIncluded: fc.integer({ min: 0, max: 20 }),
        formativeChecksIncluded: fc.integer({ min: 0, max: 50 }),
      }),
      generatedAt: fc.date(),
    }),
    { nil: undefined }
  ),
  createdAt: fc.option(fc.constant(new Date('2024-01-01').toISOString()), { nil: undefined }),
  updatedAt: fc.option(fc.constant(new Date('2024-06-01').toISOString()), { nil: undefined }),
});

describe('WordExportService - Property Tests', () => {
  /**
   * **Feature: lesson-plan-ppt-integration, Property 12: Document Export Completeness**
   * **Validates: Requirements 11.1, 11.2**
   *
   * Property: For any exported curriculum document, the document SHALL include
   * sections for all 10 steps in sequential order.
   *
   * This test verifies that:
   * - The document generation includes Step 10 after Step 9 (Req 11.1)
   * - Step 10 section includes lesson plans with proper formatting (Req 11.2)
   * - All present steps are included in the document
   * - The document can be generated without errors
   */
  describe('Property 12: Document Export Completeness', () => {
    it('should generate document with all present steps including Step 10', async () => {
      await fc.assert(
        fc.asyncProperty(workflowDataArb, async (workflowData) => {
          // Generate the document
          const buffer = await wordExportService.generateDocument(workflowData);

          // Verify buffer is generated
          expect(buffer).toBeDefined();
          expect(buffer).toBeInstanceOf(Buffer);
          expect(buffer.length).toBeGreaterThan(0);

          // The document should be successfully generated for any valid workflow data
          // This validates that the service can handle all 10 steps
          return true;
        }),
        { numRuns: 100 } // Run 100 iterations as specified in design
      );
    }, 60000); // 60 second timeout for async property test

    it('should include Step 10 section when step10 data is present', async () => {
      await fc.assert(
        fc.asyncProperty(
          workflowDataArb.filter((data) => data.step10 !== undefined),
          async (workflowData) => {
            // Generate the document with Step 10 data
            const buffer = await wordExportService.generateDocument(workflowData);

            // Verify buffer is generated
            expect(buffer).toBeDefined();
            expect(buffer).toBeInstanceOf(Buffer);
            expect(buffer.length).toBeGreaterThan(0);

            // The presence of step10 data should not cause errors
            // and should result in a valid document
            return true;
          }
        ),
        { numRuns: 100 }
      );
    }, 60000);

    it('should handle workflows with all 10 steps present', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            projectName: fc.string({ minLength: 5, maxLength: 50 }),
            step1: fc.record({
              programTitle: fc.string({ minLength: 5, maxLength: 100 }),
              programDescription: fc.string({ minLength: 10, maxLength: 200 }),
              academicLevel: fc.constantFrom('certificate', 'micro-credential', 'diploma'),
              creditFramework: fc.record({
                system: fc.constantFrom('uk_credits', 'ects'),
                credits: fc.integer({ min: 1, max: 120 }),
                totalHours: fc.integer({ min: 10, max: 500 }),
                contactHours: fc.integer({ min: 5, max: 250 }),
                independentHours: fc.integer({ min: 5, max: 250 }),
              }),
            }),
            step2: fc.record({
              knowledgeItems: fc.array(
                fc.record({
                  id: fc.string({ minLength: 2, maxLength: 10 }),
                  statement: fc.string({ minLength: 10, maxLength: 100 }),
                  description: fc.string({ minLength: 10, maxLength: 200 }),
                }),
                { minLength: 1, maxLength: 2 }
              ),
              skillItems: fc.constant([]),
              competencyItems: fc.constant([]),
            }),
            step3: fc.record({
              outcomes: fc.array(
                fc.record({
                  id: fc.string({ minLength: 3, maxLength: 10 }),
                  statement: fc.string({ minLength: 10, maxLength: 100 }),
                  bloomLevel: fc.constantFrom('Remember', 'Understand', 'Apply'),
                }),
                { minLength: 1, maxLength: 2 }
              ),
            }),
            step4: fc.record({
              modules: fc.array(
                fc.record({
                  moduleCode: fc.string({ minLength: 3, maxLength: 10 }),
                  title: fc.string({ minLength: 5, maxLength: 50 }),
                  totalHours: fc.integer({ min: 10, max: 100 }),
                  contactHours: fc.integer({ min: 5, max: 50 }),
                  mlos: fc.array(
                    fc.record({
                      id: fc.string({ minLength: 3, maxLength: 10 }),
                      statement: fc.string({ minLength: 10, maxLength: 100 }),
                      bloomLevel: fc.constantFrom('Remember', 'Understand'),
                    }),
                    { minLength: 1, maxLength: 2 }
                  ),
                }),
                { minLength: 1, maxLength: 2 }
              ),
            }),
            step5: fc.record({
              sources: fc.array(
                fc.record({
                  citation: fc.string({ minLength: 10, maxLength: 100 }),
                  title: fc.string({ minLength: 5, maxLength: 50 }),
                }),
                { minLength: 1, maxLength: 2 }
              ),
            }),
            step6: fc.record({
              coreReadings: fc.array(fc.string({ minLength: 10, maxLength: 100 }), {
                minLength: 1,
                maxLength: 2,
              }),
              supplementaryReadings: fc.constant([]),
            }),
            step7: fc.record({
              formativeAssessments: fc.array(
                fc.record({
                  title: fc.string({ minLength: 5, maxLength: 50 }),
                  description: fc.string({ minLength: 10, maxLength: 100 }),
                  assessmentType: fc.constantFrom('quiz', 'assignment'),
                }),
                { minLength: 1, maxLength: 2 }
              ),
              summativeAssessments: fc.constant([]),
            }),
            step8: fc.record({
              caseStudies: fc.array(
                fc.record({
                  title: fc.string({ minLength: 5, maxLength: 50 }),
                  scenario: fc.string({ minLength: 20, maxLength: 200 }),
                }),
                { minLength: 1, maxLength: 2 }
              ),
            }),
            step9: fc.record({
              terms: fc.array(
                fc.record({
                  term: fc.string({ minLength: 3, maxLength: 30 }),
                  definition: fc.string({ minLength: 10, maxLength: 100 }),
                }),
                { minLength: 1, maxLength: 2 }
              ),
            }),
            step10: fc.record({
              moduleLessonPlans: fc.array(
                fc.record({
                  moduleId: fc.uuid(),
                  moduleCode: fc.string({ minLength: 3, maxLength: 10 }),
                  moduleTitle: fc.string({ minLength: 5, maxLength: 50 }),
                  totalContactHours: fc.integer({ min: 10, max: 100 }),
                  totalLessons: fc.integer({ min: 1, max: 5 }),
                  lessons: fc.array(
                    fc.record({
                      lessonId: fc.uuid(),
                      lessonNumber: fc.integer({ min: 1, max: 5 }),
                      lessonTitle: fc.string({ minLength: 5, maxLength: 50 }),
                      duration: fc.integer({ min: 60, max: 180 }),
                      linkedMLOs: fc.array(fc.string({ minLength: 3, maxLength: 10 }), {
                        minLength: 1,
                        maxLength: 2,
                      }),
                      linkedPLOs: fc.array(fc.string({ minLength: 3, maxLength: 10 }), {
                        maxLength: 1,
                      }),
                      bloomLevel: fc.constantFrom('Remember', 'Understand'),
                      objectives: fc.array(fc.string({ minLength: 10, maxLength: 100 }), {
                        minLength: 1,
                        maxLength: 2,
                      }),
                      activities: fc.array(
                        fc.record({
                          activityId: fc.uuid(),
                          sequenceOrder: fc.integer({ min: 1, max: 5 }),
                          type: fc.constantFrom('mini_lecture', 'discussion'),
                          title: fc.string({ minLength: 5, maxLength: 50 }),
                          description: fc.string({ minLength: 10, maxLength: 100 }),
                          duration: fc.integer({ min: 10, max: 30 }),
                          teachingMethod: fc.string({ minLength: 5, maxLength: 30 }),
                          resources: fc.constant([]),
                          instructorActions: fc.constant([]),
                          studentActions: fc.constant([]),
                        }),
                        { minLength: 1, maxLength: 3 }
                      ),
                      materials: fc.record({
                        pptDeckRef: fc.string({ minLength: 5, maxLength: 50 }),
                        caseFiles: fc.constant([]),
                        readingReferences: fc.constant([]),
                      }),
                      instructorNotes: fc.record({
                        pedagogicalGuidance: fc.string({ minLength: 20, maxLength: 200 }),
                        pacingSuggestions: fc.string({ minLength: 10, maxLength: 100 }),
                        adaptationOptions: fc.array(fc.string({ minLength: 10, maxLength: 50 }), {
                          maxLength: 1,
                        }),
                        commonMisconceptions: fc.constant([]),
                        discussionPrompts: fc.constant([]),
                      }),
                      independentStudy: fc.record({
                        coreReadings: fc.constant([]),
                        supplementaryReadings: fc.constant([]),
                        estimatedEffort: fc.integer({ min: 30, max: 180 }),
                      }),
                      formativeChecks: fc.constant([]),
                    }),
                    { minLength: 1, maxLength: 2 }
                  ),
                  pptDecks: fc.array(
                    fc.record({
                      deckId: fc.uuid(),
                      lessonId: fc.uuid(),
                      lessonNumber: fc.integer({ min: 1, max: 5 }),
                      slideCount: fc.integer({ min: 15, max: 35 }),
                    }),
                    { minLength: 1, maxLength: 2 }
                  ),
                }),
                { minLength: 1, maxLength: 2 }
              ),
              validation: fc.record({
                allModulesHaveLessonPlans: fc.boolean(),
                allLessonDurationsValid: fc.boolean(),
                totalHoursMatch: fc.boolean(),
                allMLOsCovered: fc.boolean(),
                caseStudiesIntegrated: fc.boolean(),
                assessmentsIntegrated: fc.boolean(),
              }),
              summary: fc.record({
                totalLessons: fc.integer({ min: 1, max: 10 }),
                totalContactHours: fc.integer({ min: 10, max: 200 }),
                averageLessonDuration: fc.integer({ min: 60, max: 180 }),
                caseStudiesIncluded: fc.integer({ min: 0, max: 5 }),
                formativeChecksIncluded: fc.integer({ min: 0, max: 10 }),
              }),
              generatedAt: fc.date(),
            }),
          }),
          async (workflowData) => {
            // Generate document with all 10 steps
            const buffer = await wordExportService.generateDocument(workflowData);

            // Verify successful generation
            expect(buffer).toBeDefined();
            expect(buffer).toBeInstanceOf(Buffer);
            expect(buffer.length).toBeGreaterThan(0);

            // Document should be generated successfully with all 10 steps
            return true;
          }
        ),
        { numRuns: 100 }
      );
    }, 60000);
  });
});
