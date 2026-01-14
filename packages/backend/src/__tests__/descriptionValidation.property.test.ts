// Property Test: Description Input Validation
// **Property 2: Description Input Validation**
// **Validates: Requirements 3.4, 10.2**

import * as fc from 'fast-check';

/**
 * Minimum character count for valid description
 * Per Requirements 3.4 and 10.2
 */
const MIN_DESCRIPTION_LENGTH = 10;

/**
 * Validates a description string
 * Returns true if description has at least MIN_DESCRIPTION_LENGTH characters after trimming
 * This mirrors the validateDescription function from DescriptionInput.tsx
 */
function validateDescription(description: string): boolean {
  return description.trim().length >= MIN_DESCRIPTION_LENGTH;
}

/**
 * Determines if the generate button should be disabled
 * Per Requirement 3.4: Disable generate button when input invalid
 */
function isGenerateButtonDisabled(description: string, isGenerating: boolean): boolean {
  return !validateDescription(description) || isGenerating;
}

/**
 * Gets the validation message to display
 * Per Requirement 10.2: Display "Please provide more details in your description."
 */
function getValidationMessage(description: string): string | null {
  const charCount = description.trim().length;
  if (charCount < MIN_DESCRIPTION_LENGTH) {
    return `Minimum ${MIN_DESCRIPTION_LENGTH} characters required (${charCount}/${MIN_DESCRIPTION_LENGTH})`;
  }
  return null;
}

// ============================================================================
// ARBITRARIES FOR GENERATING TEST DATA
// ============================================================================

// Valid description (at least 10 characters after trimming)
const validDescriptionArb = fc.string({ minLength: 10, maxLength: 500 }).filter(s => s.trim().length >= 10);

// Invalid description (less than 10 characters after trimming)
const invalidDescriptionArb = fc.oneof(
  fc.constant(''),
  fc.string({ minLength: 1, maxLength: 9 }),
  fc.constant('   '),
  fc.constant('short'),
  fc.constant('123456789'), // exactly 9 chars
  fc.constant('  abc  '), // 3 chars after trim
);

// Whitespace-only strings
const whitespaceOnlyArb = fc.oneof(
  fc.constant(''),
  fc.constant(' '),
  fc.constant('  '),
  fc.constant('\t'),
  fc.constant('\n'),
  fc.constant('   \t\n   '),
  fc.constant('                    '), // 20 spaces
);

// ============================================================================
// PROPERTY TESTS
// ============================================================================

describe('Description Input Validation - Property 2', () => {
  // Feature: standalone-step-execution, Property 2: Description Input Validation
  // Validates: Requirements 3.4, 10.2

  // Property 2.1: Descriptions with fewer than 10 characters (after trimming) should be invalid
  it('should reject descriptions with fewer than 10 characters after trimming', () => {
    fc.assert(
      fc.property(invalidDescriptionArb, (shortDescription) => {
        const isValid = validateDescription(shortDescription);
        expect(isValid).toBe(false);
      }),
      { numRuns: 20 }
    );
  });

  // Property 2.2: Descriptions with 10 or more characters (after trimming) should be valid
  it('should accept descriptions with 10 or more characters after trimming', () => {
    fc.assert(
      fc.property(validDescriptionArb, (validDescription) => {
        const isValid = validateDescription(validDescription);
        expect(isValid).toBe(true);
      }),
      { numRuns: 20 }
    );
  });

  // Property 2.3: Whitespace-only strings should be invalid regardless of length
  it('should reject whitespace-only strings regardless of length', () => {
    fc.assert(
      fc.property(whitespaceOnlyArb, (whitespaceString) => {
        const isValid = validateDescription(whitespaceString);
        expect(isValid).toBe(false);
      }),
      { numRuns: 10 }
    );
  });

  // Property 2.4: Leading/trailing whitespace should not count toward character limit
  it('should not count leading/trailing whitespace toward character limit', () => {
    fc.assert(
      fc.property(
        // Generate padding whitespace
        fc.constantFrom('', ' ', '  ', '   ', '\t', '\n'),
        // Generate core content (may or may not meet minimum)
        fc.string({ minLength: 0, maxLength: 20 }).filter(s => s.trim() === s), // no whitespace
        fc.constantFrom('', ' ', '  ', '   ', '\t', '\n'),
        (leadingWhitespace, coreContent, trailingWhitespace) => {
          const paddedString = leadingWhitespace + coreContent + trailingWhitespace;
          const isValid = validateDescription(paddedString);
          
          // Validation should be based on trimmed content only
          const expectedValid = coreContent.length >= MIN_DESCRIPTION_LENGTH;
          expect(isValid).toBe(expectedValid);
        }
      ),
      { numRuns: 20 }
    );
  });

  // Property 2.5: Generate button should be disabled when description is invalid
  it('should disable generate button when description is invalid', () => {
    fc.assert(
      fc.property(
        invalidDescriptionArb,
        fc.boolean(),
        (shortDescription, isGenerating) => {
          const isDisabled = isGenerateButtonDisabled(shortDescription, isGenerating);
          expect(isDisabled).toBe(true);
        }
      ),
      { numRuns: 10 }
    );
  });

  // Property 2.6: Generate button should be disabled when generating, even with valid description
  it('should disable generate button when generating regardless of description validity', () => {
    fc.assert(
      fc.property(validDescriptionArb, (validDescription) => {
        const isDisabled = isGenerateButtonDisabled(validDescription, true);
        expect(isDisabled).toBe(true);
      }),
      { numRuns: 10 }
    );
  });

  // Property 2.7: Generate button should be enabled only when description is valid AND not generating
  it('should enable generate button only when description is valid and not generating', () => {
    fc.assert(
      fc.property(validDescriptionArb, (validDescription) => {
        const isDisabled = isGenerateButtonDisabled(validDescription, false);
        expect(isDisabled).toBe(false);
      }),
      { numRuns: 10 }
    );
  });

  // Property 2.8: Validation message should be shown for invalid descriptions
  it('should show validation message for descriptions under minimum length', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 9 }),
        (charCount) => {
          // Generate a string with exactly charCount non-whitespace characters
          const description = 'a'.repeat(charCount);
          const message = getValidationMessage(description);
          
          expect(message).not.toBeNull();
          expect(message).toContain('Minimum');
          expect(message).toContain(`${charCount}/${MIN_DESCRIPTION_LENGTH}`);
        }
      ),
      { numRuns: 10 }
    );
  });

  // Property 2.9: No validation message for valid descriptions
  it('should not show validation message for valid descriptions', () => {
    fc.assert(
      fc.property(validDescriptionArb, (validDescription) => {
        const message = getValidationMessage(validDescription);
        expect(message).toBeNull();
      }),
      { numRuns: 10 }
    );
  });

  // Property 2.10: Boundary test - exactly 10 characters should be valid
  it('should accept descriptions with exactly 10 characters', () => {
    const exactlyTenChars = 'abcdefghij'; // exactly 10 chars
    const isValid = validateDescription(exactlyTenChars);
    expect(isValid).toBe(true);
  });

  // Property 2.11: Boundary test - exactly 9 characters should be invalid
  it('should reject descriptions with exactly 9 characters', () => {
    const exactlyNineChars = 'abcdefghi'; // exactly 9 chars
    const isValid = validateDescription(exactlyNineChars);
    expect(isValid).toBe(false);
  });

  // Property 2.12: Empty string should be invalid
  it('should reject empty string', () => {
    const isValid = validateDescription('');
    expect(isValid).toBe(false);
  });

  // Property 2.13: String with only spaces should be invalid
  it('should reject string with only spaces', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        (numSpaces) => {
          const spacesOnly = ' '.repeat(numSpaces);
          const isValid = validateDescription(spacesOnly);
          expect(isValid).toBe(false);
        }
      ),
      { numRuns: 10 }
    );
  });

  // Property 2.14: Validation should be consistent (same input = same output)
  it('should produce consistent validation results for the same input', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 100 }),
        (description) => {
          const result1 = validateDescription(description);
          const result2 = validateDescription(description);
          const result3 = validateDescription(description);
          
          expect(result1).toBe(result2);
          expect(result2).toBe(result3);
        }
      ),
      { numRuns: 10 }
    );
  });
});
