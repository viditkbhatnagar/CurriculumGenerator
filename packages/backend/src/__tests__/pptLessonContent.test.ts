/**
 * Slides teach the lesson's content, from the fields lessons actually store, and a download
 * serves the AI-written deck for each lesson rather than an outline of the lesson plan
 * (Dr Sherin, 12 October 2026).
 */
import {
  activitiesForSlides,
  caseForSlides,
  storedDeckFor,
  topicForSlides,
} from '../services/pptLessonContent';

const lesson = {
  lessonId: 'M01-L5',
  lessonTitle: 'Decision rights and approval pathways',
  topicCoverage: { exactTopic: 'Decision rights', subtopics: ['RAPID', 'Delegation of Authority'] },
  activities: [
    { sequenceOrder: 2, type: 'demonstration', title: 'Delay decomposition', duration: 10 },
    {
      sequenceOrder: 1,
      type: 'mini_lecture',
      title: 'Decision rights and queues',
      duration: 20,
      description: 'Links structure to decision rights.',
    },
  ],
  caseStudyActivity: {
    caseTitle: 'Al Noor Trading',
    learningPurpose: 'Spot approval delays',
    assessmentHooks: { keyFacts: ['5 approvals'], decisionPoints: ['Which to remove'] },
  },
};

describe('what the slide writer is given', () => {
  it('lists the activities in order, with what each covers', () => {
    expect(activitiesForSlides(lesson)).toBe(
      '- mini_lecture: Decision rights and queues (20 min)\n  Links structure to decision rights.\n' +
        '- demonstration: Delay decomposition (10 min)'
    );
  });

  it('gives the topic and its subtopics', () => {
    expect(topicForSlides(lesson)).toBe(
      'Decision rights\nSubtopics: RAPID; Delegation of Authority'
    );
  });

  it('reads the case from the fields lessons store', () => {
    expect(caseForSlides(lesson)).toContain('Title: Al Noor Trading');
    expect(caseForSlides(lesson)).toContain('Decision points: Which to remove');
    expect(caseForSlides({})).toBe('No case study for this lesson');
  });
});

describe('which deck a download serves', () => {
  const full = { lessonId: 'M01-L5', lessonTitle: lesson.lessonTitle, slides: [{ content: {} }] };

  it('serves the stored deck for the same lesson', () => {
    expect(storedDeckFor(lesson, [full])).toBe(full);
  });

  it('falls back when the lesson was renamed, or the slides were not restored', () => {
    expect(storedDeckFor(lesson, [{ ...full, lessonTitle: 'Old title' }])).toBeUndefined();
    expect(storedDeckFor(lesson, [{ ...full, slides: [{}] }])).toBeUndefined();
    expect(storedDeckFor(lesson, [{ ...full, lessonId: 'M01-L6' }])).toBeUndefined();
  });
});
