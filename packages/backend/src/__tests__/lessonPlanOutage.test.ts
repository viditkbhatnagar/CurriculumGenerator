/**
 * What happens to a lesson plan when the AI call fails.
 *
 * On 21 Sep 2026 the production OpenAI key stopped working. Seventeen modules were regenerated
 * and all 510 lessons saved with no objectives and no activities, while every queue job reported
 * 100% and zero failures. Three things had to go wrong together, and each is pinned here.
 */

import { LessonPlanService, isAiUnavailable, MLO, ModuleData } from '../services/lessonPlanService';

describe('an AI failure must not silently produce an empty lesson', () => {
  describe('isAiUnavailable', () => {
    it('treats a rejected key as an outage, not a hiccup', () => {
      expect(isAiUnavailable({ status: 401, code: 'invalid_api_key' })).toBe(true);
      expect(isAiUnavailable(new Error('Incorrect API key provided: sk-proj-***'))).toBe(true);
      expect(isAiUnavailable({ status: 403 })).toBe(true);
    });

    it('treats exhausted credit as an outage — every later call fails the same way', () => {
      expect(isAiUnavailable({ code: 'insufficient_quota' })).toBe(true);
      expect(isAiUnavailable(new Error('You exceeded your current quota'))).toBe(true);
    });

    it('leaves genuinely per-call failures to the fallback', () => {
      expect(isAiUnavailable(new Error('Request timed out'))).toBe(false);
      expect(isAiUnavailable(new Error('Unexpected token < in JSON'))).toBe(false);
      expect(isAiUnavailable({ status: 500 })).toBe(false);
      expect(isAiUnavailable({ status: 429, code: 'rate_limit_exceeded' })).toBe(false);
    });
  });

  describe('the fallback that never ran', () => {
    // `[] || fallback` is `[]`. Every fallback in generateLessonContent was written against a
    // generator that returns `[]` on failure, so none of them had ever executed.
    it('an empty array does not fall through with ||', () => {
      const aiReturnedNothing: string[] = [];
      expect(aiReturnedNothing || ['fallback']).toEqual([]);
      expect(aiReturnedNothing.length ? aiReturnedNothing : ['fallback']).toEqual(['fallback']);
    });

    it('builds objectives from the module outcomes when the AI returns none', async () => {
      const service = new LessonPlanService();
      const mlos: MLO[] = [
        {
          id: 'M06-LO4',
          statement: 'Calculate interest and annuity payments',
          bloomLevel: 'apply',
        } as MLO,
      ];
      const module = {
        id: 'mod-m06',
        moduleCode: 'M06',
        title: 'Business Mathematics',
        contactHours: 45,
        mlos,
      } as unknown as ModuleData;

      // Force the AI path to fail the way a parse error does — recoverable, so it must degrade
      // to real content rather than to nothing.
      jest.spyOn(service as never, 'generateAIEnhancedContent' as never).mockResolvedValue({
        objectives: [],
        activities: [],
        pedagogicalGuidance: '',
        pacingSuggestions: '',
        adaptationOptions: [],
        commonMisconceptions: [],
        discussionPrompts: [],
      } as never);

      const block = {
        lessonNumber: 1,
        duration: 90,
        bloomLevel: 'apply',
        assignedMLOs: mlos,
        totalLessonsInModule: 1,
      } as never;

      const lesson = await service.generateLessonContent(block, module, {
        deliveryMode: 'blended',
        caseStudies: [],
        formativeAssessments: [],
        moduleReadingLists: [],
        programOverview: {},
        plos: [],
        kscs: [],
        modules: [module],
      } as never);

      expect(lesson.objectives.length).toBeGreaterThan(0);
      expect(lesson.activities.length).toBeGreaterThan(0);
      expect(lesson.instructorNotes.pacingSuggestions).not.toContain('Infinity');
    });
  });
});
