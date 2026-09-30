import { partOf } from '../agu/generation/artefactRepair';

const f = (code: string, path?: string) => ({
  code,
  severity: 'blocking' as const,
  message: '',
  path,
});

describe('partOf: which part a repair re-asks for', () => {
  it('sends rubric, weight and discussion problems to the plan request', () => {
    expect(partOf(f('RUBRIC_WEIGHTS', 'rubrics.a1'))).toBe('plan');
    expect(partOf(f('WEEKLY_WEIGHTS', 'quizBank.plan'))).toBe('plan');
    expect(partOf(f('DISCUSSION_INCOMPLETE', 'discussions.week2'))).toBe('plan');
  });

  it("sends a week's item problems to that week", () => {
    expect(partOf(f('QUIZ_ITEM_COUNT', 'quizBank.week3'))).toBe('week3');
    expect(partOf(f('QUIZ_ITEM_INVALID', 'quizBank.items.W2-Q04'))).toBe('week2');
    expect(partOf(f('PRACTICE_WEEK_EMPTY', 'quizBank.week1'))).toBe('week1');
  });

  it('sends exam and guardrail problems to their own requests', () => {
    expect(partOf(f('EXAM_LEAK', 'finalExam.paper[2]'))).toBe('exam');
    expect(partOf(f('TUTOR_GUARDRAILS', 'tutorPack.guardrails'))).toBe('tutor');
  });

  it('sends a claim in a quiz item to that item’s week', () => {
    const artefacts: any = { quizBank: { items: [{ week: 1 }, { week: 3 }], practice: [] } };
    expect(partOf(f('ARTEFACT_CLAIM', 'quizBank.items[1].question'), artefacts)).toBe('week3');
  });

  it('leaves problems no request can fix to faculty', () => {
    expect(partOf(f('ARTEFACTS_STALE', 'artefacts'))).toBeNull();
    expect(partOf(f('WEEKLY_OUTCOME_GAP', 'quizBank'))).toBeNull();
  });
});
