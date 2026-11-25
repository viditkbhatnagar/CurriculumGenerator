import {
  findSpecialisation,
  forSpecialisation,
  specialisationName,
  specialisationsOf,
} from '../services/specialisations';

const Y3 = 'Year 3 – Level 6 › ';
const mod = (n: number, group: string, isElective: boolean) => ({
  id: `mod-m${n}`,
  code: `M${n}`,
  title: `Module ${n}`,
  group,
  isElective,
  credits: 6,
  totalHours: 150,
  contactHours: 45,
  independentHours: 105,
});
const modules = [
  mod(1, 'Year 1 – Level 4', false),
  mod(2, `${Y3}Common Modules (All Students)`, false),
  mod(27, `${Y3}Specialization : Finance and FinTech`, true),
  mod(28, `${Y3}Specialization : Finance and FinTech`, true),
  mod(31, `${Y3}Specialization : Business Analytics & Data-Driven Management`, true),
  mod(32, `${Y3}Specialization : Business Analytics & Data-Driven Management`, true),
];
const data = {
  projectName: 'Bachelor in Business Administration',
  step1: { programTitle: 'Bachelor in Business Administration' },
  step4: { modules, totalProgramHours: 900, moduleCount: 6 },
  step5: {
    sources: [
      { id: 's1', moduleId: 'mod-m1' },
      { id: 's2', moduleId: 'mod-m31' },
    ],
    sourcesByModule: { 'mod-m1': [{ id: 's1' }], 'mod-m31': [{ id: 's2' }] },
  },
  step10: { moduleLessonPlans: [{ moduleId: 'mod-m27' }, { moduleId: 'mod-m32' }] },
  step12: { moduleAssignmentPacks: [{ moduleId: 'mod-m28' }, { moduleId: 'mod-m31' }] },
  step13: { overview: { examTitle: 'Final exam' }, linkedModules: ['mod-m1', 'mod-m31'] },
};

describe('specialisations', () => {
  it('names a track from its heading', () => {
    expect(specialisationName(`${Y3}Specialization : Finance and FinTech`)).toBe(
      'Finance and FinTech'
    );
    expect(specialisationName('Year 3 › Specialisation – Digital Marketing')).toBe(
      'Digital Marketing'
    );
  });

  it('lists each elective track once with its modules and credits', () => {
    const specs = specialisationsOf(data.step4);
    expect(specs.map((s) => [s.id, s.moduleCodes, s.credits])).toEqual([
      ['finance-and-fintech', ['M27', 'M28'], 12],
      ['business-analytics-data-driven-management', ['M31', 'M32'], 12],
    ]);
    expect(specialisationsOf({ modules: [mod(1, 'Year 1', false)] })).toEqual([]);
  });

  it('keeps the core and one track, and drops the other track from every step', () => {
    const spec = findSpecialisation(data.step4, 'finance-and-fintech')!;
    const out: any = forSpecialisation(data, spec);
    expect(out.step4.modules.map((m: any) => m.code)).toEqual(['M1', 'M2', 'M27', 'M28']);
    expect(out.step4.moduleCount).toBe(4);
    expect(out.step4.totalProgramHours).toBe(600);
    expect(out.step5.sources.map((s: any) => s.id)).toEqual(['s1']);
    expect(Object.keys(out.step5.sourcesByModule)).toEqual(['mod-m1']);
    expect(out.step10.moduleLessonPlans).toEqual([{ moduleId: 'mod-m27' }]);
    expect(out.step12.moduleAssignmentPacks).toEqual([{ moduleId: 'mod-m28' }]);
    expect(out.step13.linkedModules).toEqual(['mod-m1']);
    expect(out.step13.overview.examTitle).toBe('Final exam');
    expect(out.projectName).toBe('Bachelor in Business Administration – Finance and FinTech');
    expect(out.specialisation).toEqual({
      name: 'Finance and FinTech',
      group: `${Y3}Specialization : Finance and FinTech`,
      credits: 12,
      coreCredits: 12,
    });
  });

  it('leaves the input untouched and refuses an unknown id', () => {
    const before = JSON.stringify(data);
    forSpecialisation(data, findSpecialisation(data.step4, 'finance-and-fintech')!);
    expect(JSON.stringify(data)).toBe(before);
    expect(findSpecialisation(data.step4, 'nursing')).toBeNull();
    expect(findSpecialisation(data.step4, undefined)).toBeNull();
  });
});
