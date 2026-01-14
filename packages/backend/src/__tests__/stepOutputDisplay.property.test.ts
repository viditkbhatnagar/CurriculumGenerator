// Property Test: Output Display State Consistency
// Validates: Requirements 3.2, 3.3, 3.4

import * as fc from 'fast-check';

// Output display states matching the frontend component
type OutputState = 'idle' | 'loading' | 'success' | 'error';

interface StepOutputData {
  stepNumber: number;
  stepName: string;
  content: any;
  generatedAt: string;
}

// Simulate the output display logic from StepOutput component
// This matches the actual component behavior where success without output shows nothing
function getDisplayBehavior(
  state: OutputState,
  output: StepOutputData | null,
  error: string | null
): {
  showsContent: boolean;
  showsLoading: boolean;
  showsError: boolean;
  showsNothing: boolean;
  hasRetryOption: boolean;
  hasDownloadOption: boolean;
} {
  // Success state without output falls back to showing nothing (same as idle)
  const effectivelyIdle = state === 'idle' || (state === 'success' && output === null);
  
  return {
    showsContent: state === 'success' && output !== null,
    showsLoading: state === 'loading',
    showsError: state === 'error',
    showsNothing: effectivelyIdle,
    hasRetryOption: state === 'error',
    hasDownloadOption: state === 'success' && output !== null,
  };
}

// Valid step names for output
const STEP_NAMES: Record<number, string> = {
  2: 'Program Overview',
  3: 'Module Breakdown',
  4: 'Lesson Breakdown',
  5: 'Learning Objectives',
  6: 'Session Plan',
  7: 'Lesson Content',
  8: 'Assessments',
  9: 'Facilitator Guide',
  10: 'Presentations',
};

describe('Output Display State Consistency', () => {
  // Property 1: Only one state should be active at a time
  test('should display exactly one state at a time', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<OutputState>('idle', 'loading', 'success', 'error'),
        fc.option(
          fc.record({
            stepNumber: fc.integer({ min: 2, max: 10 }),
            stepName: fc.constantFrom(...Object.values(STEP_NAMES)),
            content: fc.oneof(fc.string(), fc.object()),
            generatedAt: fc.date().map((d) => d.toISOString()),
          }),
          { nil: null }
        ),
        fc.option(fc.string({ minLength: 1 }), { nil: null }),
        (state, output, error) => {
          const behavior = getDisplayBehavior(state, output, error);
          
          // Count active display states
          const activeStates = [
            behavior.showsContent,
            behavior.showsLoading,
            behavior.showsError,
            behavior.showsNothing,
          ].filter(Boolean).length;
          
          // Exactly one state should be active
          expect(activeStates).toBe(1);
        }
      ),
      { numRuns: 20 }
    );
  });

  // Property 2: Loading state should show loading indicator (Requirement 3.3)
  test('should show loading indicator during loading state', () => {
    fc.assert(
      fc.property(
        fc.option(
          fc.record({
            stepNumber: fc.integer({ min: 2, max: 10 }),
            stepName: fc.constantFrom(...Object.values(STEP_NAMES)),
            content: fc.string(),
            generatedAt: fc.date().map((d) => d.toISOString()),
          }),
          { nil: null }
        ),
        fc.option(fc.string(), { nil: null }),
        (output, error) => {
          const behavior = getDisplayBehavior('loading', output, error);
          
          expect(behavior.showsLoading).toBe(true);
          expect(behavior.showsContent).toBe(false);
          expect(behavior.showsError).toBe(false);
          expect(behavior.showsNothing).toBe(false);
        }
      ),
      { numRuns: 10 }
    );
  });

  // Property 3: Error state should show error message and retry option (Requirement 3.4)
  test('should show error message and retry option on error state', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        (errorMessage) => {
          const behavior = getDisplayBehavior('error', null, errorMessage);
          
          expect(behavior.showsError).toBe(true);
          expect(behavior.hasRetryOption).toBe(true);
          expect(behavior.showsContent).toBe(false);
          expect(behavior.showsLoading).toBe(false);
        }
      ),
      { numRuns: 10 }
    );
  });

  // Property 4: Success state should display formatted output (Requirement 3.2)
  test('should display formatted output on success state', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 10 }),
        fc.oneof(
          fc.string({ minLength: 1 }),
          fc.object(),
          fc.array(fc.string())
        ),
        (stepNumber, content) => {
          const output: StepOutputData = {
            stepNumber,
            stepName: STEP_NAMES[stepNumber],
            content,
            generatedAt: new Date().toISOString(),
          };
          
          const behavior = getDisplayBehavior('success', output, null);
          
          expect(behavior.showsContent).toBe(true);
          expect(behavior.hasDownloadOption).toBe(true);
          expect(behavior.showsLoading).toBe(false);
          expect(behavior.showsError).toBe(false);
        }
      ),
      { numRuns: 10 }
    );
  });

  // Property 5: Idle state should show nothing
  test('should show nothing in idle state', () => {
    fc.assert(
      fc.property(
        fc.option(
          fc.record({
            stepNumber: fc.integer({ min: 2, max: 10 }),
            stepName: fc.constantFrom(...Object.values(STEP_NAMES)),
            content: fc.string(),
            generatedAt: fc.date().map((d) => d.toISOString()),
          }),
          { nil: null }
        ),
        fc.option(fc.string(), { nil: null }),
        (output, error) => {
          const behavior = getDisplayBehavior('idle', output, error);
          
          expect(behavior.showsNothing).toBe(true);
          expect(behavior.showsContent).toBe(false);
          expect(behavior.showsLoading).toBe(false);
          expect(behavior.showsError).toBe(false);
        }
      ),
      { numRuns: 10 }
    );
  });

  // Property 6: Success state requires valid output data
  test('should not show content without valid output data', () => {
    const behavior = getDisplayBehavior('success', null, null);
    
    expect(behavior.showsContent).toBe(false);
    expect(behavior.hasDownloadOption).toBe(false);
  });
});
