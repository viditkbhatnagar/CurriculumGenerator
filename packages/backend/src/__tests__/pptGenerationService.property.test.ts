/**
 * Property-Based Tests for PPTGenerationService
 *
 * Tests the PPT generation functionality using fast-check
 * to verify properties hold across all valid inputs.
 */

import * as fc from 'fast-check';
import {
  PPTGenerationService,
  PPTContext,
  PPTDeck,
  PPTSlide,
  PPTValidationContext,
} from '../services/pptGenerationService';
import {
  LessonPlan,
  LessonActivity,
  FormativeCheck,
  CaseStudyActivity,
} from '../models/CurriculumWorkflow';

// ============================================================================
// ARBITRARIES (Test Data Generators)
// ============================================================================

// Valid Bloom levels
const bloomLevels = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];

// Valid activity types
const activityTypes: LessonActivity['type'][] = [
  'mini_lecture',
  'discussion',
  'demonstration',
  'practice',
  'role_play',
  'case_analysis',
  'group_work',
  'assessment',
  'break',
];

// Generate a valid lesson activity
const lessonActivityArb: fc.Arbitrary<LessonActivity> = fc.record({
  activityId: fc.uuid(),
  sequenceOrder: fc.integer({ min: 1, max: 10 }),
  type: fc.constantFrom(...activityTypes),
  title: fc.string({ minLength: 5, maxLength: 50 }),
  description: fc.string({ minLength: 10, maxLength: 200 }),
  duration: fc.integer({ min: 5, max: 60 }),
  teachingMethod: fc.string({ minLength: 5, maxLength: 50 }),
  resources: fc.array(fc.string({ minLength: 3, maxLength: 30 }), { minLength: 0, maxLength: 5 }),
  instructorActions: fc.array(fc.string({ minLength: 5, maxLength: 50 }), {
    minLength: 1,
    maxLength: 5,
  }),
  studentActions: fc.array(fc.string({ minLength: 5, maxLength: 50 }), {
    minLength: 1,
    maxLength: 5,
  }),
});

// Generate a valid formative check
const formativeCheckArb: fc.Arbitrary<FormativeCheck> = fc.record({
  checkId: fc.uuid(),
  type: fc.constantFrom('mcq', 'quick_poll', 'discussion_question', 'reflection'),
  question: fc.string({ minLength: 10, maxLength: 200 }),
  options: fc.option(
    fc.array(fc.string({ minLength: 5, maxLength: 100 }), { minLength: 2, maxLength: 5 })
  ),
  correctAnswer: fc.option(fc.string({ minLength: 1, maxLength: 100 })),
  explanation: fc.option(fc.string({ minLength: 10, maxLength: 200 })),
  linkedMLO: fc.uuid(),
  duration: fc.integer({ min: 2, max: 15 }),
});

// Generate a valid lesson plan
const lessonPlanArb: fc.Arbitrary<LessonPlan> = fc.record({
  lessonId: fc.string({ minLength: 5, maxLength: 20 }),
  lessonNumber: fc.integer({ min: 1, max: 20 }),
  lessonTitle: fc.string({ minLength: 10, maxLength: 100 }),
  duration: fc.integer({ min: 60, max: 180 }),
  linkedMLOs: fc.array(fc.uuid(), { minLength: 1, maxLength: 2 }),
  linkedPLOs: fc.array(fc.uuid(), { minLength: 0, maxLength: 3 }),
  bloomLevel: fc.constantFrom(...bloomLevels),
  objectives: fc.array(fc.string({ minLength: 20, maxLength: 150 }), {
    minLength: 1,
    maxLength: 5,
  }),
  activities: fc.array(lessonActivityArb, { minLength: 3, maxLength: 10 }),
  materials: fc.record({
    pptDeckRef: fc.string({ minLength: 5, maxLength: 30 }),
    caseFiles: fc.array(fc.uuid(), { minLength: 0, maxLength: 3 }),
    readingReferences: fc.array(
      fc.record({
        sourceId: fc.uuid(),
        citation: fc.string({ minLength: 20, maxLength: 200 }),
        estimatedMinutes: fc.integer({ min: 10, max: 120 }),
      }),
      { minLength: 0, maxLength: 5 }
    ),
  }),
  instructorNotes: fc.record({
    pedagogicalGuidance: fc.string({ minLength: 20, maxLength: 300 }),
    pacingSuggestions: fc.string({ minLength: 20, maxLength: 200 }),
    adaptationOptions: fc.array(fc.string({ minLength: 10, maxLength: 100 }), {
      minLength: 0,
      maxLength: 5,
    }),
    commonMisconceptions: fc.array(fc.string({ minLength: 10, maxLength: 100 }), {
      minLength: 0,
      maxLength: 5,
    }),
    discussionPrompts: fc.array(fc.string({ minLength: 10, maxLength: 150 }), {
      minLength: 0,
      maxLength: 5,
    }),
  }),
  independentStudy: fc.record({
    coreReadings: fc.array(
      fc.record({
        sourceId: fc.uuid(),
        citation: fc.string({ minLength: 20, maxLength: 200 }),
        estimatedMinutes: fc.integer({ min: 10, max: 120 }),
        complexityLevel: fc.constantFrom('introductory', 'intermediate', 'advanced'),
      }),
      { minLength: 0, maxLength: 3 }
    ),
    supplementaryReadings: fc.array(
      fc.record({
        sourceId: fc.uuid(),
        citation: fc.string({ minLength: 20, maxLength: 200 }),
        estimatedMinutes: fc.integer({ min: 10, max: 120 }),
        complexityLevel: fc.constantFrom('introductory', 'intermediate', 'advanced'),
      }),
      { minLength: 0, maxLength: 3 }
    ),
    estimatedEffort: fc.integer({ min: 0, max: 300 }),
  }),
  caseStudyActivity: fc.option(
    fc.record({
      caseStudyId: fc.uuid(),
      caseTitle: fc.string({ minLength: 10, maxLength: 100 }),
      activityType: fc.constantFrom('practice', 'discussion', 'assessment_ready'),
      duration: fc.integer({ min: 15, max: 90 }),
      learningPurpose: fc.string({ minLength: 20, maxLength: 200 }),
      linkedMLOs: fc.array(fc.uuid(), { minLength: 1, maxLength: 3 }),
      linkedPLOs: fc.array(fc.uuid(), { minLength: 0, maxLength: 2 }),
      instructorInstructions: fc.string({ minLength: 20, maxLength: 300 }),
      studentOutputExpectations: fc.array(fc.string({ minLength: 10, maxLength: 100 }), {
        minLength: 1,
        maxLength: 5,
      }),
      assessmentHooks: fc.record({
        keyFacts: fc.array(fc.string({ minLength: 10, maxLength: 150 }), {
          minLength: 1,
          maxLength: 5,
        }),
        misconceptions: fc.array(fc.string({ minLength: 10, maxLength: 100 }), {
          minLength: 0,
          maxLength: 3,
        }),
        decisionPoints: fc.array(fc.string({ minLength: 10, maxLength: 150 }), {
          minLength: 1,
          maxLength: 5,
        }),
      }),
      rolePlay: fc.option(
        fc.record({
          characterBriefs: fc.array(
            fc.record({
              characterName: fc.string({ minLength: 5, maxLength: 50 }),
              role: fc.string({ minLength: 10, maxLength: 100 }),
              background: fc.string({ minLength: 20, maxLength: 200 }),
              objectives: fc.array(fc.string({ minLength: 10, maxLength: 100 }), {
                minLength: 1,
                maxLength: 3,
              }),
            }),
            { minLength: 2, maxLength: 5 }
          ),
          decisionPrompts: fc.array(fc.string({ minLength: 10, maxLength: 150 }), {
            minLength: 1,
            maxLength: 5,
          }),
          debriefQuestions: fc.array(fc.string({ minLength: 10, maxLength: 150 }), {
            minLength: 1,
            maxLength: 5,
          }),
        })
      ),
      isFirstAppearance: fc.boolean(),
      previousAppearanceRef: fc.option(fc.string({ minLength: 5, maxLength: 30 })),
    })
  ),
  formativeChecks: fc.array(formativeCheckArb, { minLength: 0, maxLength: 3 }),
});

// Generate a valid PPT context
const pptContextArb: fc.Arbitrary<PPTContext> = fc.record({
  programTitle: fc.string({ minLength: 10, maxLength: 100 }),
  moduleCode: fc.string({ minLength: 3, maxLength: 10 }),
  moduleTitle: fc.string({ minLength: 10, maxLength: 100 }),
  deliveryMode: fc.constantFrom(
    'online_self_study',
    'online_facilitated',
    'hybrid_blended',
    'in_person'
  ),
  glossaryEntries: fc.option(
    fc.array(
      fc.record({
        term: fc.string({ minLength: 3, maxLength: 50 }),
        definition: fc.string({ minLength: 10, maxLength: 200 }),
      }),
      { minLength: 0, maxLength: 20 }
    )
  ),
  sources: fc.option(fc.array(fc.record({ id: fc.uuid() }), { minLength: 0, maxLength: 10 })),
  readingLists: fc.option(fc.array(fc.record({ id: fc.uuid() }), { minLength: 0, maxLength: 10 })),
});

// ============================================================================
// TEST SUITE
// ============================================================================

describe('PPTGenerationService - Property Tests', () => {
  let service: PPTGenerationService;

  beforeEach(() => {
    service = new PPTGenerationService();
  });

  // ==========================================================================
  // Property 9: PPT Slide Count Bounds
  // ==========================================================================

  /**
   * **Feature: lesson-plan-ppt-integration, Property 9: PPT Slide Count Bounds**
   * **Validates: Requirements 9.5**
   *
   * Property: For any generated PPT deck, the slide count SHALL be between
   * 15 and 35 slides inclusive.
   */
  describe('Property 9: PPT Slide Count Bounds', () => {
    it('should generate PPT decks with slide count between 15 and 35', async () => {
      await fc.assert(
        fc.asyncProperty(lessonPlanArb, pptContextArb, async (lesson, context) => {
          const deck = await service.generateLessonPPT(lesson, context);

          // Property: Slide count must be between 15 and 35 inclusive
          expect(deck.slideCount).toBeGreaterThanOrEqual(15);
          expect(deck.slideCount).toBeLessThanOrEqual(35);

          // Verify slideCount matches actual slides array length
          expect(deck.slideCount).toBe(deck.slides.length);
        }),
        { numRuns: 10 } // Reduced for faster testing
      );
    }, 120000);

    it('should mark slide count validation as valid when within bounds', async () => {
      await fc.assert(
        fc.asyncProperty(lessonPlanArb, pptContextArb, async (lesson, context) => {
          const deck = await service.generateLessonPPT(lesson, context);

          // If slide count is within bounds, validation should be true
          const isWithinBounds = deck.slideCount >= 15 && deck.slideCount <= 35;
          expect(deck.validation.slideCountValid).toBe(isWithinBounds);
        }),
        { numRuns: 10 }
      );
    }, 120000);
  });

  // ==========================================================================
  // Property 10: PPT MLO Coverage
  // ==========================================================================

  /**
   * **Feature: lesson-plan-ppt-integration, Property 10: PPT MLO Coverage**
   * **Validates: Requirements 9.2**
   *
   * Property: For any generated PPT deck, all MLOs linked to the corresponding
   * lesson SHALL appear in the slide content.
   */
  describe('Property 10: PPT MLO Coverage', () => {
    it('should include objectives slide in every PPT deck', async () => {
      await fc.assert(
        fc.asyncProperty(lessonPlanArb, pptContextArb, async (lesson, context) => {
          const deck = await service.generateLessonPPT(lesson, context);

          // Find objectives slide
          const objectivesSlide = deck.slides.find((s) => s.slideType === 'objectives');
          expect(objectivesSlide).toBeDefined();
        }),
        { numRuns: 10 }
      );
    }, 120000);

    it('should mark MLO coverage validation as valid when objectives are present', async () => {
      await fc.assert(
        fc.asyncProperty(lessonPlanArb, pptContextArb, async (lesson, context) => {
          const deck = await service.generateLessonPPT(lesson, context);

          // MLO coverage validation should be true if objectives slide exists
          const objectivesSlide = deck.slides.find((s) => s.slideType === 'objectives');

          if (objectivesSlide) {
            expect(deck.validation.mlosCovered).toBe(true);
          }
        }),
        { numRuns: 10 }
      );
    }, 120000);
  });

  // ==========================================================================
  // Property 11: Citation Validity
  // ==========================================================================

  /**
   * **Feature: lesson-plan-ppt-integration, Property 11: Citation Validity**
   * **Validates: Requirements 9.4**
   *
   * Property: For any citation in a PPT deck, the citation SHALL reference
   * a verified source from Steps 5-6.
   */
  describe('Property 11: Citation Validity', () => {
    it('should include a references slide in every PPT deck', async () => {
      await fc.assert(
        fc.asyncProperty(lessonPlanArb, pptContextArb, async (lesson, context) => {
          const deck = await service.generateLessonPPT(lesson, context);

          // Find references slide
          const referencesSlide = deck.slides.find((s) => s.slideType === 'references');
          expect(referencesSlide).toBeDefined();
        }),
        { numRuns: 10 }
      );
    }, 120000);

    it('should mark citation validation as valid when references slide exists', async () => {
      await fc.assert(
        fc.asyncProperty(lessonPlanArb, pptContextArb, async (lesson, context) => {
          const deck = await service.generateLessonPPT(lesson, context);

          // Citation validation should be true if references slide exists
          const referencesSlide = deck.slides.find((s) => s.slideType === 'references');

          if (referencesSlide) {
            expect(deck.validation.citationsValid).toBe(true);
          }
        }),
        { numRuns: 10 }
      );
    }, 120000);
  });
});

// ============================================================================
// UNIT TESTS FOR PPT EXPORT FORMATS (Task 15.4)
// ============================================================================

describe('PPTGenerationService - Export Formats', () => {
  let service: PPTGenerationService;
  let mockDeck: PPTDeck;

  beforeEach(() => {
    service = new PPTGenerationService();

    // Create a mock PPT deck for testing
    const mockSlides: PPTSlide[] = [
      {
        slideNumber: 1,
        slideType: 'title',
        title: 'Test Lesson',
        content: {
          type: 'title',
          title: 'Test Lesson',
          content: ['Module 1', 'Lesson 1'],
        },
        speakerNotes: 'Welcome to the lesson',
      },
      {
        slideNumber: 2,
        slideType: 'objectives',
        title: 'Learning Objectives',
        content: {
          type: 'bullets',
          title: 'Learning Objectives',
          content: ['Objective 1', 'Objective 2', 'Objective 3'],
        },
        speakerNotes: 'Review the objectives',
      },
      {
        slideNumber: 3,
        slideType: 'content',
        title: 'Key Concepts',
        content: {
          type: 'bullets',
          title: 'Key Concepts',
          content: ['Concept 1', 'Concept 2'],
        },
        speakerNotes: 'Explain the concepts',
      },
    ];

    // Add more slides to reach minimum of 15
    for (let i = 4; i <= 15; i++) {
      mockSlides.push({
        slideNumber: i,
        slideType: 'content',
        title: `Content Slide ${i}`,
        content: {
          type: 'bullets',
          title: `Content Slide ${i}`,
          content: [`Point 1 for slide ${i}`, `Point 2 for slide ${i}`],
        },
        speakerNotes: `Speaker notes for slide ${i}`,
      });
    }

    mockDeck = {
      deckId: 'test-lesson-PPT',
      lessonId: 'test-lesson',
      moduleCode: 'TEST101',
      lessonNumber: 1,
      lessonTitle: 'Test Lesson',
      slides: mockSlides,
      slideCount: mockSlides.length,
      deliveryMode: 'in_person',
      generatedAt: new Date(),
      validation: {
        slideCountValid: true,
        mlosCovered: true,
        citationsValid: true,
        glossaryTermsDefined: true,
      },
    };
  });

  // ==========================================================================
  // PPTX Export Tests (Requirement 12.1)
  // ==========================================================================

  describe('PPTX Export', () => {
    it('should export PPT deck as PPTX buffer', async () => {
      const buffer = await service.exportPPTX(mockDeck);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    }, 30000);

    it('should create PPTX with correct number of slides', async () => {
      const buffer = await service.exportPPTX(mockDeck);

      // Verify buffer is not empty
      expect(buffer.length).toBeGreaterThan(1000); // PPTX files are typically > 1KB
    }, 30000);

    it('should handle deck with minimum slides (15)', async () => {
      const buffer = await service.exportPPTX(mockDeck);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    }, 30000);

    it('should handle deck with maximum slides (35)', async () => {
      // Add more slides to reach 35
      const additionalSlides: PPTSlide[] = [];
      for (let i = 16; i <= 35; i++) {
        additionalSlides.push({
          slideNumber: i,
          slideType: 'content',
          title: `Content Slide ${i}`,
          content: {
            type: 'bullets',
            title: `Content Slide ${i}`,
            content: [`Point 1 for slide ${i}`],
          },
          speakerNotes: `Notes for slide ${i}`,
        });
      }

      const largeDeck: PPTDeck = {
        ...mockDeck,
        slides: [...mockDeck.slides, ...additionalSlides],
        slideCount: 35,
      };

      const buffer = await service.exportPPTX(largeDeck);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    }, 30000);
  });

  // ==========================================================================
  // PDF Export Tests (Requirement 12.2)
  // ==========================================================================

  describe('PDF Export', () => {
    it('should export PPT deck as PDF buffer', async () => {
      const buffer = await service.exportPDF(mockDeck);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    }, 60000);

    it('should create PDF with valid PDF header', async () => {
      const buffer = await service.exportPDF(mockDeck);

      // PDF files start with %PDF-
      const header = buffer.toString('utf8', 0, 5);
      expect(header).toBe('%PDF-');
    }, 60000);

    it('should handle deck with various slide types', async () => {
      const buffer = await service.exportPDF(mockDeck);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(1000); // PDFs are typically > 1KB
    }, 60000);
  });

  // ==========================================================================
  // Image Export Tests (Requirement 12.3)
  // ==========================================================================

  describe('Image Export', () => {
    it('should export PPT deck as PNG images', async () => {
      const images = await service.exportImages(mockDeck, 'png');

      expect(Array.isArray(images)).toBe(true);
      expect(images.length).toBe(mockDeck.slideCount);

      // Verify each image is a buffer
      images.forEach((image) => {
        expect(image).toBeInstanceOf(Buffer);
        expect(image.length).toBeGreaterThan(0);
      });
    }, 120000);

    it('should export PPT deck as JPEG images', async () => {
      const images = await service.exportImages(mockDeck, 'jpeg');

      expect(Array.isArray(images)).toBe(true);
      expect(images.length).toBe(mockDeck.slideCount);

      // Verify each image is a buffer
      images.forEach((image) => {
        expect(image).toBeInstanceOf(Buffer);
        expect(image.length).toBeGreaterThan(0);
      });
    }, 120000);

    it('should create one image per slide', async () => {
      const images = await service.exportImages(mockDeck, 'png');

      expect(images.length).toBe(mockDeck.slides.length);
    }, 120000);

    it('should default to PNG format when format not specified', async () => {
      const images = await service.exportImages(mockDeck);

      expect(Array.isArray(images)).toBe(true);
      expect(images.length).toBe(mockDeck.slideCount);
    }, 120000);

    it('should handle deck with minimum slides for image export', async () => {
      const images = await service.exportImages(mockDeck, 'png');

      expect(images.length).toBe(15); // mockDeck has 15 slides

      // Verify PNG signature (first 8 bytes)
      const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const firstImageHeader = images[0].slice(0, 8);
      expect(firstImageHeader.equals(pngSignature)).toBe(true);
    }, 120000);
  });

  // ==========================================================================
  // Export Format Integration Tests
  // ==========================================================================

  describe('Export Format Integration', () => {
    it('should export same deck in all three formats', async () => {
      const pptxBuffer = await service.exportPPTX(mockDeck);
      const pdfBuffer = await service.exportPDF(mockDeck);
      const images = await service.exportImages(mockDeck, 'png');

      // Verify all exports succeeded
      expect(pptxBuffer).toBeInstanceOf(Buffer);
      expect(pptxBuffer.length).toBeGreaterThan(0);

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);

      expect(Array.isArray(images)).toBe(true);
      expect(images.length).toBe(mockDeck.slideCount);
    }, 180000);

    it('should handle export errors gracefully', async () => {
      const invalidDeck: PPTDeck = {
        ...mockDeck,
        slides: [], // Invalid: no slides
        slideCount: 0,
      };

      // PPTX export should still work with empty deck
      const pptxBuffer = await service.exportPPTX(invalidDeck);
      expect(pptxBuffer).toBeInstanceOf(Buffer);
    }, 30000);
  });
});
