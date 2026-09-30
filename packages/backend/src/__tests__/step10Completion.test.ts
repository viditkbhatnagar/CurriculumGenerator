import {
  plannedLessonCountFor,
  expectedLessonCount,
  isPlanComplete,
  completedModuleIds,
  nextIncompleteModuleIndex,
  moduleStub,
  lessonsHeld,
  moduleStats,
  summariseFromStubs,
  validationFromStubs,
  validationFromPlans,
  modulesInDocument,
} from '../services/step10Completion';

const lessons = (n: number) => Array.from({ length: n }, (_, i) => ({ lessonNumber: i + 1 }));

describe('plannedLessonCountFor', () => {
  it('derives 30 lessons for the 45-contact-hour modules in the reviewed programme', () => {
    expect(plannedLessonCountFor(45)).toBe(30);
  });

  it('honours an agreed count over the derived one', () => {
    expect(plannedLessonCountFor(45, 8)).toBe(8);
  });

  it('never asks for lessons longer than three hours', () => {
    const count = plannedLessonCountFor(100);
    expect((100 * 60) / count).toBeLessThanOrEqual(180);
  });

  it('returns nothing to generate for a module with no contact hours', () => {
    expect(plannedLessonCountFor(0)).toBe(0);
  });
});

describe('isPlanComplete', () => {
  it('rejects the truncated modules that were being reported as generated', () => {
    // The state found in production: module 12 held one lesson of the thirty planned.
    expect(isPlanComplete({ lessons: lessons(1), plannedLessonCount: 30 }, 30)).toBe(false);
    expect(isPlanComplete({ lessons: lessons(19), plannedLessonCount: 30 }, 30)).toBe(false);
  });

  it('accepts a module that holds every lesson it planned', () => {
    expect(isPlanComplete({ lessons: lessons(30), plannedLessonCount: 30 }, 30)).toBe(true);
  });

  it('treats a missing plan as incomplete rather than as nothing to do', () => {
    expect(isPlanComplete(undefined, 30)).toBe(false);
  });

  it('counts a stub by its recorded total, without loading lesson bodies', () => {
    expect(isPlanComplete({ lessons: [], totalLessons: 30, plannedLessonCount: 30 }, 30)).toBe(
      true
    );
    expect(isPlanComplete({ lessons: [], totalLessons: 5, plannedLessonCount: 30 }, 30)).toBe(
      false
    );
  });

  it('does not regenerate a plan that holds more lessons than derived', () => {
    expect(isPlanComplete({ lessons: lessons(32), plannedLessonCount: 30 }, 30)).toBe(true);
  });

  it('falls back to the expectation passed in when the plan never recorded one', () => {
    expect(isPlanComplete({ lessons: lessons(5) }, 30)).toBe(false);
    expect(isPlanComplete({ lessons: lessons(30) }, 30)).toBe(true);
  });
});

describe('completedModuleIds', () => {
  const modules = [
    { id: 'mod-m01', contactHours: 45 },
    { id: 'mod-m02', contactHours: 45 },
    { id: 'mod-m03', contactHours: 45 },
  ];

  it('excludes a module whose lessons were truncated by a failed write', () => {
    const step10 = {
      moduleLessonPlans: [
        { moduleId: 'mod-m01', lessons: lessons(30), plannedLessonCount: 30 },
        { moduleId: 'mod-m02', lessons: lessons(5), plannedLessonCount: 30 },
      ],
    };
    expect([...completedModuleIds(modules, step10)]).toEqual(['mod-m01']);
  });

  it('reports nothing complete when Step 10 has never run', () => {
    expect(completedModuleIds(modules, undefined).size).toBe(0);
  });
});

describe('nextIncompleteModuleIndex', () => {
  const modules = [
    { id: 'mod-m01', contactHours: 45 },
    { id: 'mod-m02', contactHours: 45 },
    { id: 'mod-m03', contactHours: 45 },
  ];

  it('returns to a half-finished module before starting an untouched one', () => {
    const step10 = {
      moduleLessonPlans: [
        { moduleId: 'mod-m01', lessons: lessons(30), plannedLessonCount: 30 },
        { moduleId: 'mod-m02', lessons: lessons(5), plannedLessonCount: 30 },
      ],
    };
    expect(nextIncompleteModuleIndex(modules, step10)).toBe(1);
  });

  it('reports -1 only when every module holds a full set of lessons', () => {
    const step10 = {
      moduleLessonPlans: modules.map((m) => ({
        moduleId: m.id,
        lessons: lessons(30),
        plannedLessonCount: 30,
      })),
    };
    expect(nextIncompleteModuleIndex(modules, step10)).toBe(-1);
  });
});

describe('moduleStub', () => {
  it('drops the lesson bodies but keeps the count they represent', () => {
    const stub = moduleStub({
      moduleId: 'mod-m01',
      moduleCode: 'M01',
      moduleTitle: 'Introduction to Management',
      totalContactHours: 45,
      plannedLessonCount: 30,
      lessons: lessons(30),
    });
    expect(stub.lessons).toEqual([]);
    expect(stub.totalLessons).toBe(30);
    expect(stub.moduleCode).toBe('M01');
    expect(lessonsHeld(stub)).toBe(30);
  });

  it('is small enough that 46 of them are a rounding error in the document budget', () => {
    const stub = moduleStub({
      moduleId: 'mod-m01',
      moduleCode: 'M01',
      moduleTitle: 'Introduction to Management & Organisations',
      totalContactHours: 45,
      plannedLessonCount: 30,
      lessons: lessons(30),
    });
    expect(Buffer.byteLength(JSON.stringify(stub)) * 46).toBeLessThan(100 * 1024);
  });
});

describe('expectedLessonCount', () => {
  it('prefers the agreed count recorded for that module', () => {
    const module = { id: 'mod-m07', contactHours: 45 };
    expect(expectedLessonCount(module, { 'mod-m07': 19 })).toBe(19);
    expect(expectedLessonCount(module, {})).toBe(30);
  });
});

describe('moduleStats', () => {
  const module = { id: 'mod-m01', contactHours: 3, mlos: [{ id: 'mlo1' }, { id: 'mlo2' }] };

  it('reduces lessons to the figures the summary and validation need', () => {
    const plan = {
      moduleId: 'mod-m01',
      totalContactHours: 3,
      lessons: [
        { duration: 90, linkedMLOs: ['mlo1'], caseStudyActivity: {}, formativeChecks: [1, 2] },
        { duration: 90, linkedMLOs: ['mlo2'], formativeChecks: [3] },
      ],
    };
    expect(moduleStats(plan, module)).toEqual({
      lessonCount: 2,
      contactHours: 3,
      lessonMinutes: 180,
      caseStudiesIncluded: 1,
      formativeChecksIncluded: 3,
      durationsValid: true,
      hoursMatch: true,
      mlosCovered: true,
    });
  });

  it('flags a lesson outside the 60-180 minute block', () => {
    const plan = { totalContactHours: 1, lessons: [{ duration: 240, linkedMLOs: [] }] };
    expect(moduleStats(plan, { id: 'm', contactHours: 4 }).durationsValid).toBe(false);
  });

  it('flags an MLO no lesson teaches', () => {
    const plan = { totalContactHours: 3, lessons: [{ duration: 180, linkedMLOs: ['mlo1'] }] };
    expect(moduleStats(plan, module).mlosCovered).toBe(false);
  });

  it('flags lesson time that does not add up to the module hours', () => {
    const plan = { totalContactHours: 45, lessons: [{ duration: 90, linkedMLOs: ['mlo1'] }] };
    expect(moduleStats(plan, { id: 'm', contactHours: 45 }).hoursMatch).toBe(false);
  });
});

describe('summariseFromStubs', () => {
  it('adds up the programme without loading a single lesson body', () => {
    const stubs = [
      {
        moduleId: 'a',
        lessons: [],
        stats: {
          lessonCount: 30,
          contactHours: 45,
          lessonMinutes: 2700,
          caseStudiesIncluded: 4,
          formativeChecksIncluded: 60,
          durationsValid: true,
          hoursMatch: true,
          mlosCovered: true,
        },
      },
      {
        moduleId: 'b',
        lessons: [],
        stats: {
          lessonCount: 30,
          contactHours: 45,
          lessonMinutes: 2700,
          caseStudiesIncluded: 2,
          formativeChecksIncluded: 30,
          durationsValid: true,
          hoursMatch: true,
          mlosCovered: true,
        },
      },
    ];
    expect(summariseFromStubs(stubs)).toEqual({
      totalLessons: 60,
      totalContactHours: 90,
      averageLessonDuration: 90,
      caseStudiesIncluded: 6,
      formativeChecksIncluded: 90,
    });
  });
});

describe('validationFromStubs', () => {
  const modules = [
    { id: 'a', contactHours: 45 },
    { id: 'b', contactHours: 45 },
  ];
  const fullStats = {
    lessonCount: 30,
    contactHours: 45,
    lessonMinutes: 2700,
    caseStudiesIncluded: 2,
    formativeChecksIncluded: 30,
    durationsValid: true,
    hoursMatch: true,
    mlosCovered: true,
  };

  it('does not report every module planned while one is truncated', () => {
    const step10 = {
      moduleLessonPlans: [
        { moduleId: 'a', lessons: [], totalLessons: 30, plannedLessonCount: 30, stats: fullStats },
        {
          moduleId: 'b',
          lessons: [],
          totalLessons: 5,
          plannedLessonCount: 30,
          stats: { ...fullStats, lessonCount: 5 },
        },
      ],
    };
    expect(validationFromStubs(modules, step10).allModulesHaveLessonPlans).toBe(false);
  });

  it('reports every module planned once all of them are whole', () => {
    const step10 = {
      moduleLessonPlans: modules.map((m) => ({
        moduleId: m.id,
        lessons: [],
        totalLessons: 30,
        plannedLessonCount: 30,
        stats: fullStats,
      })),
    };
    expect(validationFromStubs(modules, step10).allModulesHaveLessonPlans).toBe(true);
  });
});

describe('validation reports only what the lessons hold', () => {
  const modules = [
    { id: 'a', contactHours: 45 },
    { id: 'b', contactHours: 45 },
  ];
  const stats = {
    lessonCount: 30,
    contactHours: 45,
    lessonMinutes: 2700,
    caseStudiesIncluded: 2,
    formativeChecksIncluded: 30,
    durationsValid: true,
    hoursMatch: true,
    mlosCovered: true,
  };
  const stub = (moduleId: string, s: any) => ({
    moduleId,
    lessons: [],
    totalLessons: 30,
    plannedLessonCount: 30,
    stats: s,
  });

  // The 21 Sep 2026 Logistics export printed "case studies integrated" and "assessments
  // integrated" as passed directly above a summary of zero case studies and zero formative
  // checks. These are that shape.
  it('fails case-study and assessment integration when no lesson holds either', () => {
    const empty = { ...stats, caseStudiesIncluded: 0, formativeChecksIncluded: 0 };
    const step10 = { moduleLessonPlans: modules.map((m) => stub(m.id, empty)) };
    const v = validationFromStubs(modules, step10);
    expect(v.caseStudiesIntegrated).toBe(false);
    expect(v.assessmentsIntegrated).toBe(false);
  });

  it('fails case-study integration when one module has none, even if another has some', () => {
    const step10 = {
      moduleLessonPlans: [stub('a', stats), stub('b', { ...stats, caseStudiesIncluded: 0 })],
    };
    expect(validationFromStubs(modules, step10).caseStudiesIntegrated).toBe(false);
  });

  it('fails assessment integration when one module has no formative check', () => {
    const step10 = {
      moduleLessonPlans: [stub('a', stats), stub('b', { ...stats, formativeChecksIncluded: 0 })],
    };
    expect(validationFromStubs(modules, step10).assessmentsIntegrated).toBe(false);
  });

  it('passes nothing for a module whose stats were never recorded', () => {
    const step10 = { moduleLessonPlans: [stub('a', stats), stub('b', undefined)] };
    const v = validationFromStubs(modules, step10);
    expect(v.allLessonDurationsValid).toBe(false);
    expect(v.totalHoursMatch).toBe(false);
    expect(v.allMLOsCovered).toBe(false);
    expect(v.caseStudiesIntegrated).toBe(false);
    expect(v.assessmentsIntegrated).toBe(false);
  });

  it('computes a legacy module from its inline lessons when it has no stored stats', () => {
    // Workflows generated before lesson bodies moved to their own collection keep the lessons
    // on the stub and never recorded stats. Skipping them reported real lessons as failing.
    const legacy = [
      {
        moduleId: 'a',
        lessons: [
          { duration: 90, linkedMLOs: ['m1'], caseStudyActivity: {}, formativeChecks: [1] },
        ],
      },
    ];
    const v = validationFromStubs([{ id: 'a', contactHours: 1.5, mlos: [{ id: 'm1' }] }], {
      moduleLessonPlans: legacy,
    });
    expect(Object.values(v)).toEqual(Array(6).fill(true));
  });

  it('passes nothing for a programme with no modules', () => {
    expect(Object.values(validationFromStubs([], { moduleLessonPlans: [] }))).toEqual(
      Array(6).fill(false)
    );
  });

  it('passes every check only when every module earns it', () => {
    const step10 = { moduleLessonPlans: modules.map((m) => stub(m.id, stats)) };
    expect(Object.values(validationFromStubs(modules, step10))).toEqual(Array(6).fill(true));
  });

  it('computes the same flags from full lesson plans', () => {
    const lesson = (extra: any = {}) => ({ duration: 90, linkedMLOs: ['m1'], ...extra });
    const withMlos = modules.map((m) => ({ ...m, contactHours: 3, mlos: [{ id: 'm1' }] }));
    const plans = [
      {
        moduleId: 'a',
        lessons: [lesson({ caseStudyActivity: {}, formativeChecks: [1] }), lesson()],
      },
      { moduleId: 'b', lessons: [lesson({ formativeChecks: [1] }), lesson()] },
    ];
    const v = validationFromPlans(withMlos, plans);
    expect(v.allModulesHaveLessonPlans).toBe(true);
    expect(v.totalHoursMatch).toBe(true);
    expect(v.assessmentsIntegrated).toBe(true);
    expect(v.caseStudiesIntegrated).toBe(false);
  });
});

describe('moduleStats mlosCovered', () => {
  it('does not claim coverage for a module that declares no MLOs', () => {
    const plan = { lessons: [{ duration: 180, linkedMLOs: [] }] };
    expect(moduleStats(plan, { id: 'm', contactHours: 3, mlos: [] }).mlosCovered).toBe(false);
  });
});

describe('moduleStats hoursMatch', () => {
  it('measures lessons against the module, not against their own total', () => {
    // A part-generated module: 22 lessons of 90 minutes, in a module of 45 contact hours.
    // The stored plan's own totalContactHours is derived from those same lessons (33h), so
    // comparing against it would report that the hours add up when a third is missing.
    const plan = {
      totalContactHours: 33,
      lessons: Array.from({ length: 22 }, () => ({ duration: 90, linkedMLOs: [] })),
    };
    expect(moduleStats(plan, { id: 'mod-m07', contactHours: 45 }).hoursMatch).toBe(false);
  });

  it('reports the hours matching once every lesson is there', () => {
    const plan = {
      totalContactHours: 45,
      lessons: Array.from({ length: 30 }, () => ({ duration: 90, linkedMLOs: [] })),
    };
    expect(moduleStats(plan, { id: 'mod-m07', contactHours: 45 }).hoursMatch).toBe(true);
  });
});

describe('modules with nothing to teach', () => {
  it('does not stall the programme on a module with no contact hours', () => {
    // Such a module generates no lessons, so an empty plan can never satisfy isPlanComplete
    // and it would be picked as "next incomplete" for ever.
    const modules = [
      { id: 'a', contactHours: 45 },
      { id: 'b', contactHours: 0 },
    ];
    const step10 = {
      moduleLessonPlans: [{ moduleId: 'a', lessons: [], totalLessons: 30, plannedLessonCount: 30 }],
    };
    expect([...completedModuleIds(modules, step10)].sort()).toEqual(['a', 'b']);
    expect(nextIncompleteModuleIndex(modules, step10)).toBe(-1);
  });
});

describe('checks on a document that holds some of the modules', () => {
  const lesson = (extra: any = {}) => ({
    duration: 90,
    linkedMLOs: ['m1'],
    caseStudyActivity: {},
    formativeChecks: [1],
    ...extra,
  });
  const programme = ['a', 'b', 'c'].map((id) => ({
    id,
    contactHours: 3,
    mlos: [{ id: 'm1' }],
  }));
  const flawless = { moduleId: 'b', lessons: [lesson(), lesson()] };

  // Each file in the Step 10 archive holds one module's plan beside the programme's whole
  // module list. Judged against every module, a flawless module printed six "Fail" rows.
  it('passes a flawless module judged against its own module', () => {
    const v = validationFromPlans(modulesInDocument(programme, [flawless]), [flawless]);
    expect(Object.values(v)).toEqual(Array(6).fill(true));
  });

  it('still fails the whole programme when that one module is all it holds', () => {
    expect(validationFromPlans(programme, [flawless]).allModulesHaveLessonPlans).toBe(false);
  });

  it('keeps Step 4 order and ignores plans for modules Step 4 no longer lists', () => {
    const plans = [{ moduleId: 'c' }, { moduleId: 'gone' }, { moduleId: 'a' }];
    expect(modulesInDocument(programme, plans).map((m) => m.id)).toEqual(['a', 'c']);
  });
});

describe('a module with no contact hours in the programme checks', () => {
  it('does not fail the per-module checks of every other module', () => {
    // A dissertation or placement module with no contact time has nothing to generate, so it
    // has no plan and no stats. It is finished by definition, and it must not turn every
    // other module's durations, hours, outcomes and cases into failures.
    const modules = [
      { id: 'a', contactHours: 3, mlos: [{ id: 'm1' }] },
      { id: 'proj', contactHours: 0, mlos: [{ id: 'p1' }] },
    ];
    const plans = [
      {
        moduleId: 'a',
        lessons: [1, 2].map(() => ({
          duration: 90,
          linkedMLOs: ['m1'],
          caseStudyActivity: {},
          formativeChecks: [1],
        })),
      },
    ];
    expect(Object.values(validationFromPlans(modules, plans))).toEqual(Array(6).fill(true));
  });

  it('passes nothing when no module has anything to teach', () => {
    const v = validationFromPlans([{ id: 'proj', contactHours: 0, mlos: [] }], []);
    expect(v.allLessonDurationsValid).toBe(false);
    expect(v.caseStudiesIntegrated).toBe(false);
  });
});
