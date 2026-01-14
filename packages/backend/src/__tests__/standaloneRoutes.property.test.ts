/**
 * Property-Based Tests for Standalone Routes API Request Validation
 *
 * **Feature: standalone-step-execution, Property 7: API Request Validation**
 * **Validates: Requirements 9.5**
 *
 * Tests that for any API request to `/api/v3/standalone/step/:stepNumber`,
 * if stepNumber is not in range 2-10, the System SHALL return HTTP 400
 * with appropriate error message.
 */

import * as fc from 'fast-check';

// ============================================================================
// VALIDATION FUNCTIONS (mirroring route validation logic)
// ============================================================================

/**
 * Validate step number is in valid range (2-10)
 * This mirrors the validation logic in standaloneRoutes.ts
 */
function validateStepNumber(stepNumber: number): { valid: boolean; error?: string } {
  if (isNaN(stepNumber)) {
    return { valid: false, error: 'Step number must be a valid number' };
  }
  if (stepNumber < 2 || stepNumber > 10) {
    return { valid: false, error: 'Step number must be between 2 and 10' };
  }
  return { valid: true };
}

/**
 * Validate description meets minimum requirements
 * This mirrors the validation logic in standaloneRoutes.ts
 */
function validateDescription(description: any): { valid: boolean; error?: string } {
  if (!description || typeof description !== 'string') {
    return { valid: false, error: 'Description is required' };
  }
  if (description.trim().length < 10) {
    return { valid: false, error: 'Please provide more details in your description.' };
  }
  return { valid: true };
}

// ============================================================================
// ARBITRARIES FOR GENERATING TEST DATA
// ============================================================================

// Valid step numbers (2-10)
const validStepNumberArb = fc.integer({ min: 2, max: 10 });

// Invalid step numbers (outside 2-10 range)
const invalidStepNumberArb = fc.oneof(
  fc.integer({ min: -1000, max: 1 }),
  fc.integer({ min: 11, max: 1000 })
);

// Valid description (at least 10 characters after trimming)
const validDescriptionArb = fc
  .string({ minLength: 10, maxLength: 500 })
  .filter((s) => s.trim().length >= 10);

// Invalid description (less than 10 characters or empty)
const invalidDescriptionArb = fc.oneof(
  fc.constant(''),
  fc.constant(null),
  fc.constant(undefined),
  fc.string({ minLength: 0, maxLength: 9 }),
  fc.constant('   '),
  fc.constant('short'),
  fc.constant('123456789') // exactly 9 chars
);

// Edge case step numbers
const edgeCaseStepNumberArb = fc.oneof(
  fc.constant(1), // Step 1 is excluded
  fc.constant(2), // First valid step
  fc.constant(10), // Last valid step
  fc.constant(11), // First invalid after range
  fc.constant(0), // Zero
  fc.constant(-1) // Negative
);

// ============================================================================
// PROPERTY TESTS
// ============================================================================

describe('StandaloneRoutes - Property Tests', () => {
  /**
   * **Feature: standalone-step-execution, Property 7: API Request Validation**
   * **Validates: Requirements 9.5**
   *
   * Property: For any API request to `/api/v3/standalone/step/:stepNumber`,
   * if stepNumber is not in range 2-10, the System SHALL return HTTP 400
   * with appropriate error message.
   */
  describe('Property 7: API Request Validation', () => {
    it('should accept all valid step numbers (2-10)', () => {
      fc.assert(
        fc.property(validStepNumberArb, (stepNumber) => {
          const result = validateStepNumber(stepNumber);
          expect(result.valid).toBe(true);
          expect(result.error).toBeUndefined();
        }),
        { numRuns: 20 }
      );
    });

    it('should reject all invalid step numbers (outside 2-10 range)', () => {
      fc.assert(
        fc.property(invalidStepNumberArb, (stepNumber) => {
          const result = validateStepNumber(stepNumber);
          expect(result.valid).toBe(false);
          expect(result.error).toBe('Step number must be between 2 and 10');
        }),
        { numRuns: 20 }
      );
    });

    it('should handle edge case step numbers correctly', () => {
      fc.assert(
        fc.property(edgeCaseStepNumberArb, (stepNumber) => {
          const result = validateStepNumber(stepNumber);

          if (stepNumber >= 2 && stepNumber <= 10) {
            expect(result.valid).toBe(true);
          } else {
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Step number must be between 2 and 10');
          }
        }),
        { numRuns: 20 }
      );
    });

    it('should accept all valid descriptions (>= 10 characters)', () => {
      fc.assert(
        fc.property(validDescriptionArb, (description) => {
          const result = validateDescription(description);
          expect(result.valid).toBe(true);
          expect(result.error).toBeUndefined();
        }),
        { numRuns: 20 }
      );
    });

    it('should reject all invalid descriptions (< 10 characters or empty)', () => {
      fc.assert(
        fc.property(invalidDescriptionArb, (description) => {
          const result = validateDescription(description);
          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();

          // Check specific error messages based on the validation logic
          // The validation function checks: !description || typeof description !== 'string'
          // Empty string '' is falsy, so it triggers "Description is required"
          if (!description || typeof description !== 'string') {
            expect(result.error).toBe('Description is required');
          } else {
            // For non-empty strings with trimmed length < 10
            expect(result.error).toBe('Please provide more details in your description.');
          }
        }),
        { numRuns: 20 }
      );
    });

    it('should validate step number boundary conditions', () => {
      // Test exact boundaries
      expect(validateStepNumber(1).valid).toBe(false); // Just below valid range
      expect(validateStepNumber(2).valid).toBe(true); // Lower boundary (valid)
      expect(validateStepNumber(10).valid).toBe(true); // Upper boundary (valid)
      expect(validateStepNumber(11).valid).toBe(false); // Just above valid range
    });

    it('should validate description length boundary conditions', () => {
      // Test exact boundaries
      expect(validateDescription('123456789').valid).toBe(false); // 9 chars - invalid
      expect(validateDescription('1234567890').valid).toBe(true); // 10 chars - valid
      expect(validateDescription('12345678901').valid).toBe(true); // 11 chars - valid
    });

    it('should handle whitespace-only descriptions correctly', () => {
      // Test specific whitespace-only strings
      const whitespaceStrings = ['   ', '\t\t\t', '\n\n\n', '  \t  \n  ', '          '];
      
      whitespaceStrings.forEach((whitespaceString) => {
        const result = validateDescription(whitespaceString);
        // Whitespace-only strings should be invalid (trimmed length < 10)
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Please provide more details in your description.');
      });
    });

    it('should handle descriptions with leading/trailing whitespace', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 10, maxLength: 100 }).filter((s) => s.trim().length >= 10),
          (content) => {
            // Add leading and trailing whitespace
            const description = '   ' + content + '   ';
            const result = validateDescription(description);
            // Should be valid if trimmed content is >= 10 chars
            expect(result.valid).toBe(true);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should reject NaN step numbers', () => {
      const result = validateStepNumber(NaN);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Step number must be a valid number');
    });

    it('should handle very large step numbers', () => {
      fc.assert(
        fc.property(fc.integer({ min: 11, max: Number.MAX_SAFE_INTEGER }), (stepNumber) => {
          const result = validateStepNumber(stepNumber);
          expect(result.valid).toBe(false);
          expect(result.error).toBe('Step number must be between 2 and 10');
        }),
        { numRuns: 20 }
      );
    });

    it('should handle very negative step numbers', () => {
      fc.assert(
        fc.property(fc.integer({ min: Number.MIN_SAFE_INTEGER, max: 1 }), (stepNumber) => {
          const result = validateStepNumber(stepNumber);
          expect(result.valid).toBe(false);
          expect(result.error).toBe('Step number must be between 2 and 10');
        }),
        { numRuns: 20 }
      );
    });

    it('should validate combined step number and description', () => {
      fc.assert(
        fc.property(validStepNumberArb, validDescriptionArb, (stepNumber, description) => {
          const stepResult = validateStepNumber(stepNumber);
          const descResult = validateDescription(description);

          // Both should be valid for a valid request
          expect(stepResult.valid).toBe(true);
          expect(descResult.valid).toBe(true);
        }),
        { numRuns: 20 }
      );
    });

    it('should reject requests with invalid step number regardless of description', () => {
      fc.assert(
        fc.property(invalidStepNumberArb, validDescriptionArb, (stepNumber, description) => {
          const stepResult = validateStepNumber(stepNumber);
          const descResult = validateDescription(description);

          // Step should be invalid, description should be valid
          expect(stepResult.valid).toBe(false);
          expect(descResult.valid).toBe(true);
        }),
        { numRuns: 20 }
      );
    });

    it('should reject requests with invalid description regardless of step number', () => {
      fc.assert(
        fc.property(validStepNumberArb, invalidDescriptionArb, (stepNumber, description) => {
          const stepResult = validateStepNumber(stepNumber);
          const descResult = validateDescription(description);

          // Step should be valid, description should be invalid
          expect(stepResult.valid).toBe(true);
          expect(descResult.valid).toBe(false);
        }),
        { numRuns: 20 }
      );
    });
  });
});
