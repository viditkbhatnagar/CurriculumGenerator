import mammoth from 'mammoth';
import {
  GuideContext,
  GuideModule,
  guideContextFromWorkflow,
  guideModule,
  guideSession,
  incompleteNote,
  sentences,
} from '../services/facultyGuide/facultyGuideModel';
import { facultyGuideBuffer } from '../services/facultyGuide/facultyGuideDocx';
import { fullLesson } from './fixtures/fullLesson';

const context: GuideContext = {
  mloStatements: new Map([['M01-LO1', 'Explain the functions of management.']]),
  glossary: new Map([
    ['service blueprint', 'A diagram of a service across customer and back-office layers.'],
  ]),
  caseTitles: new Map([['case-1', 'FoodNow refunds']]),
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
  formativeChecks: [
    {
      type: 'mcq',
      question: 'Which layer is invisible to the customer?',
      options: ['Frontstage', 'Backstage', 'Physical evidence'],
      correctAnswer: 'Backstage',
      explanation: 'Backstage actions sit below the line of visibility.',
      linkedMLO: 'M01-LO1',
      duration: 3,
    },
  ],
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
      assessment: ['Multiple-choice question'],
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

  it('carries prompts, resources and takeaways across', () => {
    expect(s.prompts.ask).toHaveLength(1);
    expect(s.prompts.watchFor).toEqual(['A blueprint is the same as a process map.']);
    expect(s.evidenceOfLearning).toBe('Annotated blueprint with labelled handoffs.');
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
    expect(bare.pacing).toEqual([]);
    expect(bare.keyConcepts).toEqual([]);
    expect(bare.checks).toEqual([]);
    expect(bare.caseActivity).toBeUndefined();
  });
});

describe('content the first version dropped', () => {
  it('keeps a multiple-choice check with its options, answer, explanation and outcome', () => {
    const [check] = guideSession(lesson, 0, context).checks;

    expect(check).toEqual({
      label: 'Multiple-choice question',
      question: 'Which layer is invisible to the customer?',
      minutes: 3,
      mlo: 'M01-LO1',
      options: ['Frontstage', 'Backstage', 'Physical evidence'],
      correctAnswer: 'Backstage',
      explanation: 'Backstage actions sit below the line of visibility.',
    });
  });

  it('does not print the placeholder outcome the generator records for an unlinked check', () => {
    const s = guideSession(
      {
        formativeChecks: [
          { type: 'reflection', question: 'What changed?', linkedMLO: 'unknown-mlo' },
        ],
      },
      0,
      context
    );

    expect(s.checks[0].mlo).toBeUndefined();
  });

  it('keeps the case-study activity with its instructions, outputs, hooks and role play', () => {
    const s = guideSession(
      {
        caseStudyActivity: {
          caseStudyId: 'case-1',
          caseTitle: 'FoodNow refunds',
          activityType: 'discussion',
          duration: 40,
          learningPurpose: 'Apply concepts to a real refund process.',
          instructorInstructions: 'Introduce the case. Use Dr. Patel’s prompts. Debrief.',
          studentOutputExpectations: ['A one-page blueprint'],
          assessmentHooks: {
            keyFacts: ['Refunds take 5 days'],
            misconceptions: ['Refunds are instant'],
            decisionPoints: ['Who approves an exception?'],
          },
          rolePlay: {
            characterBriefs: [
              {
                characterName: 'Amira',
                role: 'Operations manager',
                background: 'Ten years in logistics.',
                objectives: ['Cut refund delays'],
              },
            ],
            decisionPrompts: ['Do you refund first?'],
            debriefQuestions: ['What would you change?'],
          },
        },
      },
      0,
      context
    );

    expect(s.caseActivity).toEqual({
      title: 'FoodNow refunds',
      kind: 'Discussion',
      minutes: 40,
      purpose: 'Apply concepts to a real refund process.',
      instructions: ['Introduce the case.', 'Use Dr. Patel’s prompts.', 'Debrief.'],
      expectedOutputs: ['A one-page blueprint'],
      hooks: {
        keyFacts: ['Refunds take 5 days'],
        misconceptions: ['Refunds are instant'],
        decisionPoints: ['Who approves an exception?'],
      },
      rolePlay: {
        characters: [
          {
            name: 'Amira',
            role: 'Operations manager',
            background: 'Ten years in logistics.',
            objectives: ['Cut refund delays'],
          },
        ],
        decisionPrompts: ['Do you refund first?'],
        debriefQuestions: ['What would you change?'],
      },
    });
  });

  it('names a case activity from Step 8 when the activity carries only its id', () => {
    const s = guideSession(
      { caseStudyActivity: { caseStudyId: 'case-1', learningPurpose: 'Apply it.' } },
      0,
      context
    );

    expect(s.caseActivity?.title).toBe('FoodNow refunds');
  });

  it('keeps pacing suggestions and the practical activity', () => {
    const s = guideSession(
      {
        instructorNotes: { pacingSuggestions: 'Open in 5 minutes. Keep the lecture to 15.' },
        topicCoverage: { practicalActivity: 'Map a refund process as a group.' },
      },
      0,
      context
    );

    expect(s.pacing).toEqual(['Open in 5 minutes.', 'Keep the lecture to 15.']);
    expect(s.practicalActivity).toBe('Map a refund process as a group.');
  });

  it('keeps supplementary reading, study effort, source mapping and independent evidence', () => {
    const s = guideSession(
      {
        independentStudy: {
          supplementaryReadings: [
            { citation: 'Porter. (1985). Competitive advantage.', estimatedMinutes: 45 },
          ],
          estimatedEffort: 120,
        },
        independentActivity: {
          sourceMaterialMapping: 'Chapter 3 of the core text.',
          studentEvidence: 'A reflective log.',
        },
      },
      0,
      context
    );

    expect(s.resources.supplementaryReadings).toEqual([
      'Porter. (1985). Competitive advantage. (45 min)',
    ]);
    expect(s.resources.independentStudyMinutes).toBe(120);
    expect(s.resources.sourceMapping).toBe('Chapter 3 of the core text.');
    expect(s.resources.studentEvidence).toBe('A reflective log.');
  });

  it('keeps an activity’s description, method, AI use and student actions beside its steps', () => {
    const s = guideSession(
      {
        activities: [
          { sequenceOrder: 1, type: 'discussion', title: 'Opening' },
          {
            sequenceOrder: 2,
            type: 'practice',
            title: 'Map it',
            description: 'Groups map a refund process.',
            teachingMethod: 'Think-pair-share',
            involvesAI: true,
            instructorActions: ['Circulate.'],
            studentActions: ['Draft the map.', 'Swap with another group.'],
          },
          { sequenceOrder: 3, type: 'discussion', title: 'Close' },
        ],
      },
      0,
      context
    );

    expect(s.activities[1]).toMatchObject({
      description: 'Groups map a refund process.',
      teachingMethod: 'Think-pair-share',
      usesAI: true,
      steps: ['Circulate.'],
      studentActions: ['Draft the map.', 'Swap with another group.'],
    });
  });

  it('flags AI use only where the activity’s label does not already say so', () => {
    const s = guideSession(
      {
        activities: [
          { sequenceOrder: 1, type: 'ai_activity', involvesAI: true, title: 'First' },
          { sequenceOrder: 2, type: 'ai_activity', involvesAI: true, title: 'Middle' },
          { sequenceOrder: 3, type: 'discussion', involvesAI: false, title: 'Last' },
        ],
      },
      0,
      context
    );

    // The first is labelled "Opening", so it needs the flag. The middle one is "AI activity".
    expect(s.activities.map((a) => [a.label, a.usesAI])).toEqual([
      ['Opening', true],
      ['AI activity', false],
      ['Wrap-up', false],
    ]);
  });

  it('drops an activity description only when it repeats the title', () => {
    const s = guideSession(
      { activities: [{ title: 'Exit ticket', description: 'exit ticket.' }] },
      0,
      context
    );

    expect(s.activities[0].description).toBeUndefined();
  });

  it('names each case once when the lesson lists its id twice', () => {
    const s = guideSession({ materials: { caseFiles: ['case-1', 'case-2', 'case-1'] } }, 0, {
      ...context,
      caseTitles: new Map([
        ['case-1', 'FoodNow refunds'],
        ['case-2', 'Al Noor'],
      ]),
    });

    expect(s.resources.cases).toEqual(['FoodNow refunds', 'Al Noor']);
  });

  it('names a case once when two ids carry the same title', () => {
    const s = guideSession({ materials: { caseFiles: ['case-1', 'case-9'] } }, 0, {
      ...context,
      caseTitles: new Map([
        ['case-1', 'FoodNow refunds'],
        ['case-9', 'FoodNow refunds'],
      ]),
    });

    expect(s.resources.cases).toEqual(['FoodNow refunds']);
  });

  it('prints reading time and level beside a citation and lists a repeated source once', () => {
    const s = guideSession(
      {
        independentStudy: {
          coreReadings: [
            { citation: 'CIPD. (2024). Culture.', complexityLevel: 'introductory' },
            {
              citation: 'Roth. (2025). Distinctions.',
              estimatedMinutes: 30,
              complexityLevel: 'advanced',
            },
          ],
        },
        materials: {
          readingReferences: [{ citation: 'CIPD. (2024). Culture.', estimatedMinutes: 20 }],
        },
      },
      0,
      context
    );

    expect(s.resources.readings).toEqual([
      'CIPD. (2024). Culture. (20 min, introductory)',
      'Roth. (2025). Distinctions. (30 min, advanced)',
    ]);
    expect(s.alignment.reference).toBe('CIPD. (2024). Culture.');
  });
});

describe('check labels', () => {
  const labels = (formativeChecks: object[]) =>
    guideSession({ formativeChecks }, 0, context).checks.map((c) => c.label);

  it('labels each check by its stored type', () => {
    expect(
      labels([
        { type: 'quick_poll', question: 'Which?' },
        { type: 'discussion_question', question: 'Why?' },
        { type: 'reflection', question: 'What changed?' },
      ])
    ).toEqual(['Poll', 'Discussion question', 'Reflection']);
  });

  it('calls an mcq a multiple-choice question only when it has options', () => {
    expect(
      labels([
        { type: 'mcq', question: 'Which?', options: ['A', 'B'] },
        { type: 'mcq', question: 'Manager-in-Action Worksheet: Team Performance' },
      ])
    ).toEqual(['Multiple-choice question', 'Check']);
  });

  it('words a stored type it has no label for, rather than calling it a quiz', () => {
    expect(labels([{ type: 'short_answer', question: 'Explain it.' }])).toEqual(['Short answer']);
  });

  it('infers the label when no type is stored', () => {
    expect(
      labels([{ question: 'Which?', options: ['A', 'B'] }, { question: 'Explain it.' }])
    ).toEqual(['Multiple-choice question', 'Check']);
  });

  it('summarises the assessment link from the labels, each once', () => {
    const s = guideSession(
      {
        formativeChecks: [
          { type: 'quick_poll', question: 'One?' },
          { type: 'quick_poll', question: 'Two?' },
          { type: 'reflection', question: 'Three?' },
        ],
      },
      0,
      context
    );

    expect(s.alignment.assessment).toEqual(['Poll', 'Reflection']);
  });

  it('labels case activities by their stored type', () => {
    const kind = (activityType: string) =>
      guideSession({ caseStudyActivity: { caseTitle: 'C', activityType } }, 0, context).caseActivity
        ?.kind;

    expect([kind('practice'), kind('discussion'), kind('assessment_ready')]).toEqual([
      'Practice',
      'Discussion',
      'Assessment-ready',
    ]);
  });
});

describe('guideModule', () => {
  const module = {
    code: 'M01',
    title: 'Introduction to Management',
    mlos: [{ id: 'M01-LO1', statement: 'Explain the functions of management.' }],
  };
  const lessons = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ lessonNumber: i + 1, lessonTitle: `Lesson ${i + 1}` }));

  it('orders sessions and states the minimum requirements from the module outcomes', () => {
    const m = guideModule(
      module,
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

  it('says how many sessions were planned when the lessons held fall short of it', () => {
    const m = guideModule(module, lessons(7), context, 30);

    expect(m.plannedSessions).toBe(30);
    expect(incompleteNote(m)).toBe(
      '7 of 30 planned sessions are generated; the rest are not yet available.'
    );
  });

  it('says nothing about completeness for a module that holds all its sessions', () => {
    const exact = guideModule(module, lessons(30), context, 30);
    const unplanned = guideModule(module, lessons(7), context);

    expect(incompleteNote(exact)).toBeUndefined();
    expect(exact.plannedSessions).toBeUndefined();
    expect(incompleteNote(unplanned)).toBeUndefined();
  });

  it('says "is" for a module with a single session generated', () => {
    expect(incompleteNote(guideModule(module, lessons(1), context, 30))).toBe(
      '1 of 30 planned sessions is generated; the rest are not yet available.'
    );
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

  it('returns nothing for empty or non-text input', () => {
    expect(sentences(undefined)).toEqual([]);
    expect(sentences('   ')).toEqual([]);
    expect(sentences(42)).toEqual([]);
  });

  // Each abbreviation is followed by a capital letter, digit or bracket: the cases that used to
  // cut the sentence short. A second sentence proves real boundaries still split.
  it.each([
    ['approx.', 'Allow approx. 15 minutes for the task.'],
    ['e.g.', "Use one model, e.g. Porter's Five Forces, for the session."],
    ['i.e.', 'Name the owner, i.e. Responsible and Accountable roles.'],
    ['Fig.', 'Refer to Fig. 3 before the discussion.'],
    ['Dr.', 'Invite Dr. Patel to comment on the result.'],
    ['vs.', 'Contrast Tesla vs. Toyota on handoffs.'],
    ['etc.', 'Collect the forms, charts, etc. (see the appendix) before class.'],
    ['No.', 'Start from No. 4 on the list.'],
    ['et al.', 'Discuss Roth et al. (2025) in pairs.'],
    ['cf.', 'Compare the two layouts, cf. Figure 2 in the reading.'],
    ['Prof.', 'Ask Prof. Nair to join the debrief.'],
  ])('keeps "%s" inside its sentence', (_abbreviation, sentence) => {
    expect(sentences(`${sentence} Then move on.`)).toEqual([sentence, 'Then move on.']);
  });

  it('protects an abbreviation at the start of the text and one inside brackets', () => {
    expect(sentences('Dr. Patel leads. (See Fig. 2) Then regroup.')).toEqual([
      'Dr. Patel leads.',
      '(See Fig. 2) Then regroup.',
    ]);
  });

  it('still ends a sentence at "no." when no number follows', () => {
    expect(sentences('Answer yes or no. Then justify it.')).toEqual([
      'Answer yes or no.',
      'Then justify it.',
    ]);
  });

  it('still ends a sentence after a person’s name', () => {
    expect(sentences('Ask Dr. Patel. Then compare the answers.')).toEqual([
      'Ask Dr. Patel.',
      'Then compare the answers.',
    ]);
  });

  it('keeps a bracketed list of quoted questions together', () => {
    const guidance =
      "Ask probing questions (e.g., 'What artefact changes hands? Who is Accountable? " +
      "Where is the approval?'). Then debrief.";

    expect(sentences(guidance)).toEqual([
      "Ask probing questions (e.g., 'What artefact changes hands? Who is Accountable? " +
        "Where is the approval?').",
      'Then debrief.',
    ]);
  });

  it('is not thrown off by a closing bracket with no opening one', () => {
    expect(sentences('Step 1) Define it. Step 2) Apply it.')).toEqual([
      'Step 1) Define it.',
      'Step 2) Apply it.',
    ]);
  });
});

describe('lookups keyed by text from the data', () => {
  it.each(['constructor', '__proto__', 'toString', 'hasOwnProperty'])(
    'treats "%s" as an ordinary word, not an inherited property',
    (word) => {
      const s = guideSession(
        {
          linkedMLOs: [word],
          topicCoverage: { subtopics: [word] },
          materials: { caseFiles: [word] },
          activities: [
            { sequenceOrder: 1, type: 'discussion', title: 'Open' },
            { sequenceOrder: 2, type: word },
            { sequenceOrder: 3, type: 'discussion', title: 'Close' },
          ],
          formativeChecks: [{ type: word, question: 'Which?' }],
          caseStudyActivity: { caseTitle: 'A case', activityType: word },
        },
        0,
        context
      );

      expect(s.keyConcepts).toEqual([{ name: word }]);
      expect(s.focus.whyItMatters).toEqual([]);
      expect(s.resources.cases).toEqual([word]);
      expect(s.activities[1]).toMatchObject({ label: 'Activity', title: 'Activity' });
      expect(typeof s.checks[0].label).toBe('string');
      expect(typeof s.caseActivity?.kind).toBe('string');
    }
  );

  it('finds definitions, outcomes and case titles the workflow names with such words', () => {
    const fromWorkflow = guideContextFromWorkflow(
      {
        step9: {
          terms: [
            { term: 'Constructor', definition: 'A builder.' },
            { term: '__proto__', definition: 'A key.' },
          ],
        },
        step8: { caseStudies: [{ id: 'toString', title: 'Odd id' }] },
      },
      { mlos: [{ id: 'hasOwnProperty', statement: 'Be odd.' }] }
    );

    const s = guideSession(
      {
        linkedMLOs: ['hasOwnProperty'],
        topicCoverage: { subtopics: ['constructor', '__proto__'] },
        materials: { caseFiles: ['toString'] },
      },
      0,
      fromWorkflow
    );

    expect(s.keyConcepts).toEqual([
      { name: 'constructor', definition: 'A builder.' },
      { name: '__proto__', definition: 'A key.' },
    ]);
    expect(s.focus.whyItMatters).toEqual(['hasOwnProperty: Be odd.']);
    expect(s.resources.cases).toEqual(['Odd id']);
  });

  it('skips glossary terms, outcomes and cases that have no usable text', () => {
    const fromWorkflow = guideContextFromWorkflow(
      {
        step9: { terms: [{ term: 'Blueprint' }, { definition: 'No term.' }] },
        step8: { caseStudies: [{ id: 'c1', title: '  ' }, { title: 'No id' }] },
      },
      { mlos: [{ id: 'M01-LO1' }, { statement: 'No id.' }] }
    );

    expect(fromWorkflow.glossary.size).toBe(0);
    expect(fromWorkflow.caseTitles.size).toBe(0);
    expect(fromWorkflow.mloStatements.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------------------------
// Every stored field reaches the Word document, or is left out on purpose and says why
// ---------------------------------------------------------------------------------------------

/** The document a lecturer would open, read back as plain text. */
async function guideText(guide: GuideModule): Promise<string> {
  const buffer = await facultyGuideBuffer(guide, 'Bachelor in Business Administration');
  return (await mammoth.extractRawText({ buffer })).value;
}

type Leaf = { path: string; value: string | number | boolean };

/** Every leaf of a value with the dotted path to it, array positions written as [0], [1]. */
function leavesOf(value: unknown, path = ''): Leaf[] {
  if (Array.isArray(value)) return value.flatMap((v, i) => leavesOf(v, `${path}[${i}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => leavesOf(v, path ? `${path}.${k}` : k));
  }
  return [{ path, value: value as Leaf['value'] }];
}

/** Array positions written as [] so one entry covers every element. */
const generic = (path: string) => path.replace(/\[\d+\]/g, '[]');

/**
 * Stored fields the guide does not print as text of their own, each with the reason. Anything
 * not listed here must appear in the document.
 */
const NOT_PRINTED: Record<string, string> = {
  lessonId: 'Internal identifier. The session number is what a lecturer refers to.',
  lessonTitle:
    'A shortened copy of topicCoverage.exactTopic (generateLessonTitle truncates it). The full ' +
    'topic is the session heading.',
  'linkedKSCs[]':
    'Alignment is kept to MLO and PLO ids at the reviewer’s request. KSC ids belong with the ' +
    'alignment tables that were dropped.',
  bloomLevel: 'Bloom levels were dropped at the reviewer’s request.',
  'activities[].activityId': 'Internal identifier.',
  'activities[].sequenceOrder': 'Expressed as the order the activities are listed in.',
  'activities[].type':
    'Printed as a label (Discussion), asserted below. The first and last activities are ' +
    'labelled Opening and Wrap-up instead.',
  'activities[].involvesAI': 'A flag, printed as an "Applied AI" line, asserted below.',
  'materials.pptDeckRef':
    'A deck identifier a lecturer cannot act on. Slides are left to the lecturer, as the guide ' +
    'says in its introduction.',
  'materials.readingReferences[].sourceId': 'Internal source identifier. The citation is printed.',
  'independentStudy.coreReadings[].sourceId':
    'Internal source identifier. The citation is printed.',
  'independentStudy.supplementaryReadings[].sourceId':
    'Internal source identifier. The citation is printed.',
  'formativeChecks[].checkId': 'Internal identifier.',
  'formativeChecks[].type': 'Printed as a label (Multiple-choice question), asserted below.',
  'caseStudyActivity.caseStudyId': 'Internal identifier. The case title is printed.',
  'caseStudyActivity.activityType': 'Printed as a label (Practice), asserted below.',
  'caseStudyActivity.linkedMLOs[]':
    'A copy of the lesson’s own linkedMLOs (createCaseStudyActivity), printed under Alignment.',
  'caseStudyActivity.linkedPLOs[]':
    'A copy of the lesson’s own linkedPLOs (createCaseStudyActivity), printed under Alignment.',
  'caseStudyActivity.isFirstAppearance':
    'Generator bookkeeping. It already decides the wording of learningPurpose and ' +
    'instructorInstructions, which are printed.',
  'caseStudyActivity.previousAppearanceRef':
    'An internal module id, meaningless to a lecturer. The instructions already say to build ' +
    'on the earlier analysis.',
};

describe('every stored lesson field', () => {
  const leaves = leavesOf(fullLesson);
  let text = '';

  beforeAll(async () => {
    const guide = guideModule({ code: 'M01', title: 'Management' }, [fullLesson], context);
    text = await guideText(guide);
  });

  const appears = (leaf: Leaf): boolean =>
    typeof leaf.value === 'number'
      ? new RegExp(`\\b${leaf.value}\\b`).test(text)
      : text.includes(String(leaf.value));

  it('is printed in the Word document unless it is on the list of deliberate exclusions', () => {
    const missing = leaves
      .filter((l) => typeof l.value !== 'boolean')
      .filter((l) => !(generic(l.path) in NOT_PRINTED))
      .filter((l) => !appears(l))
      .map((l) => l.path);

    expect(missing).toEqual([]);
  });

  it('keeps the list of exclusions honest: every entry names a real field that is not printed', () => {
    const paths = new Set(leaves.map((l) => generic(l.path)));
    const unknown = Object.keys(NOT_PRINTED).filter((p) => !paths.has(p));
    const printedAnyway = leaves
      .filter((l) => generic(l.path) in NOT_PRINTED)
      .filter((l) => typeof l.value === 'string' && l.value.startsWith('«') && appears(l))
      .map((l) => l.path);

    expect(unknown).toEqual([]);
    expect(printedAnyway).toEqual([]);
  });

  it('prints the fields that appear as labels and flags', () => {
    expect(text).toContain('Discussion (13 min)');
    expect(text).toContain('Multiple-choice question (19 min)');
    expect(text).toContain('Case activity (Practice, 23 min)');
    // Exactly one activity, the second, has students using AI.
    expect(text.match(/Applied AI: students use a generative AI tool/g)).toHaveLength(1);
  });

  it('prints the first and last activities as opening and wrap-up', () => {
    expect(text).toContain('Opening (11 min)');
    expect(text).toContain('Wrap-up (17 min)');
  });
});

describe('a case activity whose time is stored as text', () => {
  // Step 8 stores estimatedDuration as text, and lessonPlanService passes it through: BBA M01
  // lesson 1 holds this string. The guide kept numbers only, so the time was dropped.
  const stored = fullLesson as Record<string, any>;
  const timed = {
    ...stored,
    caseStudyActivity: {
      ...stored.caseStudyActivity,
      duration: 'Preparation 20–30 minutes; class/discussion 60–75 minutes.',
    },
  };

  it('keeps the text as the activity time', () => {
    const s = guideSession(timed, 0, context);
    expect(s.caseActivity?.minutes).toBeUndefined();
    expect(s.caseActivity?.time).toBe('Preparation 20–30 minutes; class/discussion 60–75 minutes.');
  });

  it('prints it in the session', async () => {
    const text = await guideText(
      guideModule({ code: 'M01', title: 'Management' }, [timed], context)
    );
    expect(text).toContain('Time: Preparation 20–30 minutes; class/discussion 60–75 minutes.');
  });
});

describe('session at a glance', () => {
  it('opens each session with what to teach, outcomes, activities, checks and preparation', async () => {
    const text = await guideText(
      guideModule({ code: 'M01', title: 'Management' }, [fullLesson as any], context)
    );
    const glance = text.indexOf('Must teach');
    expect(glance).toBeGreaterThan(-1);
    for (const row of ['Outcomes', 'Activities', 'Check learning', 'Prepare']) {
      expect(text.indexOf(row, glance)).toBeGreaterThan(glance);
    }
    // The table comes before the nine detailed sections.
    expect(glance).toBeLessThan(text.indexOf('1. Session Focus'));
  });
});
