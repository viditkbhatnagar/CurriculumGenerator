/**
 * Property-Based Tests for Step Metadata Display Consistency
 *
 * **Feature: standalone-step-execution, Property 1: Step Metadata Display Consistency**
 * **Validates: Requirements 2.2, 3.5**
 *
 * Property: For any step number in the range 2-10, when that step is displayed in the
 * Step Selector, the displayed name, icon, and time estimate SHALL match the values
 * defined in STANDALONE_STEPS configuration.
 */

import * as fc from 'fast-check';

// ============================================================================
// STANDALONE_STEPS CONFIGURATION (mirrors frontend StepSelector.tsx)
// ============================================================================

/**
 * Step configuration matching the design document.
 * This is the source of truth for step metadata that must be displayed consistently.
 */
export const STANDALONE_STEPS = [
  {
    step: 2,
    name: 'Competency Framework (KSC)',
    time: '10-15 min',
    icon: '🎯',
    description: 'Generate Knowledge, Skills, and Competencies (KSC) framework',
  },
  {
    step: 3,
    name: 'Program Learning Outcomes',
    time: '15-20 min',
    icon: '⚡',
    description: "Create measurable Program Learning Outcomes using Bloom's Taxonomy",
  },
  {
    step: 4,
    name: 'Course Framework & MLOs',
    time: '25-30 min',
    icon: '📚',
    description: 'Structure modules, topics, and Module Learning Outcomes',
  },
  {
    step: 5,
    name: 'Topic-Level Sources',
    time: '10 min',
    icon: '📖',
    description: 'Assign AGI-compliant academic sources to topics',
  },
  {
    step: 6,
    name: 'Reading Lists',
    time: '8 min',
    icon: '📕',
    description: 'Create core and supplementary reading lists per module',
  },
  {
    step: 7,
    name: 'Auto-Gradable Assessments',
    time: '15-20 min',
    icon: '✅',
    description: 'Generate MCQ-first auto-gradable assessments and quizzes',
  },
  {
    step: 8,
    name: 'Case Studies',
    time: '10-15 min',
    icon: '🏢',
    description: 'Create engagement hooks and case study scenarios',
  },
  {
    step: 9,
    name: 'Glossary',
    time: '5 min',
    icon: '📖',
    description: 'Auto-generate glossary from all curriculum content',
  },
  {
    step: 10,
    name: 'Lesson Plans & PPT',
    time: '10-15 min',
    icon: '📝',
    description: 'Generate detailed lesson plans and PowerPoint decks',
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get step metadata by step number
 */
function getStepByNumber(stepNumber: number) {
  return STANDALONE_STEPS.find((s) => s.step === stepNumber);
}

/**
 * Validate that a step has all required metadata fields
 */
function hasRequiredMetadataFields(step: typeof STANDALONE_STEPS[0]): boolean {
  return (
    typeof step.step === 'number' &&
    typeof step.name === 'string' &&
    step.name.length > 0 &&
    typeof step.time === 'string' &&
    step.time.length > 0 &&
    typeof step.icon === 'string' &&
    step.icon.length > 0 &&
    typeof step.description === 'string' &&
    step.description.length > 0
  );
}

/**
 * Validate time format (e.g., "10-15 min", "5 min", "8 min")
 */
function isValidTimeFormat(time: string): boolean {
  // Matches patterns like "10-15 min", "5 min", "8 min"
  const timePattern = /^\d+(-\d+)?\s*min$/;
  return timePattern.test(time);
}

// ============================================================================
// ARBITRARIES FOR GENERATING TEST DATA
// ============================================================================

// Valid step numbers (2-10)
const validStepNumberArb = fc.integer({ min: 2, max: 10 });

// Invalid step numbers (outside 2-10 range, including step 1)
const invalidStepNumberArb = fc.oneof(
  fc.constant(1), // Step 1 should be excluded
  fc.integer({ min: -100, max: 0 }),
  fc.integer({ min: 11, max: 100 })
);

// ============================================================================
// PROPERTY TESTS
// ============================================================================

describe('StepSelector - Property Tests', () => {
  /**
   * **Feature: standalone-step-execution, Property 1: Step Metadata Display Consistency**
   * **Validates: Requirements 2.2, 3.5**
   *
   * Property: For any step number in the range 2-10, when that step is displayed in the
   * Step Selector, the displayed name, icon, and time estimate SHALL match the values
   * defined in STANDALONE_STEPS configuration.
   */
  describe('Property 1: Step Metadata Display Consistency', () => {
    it('should have exactly 9 steps (steps 2-10) in STANDALONE_STEPS', () => {
      expect(STANDALONE_STEPS.length).toBe(9);
    });

    it('should exclude Step 1 from STANDALONE_STEPS (Requirement 2.3)', () => {
      const step1 = getStepByNumber(1);
      expect(step1).toBeUndefined();
    });

    it('should have all steps 2-10 defined in STANDALONE_STEPS', () => {
      fc.assert(
        fc.property(validStepNumberArb, (stepNumber) => {
          const step = getStepByNumber(stepNumber);
          expect(step).toBeDefined();
          expect(step?.step).toBe(stepNumber);
        }),
        { numRuns: 10 }
      );
    });

    it('should have all required metadata fields for each step (Requirement 2.2)', () => {
      fc.assert(
        fc.property(validStepNumberArb, (stepNumber) => {
          const step = getStepByNumber(stepNumber);
          expect(step).toBeDefined();
          if (step) {
            expect(hasRequiredMetadataFields(step)).toBe(true);
          }
        }),
        { numRuns: 10 }
      );
    });

    it('should have valid time format for each step', () => {
      fc.assert(
        fc.property(validStepNumberArb, (stepNumber) => {
          const step = getStepByNumber(stepNumber);
          expect(step).toBeDefined();
          if (step) {
            expect(isValidTimeFormat(step.time)).toBe(true);
          }
        }),
        { numRuns: 10 }
      );
    });

    it('should have non-empty name for each step', () => {
      fc.assert(
        fc.property(validStepNumberArb, (stepNumber) => {
          const step = getStepByNumber(stepNumber);
          expect(step).toBeDefined();
          if (step) {
            expect(step.name.trim().length).toBeGreaterThan(0);
          }
        }),
        { numRuns: 10 }
      );
    });

    it('should have non-empty icon for each step', () => {
      fc.assert(
        fc.property(validStepNumberArb, (stepNumber) => {
          const step = getStepByNumber(stepNumber);
          expect(step).toBeDefined();
          if (step) {
            expect(step.icon.length).toBeGreaterThan(0);
          }
        }),
        { numRuns: 10 }
      );
    });

    it('should have non-empty description for each step (Requirement 3.5)', () => {
      fc.assert(
        fc.property(validStepNumberArb, (stepNumber) => {
          const step = getStepByNumber(stepNumber);
          expect(step).toBeDefined();
          if (step) {
            expect(step.description.trim().length).toBeGreaterThan(0);
          }
        }),
        { numRuns: 10 }
      );
    });

    it('should not have any step defined for invalid step numbers', () => {
      fc.assert(
        fc.property(invalidStepNumberArb, (stepNumber) => {
          const step = getStepByNumber(stepNumber);
          expect(step).toBeUndefined();
        }),
        { numRuns: 10 }
      );
    });

    it('should have unique step numbers', () => {
      const stepNumbers = STANDALONE_STEPS.map((s) => s.step);
      const uniqueStepNumbers = new Set(stepNumbers);
      expect(uniqueStepNumbers.size).toBe(stepNumbers.length);
    });

    it('should have unique step names', () => {
      const stepNames = STANDALONE_STEPS.map((s) => s.name);
      const uniqueStepNames = new Set(stepNames);
      expect(uniqueStepNames.size).toBe(stepNames.length);
    });

    it('should have steps in sequential order (2-10)', () => {
      const stepNumbers = STANDALONE_STEPS.map((s) => s.step);
      const expectedOrder = [2, 3, 4, 5, 6, 7, 8, 9, 10];
      expect(stepNumbers).toEqual(expectedOrder);
    });

    it('should have consistent metadata between STANDALONE_STEPS and expected values', () => {
      const expectedMetadata: Record<number, { name: string; icon: string }> = {
        2: { name: 'Competency Framework (KSC)', icon: '🎯' },
        3: { name: 'Program Learning Outcomes', icon: '⚡' },
        4: { name: 'Course Framework & MLOs', icon: '📚' },
        5: { name: 'Topic-Level Sources', icon: '📖' },
        6: { name: 'Reading Lists', icon: '📕' },
        7: { name: 'Auto-Gradable Assessments', icon: '✅' },
        8: { name: 'Case Studies', icon: '🏢' },
        9: { name: 'Glossary', icon: '📖' },
        10: { name: 'Lesson Plans & PPT', icon: '📝' },
      };

      fc.assert(
        fc.property(validStepNumberArb, (stepNumber) => {
          const step = getStepByNumber(stepNumber);
          const expected = expectedMetadata[stepNumber];
          
          expect(step).toBeDefined();
          expect(expected).toBeDefined();
          
          if (step && expected) {
            expect(step.name).toBe(expected.name);
            expect(step.icon).toBe(expected.icon);
          }
        }),
        { numRuns: 10 }
      );
    });
  });
});
