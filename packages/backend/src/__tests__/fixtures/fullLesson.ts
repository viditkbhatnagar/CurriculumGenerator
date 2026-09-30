/**
 * A lesson with every field of `LessonPlan` (models/CurriculumWorkflow.ts) filled in, for the
 * faculty guide's coverage test.
 *
 * A string written as '@' becomes a marker naming its own path, «instructorNotes.pacingSuggestions»,
 * so a field the guide fails to print is reported by name. Numbers are distinct primes above ten,
 * so each can be found in the document without matching a heading number or another field.
 *
 * When a field is added to `LessonPlan`, add it here: the coverage test then decides whether the
 * guide prints it or must say why it does not.
 */
const skeleton = {
  lessonId: '@',
  lessonNumber: 89,
  lessonTitle: '@',
  duration: 97,
  linkedMLOs: ['@'],
  linkedPLOs: ['@'],
  linkedKSCs: ['@'],
  bloomLevel: '@',
  objectives: ['@', '@'],
  activities: [
    {
      activityId: '@',
      sequenceOrder: 1,
      type: 'mini_lecture',
      involvesAI: false,
      title: '@',
      description: '@',
      duration: 11,
      teachingMethod: '@',
      resources: ['@'],
      instructorActions: ['@'],
      studentActions: ['@'],
    },
    {
      activityId: '@',
      sequenceOrder: 2,
      type: 'discussion',
      involvesAI: true,
      title: '@',
      description: '@',
      duration: 13,
      teachingMethod: '@',
      resources: ['@'],
      instructorActions: ['@'],
      studentActions: ['@', '@'],
    },
    {
      activityId: '@',
      sequenceOrder: 3,
      type: 'assessment',
      involvesAI: false,
      title: '@',
      description: '@',
      duration: 17,
      teachingMethod: '@',
      resources: ['@'],
      instructorActions: ['@'],
      studentActions: ['@'],
    },
  ],
  materials: {
    pptDeckRef: '@',
    caseFiles: ['@'],
    readingReferences: [{ sourceId: '@', citation: '@', estimatedMinutes: 29 }],
  },
  instructorNotes: {
    pedagogicalGuidance: '@',
    pacingSuggestions: '@',
    adaptationOptions: ['@'],
    commonMisconceptions: ['@'],
    discussionPrompts: ['@'],
  },
  independentStudy: {
    coreReadings: [{ sourceId: '@', citation: '@', estimatedMinutes: 31, complexityLevel: '@' }],
    supplementaryReadings: [
      { sourceId: '@', citation: '@', estimatedMinutes: 37, complexityLevel: '@' },
    ],
    estimatedEffort: 41,
  },
  caseStudyActivity: {
    caseStudyId: '@',
    caseTitle: '@',
    activityType: 'practice',
    duration: 23,
    learningPurpose: '@',
    linkedMLOs: ['@'],
    linkedPLOs: ['@'],
    instructorInstructions: '@',
    studentOutputExpectations: ['@'],
    assessmentHooks: { keyFacts: ['@'], misconceptions: ['@'], decisionPoints: ['@'] },
    rolePlay: {
      characterBriefs: [{ characterName: '@', role: '@', background: '@', objectives: ['@'] }],
      decisionPrompts: ['@'],
      debriefQuestions: ['@'],
    },
    isFirstAppearance: true,
    previousAppearanceRef: '@',
  },
  topicCoverage: {
    exactTopic: '@',
    subtopics: ['@'],
    practicalActivity: '@',
    studentEvidence: '@',
  },
  independentActivity: {
    sourceMaterialMapping: '@',
    independentTask: '@',
    aiPlatformSupport: '@',
    studentEvidence: '@',
  },
  formativeChecks: [
    {
      checkId: '@',
      type: 'mcq',
      question: '@',
      options: ['@', '@'],
      correctAnswer: '@',
      explanation: '@',
      linkedMLO: '@',
      duration: 19,
    },
  ],
};

function withMarkers(value: unknown, path = ''): unknown {
  if (value === '@') return `«${path}»`;
  if (Array.isArray(value)) return value.map((v, i) => withMarkers(v, `${path}[${i}]`));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, withMarkers(v, path ? `${path}.${k}` : k)])
    );
  }
  return value;
}

export const fullLesson = withMarkers(skeleton);
