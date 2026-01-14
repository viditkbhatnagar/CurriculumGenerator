import { describe, test, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { standaloneService, STEP_METADATA } from '../services/standaloneService';

// Mock the openai service
vi.mock('../services/openaiService', () => ({
  openaiService: {
    generateContent: vi.fn().mockResolvedValue(JSON.stringify({
      knowledgeItems: [],
      skillItems: [],
      competencyItems: [],
    })),
  },
}));

// Mock the logging service
vi.mock('../services/loggingService', () => ({
  loggingService: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Standalone Execution Independence Property Tests', () => {
  // Arbitrary for valid step numbers (2-10)
  const validStepNumberArb = fc.integer({ min: 2, max: 10 });

  // Arbitrary for valid descriptions (at least 10 characters)
  const validDescriptionArb = fc.string({ minLength: 10, maxLength: 500 });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Property 3.1: Each step execution should be independent - no shared state
  test('should execute steps independently without shared state', async () => {
    await fc.assert(
      fc.asyncProperty(
        validStepNumberArb,
        validStepNumberArb,
        validDescriptionArb,
        validDescriptionArb,
        async (step1, step2, desc1, desc2) => {
          // Execute two different steps
          const result1 = await standaloneService.generateStep(step1, desc1);
          const result2 = await standaloneService.generateStep(step2, desc2);

          // Each result should be independent
          expect(result1.stepNumber).toBe(step1);
          expect(result2.stepNumber).toBe(step2);
          expect(result1.stepName).toBe(STEP_METADATA[step1].name);
          expect(result2.stepName).toBe(STEP_METADATA[step2].name);

          // Results should not affect each other
          expect(result1).not.toBe(result2);
        }
      ),
      { numRuns: 10 }
    );
  });

  // Property 3.2: Same inputs should produce consistent structure
  test('should produce consistent result structure for same inputs', async () => {
    await fc.assert(
      fc.asyncProperty(validStepNumberArb, validDescriptionArb, async (stepNumber, description) => {
        const result1 = await standaloneService.generateStep(stepNumber, description);
        const result2 = await standaloneService.generateStep(stepNumber, description);

        // Structure should be consistent
        expect(result1.stepNumber).toBe(result2.stepNumber);
        expect(result1.stepName).toBe(result2.stepName);

        // Both should have content (since AI is mocked)
        expect(result1.content).toBeDefined();
        expect(result2.content).toBeDefined();
      }),
      { numRuns: 10 }
    );
  });

  // Property 3.3: Execution order should not affect results
  test('should not be affected by execution order', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.tuple(validStepNumberArb, validDescriptionArb), { minLength: 2, maxLength: 5 }),
        async (stepInputs) => {
          // Execute in original order
          const results1 = await Promise.all(
            stepInputs.map(([step, desc]) => standaloneService.generateStep(step, desc))
          );

          // Execute in reverse order
          const reversedInputs = [...stepInputs].reverse();
          const results2 = await Promise.all(
            reversedInputs.map(([step, desc]) => standaloneService.generateStep(step, desc))
          );

          // Results should match their inputs regardless of order
          for (let i = 0; i < stepInputs.length; i++) {
            const [step] = stepInputs[i];
            expect(results1[i].stepNumber).toBe(step);
            expect(results1[i].stepName).toBe(STEP_METADATA[step].name);
          }

          for (let i = 0; i < reversedInputs.length; i++) {
            const [step] = reversedInputs[i];
            expect(results2[i].stepNumber).toBe(step);
            expect(results2[i].stepName).toBe(STEP_METADATA[step].name);
          }
        }
      ),
      { numRuns: 5 }
    );
  });

  // Property 3.4: No workflow context should be required
  test('should not require any workflow context', async () => {
    await fc.assert(
      fc.asyncProperty(validStepNumberArb, validDescriptionArb, async (stepNumber, description) => {
        // Execute step without any workflow context
        const result = await standaloneService.generateStep(stepNumber, description);

        // Should succeed with just step number and description
        expect(result.stepNumber).toBe(stepNumber);
        expect(result.stepName).toBe(STEP_METADATA[stepNumber].name);
        expect(result.content).toBeDefined();
        expect(result.generatedAt).toBeDefined();
      }),
      { numRuns: 10 }
    );
  });

  // Property 3.5: Parallel execution should not cause interference
  test('should handle parallel execution without interference', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.tuple(validStepNumberArb, validDescriptionArb), { minLength: 3, maxLength: 5 }),
        async (stepInputs) => {
          // Execute all steps in parallel
          const results = await Promise.all(
            stepInputs.map(([step, desc]) => standaloneService.generateStep(step, desc))
          );

          // Each result should match its input
          for (let i = 0; i < stepInputs.length; i++) {
            const [step] = stepInputs[i];
            expect(results[i].stepNumber).toBe(step);
            expect(results[i].stepName).toBe(STEP_METADATA[step].name);
            expect(results[i].content).toBeDefined();
          }
        }
      ),
      { numRuns: 5 }
    );
  });
});
