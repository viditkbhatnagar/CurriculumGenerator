/**
 * A written or practical module summative is asked for as a brief of written or practical tasks,
 * not as multiple-choice items (Logan Pacey, 17 November 2026, Diploma in Logistics pilot).
 * Formatives stay multiple-choice first.
 */
const captured: string[] = [];
jest.mock('../services/openaiService', () => ({
  openaiService: {
    generateContent: jest.fn(async (prompt: string) => {
      captured.push(prompt);
      return JSON.stringify({ formativeAssessments: [] });
    }),
  },
}));
jest.mock('../services/loggingService', () => ({
  loggingService: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { AssessmentGeneratorService } from '../services/assessmentGeneratorService';
import { planFormativeFormats } from '../services/bloomTaxonomy';
import {
  briefSpecFor,
  mcqShare,
  summativeContentProblem,
  writtenSummativePlan,
} from '../services/summativeBrief';

const ALL = [
  'Short quizzes',
  'MCQ knowledge checks',
  'Mini-case exercises',
  'Practice simulations',
  'Short written reflections',
];
const mod = {
  id: 'M1',
  title: 'Freight operations',
  mlos: [{ id: 'M1-LO1', statement: 'Apply routing methods', bloomLevel: 'apply' }],
};
const request: any = {
  userPreferences: {
    assessmentBalance: 'balanced',
    formativeTypesPerUnit: ALL,
    certificationStyles: [],
    assessmentStructure: 'both',
  },
  moduleContexts: {},
};

async function promptFor(purposeIndex: number): Promise<string> {
  captured.length = 0;
  const svc = new AssessmentGeneratorService() as any;
  const plan = planFormativeFormats(mod, ALL, 1);
  await svc.generateOneFormative(mod, 0, request, plan, purposeIndex).catch(() => undefined);
  return captured[0] || '';
}

describe('the summative prompt', () => {
  it('asks a written summative for written or practical tasks and forbids MCQ', async () => {
    const prompt = await promptFor(1); // slot 1 is the module summative
    expect(prompt).toContain('WRITTEN OR PRACTICAL TASKS');
    expect(prompt).toContain('Write no multiple-choice items');
    expect(prompt).not.toContain('expressed as a multiple-choice item');
    expect(prompt).not.toContain('MCQ ANSWER DESIGN');
    expect(prompt).not.toContain('QUESTION TYPE — MULTIPLE CHOICE FIRST');
  });

  it('keeps the formative prompt multiple-choice first', async () => {
    const prompt = await promptFor(0);
    expect(prompt).toContain('QUESTION TYPE — MULTIPLE CHOICE FIRST');
    expect(prompt).toContain('MCQ ANSWER DESIGN');
  });
});

describe('briefSpecFor', () => {
  it('words a written-reflection summative as a report, not a diary', () => {
    expect(briefSpecFor('Short written reflections').deliverable).toBe(
      'a written analytical report'
    );
    expect(briefSpecFor('Short written reflections').taskWording).toMatch(
      /not a personal reflection/
    );
  });
  it('words a mini-case summative as a case analysis report', () => {
    expect(briefSpecFor('Mini-case exercises').deliverable).toMatch(/case analysis report/);
  });
});

describe('summativeContentProblem', () => {
  const q = (questionType: string) => ({ questionType });
  it('fails a written summative whose questions are mostly MCQ', () => {
    const a = {
      assessmentType: 'Mini-case exercises',
      questions: [q('mcq'), q('mcq'), q('mcq'), q('short_answer')],
    };
    expect(mcqShare(a)).toBe(0.75);
    expect(summativeContentProblem(a)).toMatch(/75% of its questions are multiple choice/);
  });
  it('passes a written summative of written tasks', () => {
    expect(
      summativeContentProblem({
        assessmentType: 'Practice simulations',
        questions: [q('practical'), q('short_answer')],
      })
    ).toBeNull();
  });
  it('does not judge a quiz summative', () => {
    expect(
      summativeContentProblem({ assessmentType: 'Short quizzes', questions: [q('mcq')] })
    ).toBeNull();
  });
  it('is null with no questions', () => {
    expect(
      summativeContentProblem({ assessmentType: 'Mini-case exercises', questions: [] })
    ).toBeNull();
  });
});

describe('writtenSummativePlan', () => {
  it('asks for a few substantial tasks, never fewer than the outcomes', () => {
    expect(writtenSummativePlan(1)).toMatchObject({ min: 2, max: 4 });
    expect(writtenSummativePlan(6)).toMatchObject({ min: 6, max: 6 });
  });
});

describe('summativeContentProblem only judges module summatives (17 Nov run)', () => {
  const mcqs = Array.from({ length: 6 }, () => ({
    questionType: 'mcq',
    options: ['a', 'b', 'c', 'd'],
  }));
  it('leaves a mostly multiple-choice formative alone, whatever its format is called', () => {
    const formative = {
      purpose: 'formative',
      assessmentType: 'Practice simulations',
      questions: mcqs,
    };
    expect(summativeContentProblem(formative)).toBeNull();
  });
  it('still flags a written summative that came back as multiple choice', () => {
    const summative = {
      purpose: 'module_summative',
      assessmentType: 'Mini-case exercises',
      questions: mcqs,
    };
    expect(summativeContentProblem(summative)).toMatch(/multiple choice/);
  });
});
