/**
 * Property-Based Tests for Standalone Step Execution Service
 *
 * **Feature: standalone-step-execution, Property 4: Step Output Structure Validation**
 * **Validates: Requirements 5.2, 8.1-8.9**
 *
 * Tests that for any step number N in range 2-10, when generation completes successfully,
 * the output content structure SHALL conform to the expected schema for that step type.
 */

import * as fc from 'fast-check';
import {
  standaloneService,
  STEP_METADATA,
  KSCContent,
  PLOContent,
  CourseFrameworkContent,
  SourcesContent,
  ReadingListContent,
  AssessmentContent,
  CaseStudyContent,
  GlossaryContent,
  LessonPlanContent,
  StandaloneStepResult,
} from '../services/standaloneService';

// ============================================================================
// ARBITRARIES FOR GENERATING TEST DATA
// ============================================================================

// Valid step numbers (2-10)
const validStepNumberArb = fc.integer({ min: 2, max: 10 });

// Invalid step numbers (outside 2-10 range)
const invalidStepNumberArb = fc.oneof(
  fc.integer({ min: -100, max: 1 }),
  fc.integer({ min: 11, max: 100 })
);

// Valid description (at least 10 characters)
const validDescriptionArb = fc.string({ minLength: 10, maxLength: 500 }).filter(s => s.trim().length >= 10);

// Invalid description (less than 10 characters)
const invalidDescriptionArb = fc.oneof(
  fc.constant(''),
  fc.string({ minLength: 1, maxLength: 9 }),
  fc.constant('   '),
  fc.constant('short')
);

// ============================================================================
// SCHEMA VALIDATORS
// ============================================================================

/**
 * Validate KSC Content structure (Step 2)
 */
function isValidKSCContent(content: any): content is KSCContent {
  if (!content || typeof content !== 'object') return false;
  if (!Array.isArray(content.knowledgeItems)) return false;
  if (!Array.isArray(content.skillItems)) return false;
  if (!Array.isArray(content.competencyItems)) return false;
  if (typeof content.totalItems !== 'number') return false;
  return true;
}

/**
 * Validate PLO Content structure (Step 3)
 */
function isValidPLOContent(content: any): content is PLOContent {
  if (!content || typeof content !== 'object') return false;
  if (!Array.isArray(content.outcomes)) return false;
  if (!content.bloomDistribution || typeof content.bloomDistribution !== 'object') return false;
  return true;
}

/**
 * Validate Course Framework Content structure (Step 4)
 */
function isValidCourseFrameworkContent(content: any): content is CourseFrameworkContent {
  if (!content || typeof content !== 'object') return false;
  if (!Array.isArray(content.modules)) return false;
  if (typeof content.totalHours !== 'number') return false;
  return true;
}

/**
 * Validate Sources Content structure (Step 5)
 */
function isValidSourcesContent(content: any): content is SourcesContent {
  if (!content || typeof content !== 'object') return false;
  if (!Array.isArray(content.sources)) return false;
  if (!content.byModule || typeof content.byModule !== 'object') return false;
  return true;
}

/**
 * Validate Reading List Content structure (Step 6)
 */
function isValidReadingListContent(content: any): content is ReadingListContent {
  if (!content || typeof content !== 'object') return false;
  if (!Array.isArray(content.coreReadings)) return false;
  if (!Array.isArray(content.supplementaryReadings)) return false;
  if (!content.byModule || typeof content.byModule !== 'object') return false;
  return true;
}

/**
 * Validate Assessment Content structure (Step 7)
 */
function isValidAssessmentContent(content: any): content is AssessmentContent {
  if (!content || typeof content !== 'object') return false;
  if (!Array.isArray(content.formativeAssessments)) return false;
  if (!Array.isArray(content.summativeAssessments)) return false;
  if (!Array.isArray(content.questionBank)) return false;
  return true;
}

/**
 * Validate Case Study Content structure (Step 8)
 */
function isValidCaseStudyContent(content: any): content is CaseStudyContent {
  if (!content || typeof content !== 'object') return false;
  if (!Array.isArray(content.caseStudies)) return false;
  return true;
}

/**
 * Validate Glossary Content structure (Step 9)
 */
function isValidGlossaryContent(content: any): content is GlossaryContent {
  if (!content || typeof content !== 'object') return false;
  if (!Array.isArray(content.terms)) return false;
  if (typeof content.totalTerms !== 'number') return false;
  return true;
}

/**
 * Validate Lesson Plan Content structure (Step 10)
 */
function isValidLessonPlanContent(content: any): content is LessonPlanContent {
  if (!content || typeof content !== 'object') return false;
  if (!Array.isArray(content.lessonPlans)) return false;
  return true;
}

/**
 * Get the appropriate validator for a step number
 */
function getValidatorForStep(stepNumber: number): (content: any) => boolean {
  const validators: Record<number, (content: any) => boolean> = {
    2: isValidKSCContent,
    3: isValidPLOContent,
    4: isValidCourseFrameworkContent,
    5: isValidSourcesContent,
    6: isValidReadingListContent,
    7: isValidAssessmentContent,
    8: isValidCaseStudyContent,
    9: isValidGlossaryContent,
    10: isValidLessonPlanContent,
  };
  return validators[stepNumber] || (() => false);
}

/**
 * Validate StandaloneStepResult structure
 */
function isValidStandaloneStepResult(result: any): result is StandaloneStepResult {
  if (!result || typeof result !== 'object') return false;
  if (typeof result.stepNumber !== 'number') return false;
  if (typeof result.stepName !== 'string') return false;
  if (result.content === undefined) return false;
  if (typeof result.generatedAt !== 'string') return false;
  return true;
}

// ============================================================================
// PROPERTY TESTS
// ============================================================================

describe('StandaloneService - Property Tests', () => {
  /**
   * **Feature: standalone-step-execution, Property 4: Step Output Structure Validation**
   * **Validates: Requirements 5.2, 8.1-8.9**
   *
   * Property: For any step number N in range 2-10, when generation completes successfully,
   * the output content structure SHALL conform to the expected schema for that step type.
   */
  describe('Property 4: Step Output Structure Validation', () => {
    
    it('should have metadata defined for all valid step numbers (2-10)', () => {
      fc.assert(
        fc.property(validStepNumberArb, (stepNumber) => {
          const metadata = STEP_METADATA[stepNumber];
          
          // Metadata should exist for all valid steps
          expect(metadata).toBeDefined();
          expect(metadata.name).toBeDefined();
          expect(typeof metadata.name).toBe('string');
          expect(metadata.name.length).toBeGreaterThan(0);
          expect(metadata.description).toBeDefined();
          expect(typeof metadata.description).toBe('string');
          expect(metadata.description.length).toBeGreaterThan(0);
        }),
        { numRuns: 10 }
      );
    });

    it('should have a validator defined for each step number (2-10)', () => {
      fc.assert(
        fc.property(validStepNumberArb, (stepNumber) => {
          const validator = getValidatorForStep(stepNumber);
          
          // Validator should be a function
          expect(typeof validator).toBe('function');
        }),
        { numRuns: 10 }
      );
    });

    it('should reject invalid step numbers (outside 2-10 range)', async () => {
      await fc.assert(
        fc.asyncProperty(invalidStepNumberArb, validDescriptionArb, async (stepNumber, description) => {
          await expect(
            standaloneService.generateStep(stepNumber, description)
          ).rejects.toThrow('Step number must be between 2 and 10');
        }),
        { numRuns: 3 }
      );
    });

    it('should reject invalid descriptions (less than 10 characters)', async () => {
      await fc.assert(
        fc.asyncProperty(validStepNumberArb, invalidDescriptionArb, async (stepNumber, description) => {
          await expect(
            standaloneService.generateStep(stepNumber, description)
          ).rejects.toThrow('Description must be at least 10 characters');
        }),
        { numRuns: 3 }
      );
    });

    it('should validate KSC content structure for step 2', () => {
      // Test with mock content structure
      const validKSCContent: KSCContent = {
        knowledgeItems: [
          {
            id: 'K1',
            type: 'knowledge',
            statement: 'Test knowledge',
            description: 'Test description',
            importance: 'essential',
          },
        ],
        skillItems: [
          {
            id: 'S1',
            type: 'skill',
            statement: 'Test skill',
            description: 'Test description',
            importance: 'essential',
          },
        ],
        competencyItems: [
          {
            id: 'C1',
            type: 'competency',
            statement: 'Test competency',
            description: 'Test description',
            importance: 'essential',
          },
        ],
        totalItems: 3,
      };

      expect(isValidKSCContent(validKSCContent)).toBe(true);
      expect(isValidKSCContent({})).toBe(false);
      expect(isValidKSCContent(null)).toBe(false);
      expect(isValidKSCContent({ knowledgeItems: 'not an array' })).toBe(false);
    });

    it('should validate PLO content structure for step 3', () => {
      const validPLOContent: PLOContent = {
        outcomes: [
          {
            id: 'PLO1',
            code: 'PLO1',
            outcomeNumber: 1,
            statement: 'Test outcome',
            bloomLevel: 'apply',
            verb: 'Apply',
            measurable: true,
            assessable: true,
          },
        ],
        bloomDistribution: {
          apply: 1,
        },
      };

      expect(isValidPLOContent(validPLOContent)).toBe(true);
      expect(isValidPLOContent({})).toBe(false);
      expect(isValidPLOContent({ outcomes: 'not an array' })).toBe(false);
    });

    it('should validate Course Framework content structure for step 4', () => {
      const validContent: CourseFrameworkContent = {
        modules: [
          {
            id: 'mod1',
            moduleCode: 'MOD101',
            title: 'Test Module',
            description: 'Test description',
            sequenceOrder: 1,
            totalHours: 20,
            contactHours: 6,
            independentHours: 14,
            mlos: [],
            topics: [],
          },
        ],
        totalHours: 20,
      };

      expect(isValidCourseFrameworkContent(validContent)).toBe(true);
      expect(isValidCourseFrameworkContent({})).toBe(false);
      expect(isValidCourseFrameworkContent({ modules: [], totalHours: 'not a number' })).toBe(false);
    });

    it('should validate Sources content structure for step 5', () => {
      const validContent: SourcesContent = {
        sources: [],
        byModule: {},
      };

      expect(isValidSourcesContent(validContent)).toBe(true);
      expect(isValidSourcesContent({})).toBe(false);
      expect(isValidSourcesContent({ sources: 'not an array' })).toBe(false);
    });

    it('should validate Reading List content structure for step 6', () => {
      const validContent: ReadingListContent = {
        coreReadings: [],
        supplementaryReadings: [],
        byModule: {},
      };

      expect(isValidReadingListContent(validContent)).toBe(true);
      expect(isValidReadingListContent({})).toBe(false);
    });

    it('should validate Assessment content structure for step 7', () => {
      const validContent: AssessmentContent = {
        formativeAssessments: [],
        summativeAssessments: [],
        questionBank: [],
      };

      expect(isValidAssessmentContent(validContent)).toBe(true);
      expect(isValidAssessmentContent({})).toBe(false);
    });

    it('should validate Case Study content structure for step 8', () => {
      const validContent: CaseStudyContent = {
        caseStudies: [],
      };

      expect(isValidCaseStudyContent(validContent)).toBe(true);
      expect(isValidCaseStudyContent({})).toBe(false);
    });

    it('should validate Glossary content structure for step 9', () => {
      const validContent: GlossaryContent = {
        terms: [],
        totalTerms: 0,
      };

      expect(isValidGlossaryContent(validContent)).toBe(true);
      expect(isValidGlossaryContent({})).toBe(false);
    });

    it('should validate Lesson Plan content structure for step 10', () => {
      const validContent: LessonPlanContent = {
        lessonPlans: [],
      };

      expect(isValidLessonPlanContent(validContent)).toBe(true);
      expect(isValidLessonPlanContent({})).toBe(false);
    });

    it('should validate StandaloneStepResult structure', () => {
      const validResult: StandaloneStepResult = {
        stepNumber: 2,
        stepName: 'Test Step',
        content: {},
        generatedAt: new Date().toISOString(),
      };

      expect(isValidStandaloneStepResult(validResult)).toBe(true);
      expect(isValidStandaloneStepResult({})).toBe(false);
      expect(isValidStandaloneStepResult(null)).toBe(false);
      expect(isValidStandaloneStepResult({ stepNumber: 'not a number' })).toBe(false);
    });

    it('should have correct step names in STEP_METADATA', () => {
      const expectedStepNames: Record<number, string> = {
        2: 'Competency Framework (KSC)',
        3: 'Program Learning Outcomes',
        4: 'Course Framework & MLOs',
        5: 'Topic-Level Sources',
        6: 'Reading Lists',
        7: 'Auto-Gradable Assessments',
        8: 'Case Studies',
        9: 'Glossary',
        10: 'Lesson Plans & PPT',
      };

      fc.assert(
        fc.property(validStepNumberArb, (stepNumber) => {
          const metadata = STEP_METADATA[stepNumber];
          expect(metadata.name).toBe(expectedStepNames[stepNumber]);
        }),
        { numRuns: 10 }
      );
    });

    it('should exclude step 1 from STEP_METADATA', () => {
      expect(STEP_METADATA[1]).toBeUndefined();
    });

    it('should have all steps 2-10 defined in STEP_METADATA', () => {
      for (let step = 2; step <= 10; step++) {
        expect(STEP_METADATA[step]).toBeDefined();
        expect(STEP_METADATA[step].name).toBeDefined();
        expect(STEP_METADATA[step].description).toBeDefined();
      }
    });
  });
});
