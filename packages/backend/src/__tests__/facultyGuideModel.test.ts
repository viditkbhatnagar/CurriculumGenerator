import { guideModule, guideSession, sentences } from '../services/facultyGuide/facultyGuideModel';

const context = {
  mloStatements: { 'M01-LO1': 'Explain the functions of management.' },
  glossary: {
    'service blueprint': 'A diagram of a service across customer and back-office layers.',
  },
  caseTitles: { 'case-1': 'FoodNow refunds' },
};

// Shaped like a stored BBA lesson (M01, lesson 4).
const lesson = {
  lessonNumber: 4,
  lessonTitle:
    'Service blueprinting of exception handling and artefact-mediated handoffs in a platform-based',
  duration: 90,
  linkedMLOs: ['M01-LO1'],
  linkedPLOs: ['PLO8'],
  objectives: ['Label the four layers of a service blueprint.'],
  topicCoverage: {
    exactTopic: 'Service blueprinting of exception handling in a platform-based refund process',
    subtopics: ['Service blueprint', 'Artefact-mediated handoffs'],
    studentEvidence: 'Annotated blueprint with labelled handoffs.',
  },
  activities: [
    {
      sequenceOrder: 2,
      type: 'mini_lecture',
      title: 'Mini-lecture',
      duration: 12,
      instructorActions: ['Define blueprint layers.'],
    },
    {
      sequenceOrder: 1,
      type: 'assessment',
      title: 'Retrieval warm-up',
      duration: 10,
      instructorActions: ['Launch the poll.'],
      resources: ['Polling tool'],
    },
    { sequenceOrder: 3, type: 'assessment', title: 'Exit ticket', duration: 5 },
  ],
  instructorNotes: {
    pedagogicalGuidance: 'Position this as a new lens. Emphasise explanation over redesign.',
    discussionPrompts: ['Where does the line of visibility change handoff design?'],
    commonMisconceptions: ['A blueprint is the same as a process map.'],
    adaptationOptions: ['Provide a partially completed template.'],
  },
  formativeChecks: [{ type: 'mcq', question: 'Classify the handoffs.' }],
  materials: {
    caseFiles: ['case-1'],
    readingReferences: [{ citation: 'CIPD. (2024). Culture factsheet.' }],
  },
  independentStudy: { coreReadings: [{ citation: 'CIPD. (2024). Culture factsheet.' }] },
  independentActivity: {
    independentTask: 'Blueprint a service exception.',
    aiPlatformSupport: 'Submit your AI prompt.',
  },
};

describe('guideSession', () => {
  const s = guideSession(lesson, 3, context, 'Process mapping basics');

  it('uses the full topic, not the truncated lesson title', () => {
    expect(s.topic).toBe(
      'Service blueprinting of exception handling in a platform-based refund process'
    );
  });

  it('keeps the alignment to ids, check types and one reference', () => {
    expect(s.alignment).toEqual({
      mlos: ['M01-LO1'],
      plos: ['PLO8'],
      assessment: ['Quiz'],
      reference: 'CIPD. (2024). Culture factsheet.',
    });
  });

  it('keeps teaching guidance to the framing, one sentence per bullet', () => {
    expect(s.teachingGuidance).toEqual([
      'Position this as a new lens.',
      'Emphasise explanation over redesign.',
    ]);
  });

  it('orders activities, labels the opening and wrap-up, and puts instructor actions under them', () => {
    expect(s.activities.map((a) => a.label)).toEqual(['Opening', 'Mini-lecture', 'Wrap-up']);
    expect(s.activities[0].steps).toEqual(['Launch the poll.']);
    expect(s.activities[1].steps).toEqual(['Define blueprint layers.']);
  });

  it('defines a key concept only from the glossary', () => {
    expect(s.keyConcepts).toEqual([
      {
        name: 'Service blueprint',
        definition: 'A diagram of a service across customer and back-office layers.',
      },
      { name: 'Artefact-mediated handoffs' },
    ]);
  });

  it('carries prompts, checks, resources and takeaways across', () => {
    expect(s.prompts.ask).toHaveLength(1);
    expect(s.prompts.watchFor).toEqual(['A blueprint is the same as a process map.']);
    expect(s.checks).toEqual([
      'Quiz: Classify the handoffs.',
      'Evidence of learning: Annotated blueprint with labelled handoffs.',
    ]);
    expect(s.resources.cases).toEqual(['FoodNow refunds']);
    expect(s.resources.readings).toEqual(['CIPD. (2024). Culture factsheet.']);
    expect(s.takeaways).toEqual(['Label the four layers of a service blueprint.']);
    expect(s.focus.whyItMatters).toEqual(['M01-LO1: Explain the functions of management.']);
    expect(s.focus.connectionToPrevious).toBe(
      'Builds on the previous session: Process mapping basics'
    );
  });

  it('leaves sections empty rather than inventing content', () => {
    const bare = guideSession({ lessonTitle: 'Bare lesson' }, 0, context);
    expect(bare.teachingGuidance).toEqual([]);
    expect(bare.keyConcepts).toEqual([]);
    expect(bare.checks).toEqual([]);
  });
});

describe('guideModule', () => {
  it('orders sessions and states the minimum requirements from the module outcomes', () => {
    const m = guideModule(
      {
        code: 'M01',
        title: 'Introduction to Management',
        mlos: [{ id: 'M01-LO1', statement: 'Explain the functions of management.' }],
      },
      [
        { ...lesson, lessonNumber: 5 },
        { ...lesson, lessonNumber: 4 },
      ],
      context
    );
    expect(m.sessions.map((s) => s.number)).toEqual([4, 5]);
    expect(m.minimumRequirements).toEqual(['M01-LO1: Explain the functions of management.']);
    expect(m.sessions[1].focus.connectionToPrevious).toMatch(/^Builds on the previous session/);
  });
});

describe('sentences', () => {
  it('splits a paragraph into sentences', () => {
    expect(sentences('One thing. Two things! "Three" things?')).toEqual([
      'One thing.',
      'Two things!',
      '"Three" things?',
    ]);
  });
});
