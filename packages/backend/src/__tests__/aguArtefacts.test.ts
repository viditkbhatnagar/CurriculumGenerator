import { validDraft } from './fixtures/aguDraftFixture';
import { CourseArtefacts } from '../agu/draft/artefactTypes';
import { outlineHash } from '../agu/draft/outlineHash';
import {
  examBlueprint,
  quizWeekFromAnswer,
  resolveAnswers,
  rubricsFromAnswer,
  tutorSourceMaterials,
  buildPlanPrompt,
} from '../agu/generation/artefactPrompts';
import { textSimilarity, validateArtefacts } from '../agu/validation/validateArtefacts';
import { catalogueCourse } from '../agu/catalogue/catalogueV1_4';

const TOPICS = ['pricing', 'churn', 'inventory', 'staffing'];

/** Artefacts for the fixture draft that pass every check. Each test breaks one thing. */
function validArtefacts(): CourseArtefacts {
  const draft = validDraft();
  const weeks = [1, 2, 3, 4];
  return {
    rubrics: [
      {
        assessmentId: 'a1',
        rows: ['CLO1', 'CLO2'].map((outcomeId) => ({
          outcomeId,
          criterion: `Analysis for ${outcomeId}`,
          weight: 50,
          excellent: 'States the decision, tests two options against the data and quantifies risk.',
          good: 'States the decision and tests one option against the data.',
          belowStandard: 'Describes the data without reaching a decision.',
        })),
      },
    ],
    quizBank: {
      plan: weeks.map((week) => ({ week, items: 2, timeLimitMinutes: 20, attempts: 2, weight: 3 })),
      items: weeks.flatMap((week) =>
        [0, 1].map((k) => {
          const options = ['Option north', 'Option south', 'Option east', 'Option west'];
          return {
            id: `W${week}-Q0${k + 1}`,
            week,
            outcomeId: `CLO${week}`,
            type: 'mcq' as const,
            question: `Week ${week} ${TOPICS[week - 1]} item ${k + 1}: which option fits the stated constraint best?`,
            options,
            answers: [options[(week + k) % 4]],
            rationale: 'Because it meets the constraint.',
          };
        })
      ),
      practice: weeks.map((week) => ({
        id: `W${week}-P01`,
        week,
        outcomeId: `CLO${week}`,
        question: `Practise the ${TOPICS[week - 1]} calculation from the lecture example.`,
        answer: 'Worked value',
        feedback: 'Check the denominator.',
      })),
    },
    finalExam: {
      durationMinutes: 120,
      totalMarks: 100,
      paper: [
        {
          number: 1,
          outcomeId: 'CLO3',
          type: 'case_analysis',
          question:
            'A regional carrier weighs dropping a loss-making route; evaluate the proposal using the contribution data supplied and recommend a course of action.',
          options: [],
          marks: 50,
          markingGuide:
            'Contribution margin computed (15); fixed-cost allocation challenged (15); recommendation justified (20).',
        },
        {
          number: 2,
          outcomeId: 'CLO4',
          type: 'extended_response',
          question:
            'Critique a hospital board paper that proposes automated triage scheduling, weighing governance risks against measured throughput gains.',
          options: [],
          marks: 50,
          markingGuide: 'Risks identified (15); evidence weighed (15); position defended (20).',
        },
      ],
    },
    discussions: weeks.map((week) => ({
      week,
      prompt: `Share a ${TOPICS[week - 1]} decision you have seen made without data.`,
      outcomeIds: [`CLO${week}`],
      studentRequirement: 'One post of 250 words by Thursday and two replies by Sunday.',
      moderationPlan: 'Faculty reply to every thread within 48 hours and summarise on Monday.',
      graded: true,
      criteria: 'Application of the week’s method; engagement with peers.',
      weight: 2,
      contactHours: 0,
    })),
    tutorPack: {
      glossary: Array.from({ length: 8 }, (_, i) => ({
        term: `Term ${i + 1}`,
        definition: 'A plain definition.',
        week: 1,
      })),
      faqs: Array.from({ length: 5 }, (_, i) => ({
        question: `How do I read chart type ${i + 1} in the weekly slides?`,
        answer: 'Look at the axes first.',
        week: 1,
      })),
      workedExamples: [
        {
          problem: 'Compute a simple average order value from five orders.',
          solution: '1. Sum. 2. Divide.',
          week: 1,
        },
        {
          problem: 'Convert a weekly count into a monthly rate for staffing.',
          solution: '1. Multiply. 2. Round.',
          week: 2,
        },
      ],
      misconceptions: Array.from({ length: 3 }, (_, i) => ({
        misconception: `Misconception ${i + 1}`,
        correction: 'Correction.',
      })),
      guardrails: [
        {
          doNot: 'Write, draft or complete any part of the applied assignment for a student.',
          instead: 'Explain the method and point to the week’s practice set.',
        },
        {
          doNot: 'Answer, hint at or rehearse final exam questions.',
          instead: 'Offer practice items on the same outcome.',
        },
      ],
      sourceMaterials: tutorSourceMaterials(draft),
    },
    outlineHash: outlineHash(draft),
    promptVersion: 'test',
    generatedAt: '2026-09-30T00:00:00.000Z',
  };
}

const codes = (a: CourseArtefacts, draft = validDraft()) =>
  validateArtefacts(a, draft).map((f) => `${f.severity}:${f.code}`);
const blocking = (a: CourseArtefacts, draft = validDraft()) =>
  validateArtefacts(a, draft).filter((f) => f.severity === 'blocking');

describe('validateArtefacts', () => {
  it('passes a complete, consistent set with no blocking finding', () => {
    expect(blocking(validArtefacts())).toEqual([]);
  });

  it('blocks rubric weights that do not add up to 100', () => {
    const a = validArtefacts();
    a.rubrics[0].rows[0].weight = 40;
    expect(codes(a)).toContain('blocking:RUBRIC_WEIGHTS');
  });

  it('blocks a rubric that leaves out an outcome the assignment assesses', () => {
    const a = validArtefacts();
    a.rubrics[0].rows = [{ ...a.rubrics[0].rows[0], weight: 100 }];
    expect(codes(a)).toContain('blocking:RUBRIC_OUTCOME_GAP');
  });

  it('blocks a quiz key that is not one of its options', () => {
    const a = validArtefacts();
    a.quizBank.items[0].answers = ['Option up'];
    expect(codes(a)).toContain('blocking:QUIZ_ITEM_INVALID');
  });

  it('blocks a week whose quiz holds fewer items than planned', () => {
    const a = validArtefacts();
    a.quizBank.items = a.quizBank.items.filter((i) => i.id !== 'W2-Q02');
    expect(codes(a)).toContain('blocking:QUIZ_ITEM_COUNT');
  });

  it('blocks quiz and discussion weights that miss the 20% component', () => {
    const a = validArtefacts();
    a.quizBank.plan[0].weight = 5;
    expect(codes(a)).toContain('blocking:WEEKLY_WEIGHTS');
  });

  it('blocks an outcome the final exam is said to assess but never tests', () => {
    const a = validArtefacts();
    a.finalExam!.paper = [{ ...a.finalExam!.paper[0], marks: 100 }];
    expect(codes(a)).toContain('blocking:EXAM_OUTCOME_GAP');
  });

  it('blocks an exam whose marks do not reach its total', () => {
    const a = validArtefacts();
    a.finalExam!.paper[1].marks = 30;
    expect(codes(a)).toContain('blocking:EXAM_MARKS');
  });

  it('blocks an exam question students have already seen in the practice bank', () => {
    const a = validArtefacts();
    a.quizBank.practice[0].question = a.finalExam!.paper[0].question;
    expect(codes(a)).toContain('blocking:EXAM_LEAK');
  });

  it('blocks a tutor with no rule against doing the assignment', () => {
    const a = validArtefacts();
    a.tutorPack.guardrails = a.tutorPack.guardrails.slice(1);
    expect(codes(a)).toContain('blocking:TUTOR_GUARDRAILS');
  });

  it('reports artefacts stale once the outline they came from changes', () => {
    const draft = validDraft();
    draft.outcomes[0].statement = 'Evaluate something else entirely with a different method.';
    expect(codes(validArtefacts(), draft)).toContain('blocking:ARTEFACTS_STALE');
  });

  it('blocks a prohibited claim anywhere in the artefacts', () => {
    const a = validArtefacts();
    a.discussions[1].prompt = 'Our DEAC-accredited MBA prepares you for this.';
    expect(codes(a)).toContain('blocking:ARTEFACT_CLAIM');
  });

  it('warns when the correct option is usually the longest', () => {
    const a = validArtefacts();
    a.quizBank.items = a.quizBank.items.map((item) => {
      const key = 'This is by far the longest and most carefully qualified option';
      return { ...item, options: [key, 'Short', 'Brief', 'Tiny'], answers: [key] };
    });
    expect(codes(a)).toEqual(expect.arrayContaining(['warning:QUIZ_LENGTH_BIAS']));
  });
});

describe('examBlueprint', () => {
  it('is counted from the paper, so it cannot claim coverage the paper lacks', () => {
    expect(examBlueprint(validArtefacts().finalExam!)).toEqual([
      { outcomeId: 'CLO3', itemTypes: ['case_analysis'], items: 1, marks: 50, percent: 50 },
      { outcomeId: 'CLO4', itemTypes: ['extended_response'], items: 1, marks: 50, percent: 50 },
    ]);
  });
});

describe('parsing the model answers', () => {
  it('resolves an answer given as a letter or a loose copy to the option itself', () => {
    const options = ['Raise price', 'Cut cost', 'Hold', 'Exit'];
    expect(resolveAnswers(options, ['B'])).toEqual(['Cut cost']);
    expect(resolveAnswers(options, ['(c)'])).toEqual(['Hold']);
    expect(resolveAnswers(options, ['exit'])).toEqual(['Exit']);
    expect(resolveAnswers(options, ['D) Exit'])).toEqual(['Exit']);
    expect(resolveAnswers(options, ['Sell the firm'])).toEqual(['Sell the firm']);
  });

  it('assigns item ids and drops items that name no outcome of the course', () => {
    const draft = validDraft();
    const { value, findings } = quizWeekFromAnswer(
      {
        items: [
          {
            outcomeId: 'CLO1',
            type: 'mcq',
            question: 'Q?',
            options: ['a', 'b', 'c'],
            answers: ['A'],
          },
          {
            outcomeId: 'CLO9',
            type: 'mcq',
            question: 'Q2?',
            options: ['a', 'b', 'c'],
            answers: ['a'],
          },
        ],
        practice: [{ outcomeId: 'clo1', question: 'P?', answer: 'x', feedback: 'y' }],
      },
      draft.weeks[0],
      draft
    );
    expect(value.items.map((i) => [i.id, i.answers[0]])).toEqual([['W1-Q01', 'a']]);
    expect(value.practice.map((p) => p.id)).toEqual(['W1-P01']);
    expect(findings.map((f) => f.code)).toEqual(['QUIZ_ITEM_UNTRACEABLE']);
  });

  it('keeps rubrics only for the course applied assignment', () => {
    const draft = validDraft();
    const { value } = rubricsFromAnswer(
      {
        rubrics: [
          { assessmentId: 'a3', rows: [{ outcomeId: 'CLO3', weight: 100 }] },
          { assessmentId: 'a1', rows: [{ outcomeId: 'CLO1', weight: 100, criterion: 'c' }] },
        ],
      },
      draft
    );
    expect(value.map((r) => r.assessmentId)).toEqual(['a1']);
  });

  it('tells the plan request how the weekly 20% is to be split', () => {
    const { user } = buildPlanPrompt(catalogueCourse('CR08')!, validDraft(), {});
    expect(user).toMatch(/add up to exactly 20/);
  });
});

describe('textSimilarity', () => {
  it('treats a reworded copy as the same question and different questions as different', () => {
    const a = 'Evaluate the proposal to drop the loss-making route using the contribution data';
    expect(textSimilarity(a, `${a}, and recommend a decision`)).toBeGreaterThan(0.6);
    expect(
      textSimilarity(a, 'Define customer lifetime value and explain how churn changes it')
    ).toBe(0);
  });
});
