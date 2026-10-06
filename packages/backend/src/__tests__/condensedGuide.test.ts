import mammoth from 'mammoth';
import {
  CONDENSED_GUIDE_VERSION,
  LIMITS,
  parseCondensed,
  storedCondensed,
} from '../services/facultyGuide/condensedGuide';
import {
  GuideContext,
  guideModule,
  guideSession,
} from '../services/facultyGuide/facultyGuideModel';
import { facultyGuideBuffer } from '../services/facultyGuide/facultyGuideDocx';
import { fullLesson } from './fixtures/fullLesson';

const context: GuideContext = {
  mloStatements: new Map([['M01-LO1', 'Explain the functions of management.']]),
  glossary: new Map(),
  caseTitles: new Map(),
};
const session = guideSession(fullLesson as any, 0, context);

const answer = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    mustTeach: [session.topic],
    guidance: [session.teachingGuidance[0] || session.topic],
    keyConcepts: [{ name: 'Concept', definition: session.topic, example: session.topic }],
    activities: session.activities.map((a) => ({
      title: a.title,
      lecturer: a.title,
      students: a.title,
    })),
    prompts: ['Invented prompt about quantum blockchain synergies'],
    quickCheck: [{ question: `What is ${session.topic}?`, answer: session.topic }],
    prepare: ['Read the core reading'],
    takeaways: [session.topic],
    ...over,
  });

describe('parseCondensed', () => {
  it('keeps the shape, with one activity per session activity and their minutes', () => {
    const c = parseCondensed(answer(), session)!;
    expect(c.version).toBe(CONDENSED_GUIDE_VERSION);
    expect(c.activities).toHaveLength(session.activities.length);
    expect(c.activities[0].minutes).toBe(session.activities[0].minutes);
    expect(c.mustTeach[0]).toEqual({ value: session.topic });
  });

  it('flags an item whose words the lesson does not contain', () => {
    const c = parseCondensed(answer(), session)!;
    expect(c.prompts[0].check).toBe(true);
    expect(c.mustTeach[0].check).toBeUndefined();
  });

  it('clips lists to their limits', () => {
    const many = Array.from({ length: 12 }, () => session.topic);
    const c = parseCondensed(answer({ mustTeach: many, takeaways: many }), session)!;
    expect(c.mustTeach).toHaveLength(LIMITS.mustTeach);
    expect(c.takeaways).toHaveLength(LIMITS.takeaways);
  });

  it('drops activities that do not line up with the session, rather than mismatching them', () => {
    const c = parseCondensed(
      answer({ activities: [{ title: 'Only one', lecturer: 'x', students: 'y' }] }),
      session
    )!;
    expect(session.activities.length).toBeGreaterThan(1);
    expect(c.activities).toEqual([]);
  });

  it('refuses an answer that is not JSON or has nothing to teach', () => {
    expect(parseCondensed('not json', session)).toBeNull();
    expect(parseCondensed(answer({ mustTeach: [] }), session)).toBeNull();
  });
});

describe('storedCondensed', () => {
  it('ignores a session condensed under an older version', () => {
    const c = parseCondensed(answer(), session)!;
    expect(storedCondensed(c)).toBe(c);
    expect(storedCondensed({ ...c, version: CONDENSED_GUIDE_VERSION - 1 })).toBeUndefined();
    expect(storedCondensed(undefined)).toBeUndefined();
  });
});

describe('a guide with condensed sessions', () => {
  it('prints the short form, the quick check, concept examples and the AI note', async () => {
    const condensed = parseCondensed(
      answer({
        keyConcepts: [
          {
            name: 'Service blueprint',
            definition: session.topic,
            example: 'A refund desk example',
          },
        ],
        quickCheck: [{ question: 'Which stage comes first?', answer: session.topic }],
      }),
      session
    );
    const lesson = { ...(fullLesson as any), facultyGuide: condensed };
    const buffer = await facultyGuideBuffer(
      guideModule({ code: 'M01', title: 'Management' }, [lesson], context)
    );
    const text = (await mammoth.extractRawText({ buffer })).value;
    expect(text).toContain('Sessions are shortened by AI');
    expect(text).toContain('Quick check (end of session)');
    expect(text).toContain('Which stage comes first?');
    expect(text).toContain('Business example');
    expect(text).toContain('A refund desk example');
    expect(text).toContain('Invented prompt about quantum blockchain synergies ⚑');
  });

  it('prints the full session when no condensed one is stored', async () => {
    const buffer = await facultyGuideBuffer(
      guideModule({ code: 'M01', title: 'Management' }, [fullLesson as any], context)
    );
    const text = (await mammoth.extractRawText({ buffer })).value;
    expect(text).not.toContain('Sessions are shortened by AI');
    expect(text).not.toContain('Quick check (end of session)');
  });
});
