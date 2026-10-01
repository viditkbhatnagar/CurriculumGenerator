import { step4ApprovalProblems } from '../services/step4Approval';

const stepModule = (over: Record<string, unknown> = {}) => ({
  id: 'mod-1',
  code: 'MOD101',
  title: 'Foundations',
  contactHours: 30,
  selfStudyHours: 90,
  totalHours: 120,
  topics: ['Port operations', { title: 'Customs basics' }],
  ...over,
});

describe('step4ApprovalProblems', () => {
  it('passes modules whose topics are named and hours are set', () => {
    expect(
      step4ApprovalProblems([stepModule(), stepModule({ id: 'mod-2', code: 'MOD102' })])
    ).toEqual([]);
  });

  it('accepts independent hours under either field name', () => {
    const m = stepModule({ selfStudyHours: undefined, independentHours: 90 });
    expect(step4ApprovalProblems([m])).toEqual([]);
  });

  it('names a module with an unnamed topic, and which topic', () => {
    const problems = step4ApprovalProblems([
      stepModule({ topics: ['Port operations', '  ', { title: '' }] }),
    ]);
    expect(problems).toEqual([
      'MOD101: Foundations: topic 2 has no name',
      'MOD101: Foundations: topic 3 has no name',
    ]);
  });

  it('names a module whose hours are missing, the "Independent: undefinedh" case', () => {
    const problems = step4ApprovalProblems([
      stepModule({ selfStudyHours: undefined }),
      stepModule({ code: 'MOD102', contactHours: 'abc', totalHours: undefined }),
    ]);
    expect(problems).toEqual([
      'MOD101: Foundations: independent hours are not set',
      'MOD102: Foundations: contact hours are not set',
      'MOD102: Foundations: total hours are not set',
    ]);
  });
});
