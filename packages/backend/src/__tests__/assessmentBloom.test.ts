/**
 * Bloom's taxonomy handling in Step 7.
 *
 * These exist because the taxonomy was, until now, honoured only by asking the model to
 * honour it. The prompt carried a "BLOOM FLOOR" rule; the backend consulted the taxonomy
 * order in exactly one place, to pick a format, and never compared a question to the outcome
 * it assessed — a question did not even record which outcome that was. On the 46-module
 * Bachelor in Business Administration, only 21% of the questions in create-level modules
 * worked at create, and every validation flag on the step was green.
 */

import {
  assignMlosToSlots,
  auditAssessmentBloom,
  auditProgrammeBloom,
  bloomIndex,
  deriveTargetBloomLevels,
  isDescriptionOnly,
  normaliseBloom,
  normaliseQuestionType,
  planFormativeFormats,
  questionPlanForBloom,
  uncollectedArtefacts,
} from '../services/bloomTaxonomy';

const ALL_FORMATS = [
  'Short quizzes',
  'MCQ knowledge checks',
  'Scenario-based micro-tasks',
  'Worksheets / problem sets',
  'Short written reflections',
  'Mini-case exercises',
  'Discussion prompts',
  'Practice simulations',
];

const mlo = (id: string, bloomLevel: string, statement = `Outcome ${id}`) => ({
  id,
  bloomLevel,
  statement,
});

describe('normaliseBloom', () => {
  it('folds the British and American spellings onto one key', () => {
    expect(normaliseBloom('analyse')).toBe('analyse');
    expect(normaliseBloom('analyze')).toBe('analyse');
    expect(normaliseBloom('Analyze')).toBe('analyse');
  });

  it('accepts the capitalised levels the model returns', () => {
    expect(normaliseBloom('Create')).toBe('create');
    expect(normaliseBloom(' EVALUATE ')).toBe('evaluate');
  });

  it('orders the taxonomy so "at least this demanding" is answerable', () => {
    expect(bloomIndex('remember')).toBeLessThan(bloomIndex('understand'));
    expect(bloomIndex('apply')).toBeLessThan(bloomIndex('analyse'));
    expect(bloomIndex('analyze')).toBeLessThan(bloomIndex('evaluate'));
    expect(bloomIndex('evaluate')).toBeLessThan(bloomIndex('create'));
  });
});

describe('questionPlanForBloom', () => {
  it('asks for fewer, larger tasks as the level rises', () => {
    const understand = questionPlanForBloom('understand');
    const create = questionPlanForBloom('create');
    expect(understand.max).toBeGreaterThan(create.max);
    expect(create.max).toBeLessThanOrEqual(4);
  });

  it('tells a create-level assessment to collect the artefact, not describe it', () => {
    expect(questionPlanForBloom('create').guidance).toMatch(/PRODUCES the artefact/i);
    expect(questionPlanForBloom('create').guidance).toMatch(/does NOT evidence this level/i);
  });
});

describe('assignMlosToSlots', () => {
  it('spreads the demanding outcomes across assessments rather than stacking them', () => {
    const module = {
      mlos: [
        mlo('LO1', 'understand'),
        mlo('LO2', 'create'),
        mlo('LO3', 'apply'),
        mlo('LO4', 'create'),
      ],
    };
    const slots = assignMlosToSlots(module, 2);
    expect(slots).toHaveLength(2);
    // Both create-level outcomes must not land in the same assessment, or one of them is
    // evidenced by an assessment pitched for something else.
    expect(slots[0]).toContain('LO2');
    expect(slots[1]).toContain('LO4');
  });

  it('covers every outcome exactly once', () => {
    const module = { mlos: ['LO1', 'LO2', 'LO3', 'LO4', 'LO5'].map((id) => mlo(id, 'apply')) };
    const slots = assignMlosToSlots(module, 2);
    expect(slots.flat().sort()).toEqual(['LO1', 'LO2', 'LO3', 'LO4', 'LO5']);
  });

  it('never leaves an assessment with nothing to be marked against', () => {
    const module = { mlos: [mlo('LO1', 'create')] };
    const slots = assignMlosToSlots(module, 3);
    expect(slots.every((s) => s.length > 0)).toBe(true);
  });

  it('survives a module with no outcomes at all', () => {
    expect(assignMlosToSlots({ mlos: [] }, 2)).toEqual([[], []]);
  });
});

describe('planFormativeFormats', () => {
  it('does not give a create-level outcome a multiple-choice knowledge check', () => {
    const module = {
      id: 'M31',
      title: 'Business Intelligence',
      sequenceOrder: 31,
      mlos: [mlo('LO1', 'create'), mlo('LO2', 'create')],
    };
    const plan = planFormativeFormats(module, ALL_FORMATS, 2);
    for (const slot of plan.slots) {
      expect(slot.bloom).toBe('create');
      expect(['Short quizzes', 'MCQ knowledge checks']).not.toContain(slot.format);
    }
  });

  it('pitches each assessment at the level of the outcomes IT carries, not the module peak', () => {
    // The module reaches create, but the assessment carrying only the understand-level
    // outcome is legitimately a comprehension quiz. Choosing on the module's highest level
    // alone made every assessment in a mixed module the same shape.
    const module = {
      id: 'M1',
      sequenceOrder: 1,
      mlos: [mlo('LO1', 'create'), mlo('LO2', 'understand')],
    };
    const plan = planFormativeFormats(module, ALL_FORMATS, 2);
    const levels = plan.slots.map((s) => s.bloom).sort();
    expect(levels).toEqual(['create', 'understand']);
  });

  it('warns instead of silently accepting formats that cannot evidence the outcome', () => {
    const module = { id: 'M9', title: 'Consulting', mlos: [mlo('LO1', 'create')] };
    const plan = planFormativeFormats(module, ['Short quizzes', 'MCQ knowledge checks'], 2);
    expect(plan.warning).toMatch(/none of the permitted formative formats/i);
  });

  it('reports an empty permitted list as a configuration problem, not silence', () => {
    const plan = planFormativeFormats({ id: 'M1', mlos: [mlo('LO1', 'apply')] }, [], 2);
    expect(plan.formats).toEqual([]);
    expect(plan.warning).toMatch(/no permitted formative assessment types/i);
  });

  it('rotates on `sequence` as well as `sequenceOrder`', () => {
    // The two Step 4 paths write different keys; reading only one collapsed the rotation to
    // zero for every module, so modules at the same level all received an identical pair.
    const mlos = [mlo('LO1', 'analyse'), mlo('LO2', 'analyse')];
    const a = planFormativeFormats({ id: 'A', sequence: 0, mlos }, ALL_FORMATS, 2);
    const b = planFormativeFormats({ id: 'B', sequence: 1, mlos }, ALL_FORMATS, 2);
    expect(a.formats).not.toEqual(b.formats);
  });
});

describe('auditAssessmentBloom', () => {
  const module = {
    id: 'M31',
    title: 'Business Intelligence',
    mlos: [mlo('LO1', 'create'), mlo('LO2', 'analyze')],
  };

  it('catches a question sitting below the outcome it is mapped to', () => {
    const assessment = {
      alignedMLOs: ['LO1', 'LO2'],
      questions: [
        { questionNumber: 1, alignedMLO: 'LO1', bloomLevel: 'create' },
        { questionNumber: 2, alignedMLO: 'LO2', bloomLevel: 'remember' },
      ],
    };
    const audit = auditAssessmentBloom(assessment, module);
    expect(audit.belowFloor).toHaveLength(1);
    expect(audit.belowFloor[0]).toMatchObject({
      questionNumber: 2,
      mlo: 'LO2',
      required: 'analyse',
    });
  });

  it('fails an assessment whose tasks never reach the level its outcomes demand', () => {
    const assessment = {
      alignedMLOs: ['LO1'],
      questions: [
        { questionNumber: 1, alignedMLO: 'LO1', bloomLevel: 'apply' },
        { questionNumber: 2, alignedMLO: 'LO1', bloomLevel: 'analyse' },
      ],
    };
    const audit = auditAssessmentBloom(assessment, module);
    expect(audit.required).toBe('create');
    expect(audit.reached).toBe('analyse');
    expect(audit.meetsFloor).toBe(false);
  });

  it('passes when lower-level items scaffold a task that does reach the level', () => {
    const assessment = {
      alignedMLOs: ['LO1'],
      questions: [
        { questionNumber: 1, alignedMLO: 'LO1', bloomLevel: 'understand' },
        { questionNumber: 2, alignedMLO: 'LO1', bloomLevel: 'create' },
      ],
    };
    expect(auditAssessmentBloom(assessment, module).meetsFloor).toBe(true);
  });

  it('does not pass vacuously when there are no questions at all', () => {
    // `.every()` over an empty array is true, and this codebase has shipped that mistake
    // before: a rubric check reported rubrics present on modules with no assessments.
    const assessment = { alignedMLOs: ['LO1'], questions: [] };
    const audit = auditAssessmentBloom(assessment, module);
    expect(audit.meetsFloor).toBe(false);
    expect(audit.reached).toBeNull();
  });

  it('matches an American-spelled outcome against a British-spelled question', () => {
    const assessment = {
      alignedMLOs: ['LO2'],
      questions: [{ questionNumber: 1, alignedMLO: 'LO2', bloomLevel: 'Analyse' }],
    };
    expect(auditAssessmentBloom(assessment, module).meetsFloor).toBe(true);
  });

  it('flags a question naming an outcome the assessment does not carry', () => {
    const assessment = {
      alignedMLOs: ['LO1'],
      questions: [{ questionNumber: 1, alignedMLO: 'LO-does-not-exist', bloomLevel: 'create' }],
    };
    expect(auditAssessmentBloom(assessment, module).unmappedQuestions).toEqual([1]);
  });
});

describe('deriveTargetBloomLevels', () => {
  it('reads the levels from the curriculum rather than from the model', () => {
    const module = { mlos: [mlo('LO1', 'create'), mlo('LO2', 'understand')] };
    const assessment = {
      alignedMLOs: ['LO1', 'LO2'],
      // What the model claimed. It named a level no aligned outcome holds.
      targetBloomLevels: ['remember', 'understand', 'apply', 'analyse'],
    };
    expect(deriveTargetBloomLevels(assessment, module)).toEqual(['understand', 'create']);
  });

  it('returns nothing when the assessment is mapped to no real outcome', () => {
    expect(deriveTargetBloomLevels({ alignedMLOs: ['ghost'] }, { mlos: [] })).toEqual([]);
  });
});

describe('auditProgrammeBloom', () => {
  it('names the modules whose assessments fall short', () => {
    const modules = [
      { id: 'M1', title: 'Intro', mlos: [mlo('LO1', 'understand')] },
      { id: 'M2', title: 'Capstone', mlos: [mlo('LO2', 'create')] },
    ];
    const formatives = [
      {
        id: 'a1',
        moduleId: 'M1',
        alignedMLOs: ['LO1'],
        questions: [{ questionNumber: 1, alignedMLO: 'LO1', bloomLevel: 'understand' }],
      },
      {
        id: 'a2',
        moduleId: 'M2',
        alignedMLOs: ['LO2'],
        questions: [{ questionNumber: 1, alignedMLO: 'LO2', bloomLevel: 'apply' }],
      },
    ];
    const report = auditProgrammeBloom(formatives, modules);
    expect(report.floorMet).toBe(false);
    expect(report.shortfalls).toHaveLength(1);
    expect(report.shortfalls[0]).toMatchObject({
      moduleTitle: 'Capstone',
      required: 'create',
      reached: 'apply',
    });
    expect(report.questionsBelowFloor).toBe(1);
    expect(report.totalQuestions).toBe(2);
  });

  it('counts the distribution across the whole programme', () => {
    const modules = [{ id: 'M1', mlos: [mlo('LO1', 'apply')] }];
    const formatives = [
      {
        moduleId: 'M1',
        alignedMLOs: ['LO1'],
        questions: [
          { questionNumber: 1, alignedMLO: 'LO1', bloomLevel: 'apply' },
          { questionNumber: 2, alignedMLO: 'LO1', bloomLevel: 'Analyze' },
        ],
      },
    ];
    const report = auditProgrammeBloom(formatives, modules);
    expect(report.distribution.apply).toBe(1);
    expect(report.distribution.analyse).toBe(1);
    expect(report.floorMet).toBe(true);
  });
});

describe('normaliseQuestionType', () => {
  it('folds the four spellings of short answer onto one', () => {
    for (const spelling of ['short_answer', 'shortAnswer', 'short answer', 'short-answer']) {
      expect(normaliseQuestionType(spelling)).toBe('short_answer');
    }
  });

  it('folds both spellings of file upload onto one', () => {
    expect(normaliseQuestionType('file-upload')).toBe('file_upload');
    expect(normaliseQuestionType('fileUpload')).toBe('file_upload');
  });

  it('maps a production task onto the practical type', () => {
    expect(normaliseQuestionType('design task')).toBe('practical');
    expect(normaliseQuestionType('modelling')).toBe('practical');
  });

  it('never returns an empty type', () => {
    expect(normaliseQuestionType(undefined)).toBe('short_answer');
    expect(normaliseQuestionType('')).toBe('short_answer');
  });
});

describe('uncollectedArtefacts', () => {
  const module = {
    mlos: [mlo('LO1', 'create', 'Create interactive KPI dashboards from cleaned datasets')],
  };

  it('does not accept a description of the artefact as the artefact', () => {
    // This is verbatim what the generated Business Intelligence module handed in.
    const assessments = [
      {
        studentBrief: {
          task: 'Outline an accessible interactive KPI dashboard with drill-through.',
          deliverables: ['Dashboard wireframe description with visuals and accessibility notes'],
        },
      },
    ];
    expect(uncollectedArtefacts(module, assessments)).toContain('dashboard');
  });

  it('accepts the artefact when it is actually handed in', () => {
    const assessments = [
      {
        studentBrief: {
          task: 'Build the dashboard from the supplied dataset.',
          deliverables: ['A working interactive KPI dashboard file (.pbix)'],
        },
      },
    ];
    expect(uncollectedArtefacts(module, assessments)).toEqual([]);
  });

  it('reports nothing when the outcomes promise no artefact', () => {
    const noArtefact = { mlos: [mlo('LO1', 'understand', 'Explain the role of managers')] };
    expect(uncollectedArtefacts(noArtefact, [])).toEqual([]);
  });

  it('recognises a deliverable that names the artefact in its own words', () => {
    const presentation = {
      mlos: [mlo('LO1', 'create', 'Create a persuasive executive presentation')],
    };
    const assessments = [
      { studentBrief: { task: 'Record it.', deliverables: ['A 6-slide deck with narration'] } },
    ];
    expect(uncollectedArtefacts(presentation, assessments)).toEqual([]);
  });
});

describe('isDescriptionOnly', () => {
  it('spots the hedges that turn producing into describing', () => {
    expect(isDescriptionOnly('Dashboard wireframe description')).toBe(true);
    expect(isDescriptionOnly('Outline of the implementation roadmap')).toBe(true);
    expect(isDescriptionOnly('Sketch the layout')).toBe(true);
  });

  it('leaves a real deliverable alone', () => {
    expect(isDescriptionOnly('A working interactive KPI dashboard (.pbix)')).toBe(false);
    expect(isDescriptionOnly('A one-page implementation roadmap')).toBe(false);
  });
});
