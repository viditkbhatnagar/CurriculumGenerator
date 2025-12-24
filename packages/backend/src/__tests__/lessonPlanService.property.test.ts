/**
 * Property-Based Tests for LessonPlanService
 *
 * Tests the core lesson planning functionality using fast-check
 * to verify properties hold across all valid inputs.
 */

import * as fc from 'fast-check';
import {
  LessonPlanService,
  MLO,
  ModuleData,
  LessonBlock,
  getBloomLevelOrder,
  BLOOM_LEVELS_ORDER,
} from '../services/lessonPlanService';

// ============================================================================
// ARBITRARIES (Test Data Generators)
// ============================================================================

// Valid Bloom levels
const bloomLevels = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];

// Generate a valid MLO
const mloArb: fc.Arbitrary<MLO> = fc.record({
  id: fc.uuid(),
  outcomeNumber: fc.integer({ min: 1, max: 20 }),
  statement: fc.string({ minLength: 10, maxLength: 200 }),
  bloomLevel: fc.constantFrom(...bloomLevels),
  linkedPLOs: fc.array(fc.uuid(), { minLength: 0, maxLength: 3 }),
  competencyLinks: fc.array(fc.uuid(), { minLength: 0, maxLength: 3 }),
});

// Generate valid contact hours (1-20 hours, representing realistic module sizes)
const contactHoursArb = fc.integer({ min: 1, max: 20 });

// Generate a valid module with MLOs
const moduleDataArb: fc.Arbitrary<ModuleData> = fc.record({
  id: fc.uuid(),
  moduleCode: fc.string({ minLength: 3, maxLength: 10 }),
  title: fc.string({ minLength: 5, maxLength: 100 }),
  sequenceOrder: fc.integer({ min: 1, max: 10 }),
  totalHours: fc.integer({ min: 10, max: 100 }),
  contactHours: contactHoursArb,
  independentHours: fc.integer({ min: 5, max: 80 }),
  isCore: fc.boolean(),
  prerequisites: fc.array(fc.uuid(), { minLength: 0, maxLength: 3 }),
  mlos: fc.array(mloArb, { minLength: 1, maxLength: 10 }),
  contactActivities: fc.array(fc.string(), { minLength: 0, maxLength: 5 }),
  independentActivities: fc.array(fc.string(), { minLength: 0, maxLength: 5 }),
});

// ============================================================================
// TEST SUITE
// ============================================================================

describe('LessonPlanService - Property Tests', () => {
  let service: LessonPlanService;

  beforeEach(() => {
    service = new LessonPlanService();
  });

  // ==========================================================================
  // Property 1: Lesson Duration Bounds
  // ==========================================================================

  /**
   * **Feature: lesson-plan-ppt-integration, Property 1: Lesson Duration Bounds**
   * **Validates: Requirements 1.3**
   *
   * Property: For any generated lesson plan, the lesson duration SHALL be
   * between 60 and 180 minutes inclusive.
   */
  describe('Property 1: Lesson Duration Bounds', () => {
    it('should generate lessons with durations between 60 and 180 minutes', () => {
      fc.assert(
        fc.property(
          contactHoursArb,
          fc.array(mloArb, { minLength: 1, maxLength: 10 }),
          (contactHours, mlos) => {
            const blocks = service.calculateLessonBlocks(contactHours, mlos);

            // All lesson durations must be within bounds
            for (const block of blocks) {
              expect(block.duration).toBeGreaterThanOrEqual(60);
              expect(block.duration).toBeLessThanOrEqual(180);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle edge case of minimum contact hours (1 hour = 60 min)', () => {
      fc.assert(
        fc.property(fc.array(mloArb, { minLength: 1, maxLength: 5 }), (mlos) => {
          const blocks = service.calculateLessonBlocks(1, mlos);

          // With 1 hour, should produce exactly one 60-minute lesson
          expect(blocks.length).toBe(1);
          expect(blocks[0].duration).toBe(60);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle edge case of maximum typical contact hours (20 hours)', () => {
      fc.assert(
        fc.property(fc.array(mloArb, { minLength: 1, maxLength: 10 }), (mlos) => {
          const blocks = service.calculateLessonBlocks(20, mlos);

          // All durations should still be within bounds
          for (const block of blocks) {
            expect(block.duration).toBeGreaterThanOrEqual(60);
            expect(block.duration).toBeLessThanOrEqual(180);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  // ==========================================================================
  // Property 2: Contact Hours Integrity
  // ==========================================================================

  /**
   * **Feature: lesson-plan-ppt-integration, Property 2: Contact Hours Integrity**
   * **Validates: Requirements 1.4**
   *
   * Property: For any module, the sum of all lesson durations SHALL equal
   * the module's total contact hours.
   */
  describe('Property 2: Contact Hours Integrity', () => {
    it('should ensure sum of lesson durations equals total contact hours', () => {
      fc.assert(
        fc.property(
          contactHoursArb,
          fc.array(mloArb, { minLength: 1, maxLength: 10 }),
          (contactHours, mlos) => {
            const blocks = service.calculateLessonBlocks(contactHours, mlos);

            // Sum of all lesson durations should equal total contact hours in minutes
            const totalMinutes = blocks.reduce((sum, block) => sum + block.duration, 0);
            const expectedMinutes = contactHours * 60;

            expect(totalMinutes).toBe(expectedMinutes);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain integrity for various contact hour values', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 15 }),
          fc.array(mloArb, { minLength: 2, maxLength: 8 }),
          (contactHours, mlos) => {
            const blocks = service.calculateLessonBlocks(contactHours, mlos);

            const totalMinutes = blocks.reduce((sum, block) => sum + block.duration, 0);
            const expectedMinutes = contactHours * 60;

            // Total should exactly match
            expect(totalMinutes).toBe(expectedMinutes);

            // Should have at least one lesson
            expect(blocks.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // ==========================================================================
  // Property 3: MLO Alignment Coverage
  // ==========================================================================

  /**
   * **Feature: lesson-plan-ppt-integration, Property 3: MLO Alignment Coverage**
   * **Validates: Requirements 1.5**
   *
   * Property: For any generated lesson, the lesson SHALL be aligned with
   * 1-2 Module Learning Outcomes (MLOs).
   */
  describe('Property 3: MLO Alignment Coverage', () => {
    it('should align each lesson with 1-2 MLOs', () => {
      fc.assert(
        fc.property(
          contactHoursArb,
          fc.array(mloArb, { minLength: 1, maxLength: 10 }),
          (contactHours, mlos) => {
            const blocks = service.calculateLessonBlocks(contactHours, mlos);

            // Each lesson should have 1-2 MLOs assigned
            for (const block of blocks) {
              expect(block.assignedMLOs.length).toBeGreaterThanOrEqual(1);
              expect(block.assignedMLOs.length).toBeLessThanOrEqual(2);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should distribute all MLOs across lessons when possible', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 3, max: 10 }),
          fc.array(mloArb, { minLength: 2, maxLength: 6 }),
          (contactHours, mlos) => {
            const blocks = service.calculateLessonBlocks(contactHours, mlos);

            // Calculate max MLOs that can be assigned (2 per lesson)
            const maxAssignableMlos = blocks.length * 2;

            // Collect all assigned MLO IDs
            const assignedMloIds = new Set<string>();
            for (const block of blocks) {
              for (const mlo of block.assignedMLOs) {
                assignedMloIds.add(mlo.id);
              }
            }

            // If we have enough capacity, all MLOs should be assigned
            // If not, we should assign as many as possible (up to 2 per lesson)
            if (mlos.length <= maxAssignableMlos) {
              // All input MLOs should be assigned to at least one lesson
              for (const mlo of mlos) {
                expect(assignedMloIds.has(mlo.id)).toBe(true);
              }
            } else {
              // When there are more MLOs than capacity, verify we assigned the maximum
              expect(assignedMloIds.size).toBeGreaterThanOrEqual(maxAssignableMlos);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle case with more lessons than MLOs', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 10, max: 15 }), // Many hours = many lessons
          fc.array(mloArb, { minLength: 1, maxLength: 3 }), // Few MLOs
          (contactHours, mlos) => {
            const blocks = service.calculateLessonBlocks(contactHours, mlos);

            // Each lesson should still have at least 1 MLO
            for (const block of blocks) {
              expect(block.assignedMLOs.length).toBeGreaterThanOrEqual(1);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // ==========================================================================
  // Property 4: Bloom's Taxonomy Progression
  // ==========================================================================

  /**
   * **Feature: lesson-plan-ppt-integration, Property 4: Bloom's Taxonomy Progression**
   * **Validates: Requirements 1.6**
   *
   * Property: For any module's lesson sequence, earlier lessons SHALL have
   * equal or lower Bloom's taxonomy levels compared to later lessons.
   */
  describe("Property 4: Bloom's Taxonomy Progression", () => {
    it('should order lessons by Bloom level (foundational first, complex later)', () => {
      fc.assert(
        fc.property(
          contactHoursArb,
          fc.array(mloArb, { minLength: 2, maxLength: 8 }),
          (contactHours, mlos) => {
            const blocks = service.calculateLessonBlocks(contactHours, mlos);
            const orderedBlocks = service.applyBloomProgression(blocks);

            // Verify progression: each lesson's Bloom level >= previous lesson's level
            for (let i = 1; i < orderedBlocks.length; i++) {
              const prevLevel = getBloomLevelOrder(orderedBlocks[i - 1].bloomLevel);
              const currLevel = getBloomLevelOrder(orderedBlocks[i].bloomLevel);

              expect(currLevel).toBeGreaterThanOrEqual(prevLevel);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should verify Bloom progression using verifyBloomProgression method', () => {
      fc.assert(
        fc.property(
          contactHoursArb,
          fc.array(mloArb, { minLength: 2, maxLength: 8 }),
          (contactHours, mlos) => {
            const blocks = service.calculateLessonBlocks(contactHours, mlos);
            const orderedBlocks = service.applyBloomProgression(blocks);

            // The verifyBloomProgression method should return true for ordered blocks
            expect(service.verifyBloomProgression(orderedBlocks)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain lesson numbering after reordering', () => {
      fc.assert(
        fc.property(
          contactHoursArb,
          fc.array(mloArb, { minLength: 2, maxLength: 8 }),
          (contactHours, mlos) => {
            const blocks = service.calculateLessonBlocks(contactHours, mlos);
            const orderedBlocks = service.applyBloomProgression(blocks);

            // Lesson numbers should be sequential starting from 1
            for (let i = 0; i < orderedBlocks.length; i++) {
              expect(orderedBlocks[i].lessonNumber).toBe(i + 1);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle single lesson case', () => {
      fc.assert(
        fc.property(fc.array(mloArb, { minLength: 1, maxLength: 2 }), (mlos) => {
          // 1 hour = 60 minutes = 1 lesson
          const blocks = service.calculateLessonBlocks(1, mlos);
          const orderedBlocks = service.applyBloomProgression(blocks);

          expect(orderedBlocks.length).toBe(1);
          expect(service.verifyBloomProgression(orderedBlocks)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });
  });

  // ==========================================================================
  // Property 5: Lesson Plan Completeness
  // ==========================================================================

  /**
   * **Feature: lesson-plan-ppt-integration, Property 5: Lesson Plan Completeness**
   * **Validates: Requirements 2.1, 2.2, 2.4, 2.5, 2.6, 5.1-5.6**
   *
   * Property: For any generated lesson plan, the plan SHALL include all required
   * components: objectives, activities with timings, materials, instructor notes,
   * and independent study assignments.
   */
  describe('Property 5: Lesson Plan Completeness', () => {
    // Create a minimal workflow context for testing
    const createMinimalContext = () => ({
      programTitle: 'Test Program',
      programDescription: 'Test Description',
      academicLevel: 'Graduate',
      deliveryMode: 'In-person',
      totalContactHours: 100,
      totalIndependentHours: 200,
      knowledgeItems: [],
      skillItems: [],
      competencyItems: [],
      programLearningOutcomes: [],
      modules: [],
      topicSources: [],
      moduleReadingLists: [],
      formativeAssessments: [],
      summativeAssessments: [],
      sampleQuestions: {},
      caseStudies: [],
      glossaryEntries: [],
    });

    it('should generate lesson plans with all required components', async () => {
      await fc.assert(
        fc.asyncProperty(moduleDataArb, async (module) => {
          const context = createMinimalContext();
          const blocks = service.calculateLessonBlocks(module.contactHours, module.mlos);
          const orderedBlocks = service.applyBloomProgression(blocks);

          // Generate lesson content for the first block
          const lessonPlan = await service.generateLessonContent(orderedBlocks[0], module, context);

          // Requirement 2.1 & 5.2: Lesson objectives
          expect(lessonPlan.objectives).toBeDefined();
          expect(Array.isArray(lessonPlan.objectives)).toBe(true);
          expect(lessonPlan.objectives.length).toBeGreaterThan(0);

          // Requirement 2.2 & 5.3: Activity sequence with timings
          expect(lessonPlan.activities).toBeDefined();
          expect(Array.isArray(lessonPlan.activities)).toBe(true);
          expect(lessonPlan.activities.length).toBeGreaterThan(0);

          // Each activity should have required fields
          for (const activity of lessonPlan.activities) {
            expect(activity.activityId).toBeDefined();
            expect(activity.sequenceOrder).toBeGreaterThan(0);
            expect(activity.type).toBeDefined();
            expect(activity.title).toBeDefined();
            expect(activity.description).toBeDefined();
            expect(activity.duration).toBeGreaterThan(0);
            expect(activity.teachingMethod).toBeDefined();
            expect(Array.isArray(activity.resources)).toBe(true);
            expect(Array.isArray(activity.instructorActions)).toBe(true);
            expect(Array.isArray(activity.studentActions)).toBe(true);
          }

          // Requirement 2.4 & 5.4: Materials
          expect(lessonPlan.materials).toBeDefined();
          expect(lessonPlan.materials.pptDeckRef).toBeDefined();
          expect(typeof lessonPlan.materials.pptDeckRef).toBe('string');
          expect(Array.isArray(lessonPlan.materials.caseFiles)).toBe(true);
          expect(Array.isArray(lessonPlan.materials.readingReferences)).toBe(true);

          // Requirement 2.5 & 5.5: Instructor notes
          expect(lessonPlan.instructorNotes).toBeDefined();
          expect(lessonPlan.instructorNotes.pedagogicalGuidance).toBeDefined();
          expect(typeof lessonPlan.instructorNotes.pedagogicalGuidance).toBe('string');
          expect(lessonPlan.instructorNotes.pacingSuggestions).toBeDefined();
          expect(typeof lessonPlan.instructorNotes.pacingSuggestions).toBe('string');
          expect(Array.isArray(lessonPlan.instructorNotes.adaptationOptions)).toBe(true);
          expect(Array.isArray(lessonPlan.instructorNotes.commonMisconceptions)).toBe(true);
          expect(Array.isArray(lessonPlan.instructorNotes.discussionPrompts)).toBe(true);

          // Requirement 2.6 & 5.6: Independent study
          expect(lessonPlan.independentStudy).toBeDefined();
          expect(Array.isArray(lessonPlan.independentStudy.coreReadings)).toBe(true);
          expect(Array.isArray(lessonPlan.independentStudy.supplementaryReadings)).toBe(true);
          expect(typeof lessonPlan.independentStudy.estimatedEffort).toBe('number');
          expect(lessonPlan.independentStudy.estimatedEffort).toBeGreaterThanOrEqual(0);

          // Requirement 5.1: Metadata
          expect(lessonPlan.lessonId).toBeDefined();
          expect(lessonPlan.lessonNumber).toBeGreaterThan(0);
          expect(lessonPlan.lessonTitle).toBeDefined();
          expect(lessonPlan.duration).toBeGreaterThanOrEqual(60);
          expect(lessonPlan.duration).toBeLessThanOrEqual(180);
          expect(Array.isArray(lessonPlan.linkedMLOs)).toBe(true);
          expect(lessonPlan.linkedMLOs.length).toBeGreaterThan(0);
          expect(Array.isArray(lessonPlan.linkedPLOs)).toBe(true);
          expect(lessonPlan.bloomLevel).toBeDefined();
        }),
        { numRuns: 100 }
      );
    }, 60000); // Increase timeout for async operations

    it('should generate activities that sum to lesson duration', async () => {
      await fc.assert(
        fc.asyncProperty(moduleDataArb, async (module) => {
          const context = createMinimalContext();
          const blocks = service.calculateLessonBlocks(module.contactHours, module.mlos);
          const orderedBlocks = service.applyBloomProgression(blocks);

          const lessonPlan = await service.generateLessonContent(orderedBlocks[0], module, context);

          // Sum of activity durations should approximately equal lesson duration
          const totalActivityTime = lessonPlan.activities.reduce(
            (sum, activity) => sum + activity.duration,
            0
          );

          // Allow some tolerance (within 10% or 10 minutes, whichever is larger)
          const tolerance = Math.max(lessonPlan.duration * 0.1, 10);
          expect(Math.abs(totalActivityTime - lessonPlan.duration)).toBeLessThanOrEqual(tolerance);
        }),
        { numRuns: 100 }
      );
    }, 60000);

    it('should include PPT deck reference in materials', async () => {
      await fc.assert(
        fc.asyncProperty(moduleDataArb, async (module) => {
          const context = createMinimalContext();
          const blocks = service.calculateLessonBlocks(module.contactHours, module.mlos);
          const orderedBlocks = service.applyBloomProgression(blocks);

          const lessonPlan = await service.generateLessonContent(orderedBlocks[0], module, context);

          // PPT deck reference should follow naming convention
          expect(lessonPlan.materials.pptDeckRef).toContain(module.moduleCode);
          expect(lessonPlan.materials.pptDeckRef).toContain('-L');
          expect(lessonPlan.materials.pptDeckRef).toContain('-PPT');
        }),
        { numRuns: 100 }
      );
    }, 60000);
  });

  // ==========================================================================
  // Property 6: Case Study Placement Correctness
  // ==========================================================================

  /**
   * **Feature: lesson-plan-ppt-integration, Property 6: Case Study Placement Correctness**
   * **Validates: Requirements 3.1**
   *
   * Property: For any case study with MLO mappings, the case study SHALL appear
   * in a lesson whose primary MLO alignment matches the case's MLO support.
   */
  describe('Property 6: Case Study Placement Correctness', () => {
    // Generate a case study with MLO mappings
    const caseStudyArb = fc.record({
      id: fc.uuid(),
      title: fc.string({ minLength: 10, maxLength: 100 }),
      moduleIds: fc.array(fc.uuid(), { minLength: 1, maxLength: 3 }),
      mloIds: fc.array(fc.uuid(), { minLength: 1, maxLength: 3 }),
      difficulty: fc.constantFrom('foundational', 'intermediate', 'advanced', 'complex'),
      activityType: fc.constantFrom('practice', 'discussion', 'assessment_ready'),
      organizationName: fc.string({ minLength: 5, maxLength: 50 }),
      isRolePlaySuitable: fc.boolean(),
      discussionQuestions: fc.array(fc.string({ minLength: 10, maxLength: 100 }), {
        minLength: 0,
        maxLength: 5,
      }),
    });

    it('should place case studies in lessons with matching MLO alignment', () => {
      fc.assert(
        fc.property(
          moduleDataArb,
          fc.array(caseStudyArb, { minLength: 1, maxLength: 5 }),
          (module, caseStudies) => {
            const context = {
              programTitle: 'Test Program',
              programDescription: 'Test Description',
              academicLevel: 'Graduate',
              deliveryMode: 'In-person',
              totalContactHours: 100,
              totalIndependentHours: 200,
              knowledgeItems: [],
              skillItems: [],
              competencyItems: [],
              programLearningOutcomes: [],
              modules: [module],
              topicSources: [],
              moduleReadingLists: [],
              formativeAssessments: [],
              summativeAssessments: [],
              sampleQuestions: {},
              caseStudies: [],
              glossaryEntries: [],
            };

            // Create lessons with known MLO IDs
            const blocks = service.calculateLessonBlocks(module.contactHours, module.mlos);
            const lessons = blocks.map((block, index) => ({
              lessonId: `${module.moduleCode}-L${index + 1}`,
              lessonNumber: index + 1,
              lessonTitle: `Lesson ${index + 1}`,
              duration: block.duration,
              linkedMLOs: block.assignedMLOs.map((mlo) => mlo.id),
              linkedPLOs: [],
              bloomLevel: block.bloomLevel,
              objectives: ['Test objective'],
              activities: [],
              materials: {
                pptDeckRef: `${module.moduleCode}-L${index + 1}-PPT`,
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
                estimatedEffort: 0,
              },
              formativeChecks: [],
            }));

            // Update case studies to reference module and some lesson MLOs
            const updatedCaseStudies = caseStudies.map((cs, index) => ({
              ...cs,
              moduleIds: [module.id],
              // Assign case study to MLOs from one of the lessons
              mloIds: lessons[index % lessons.length].linkedMLOs.slice(0, 2),
            }));

            // Integrate case studies
            const lessonsWithCases = service.integrateCaseStudies(
              lessons,
              updatedCaseStudies,
              module.id
            );

            // Verify: Each case study should be placed in a lesson with matching MLO
            for (const lesson of lessonsWithCases) {
              if (lesson.caseStudyActivity) {
                const caseStudy = updatedCaseStudies.find(
                  (cs) => cs.id === lesson.caseStudyActivity!.caseStudyId
                );

                if (caseStudy) {
                  // At least one MLO from the case study should match a lesson MLO
                  const hasMatchingMLO = caseStudy.mloIds.some((mloId) =>
                    lesson.linkedMLOs.includes(mloId)
                  );
                  expect(hasMatchingMLO).toBe(true);
                }
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should respect difficulty progression when placing case studies', () => {
      fc.assert(
        fc.property(
          moduleDataArb,
          fc.array(caseStudyArb, { minLength: 3, maxLength: 5 }),
          (module, caseStudies) => {
            // Create lessons
            const blocks = service.calculateLessonBlocks(module.contactHours, module.mlos);
            const lessons = blocks.map((block, index) => ({
              lessonId: `${module.moduleCode}-L${index + 1}`,
              lessonNumber: index + 1,
              lessonTitle: `Lesson ${index + 1}`,
              duration: block.duration,
              linkedMLOs: block.assignedMLOs.map((mlo) => mlo.id),
              linkedPLOs: [],
              bloomLevel: block.bloomLevel,
              objectives: ['Test objective'],
              activities: [],
              materials: {
                pptDeckRef: `${module.moduleCode}-L${index + 1}-PPT`,
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
                estimatedEffort: 0,
              },
              formativeChecks: [],
            }));

            // Create case studies with varying difficulties and matching MLOs
            const updatedCaseStudies = [
              {
                ...caseStudies[0],
                difficulty: 'foundational',
                moduleIds: [module.id],
                mloIds: lessons[0].linkedMLOs,
              },
              {
                ...caseStudies[1],
                difficulty: 'intermediate',
                moduleIds: [module.id],
                mloIds: lessons[Math.floor(lessons.length / 2)].linkedMLOs,
              },
              {
                ...caseStudies[2],
                difficulty: 'advanced',
                moduleIds: [module.id],
                mloIds: lessons[lessons.length - 1].linkedMLOs,
              },
            ];

            // Integrate case studies
            const lessonsWithCases = service.integrateCaseStudies(
              lessons,
              updatedCaseStudies,
              module.id
            );

            // Collect case studies by lesson position
            const casesByPosition: Array<{ position: number; difficulty: string }> = [];
            lessonsWithCases.forEach((lesson, index) => {
              if (lesson.caseStudyActivity) {
                const cs = updatedCaseStudies.find(
                  (c) => c.id === lesson.caseStudyActivity!.caseStudyId
                );
                if (cs) {
                  casesByPosition.push({
                    position: index,
                    difficulty: cs.difficulty,
                  });
                }
              }
            });

            // Verify: Foundational cases should generally appear before advanced cases
            // (allowing some flexibility due to MLO matching priority)
            if (casesByPosition.length >= 2) {
              const difficultyOrder: Record<string, number> = {
                foundational: 1,
                basic: 1,
                intermediate: 2,
                moderate: 2,
                advanced: 3,
                complex: 3,
              };

              // Check that difficulty generally increases or stays the same
              let violations = 0;
              for (let i = 1; i < casesByPosition.length; i++) {
                const prevDiff = difficultyOrder[casesByPosition[i - 1].difficulty] || 2;
                const currDiff = difficultyOrder[casesByPosition[i].difficulty] || 2;

                // Allow some violations due to MLO matching priority
                if (currDiff < prevDiff - 1) {
                  violations++;
                }
              }

              // Most placements should respect difficulty progression
              expect(violations).toBeLessThan(casesByPosition.length / 2);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not assign the same case study to multiple lessons in the same module', () => {
      fc.assert(
        fc.property(
          moduleDataArb,
          fc.array(caseStudyArb, { minLength: 1, maxLength: 3 }),
          (module, caseStudies) => {
            // Create lessons
            const blocks = service.calculateLessonBlocks(module.contactHours, module.mlos);
            const lessons = blocks.map((block, index) => ({
              lessonId: `${module.moduleCode}-L${index + 1}`,
              lessonNumber: index + 1,
              lessonTitle: `Lesson ${index + 1}`,
              duration: block.duration,
              linkedMLOs: block.assignedMLOs.map((mlo) => mlo.id),
              linkedPLOs: [],
              bloomLevel: block.bloomLevel,
              objectives: ['Test objective'],
              activities: [],
              materials: {
                pptDeckRef: `${module.moduleCode}-L${index + 1}-PPT`,
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
                estimatedEffort: 0,
              },
              formativeChecks: [],
            }));

            // Make all case studies match all lessons' MLOs
            const updatedCaseStudies = caseStudies.map((cs) => ({
              ...cs,
              moduleIds: [module.id],
              mloIds: lessons.flatMap((l) => l.linkedMLOs),
            }));

            // Integrate case studies
            const lessonsWithCases = service.integrateCaseStudies(
              lessons,
              updatedCaseStudies,
              module.id
            );

            // Collect all assigned case study IDs
            const assignedCaseIds = lessonsWithCases
              .filter((l) => l.caseStudyActivity)
              .map((l) => l.caseStudyActivity!.caseStudyId);

            // Verify: No duplicate case study IDs
            const uniqueCaseIds = new Set(assignedCaseIds);
            expect(assignedCaseIds.length).toBe(uniqueCaseIds.size);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle case studies with no matching MLOs gracefully', () => {
      fc.assert(
        fc.property(
          moduleDataArb,
          fc.array(caseStudyArb, { minLength: 1, maxLength: 3 }),
          (module, caseStudies) => {
            // Create lessons
            const blocks = service.calculateLessonBlocks(module.contactHours, module.mlos);
            const lessons = blocks.map((block, index) => ({
              lessonId: `${module.moduleCode}-L${index + 1}`,
              lessonNumber: index + 1,
              lessonTitle: `Lesson ${index + 1}`,
              duration: block.duration,
              linkedMLOs: block.assignedMLOs.map((mlo) => mlo.id),
              linkedPLOs: [],
              bloomLevel: block.bloomLevel,
              objectives: ['Test objective'],
              activities: [],
              materials: {
                pptDeckRef: `${module.moduleCode}-L${index + 1}-PPT`,
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
                estimatedEffort: 0,
              },
              formativeChecks: [],
            }));

            // Create case studies with non-matching MLO IDs
            const updatedCaseStudies = caseStudies.map((cs) => ({
              ...cs,
              moduleIds: [module.id],
              mloIds: [fc.sample(fc.uuid(), 1)[0]], // Random UUID that won't match
            }));

            // Integrate case studies
            const lessonsWithCases = service.integrateCaseStudies(
              lessons,
              updatedCaseStudies,
              module.id
            );

            // Verify: No case studies should be assigned (no MLO matches)
            const assignedCases = lessonsWithCases.filter((l) => l.caseStudyActivity);
            expect(assignedCases.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // ==========================================================================
  // Property 7: Role-Play Component Completeness
  // ==========================================================================

  /**
   * **Feature: lesson-plan-ppt-integration, Property 7: Role-Play Component Completeness**
   * **Validates: Requirements 3.3**
   *
   * Property: For any case study marked as role-play suitable, the embedded activity
   * SHALL include character briefs, decision prompts, and debrief questions.
   */
  describe('Property 7: Role-Play Component Completeness', () => {
    // Generate a role-play suitable case study
    const rolePlayCaseStudyArb = fc.record({
      id: fc.uuid(),
      title: fc.string({ minLength: 10, maxLength: 100 }),
      moduleIds: fc.array(fc.uuid(), { minLength: 1, maxLength: 3 }),
      mloIds: fc.array(fc.uuid(), { minLength: 1, maxLength: 3 }),
      difficulty: fc.constantFrom('foundational', 'intermediate', 'advanced', 'complex'),
      activityType: fc.constantFrom('practice', 'discussion', 'assessment_ready'),
      organizationName: fc.string({ minLength: 5, maxLength: 50 }),
      isRolePlaySuitable: fc.constant(true), // Always true for this test
      discussionQuestions: fc.array(fc.string({ minLength: 10, maxLength: 100 }), {
        minLength: 1,
        maxLength: 5,
      }),
      decisionPoints: fc.array(fc.string({ minLength: 10, maxLength: 100 }), {
        minLength: 0,
        maxLength: 5,
      }),
    });

    it('should include role-play components for role-play suitable case studies', () => {
      fc.assert(
        fc.property(
          moduleDataArb,
          fc.array(rolePlayCaseStudyArb, { minLength: 1, maxLength: 3 }),
          (module, caseStudies) => {
            // Create lessons
            const blocks = service.calculateLessonBlocks(module.contactHours, module.mlos);
            const lessons = blocks.map((block, index) => ({
              lessonId: `${module.moduleCode}-L${index + 1}`,
              lessonNumber: index + 1,
              lessonTitle: `Lesson ${index + 1}`,
              duration: block.duration,
              linkedMLOs: block.assignedMLOs.map((mlo) => mlo.id),
              linkedPLOs: [],
              bloomLevel: block.bloomLevel,
              objectives: ['Test objective'],
              activities: [],
              materials: {
                pptDeckRef: `${module.moduleCode}-L${index + 1}-PPT`,
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
                estimatedEffort: 0,
              },
              formativeChecks: [],
            }));

            // Update case studies to match lesson MLOs
            const updatedCaseStudies = caseStudies.map((cs, index) => ({
              ...cs,
              moduleIds: [module.id],
              mloIds: lessons[index % lessons.length].linkedMLOs.slice(0, 2),
            }));

            // Integrate case studies
            const lessonsWithCases = service.integrateCaseStudies(
              lessons,
              updatedCaseStudies,
              module.id
            );

            // Verify: All role-play suitable case studies should have role-play components
            for (const lesson of lessonsWithCases) {
              if (lesson.caseStudyActivity) {
                const caseStudy = updatedCaseStudies.find(
                  (cs) => cs.id === lesson.caseStudyActivity!.caseStudyId
                );

                if (caseStudy && caseStudy.isRolePlaySuitable) {
                  // Role-play components must be present
                  expect(lesson.caseStudyActivity.rolePlay).toBeDefined();

                  const rolePlay = lesson.caseStudyActivity.rolePlay!;

                  // Must have character briefs
                  expect(rolePlay.characterBriefs).toBeDefined();
                  expect(Array.isArray(rolePlay.characterBriefs)).toBe(true);
                  expect(rolePlay.characterBriefs.length).toBeGreaterThan(0);

                  // Each character brief must have required fields
                  for (const brief of rolePlay.characterBriefs) {
                    expect(brief.characterName).toBeDefined();
                    expect(typeof brief.characterName).toBe('string');
                    expect(brief.characterName.length).toBeGreaterThan(0);

                    expect(brief.role).toBeDefined();
                    expect(typeof brief.role).toBe('string');
                    expect(brief.role.length).toBeGreaterThan(0);

                    expect(brief.background).toBeDefined();
                    expect(typeof brief.background).toBe('string');
                    expect(brief.background.length).toBeGreaterThan(0);

                    expect(brief.objectives).toBeDefined();
                    expect(Array.isArray(brief.objectives)).toBe(true);
                    expect(brief.objectives.length).toBeGreaterThan(0);
                  }

                  // Must have decision prompts
                  expect(rolePlay.decisionPrompts).toBeDefined();
                  expect(Array.isArray(rolePlay.decisionPrompts)).toBe(true);
                  expect(rolePlay.decisionPrompts.length).toBeGreaterThan(0);

                  // Each decision prompt must be a non-empty string
                  for (const prompt of rolePlay.decisionPrompts) {
                    expect(typeof prompt).toBe('string');
                    expect(prompt.length).toBeGreaterThan(0);
                  }

                  // Must have debrief questions
                  expect(rolePlay.debriefQuestions).toBeDefined();
                  expect(Array.isArray(rolePlay.debriefQuestions)).toBe(true);
                  expect(rolePlay.debriefQuestions.length).toBeGreaterThan(0);

                  // Each debrief question must be a non-empty string
                  for (const question of rolePlay.debriefQuestions) {
                    expect(typeof question).toBe('string');
                    expect(question.length).toBeGreaterThan(0);
                  }
                }
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate at least 2 character briefs for role-play activities', () => {
      fc.assert(
        fc.property(moduleDataArb, rolePlayCaseStudyArb, (module, caseStudy) => {
          // Create a single lesson
          const blocks = service.calculateLessonBlocks(module.contactHours, module.mlos);
          const lesson = {
            lessonId: `${module.moduleCode}-L1`,
            lessonNumber: 1,
            lessonTitle: 'Lesson 1',
            duration: blocks[0].duration,
            linkedMLOs: blocks[0].assignedMLOs.map((mlo) => mlo.id),
            linkedPLOs: [],
            bloomLevel: blocks[0].bloomLevel,
            objectives: ['Test objective'],
            activities: [],
            materials: {
              pptDeckRef: `${module.moduleCode}-L1-PPT`,
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
              estimatedEffort: 0,
            },
            formativeChecks: [],
          };

          // Update case study to match lesson MLOs
          const updatedCaseStudy = {
            ...caseStudy,
            moduleIds: [module.id],
            mloIds: lesson.linkedMLOs,
          };

          // Integrate case study
          const lessonsWithCases = service.integrateCaseStudies(
            [lesson],
            [updatedCaseStudy],
            module.id
          );

          // Verify: Should have at least 2 character briefs for meaningful role-play
          if (lessonsWithCases[0].caseStudyActivity?.rolePlay) {
            const characterBriefs = lessonsWithCases[0].caseStudyActivity.rolePlay.characterBriefs;
            expect(characterBriefs.length).toBeGreaterThanOrEqual(2);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should generate at least 3 decision prompts for role-play activities', () => {
      fc.assert(
        fc.property(moduleDataArb, rolePlayCaseStudyArb, (module, caseStudy) => {
          // Create a single lesson
          const blocks = service.calculateLessonBlocks(module.contactHours, module.mlos);
          const lesson = {
            lessonId: `${module.moduleCode}-L1`,
            lessonNumber: 1,
            lessonTitle: 'Lesson 1',
            duration: blocks[0].duration,
            linkedMLOs: blocks[0].assignedMLOs.map((mlo) => mlo.id),
            linkedPLOs: [],
            bloomLevel: blocks[0].bloomLevel,
            objectives: ['Test objective'],
            activities: [],
            materials: {
              pptDeckRef: `${module.moduleCode}-L1-PPT`,
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
              estimatedEffort: 0,
            },
            formativeChecks: [],
          };

          // Update case study to match lesson MLOs
          const updatedCaseStudy = {
            ...caseStudy,
            moduleIds: [module.id],
            mloIds: lesson.linkedMLOs,
          };

          // Integrate case study
          const lessonsWithCases = service.integrateCaseStudies(
            [lesson],
            [updatedCaseStudy],
            module.id
          );

          // Verify: Should have at least 3 decision prompts for meaningful discussion
          if (lessonsWithCases[0].caseStudyActivity?.rolePlay) {
            const decisionPrompts = lessonsWithCases[0].caseStudyActivity.rolePlay.decisionPrompts;
            expect(decisionPrompts.length).toBeGreaterThanOrEqual(3);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should generate at least 5 debrief questions for role-play activities', () => {
      fc.assert(
        fc.property(moduleDataArb, rolePlayCaseStudyArb, (module, caseStudy) => {
          // Create a single lesson
          const blocks = service.calculateLessonBlocks(module.contactHours, module.mlos);
          const lesson = {
            lessonId: `${module.moduleCode}-L1`,
            lessonNumber: 1,
            lessonTitle: 'Lesson 1',
            duration: blocks[0].duration,
            linkedMLOs: blocks[0].assignedMLOs.map((mlo) => mlo.id),
            linkedPLOs: [],
            bloomLevel: blocks[0].bloomLevel,
            objectives: ['Test objective'],
            activities: [],
            materials: {
              pptDeckRef: `${module.moduleCode}-L1-PPT`,
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
              estimatedEffort: 0,
            },
            formativeChecks: [],
          };

          // Update case study to match lesson MLOs
          const updatedCaseStudy = {
            ...caseStudy,
            moduleIds: [module.id],
            mloIds: lesson.linkedMLOs,
          };

          // Integrate case study
          const lessonsWithCases = service.integrateCaseStudies(
            [lesson],
            [updatedCaseStudy],
            module.id
          );

          // Verify: Should have at least 5 debrief questions for thorough reflection
          if (lessonsWithCases[0].caseStudyActivity?.rolePlay) {
            const debriefQuestions =
              lessonsWithCases[0].caseStudyActivity.rolePlay.debriefQuestions;
            expect(debriefQuestions.length).toBeGreaterThanOrEqual(5);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should not include role-play components for non-role-play case studies', () => {
      fc.assert(
        fc.property(
          moduleDataArb,
          fc.record({
            id: fc.uuid(),
            title: fc.string({ minLength: 10, maxLength: 100 }),
            moduleIds: fc.array(fc.uuid(), { minLength: 1, maxLength: 3 }),
            mloIds: fc.array(fc.uuid(), { minLength: 1, maxLength: 3 }),
            difficulty: fc.constantFrom('foundational', 'intermediate', 'advanced'),
            activityType: fc.constantFrom('practice', 'discussion', 'assessment_ready'),
            organizationName: fc.string({ minLength: 5, maxLength: 50 }),
            isRolePlaySuitable: fc.constant(false), // Not role-play suitable
          }),
          (module, caseStudy) => {
            // Create a single lesson
            const blocks = service.calculateLessonBlocks(module.contactHours, module.mlos);
            const lesson = {
              lessonId: `${module.moduleCode}-L1`,
              lessonNumber: 1,
              lessonTitle: 'Lesson 1',
              duration: blocks[0].duration,
              linkedMLOs: blocks[0].assignedMLOs.map((mlo) => mlo.id),
              linkedPLOs: [],
              bloomLevel: blocks[0].bloomLevel,
              objectives: ['Test objective'],
              activities: [],
              materials: {
                pptDeckRef: `${module.moduleCode}-L1-PPT`,
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
                estimatedEffort: 0,
              },
              formativeChecks: [],
            };

            // Update case study to match lesson MLOs
            const updatedCaseStudy = {
              ...caseStudy,
              moduleIds: [module.id],
              mloIds: lesson.linkedMLOs,
            };

            // Integrate case study
            const lessonsWithCases = service.integrateCaseStudies(
              [lesson],
              [updatedCaseStudy],
              module.id
            );

            // Verify: Should NOT have role-play components
            if (lessonsWithCases[0].caseStudyActivity) {
              expect(lessonsWithCases[0].caseStudyActivity.rolePlay).toBeUndefined();
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
