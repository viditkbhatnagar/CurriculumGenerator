import { applyStep12Edit, step12Index } from '../utils/step12Edit';

const variant = (title: string) => ({
  overview: { title, assignmentType: 'Mini-case', submissionFormat: 'PDF' },
  brief: { studentFacingIntro: 'Intro', workplaceContext: 'Al Noor Trading…', deliverables: ['A'] },
  rubric: [{ criterionName: 'Evidence', weight: 100 }],
  academicIntegrity: 'Individual work.',
});
const packs = () => [
  {
    moduleId: 'mod-1',
    moduleCode: 'M01',
    variants: { in_person: variant('In person'), self_study: variant('Self study') },
  },
  { moduleId: 'mod-2', moduleCode: 'M02', variants: { hybrid: variant('Hybrid') } },
];

describe('applyStep12Edit', () => {
  it('sets a nested field of one variant, found by module code', () => {
    const before = packs();
    const result = applyStep12Edit(before, {
      match: { moduleCode: 'm01', variant: 'in_person' },
      field: 'brief.workplaceContext',
      value: 'A Dubai uniform supplier…',
    });
    if ('problem' in result) throw new Error(result.problem);
    expect(result.changed).toBe(1);
    const edited = result.packs[0].variants!.in_person as any;
    expect(edited.brief.workplaceContext).toBe('A Dubai uniform supplier…');
    expect(edited.brief.studentFacingIntro).toBe('Intro'); // the rest of the brief is kept
    expect((result.packs[0].variants!.self_study as any).brief.workplaceContext).toBe(
      'Al Noor Trading…'
    );
    expect((before[0].variants.in_person as any).brief.workplaceContext).toBe('Al Noor Trading…');
  });

  it('sets a top-level field in every variant when the variant is "all" or left out', () => {
    const result = applyStep12Edit(packs(), {
      match: { moduleId: 'mod-1' },
      field: 'academicIntegrity',
      value: 'Open-book, individual.',
    });
    if ('problem' in result) throw new Error(result.problem);
    expect(result.changed).toBe(2);
    expect((result.packs[0].variants!.self_study as any).academicIntegrity).toBe(
      'Open-book, individual.'
    );
  });

  it('replaces a whole list field', () => {
    const rubric = [
      { criterionName: 'Research', weight: 50 },
      { criterionName: 'Concept', weight: 50 },
    ];
    const result = applyStep12Edit(packs(), {
      match: { moduleCode: 'M02', variant: 'hybrid' },
      field: 'rubric',
      value: rubric,
    });
    if ('problem' in result) throw new Error(result.problem);
    expect((result.packs[1].variants!.hybrid as any).rubric).toEqual(rubric);
  });

  it('refuses a field that is not editable, a wrong value type, or no such module or variant', () => {
    const base = { match: { moduleCode: 'M01', variant: 'in_person' } };
    expect(applyStep12Edit(packs(), { ...base, field: 'assignmentId', value: 'x' })).toHaveProperty(
      'problem'
    );
    expect(applyStep12Edit(packs(), { ...base, field: 'rubric', value: 'x' })).toHaveProperty(
      'problem'
    );
    expect(
      applyStep12Edit(packs(), { ...base, field: 'overview.title', value: ['x'] })
    ).toHaveProperty('problem');
    expect(
      applyStep12Edit(packs(), {
        match: { moduleCode: 'M09' },
        field: 'overview.title',
        value: 'x',
      })
    ).toHaveProperty('problem');
    expect(
      applyStep12Edit(packs(), {
        match: { moduleCode: 'M02', variant: 'in_person' },
        field: 'overview.title',
        value: 'x',
      })
    ).toHaveProperty('problem');
  });
});

describe('step12Index', () => {
  it('lists each pack’s variants with title, type, context start and rubric criteria', () => {
    expect(step12Index(packs())[0]).toEqual({
      moduleId: 'mod-1',
      moduleCode: 'M01',
      variants: {
        in_person: {
          title: 'In person',
          assignmentType: 'Mini-case',
          workplaceContext: 'Al Noor Trading…',
          rubricCriteria: ['Evidence'],
        },
        self_study: {
          title: 'Self study',
          assignmentType: 'Mini-case',
          workplaceContext: 'Al Noor Trading…',
          rubricCriteria: ['Evidence'],
        },
      },
    });
  });
});
