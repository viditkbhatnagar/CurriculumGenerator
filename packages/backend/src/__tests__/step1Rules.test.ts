import { step1InputProblems, wordCount } from '../services/step1Rules';

const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ');
const role = (title: string, n: number) => ({
  title,
  description: words(n),
  tasks: ['Analyse data'],
});
const complete = {
  programDescription: words(60),
  programPurpose: words(80),
  jobRoles: [role('Business Analyst', 120), role('Data Analyst', 110)],
};

describe('step1InputProblems', () => {
  it('finds nothing when every minimum is met', () => {
    expect(step1InputProblems(complete)).toEqual([]);
  });

  it("names each job description that is too short, as in Logan's run (41 and 36 words)", () => {
    const problems = step1InputProblems({
      ...complete,
      jobRoles: [role('Business Analyst', 41), role('Data Analyst', 36)],
    });
    expect(problems).toEqual([
      '"Business Analyst": the job description has 41 words; it needs at least 100.',
      '"Data Analyst": the job description has 36 words; it needs at least 100.',
    ]);
  });

  it('checks the description, the purpose range and the number of roles', () => {
    const problems = step1InputProblems({
      programDescription: words(10),
      programPurpose: words(400),
      jobRoles: [role('Business Analyst', 150), { title: '  ', description: '', tasks: [] }],
    });
    expect(problems).toEqual([
      'The programme description has 10 words; it needs at least 50.',
      'The programme purpose has 400 words; it needs 50 to 300.',
      'At least 2 job roles are needed; 1 given.',
    ]);
  });
});

describe('wordCount', () => {
  it('counts words, not characters, and treats a non-string as empty', () => {
    expect(wordCount('  one  two\nthree ')).toBe(3);
    expect(wordCount(undefined)).toBe(0);
  });
});
