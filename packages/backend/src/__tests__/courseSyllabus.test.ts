import {
  buildCourseSyllabus,
  datePlus,
  missingStudentRules,
  studentRules,
  summarise,
} from '../services/courseSyllabus';
import { checkCourseSyllabus, courseIssues, emptyCells } from '../services/courseSyllabusChecks';
import { programmeSyllabusBody, courseSyllabusBody } from '../services/syllabusDocx';

const mlos = [
  { id: 'M2-LO1', statement: 'Explain supply and demand.' },
  { id: 'M2-LO2', statement: 'Apply elasticity to a tax.' },
];

function workflow(overrides: Record<string, unknown> = {}): any {
  return {
    step1: { programTitle: 'Test Programme', creditFramework: { system: 'uk_credits' } },
    step3: { outcomes: [{ statement: 'A programme outcome.' }] },
    step4: {
      modules: [
        { id: 'm1', code: 'M01', title: 'Foundations', credits: 10, mlos: [], topics: ['a'] },
        {
          id: 'm2',
          code: 'M02',
          title: 'Economics',
          description: 'Markets and policy.',
          credits: 10,
          totalHours: 100,
          contactHours: 30,
          selfStudyHours: 70,
          prerequisites: ['m1'],
          mlos,
          topics: ['Markets', 'Tax'],
        },
      ],
    },
    step6: {
      readings: [
        {
          sourceId: 's1',
          moduleId: 'm2',
          category: 'core',
          citation: 'Mankiw (2020). Principles.',
          specificChapters: '4',
          pageRange: '80-110',
          suggestedWeek: 'Week 2',
        },
      ],
    },
    step7: {
      formativeAssessments: [
        {
          moduleId: 'm2',
          title: 'Practice quiz',
          purpose: 'formative',
          graded: false,
          weighting: 0,
          description: 'Short quiz.',
        },
        {
          moduleId: 'm2',
          title: 'Essay',
          purpose: 'module_summative',
          graded: true,
          weighting: 100,
          maxMarks: 50,
          assessmentType: 'Essay',
        },
      ],
    },
    step10: {
      moduleLessonPlans: [
        {
          moduleId: 'm2',
          lessons: [
            {
              lessonNumber: 1,
              lessonTitle: 'Demand',
              independentStudy: { estimatedEffort: 60, coreReadings: [] },
            },
            {
              lessonNumber: 2,
              lessonTitle: 'Supply',
              independentStudy: { estimatedEffort: 60, coreReadings: [] },
            },
            {
              lessonNumber: 3,
              lessonTitle: 'Tax',
              independentStudy: { estimatedEffort: 60, coreReadings: [] },
            },
            {
              lessonNumber: 4,
              lessonTitle: 'Elasticity',
              independentStudy: { estimatedEffort: 60, coreReadings: [] },
            },
          ],
        },
      ],
    },
    step12: {
      moduleAssignmentPacks: [
        {
          moduleId: 'm2',
          variants: {
            in_person: {
              overview: { title: 'Economics Worksheet', submissionFormat: 'Paper hand-in.' },
              brief: { studentFacingIntro: 'You will solve seven short cases.' },
              rubric: [
                {
                  criterionName: 'Method',
                  fail: 'No method.',
                  pass: 'Some.',
                  merit: 'Good.',
                  distinction: 'Excellent.',
                },
              ],
              bandLabels: ['Refer', 'Pass', 'Merit', 'Distinction'],
            },
          },
        },
      ],
    },
    ...overrides,
  };
}

const modOf = (w: any) => w.step4.modules[1];

describe('summarise and datePlus', () => {
  it('cuts long text at a sentence end', () => {
    const s = summarise('First sentence here. ' + 'x'.repeat(400), 60);
    expect(s).toBe('First sentence here.');
  });
  it('adds days to an ISO date and rejects non-dates', () => {
    expect(datePlus('2027-01-11', 7)).toBe('18 Jan 2027');
    expect(datePlus('', 7)).toBeUndefined();
    expect(datePlus('soon', 7)).toBeUndefined();
  });
});

describe('institution rules', () => {
  it('reports every required rule missing when nothing was entered', () => {
    expect(missingStudentRules(undefined, undefined)).toHaveLength(5);
  });
  it('takes pass and resits from assessment rules and the rest from the form', () => {
    const missing = missingStudentRules(
      { passRequirements: '40%', resits: 'One resit' },
      {
        policies: {
          lateWork: 'Capped at pass',
          attendance: '80%',
          gradingScale: '70+ distinction',
        },
      }
    );
    expect(missing).toEqual([]);
  });
  it('never invents a stated text', () => {
    const rules = studentRules(undefined, { policies: {} });
    expect(rules.every((r) => r.text === null)).toBe(true);
  });
});

describe('buildCourseSyllabus', () => {
  it('uses the module, not the programme', () => {
    const w = workflow();
    const c = buildCourseSyllabus(w, modOf(w), {});
    expect(c.outcomes).toEqual(['Explain supply and demand.', 'Apply elasticity to a tax.']);
    expect(c.facts).toContainEqual(['Credits', '10']);
    expect(c.buildsOn).toEqual(['M01: Foundations']);
  });

  it('groups lessons into weeks and leaves out columns with nothing to show', () => {
    const w = workflow();
    const c = buildCourseSyllabus(w, modOf(w), { sessionsPerWeek: 2 });
    expect(c.weeks).toHaveLength(2);
    expect(c.scheduleTable.headers).not.toContain('Starts');
    expect(c.scheduleTable.headers).toContain('Readings');
    expect(c.scheduleTable.rows[0][c.scheduleTable.headers.indexOf('Readings')]).toBe(
      'No set reading'
    );
    expect(c.scheduleTable.rows[1][c.scheduleTable.headers.indexOf('Readings')]).toContain(
      'chapters: 4; pages: 80-110'
    );
  });

  it('adds dates only when a start date is given', () => {
    const w = workflow();
    const c = buildCourseSyllabus(w, modOf(w), { startDate: '2027-01-11', sessionsPerWeek: 2 });
    expect(c.scheduleTable.headers).toContain('Starts');
    expect(c.scheduleTable.rows[1][1]).toBe('18 Jan 2027');
    expect(c.workTable.rows[c.workTable.rows.length - 1][3]).toBe('Week 2 (by 24 Jan 2027)');
  });

  it('marks ungraded formative work as practice and names the graded work once', () => {
    const w = workflow();
    const c = buildCourseSyllabus(w, modOf(w), {});
    expect(c.workTable.rows.map((r) => r[2])).toEqual(['Practice, not graded', 'Graded']);
    expect(c.components).toHaveLength(1);
    expect(c.components[0].title).toBe('Economics Worksheet');
    expect(c.weightTotal).toBe(100);
  });

  it('takes band names from the pack', () => {
    const w = workflow();
    const c = buildCourseSyllabus(w, modOf(w), {});
    expect(c.criteriaTable?.headers).toEqual([
      'Criterion',
      'Refer',
      'Pass',
      'Merit',
      'Distinction',
    ]);
  });

  it('falls back to Step 4 topics when there are no lessons', () => {
    const w = workflow({ step10: undefined });
    const c = buildCourseSyllabus(w, modOf(w), {});
    expect(c.weeks.map((x) => x.covers[0])).toEqual(['Markets', 'Tax']);
  });
});

describe('checkCourseSyllabus', () => {
  it('passes everything except the unstated rules on a full module', () => {
    const w = workflow();
    const c = buildCourseSyllabus(w, modOf(w), {});
    const r = checkCourseSyllabus(c, modOf(w));
    expect(r.checks.filter((k) => !k.ok).map((k) => k.key)).toEqual(['institutionRules']);
  });

  it('passes fully when the institution has entered its rules', () => {
    const w = workflow({
      assessmentRules: { passRequirements: '40%', resits: 'One resit' },
    });
    const inputs = { policies: { lateWork: 'x', attendance: 'y', gradingScale: 'z' } };
    const c = buildCourseSyllabus(w, modOf(w), inputs);
    expect(checkCourseSyllabus(c, modOf(w)).ok).toBe(true);
  });

  it('fails when weights do not reach 100', () => {
    const w = workflow();
    w.step7.formativeAssessments[1].weighting = 40;
    const c = buildCourseSyllabus(w, modOf(w), {});
    const r = checkCourseSyllabus(c, modOf(w));
    expect(r.checks.find((k) => k.key === 'weightsSum100')?.ok).toBe(false);
  });

  it('fails the assessed and complete sections for a module with no assessments', () => {
    const w = workflow({ step7: { formativeAssessments: [] }, step12: undefined });
    const c = buildCourseSyllabus(w, modOf(w), {});
    const failed = checkCourseSyllabus(c, modOf(w))
      .checks.filter((k) => !k.ok)
      .map((k) => k.key);
    expect(failed).toEqual(expect.arrayContaining(['complete', 'assessed', 'weightsSum100']));
  });

  it('fails when the outcomes shown are not the module outcomes', () => {
    const w = workflow();
    const c = { ...buildCourseSyllabus(w, modOf(w), {}), outcomes: ['A programme outcome.'] };
    expect(
      checkCourseSyllabus(c, modOf(w)).checks.find((k) => k.key === 'outcomesAreMLOs')?.ok
    ).toBe(false);
  });

  it('finds empty table cells', () => {
    expect(emptyCells('t', { headers: ['A', 'B'], rows: [['x', ' ']] })).toEqual([
      't, row 1, column "B"',
    ]);
    expect(emptyCells('t', null)).toEqual([]);
  });

  it('words failures for Unresolved Issues and reports the rules once', () => {
    const w = workflow({ step7: { formativeAssessments: [] } });
    const r = checkCourseSyllabus(buildCourseSyllabus(w, modOf(w), {}), modOf(w));
    const issues = courseIssues([r, r]);
    expect(issues.filter((i) => i.includes('institution rules'))).toHaveLength(1);
    expect(issues.some((i) => i.startsWith('M02 Economics'))).toBe(true);
  });
});

describe('Word body', () => {
  it('writes the overview and one course syllabus per module with the four headings', () => {
    const w = workflow();
    const step14: any = {
      inputs: { instructor: { name: 'Dr T' }, semester: 'I' },
      generatedSections: {
        courseDescription: 'About.',
        learningOutcomes: ['A programme outcome.'],
      },
    };
    const blocks = programmeSyllabusBody(w, step14);
    expect(blocks.length).toBeGreaterThan(20);
    const course = courseSyllabusBody(buildCourseSyllabus(w, modOf(w), {}));
    expect(course.length).toBeGreaterThan(15);
  });
});
