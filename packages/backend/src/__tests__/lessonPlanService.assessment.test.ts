/**
 * Unit Tests for LessonPlanService - Assessment Integration
 *
 * Tests the formative assessment integration functionality
 * Requirements: 4.1, 4.2, 4.3
 */

import { LessonPlanService, MLO, ModuleData } from '../services/lessonPlanService';
import { LessonPlan, FormativeCheck } from '../models/CurriculumWorkflow';

describe('LessonPlanService - Assessment Integration', () => {
  let service: LessonPlanService;

  beforeEach(() => {
    service = new LessonPlanService();
  });

  // Helper function to create a mock lesson plan
  const createMockLesson = (lessonId: string, linkedMLOs: string[]): LessonPlan => ({
    lessonId,
    lessonNumber: 1,
    lessonTitle: 'Test Lesson',
    duration: 90,
    linkedMLOs,
    linkedPLOs: [],
    bloomLevel: 'understand',
    objectives: ['Test objective'],
    activities: [],
    materials: {
      pptDeckRef: 'test-ppt',
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
  });

  // ==========================================================================
  // Requirement 4.1: Pull formative assessments from Step 7
  // ==========================================================================

  describe('Requirement 4.1: Pull formative assessments from Step 7', () => {
    it('should filter assessments by module ID', () => {
      const lessons = [createMockLesson('L1', ['mlo-1'])];
      const assessments = [
        { id: 'a1', moduleId: 'module-1', alignedMLOs: ['mlo-1'], assessmentType: 'mcq' },
        { id: 'a2', moduleId: 'module-2', alignedMLOs: ['mlo-1'], assessmentType: 'mcq' },
        { id: 'a3', moduleId: 'module-1', alignedMLOs: ['mlo-2'], assessmentType: 'mcq' },
      ];

      const result = service.integrateAssessments(lessons, assessments, 'module-1');

      // Should only use assessments from module-1
      const allCheckIds = result.flatMap((l) => l.formativeChecks.map((fc) => fc.checkId));
      expect(allCheckIds).toContain('a1');
      expect(allCheckIds).not.toContain('a2'); // Different module
    });

    it('should return lessons unchanged when no assessments exist for module', () => {
      const lessons = [createMockLesson('L1', ['mlo-1'])];
      const assessments = [
        { id: 'a1', moduleId: 'module-2', alignedMLOs: ['mlo-1'], assessmentType: 'mcq' },
      ];

      const result = service.integrateAssessments(lessons, assessments, 'module-1');

      expect(result).toEqual(lessons);
      expect(result[0].formativeChecks).toEqual([]);
    });

    it('should handle empty assessment array', () => {
      const lessons = [createMockLesson('L1', ['mlo-1'])];
      const assessments: any[] = [];

      const result = service.integrateAssessments(lessons, assessments, 'module-1');

      expect(result).toEqual(lessons);
    });
  });

  // ==========================================================================
  // Requirement 4.2: Align assessments with lesson MLOs
  // ==========================================================================

  describe('Requirement 4.2: Align assessments with lesson MLOs', () => {
    it('should match assessments to lessons based on MLO alignment', () => {
      const lessons = [
        createMockLesson('L1', ['mlo-1', 'mlo-2']),
        createMockLesson('L2', ['mlo-3']),
      ];
      const assessments = [
        {
          id: 'a1',
          moduleId: 'module-1',
          alignedMLOs: ['mlo-1'],
          assessmentType: 'mcq',
          question: 'Question 1',
        },
        {
          id: 'a2',
          moduleId: 'module-1',
          alignedMLOs: ['mlo-3'],
          assessmentType: 'mcq',
          question: 'Question 2',
        },
        {
          id: 'a3',
          moduleId: 'module-1',
          alignedMLOs: ['mlo-4'], // No matching lesson
          assessmentType: 'mcq',
          question: 'Question 3',
        },
      ];

      const result = service.integrateAssessments(lessons, assessments, 'module-1');

      // Lesson 1 should have assessment a1 (matches mlo-1)
      expect(result[0].formativeChecks.length).toBeGreaterThan(0);
      expect(result[0].formativeChecks.some((fc) => fc.checkId === 'a1')).toBe(true);

      // Lesson 2 should have assessment a2 (matches mlo-3)
      expect(result[1].formativeChecks.length).toBeGreaterThan(0);
      expect(result[1].formativeChecks.some((fc) => fc.checkId === 'a2')).toBe(true);

      // Assessment a3 should not appear (no matching MLO)
      const allCheckIds = result.flatMap((l) => l.formativeChecks.map((fc) => fc.checkId));
      expect(allCheckIds).not.toContain('a3');
    });

    it('should prioritize assessments with more MLO matches', () => {
      const lessons = [createMockLesson('L1', ['mlo-1', 'mlo-2', 'mlo-3'])];
      const assessments = [
        {
          id: 'a1',
          moduleId: 'module-1',
          alignedMLOs: ['mlo-1'], // 1 match
          assessmentType: 'mcq',
          question: 'Question 1',
        },
        {
          id: 'a2',
          moduleId: 'module-1',
          alignedMLOs: ['mlo-1', 'mlo-2'], // 2 matches
          assessmentType: 'mcq',
          question: 'Question 2',
        },
        {
          id: 'a3',
          moduleId: 'module-1',
          alignedMLOs: ['mlo-1', 'mlo-2', 'mlo-3'], // 3 matches
          assessmentType: 'mcq',
          question: 'Question 3',
        },
        {
          id: 'a4',
          moduleId: 'module-1',
          alignedMLOs: ['mlo-2'], // 1 match
          assessmentType: 'mcq',
          question: 'Question 4',
        },
      ];

      const result = service.integrateAssessments(lessons, assessments, 'module-1');

      // Should include top 3 assessments by match score
      expect(result[0].formativeChecks.length).toBe(3);

      // Best matches should be included (a3, a2, and either a1 or a4)
      const checkIds = result[0].formativeChecks.map((fc) => fc.checkId);
      expect(checkIds).toContain('a3'); // 3 matches
      expect(checkIds).toContain('a2'); // 2 matches
    });

    it('should handle assessments with mloIds field (alternative field name)', () => {
      const lessons = [createMockLesson('L1', ['mlo-1'])];
      const assessments = [
        {
          id: 'a1',
          moduleId: 'module-1',
          mloIds: ['mlo-1'], // Using mloIds instead of alignedMLOs
          assessmentType: 'mcq',
          question: 'Question 1',
        },
      ];

      const result = service.integrateAssessments(lessons, assessments, 'module-1');

      expect(result[0].formativeChecks.length).toBe(1);
      expect(result[0].formativeChecks[0].checkId).toBe('a1');
    });

    it('should limit to 3 assessments per lesson', () => {
      const lessons = [createMockLesson('L1', ['mlo-1'])];
      const assessments = Array.from({ length: 10 }, (_, i) => ({
        id: `a${i + 1}`,
        moduleId: 'module-1',
        alignedMLOs: ['mlo-1'],
        assessmentType: 'mcq',
        question: `Question ${i + 1}`,
      }));

      const result = service.integrateAssessments(lessons, assessments, 'module-1');

      // Should have exactly 3 formative checks
      expect(result[0].formativeChecks.length).toBe(3);
    });
  });

  // ==========================================================================
  // Requirement 4.3: Include assessment type and duration
  // ==========================================================================

  describe('Requirement 4.3: Include assessment type and duration', () => {
    it('should map assessment types correctly', () => {
      const lessons = [createMockLesson('L1', ['mlo-1'])];
      const assessments = [
        {
          id: 'a1',
          moduleId: 'module-1',
          alignedMLOs: ['mlo-1'],
          assessmentType: 'mcq',
          question: 'MCQ Question',
        },
        {
          id: 'a2',
          moduleId: 'module-1',
          alignedMLOs: ['mlo-1'],
          assessmentType: 'poll',
          question: 'Poll Question',
        },
        {
          id: 'a3',
          moduleId: 'module-1',
          alignedMLOs: ['mlo-1'],
          assessmentType: 'discussion',
          question: 'Discussion Question',
        },
      ];

      const result = service.integrateAssessments(lessons, assessments, 'module-1');

      const checks = result[0].formativeChecks;
      expect(checks.find((c) => c.checkId === 'a1')?.type).toBe('mcq');
      expect(checks.find((c) => c.checkId === 'a2')?.type).toBe('quick_poll');
      expect(checks.find((c) => c.checkId === 'a3')?.type).toBe('discussion_question');
    });

    it('should handle various assessment type formats', () => {
      const lessons = [createMockLesson('L1', ['mlo-1'])];
      const assessments = [
        {
          id: 'a1',
          moduleId: 'module-1',
          alignedMLOs: ['mlo-1'],
          assessmentType: 'multiple_choice',
          question: 'Question 1',
        },
        {
          id: 'a2',
          moduleId: 'module-1',
          alignedMLOs: ['mlo-1'],
          assessmentType: 'Multiple Choice',
          question: 'Question 2',
        },
        {
          id: 'a3',
          moduleId: 'module-1',
          alignedMLOs: ['mlo-1'],
          assessmentType: 'QUIZ',
          question: 'Question 3',
        },
      ];

      const result = service.integrateAssessments(lessons, assessments, 'module-1');

      // All should map to 'mcq'
      const checks = result[0].formativeChecks;
      expect(checks.every((c) => c.type === 'mcq')).toBe(true);
    });

    it('should use default type when assessment type is missing', () => {
      const lessons = [createMockLesson('L1', ['mlo-1'])];
      const assessments = [
        {
          id: 'a1',
          moduleId: 'module-1',
          alignedMLOs: ['mlo-1'],
          question: 'Question without type',
        },
      ];

      const result = service.integrateAssessments(lessons, assessments, 'module-1');

      expect(result[0].formativeChecks[0].type).toBe('mcq'); // Default type
    });

    it('should include duration for each assessment', () => {
      const lessons = [createMockLesson('L1', ['mlo-1'])];
      const assessments = [
        {
          id: 'a1',
          moduleId: 'module-1',
          alignedMLOs: ['mlo-1'],
          assessmentType: 'mcq',
          question: 'Question 1',
        },
      ];

      const result = service.integrateAssessments(lessons, assessments, 'module-1');

      expect(result[0].formativeChecks[0].duration).toBeDefined();
      expect(typeof result[0].formativeChecks[0].duration).toBe('number');
      expect(result[0].formativeChecks[0].duration).toBeGreaterThan(0);
    });

    it('should use explicit duration when provided', () => {
      const lessons = [createMockLesson('L1', ['mlo-1'])];
      const assessments = [
        {
          id: 'a1',
          moduleId: 'module-1',
          alignedMLOs: ['mlo-1'],
          assessmentType: 'mcq',
          question: 'Question 1',
          duration: 10,
        },
      ];

      const result = service.integrateAssessments(lessons, assessments, 'module-1');

      expect(result[0].formativeChecks[0].duration).toBe(10);
    });

    it('should calculate appropriate durations based on assessment type', () => {
      const lessons = [createMockLesson('L1', ['mlo-1'])];
      const assessments = [
        {
          id: 'a1',
          moduleId: 'module-1',
          alignedMLOs: ['mlo-1'],
          assessmentType: 'mcq',
          question: 'MCQ',
        },
        {
          id: 'a2',
          moduleId: 'module-1',
          alignedMLOs: ['mlo-1'],
          assessmentType: 'quick_poll',
          question: 'Poll',
        },
        {
          id: 'a3',
          moduleId: 'module-1',
          alignedMLOs: ['mlo-1'],
          assessmentType: 'discussion',
          question: 'Discussion',
        },
      ];

      const result = service.integrateAssessments(lessons, assessments, 'module-1');

      const checks = result[0].formativeChecks;
      const mcqDuration = checks.find((c) => c.checkId === 'a1')?.duration || 0;
      const pollDuration = checks.find((c) => c.checkId === 'a2')?.duration || 0;
      const discussionDuration = checks.find((c) => c.checkId === 'a3')?.duration || 0;

      // Discussion should take longer than MCQ, poll should be quickest
      expect(discussionDuration).toBeGreaterThan(mcqDuration);
      expect(pollDuration).toBeLessThanOrEqual(mcqDuration);
    });

    it('should clamp duration to reasonable bounds (1-15 minutes)', () => {
      const lessons = [createMockLesson('L1', ['mlo-1'])];
      const assessments = [
        {
          id: 'a1',
          moduleId: 'module-1',
          alignedMLOs: ['mlo-1'],
          assessmentType: 'mcq',
          question: 'Question 1',
          duration: 0, // Too low
        },
        {
          id: 'a2',
          moduleId: 'module-1',
          alignedMLOs: ['mlo-1'],
          assessmentType: 'mcq',
          question: 'Question 2',
          duration: 100, // Too high
        },
      ];

      const result = service.integrateAssessments(lessons, assessments, 'module-1');

      const checks = result[0].formativeChecks;
      expect(checks[0].duration).toBeGreaterThanOrEqual(1);
      expect(checks[0].duration).toBeLessThanOrEqual(15);
      expect(checks[1].duration).toBeGreaterThanOrEqual(1);
      expect(checks[1].duration).toBeLessThanOrEqual(15);
    });

    it('should include optional MCQ fields when available', () => {
      const lessons = [createMockLesson('L1', ['mlo-1'])];
      const assessments = [
        {
          id: 'a1',
          moduleId: 'module-1',
          alignedMLOs: ['mlo-1'],
          assessmentType: 'mcq',
          question: 'What is 2+2?',
          options: ['2', '3', '4', '5'],
          correctAnswer: '4',
          explanation: 'Basic arithmetic',
        },
      ];

      const result = service.integrateAssessments(lessons, assessments, 'module-1');

      const check = result[0].formativeChecks[0];
      expect(check.options).toEqual(['2', '3', '4', '5']);
      expect(check.correctAnswer).toBe('4');
      expect(check.explanation).toBe('Basic arithmetic');
    });

    it('should extract question text from various fields', () => {
      const lessons = [createMockLesson('L1', ['mlo-1'])];
      const assessments = [
        {
          id: 'a1',
          moduleId: 'module-1',
          alignedMLOs: ['mlo-1'],
          assessmentType: 'mcq',
          question: 'Question field',
        },
        {
          id: 'a2',
          moduleId: 'module-1',
          alignedMLOs: ['mlo-1'],
          assessmentType: 'mcq',
          questionText: 'QuestionText field',
        },
        {
          id: 'a3',
          moduleId: 'module-1',
          alignedMLOs: ['mlo-1'],
          assessmentType: 'mcq',
          prompt: 'Prompt field',
        },
      ];

      const result = service.integrateAssessments(lessons, assessments, 'module-1');

      const checks = result[0].formativeChecks;
      expect(checks.find((c) => c.checkId === 'a1')?.question).toBe('Question field');
      expect(checks.find((c) => c.checkId === 'a2')?.question).toBe('QuestionText field');
      expect(checks.find((c) => c.checkId === 'a3')?.question).toBe('Prompt field');
    });

    it('should link assessment to best matching MLO', () => {
      const lessons = [createMockLesson('L1', ['mlo-1', 'mlo-2'])];
      const assessments = [
        {
          id: 'a1',
          moduleId: 'module-1',
          alignedMLOs: ['mlo-2', 'mlo-3'], // mlo-2 matches lesson
          assessmentType: 'mcq',
          question: 'Question 1',
        },
      ];

      const result = service.integrateAssessments(lessons, assessments, 'module-1');

      expect(result[0].formativeChecks[0].linkedMLO).toBe('mlo-2');
    });
  });

  // ==========================================================================
  // Integration Tests
  // ==========================================================================

  describe('Integration Tests', () => {
    it('should handle complete assessment integration workflow', () => {
      const lessons = [
        createMockLesson('L1', ['mlo-1', 'mlo-2']),
        createMockLesson('L2', ['mlo-3']),
      ];
      const assessments = [
        {
          id: 'a1',
          moduleId: 'module-1',
          alignedMLOs: ['mlo-1'],
          assessmentType: 'mcq',
          question: 'MCQ for MLO 1',
          options: ['A', 'B', 'C'],
          correctAnswer: 'B',
          duration: 5,
        },
        {
          id: 'a2',
          moduleId: 'module-1',
          alignedMLOs: ['mlo-2'],
          assessmentType: 'discussion',
          question: 'Discussion for MLO 2',
          duration: 10,
        },
        {
          id: 'a3',
          moduleId: 'module-1',
          alignedMLOs: ['mlo-3'],
          assessmentType: 'quick_poll',
          question: 'Poll for MLO 3',
          duration: 2,
        },
      ];

      const result = service.integrateAssessments(lessons, assessments, 'module-1');

      // Verify lesson 1 has 2 assessments
      expect(result[0].formativeChecks.length).toBe(2);
      expect(result[0].formativeChecks.some((fc) => fc.checkId === 'a1')).toBe(true);
      expect(result[0].formativeChecks.some((fc) => fc.checkId === 'a2')).toBe(true);

      // Verify lesson 2 has 1 assessment
      expect(result[1].formativeChecks.length).toBe(1);
      expect(result[1].formativeChecks[0].checkId).toBe('a3');

      // Verify all required fields are present
      for (const lesson of result) {
        for (const check of lesson.formativeChecks) {
          expect(check.checkId).toBeDefined();
          expect(check.type).toBeDefined();
          expect(check.question).toBeDefined();
          expect(check.linkedMLO).toBeDefined();
          expect(check.duration).toBeGreaterThan(0);
        }
      }
    });

    it('should preserve existing lesson data when integrating assessments', () => {
      const originalLesson = createMockLesson('L1', ['mlo-1']);
      originalLesson.objectives = ['Original objective'];
      originalLesson.activities = [
        {
          activityId: 'act-1',
          sequenceOrder: 1,
          type: 'mini_lecture',
          title: 'Original activity',
          description: 'Description',
          duration: 30,
          teachingMethod: 'lecture',
          resources: [],
          instructorActions: [],
          studentActions: [],
        },
      ];

      const lessons = [originalLesson];
      const assessments = [
        {
          id: 'a1',
          moduleId: 'module-1',
          alignedMLOs: ['mlo-1'],
          assessmentType: 'mcq',
          question: 'Question 1',
        },
      ];

      const result = service.integrateAssessments(lessons, assessments, 'module-1');

      // Original data should be preserved
      expect(result[0].lessonId).toBe('L1');
      expect(result[0].objectives).toEqual(['Original objective']);
      expect(result[0].activities.length).toBe(1);
      expect(result[0].activities[0].title).toBe('Original activity');

      // New formative checks should be added
      expect(result[0].formativeChecks.length).toBe(1);
      expect(result[0].formativeChecks[0].checkId).toBe('a1');
    });
  });
});
