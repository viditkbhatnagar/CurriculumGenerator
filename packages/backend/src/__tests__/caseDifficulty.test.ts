/**
 * Logan Pacey's re-test, 2 November 2026: all eight cases of a four-module certificate were
 * introductory, seven were about dashboards, and the two cases of a module were near-duplicates.
 */
import { caseDifficultyChecks, caseSpecForModule, caseTopicsFor } from '../services/caseDifficulty';
import { caseLevelFor } from '../services/caseStudySpec';
import { deriveModuleLevels } from '../services/moduleLevels';

const certificate = {
  programTitle: 'Certificate in Business Analytics',
  academicLevel: 'certificate',
  creditFramework: { system: 'uk_credits', credits: 60 },
};
const four = [1, 2, 3, 4].map((n) => ({ id: `m${n}`, code: `M0${n}`, sequence: n, credits: 15 }));

describe('case difficulty by module', () => {
  const levels = deriveModuleLevels(four, certificate);

  it('raises difficulty with position in a single-level programme, the capstone highest', () => {
    const specs = four.map((_, i) => caseSpecForModule(levels, i));
    expect(specs.map((s) => s.difficulty)).toEqual([
      'introductory',
      'introductory',
      'intermediate',
      'advanced',
    ]);
    expect(specs[3].protagonist).not.toBe(specs[0].protagonist);
    expect(specs[3].words.max).toBeGreaterThan(specs[0].words.max);
  });

  it('uses the level alone where modules are at different levels', () => {
    const bachelor = {
      programTitle: 'Bachelor of Business',
      creditFramework: { system: 'uk_credits', credits: 360 },
    };
    const mods = Array.from({ length: 12 }, (_, i) => ({ sequence: i + 1, credits: 30 }));
    const lv = deriveModuleLevels(mods, bachelor);
    expect(caseSpecForModule(lv, 0)).toMatchObject({ level: 4, difficulty: 'introductory' });
    expect(caseSpecForModule(lv, 5)).toMatchObject({ level: 5, difficulty: 'intermediate' });
    expect(caseSpecForModule(lv, 11)).toMatchObject({ level: 6, difficulty: 'advanced' });
  });

  it("reads the module's own level before its group or the programme", () => {
    expect(caseLevelFor({ level: 5, group: 'Year 1 – Level 4' }, 'certificate')).toBe(5);
    expect(caseLevelFor({ level: 4, levelFramework: 'EQF' }, 'diploma')).toBe(3);
    expect(caseLevelFor({ group: 'Year 3 – Level 6' }, 'certificate')).toBe(6);
  });
});

describe('case topics', () => {
  it('gives each case its own topic from the module', () => {
    const topics = ['A', { title: 'B' }, 'C', 'D', 'E'];
    const [one, two] = caseTopicsFor({ topics });
    expect(one).toBe('A');
    expect(two).toBe('C');
    expect(caseTopicsFor({ topics: ['A', 'B'] })).toEqual(['A', 'B']);
    expect(caseTopicsFor({ topics: [] })).toEqual(['', '']);
  });
});

describe('case difficulty checks', () => {
  const modules = four.map((m) => ({ ...m, topics: ['x', 'y'] }));
  const cases = (diffs: string[]) =>
    modules.flatMap((m, i) => [
      { moduleId: m.id, difficulty: diffs[i], title: `Alpha ${i}`, focusTopic: 'x' },
      { moduleId: m.id, difficulty: diffs[i], title: `Different ${i} story`, focusTopic: 'y' },
    ]);

  it('passes rising difficulty with distinct topics', () => {
    const r = caseDifficultyChecks(
      cases(['introductory', 'introductory', 'intermediate', 'advanced']),
      modules
    );
    expect(r).toMatchObject({
      difficultyRising: true,
      capstoneCaseHighest: true,
      casesHaveDistinctTopics: true,
    });
  });

  it('fails the re-test: every case introductory and the final module not the hardest', () => {
    const flat = caseDifficultyChecks(
      cases(['introductory', 'advanced', 'intermediate', 'introductory']),
      modules
    );
    expect(flat.difficultyRising).toBe(false);
    expect(flat.capstoneCaseHighest).toBe(false);
    expect(flat.problems.join(' ')).toMatch(/M03/);
  });

  it('flags two cases sharing a topic or a near-identical title', () => {
    const dupes = [
      { moduleId: 'm1', difficulty: 'introductory', title: 'Dashboard for Sales', focusTopic: 'x' },
      {
        moduleId: 'm1',
        difficulty: 'introductory',
        title: 'Dashboard for Sales!',
        focusTopic: 'y',
      },
      { moduleId: 'm2', difficulty: 'advanced', title: 'One', focusTopic: 'x' },
      { moduleId: 'm2', difficulty: 'advanced', title: 'Two', focusTopic: 'x' },
    ];
    const r = caseDifficultyChecks(dupes, modules);
    expect(r.casesHaveDistinctTopics).toBe(false);
    expect(r.problems.join(' ')).toContain('M01, M02');
  });

  it('is null when there are no cases', () => {
    expect(caseDifficultyChecks([], modules).difficultyRising).toBeNull();
  });
});
