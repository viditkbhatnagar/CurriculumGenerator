/**
 * The three OTHM-layout documents Rejin asked for (13 October 2026): each unit's assessment
 * criteria are written once and tied to their outcome's wording, and the documents are built
 * from the programme without claiming anything it does not hold.
 */
import JSZip from 'jszip';
import {
  currentCriteria,
  parseUnitCriteria,
  UNIT_CRITERIA_VERSION,
  unitCriteriaComplete,
} from '../services/othm/unitCriteria';
import {
  NOT_STATED,
  othmQualification,
  othmUnits,
  outcomeRange,
  TO_BE_ASSIGNED,
} from '../services/othm/othmModel';
import { OTHM_DOCUMENTS } from '../services/othm/othmDocx';

const unit1 = {
  id: 'mod-1',
  code: 'M01',
  title: 'Supply Chain Foundations',
  description: 'Introduces supply chains.',
  credits: 6,
  totalHours: 60,
  contactHours: 18,
  mlos: [
    { id: 'M01-LO1', statement: 'Describe supply chain flows.', bloomLevel: 'understand' },
    { id: 'M01-LO2', statement: 'Analyse logistics costs.', bloomLevel: 'analyse' },
  ],
  topics: ['Flows and stakeholders', { title: 'Costing', subtopics: ['Landed cost'] }],
};

const answer = JSON.stringify({
  unitAim: 'The aim of this unit is to introduce supply chains.',
  outcomes: [
    {
      id: 'M01-LO1',
      criteria: ['Explain material flows.', 'Describe information flows.'],
      indicativeContent: ['Flows; stakeholders'],
    },
    {
      id: 'M01-LO2',
      criteria: ['Analyse landed cost.', 'Evaluate cost drivers.', 'x'],
      indicativeContent: ['Landed cost'],
    },
  ],
});

describe('unit assessment criteria', () => {
  it('keeps criteria for every outcome, tied to its wording', () => {
    const parsed = parseUnitCriteria(answer, unit1)!;
    expect(parsed.version).toBe(UNIT_CRITERIA_VERSION);
    expect(parsed.outcomes['M01-LO2'].criteria).toHaveLength(3);
    expect(parsed.outcomes['M01-LO1'].statement).toBe('Describe supply chain flows.');
    expect(unitCriteriaComplete({ ...unit1, othm: parsed })).toBe(true);
  });

  it('refuses an answer that leaves an outcome with fewer than two criteria', () => {
    const short = JSON.stringify({
      unitAim: 'The aim of this unit is to x.',
      outcomes: [{ id: 'M01-LO1', criteria: ['Only one.'] }],
    });
    expect(parseUnitCriteria(short, unit1)).toBeNull();
    expect(parseUnitCriteria('not json', unit1)).toBeNull();
  });

  it('treats criteria written for earlier wording as not written', () => {
    const othm = parseUnitCriteria(answer, unit1)!;
    const edited = { ...unit1.mlos[0], statement: 'Describe and compare supply chain flows.' };
    expect(currentCriteria({ othm }, edited)).toBeUndefined();
    expect(currentCriteria({ othm }, unit1.mlos[1])).toBeDefined();
  });
});

describe('the programme as an OTHM qualification', () => {
  const othm = parseUnitCriteria(answer, unit1)!;
  const workflow = {
    projectName: 'Diploma in Logistics',
    step1: {
      programTitle: 'Diploma in Logistics',
      academicLevel: 'diploma',
      creditFramework: { credits: 6, totalHours: 60, contactHours: 18 },
      entryRequirements: 'Level 3 qualification.',
    },
    step4: { modules: [{ ...unit1, othm }] },
    step7: {
      formativeAssessments: [
        {
          id: 's1',
          moduleId: 'mod-1',
          purpose: 'module_summative',
          alignedMLOs: ['M01-LO1', 'M01-LO2'],
          assessmentType: 'report',
          title: 'Cost report',
        },
      ],
    },
    assessmentRules: { resits: 'One resit, capped at a pass.' },
  };

  it('writes outcome ranges the way OTHM does', () => {
    expect(outcomeRange([1, 2, 3], 3)).toBe('All 1 to 3');
    expect(outcomeRange([3, 1], 4)).toBe('1, 3');
    expect(outcomeRange([2], 4)).toBe('2');
  });

  it('numbers each outcome’s criteria and briefs the task against them', () => {
    const [unit] = othmUnits(workflow);
    expect(unit.outcomes[1].criteria.map((c) => c.ref)).toEqual(['2.1', '2.2', '2.3']);
    expect(unit.grading).toBe('Pass / Fail');
    expect(unit.assessment[0]).toMatchObject({ outcomes: 'All 1 to 2', type: 'Report' });
    expect(unit.brief!.taskHeading).toBe(
      'Task 1 of 1 – Report (LO1 AC 1.1, 1.2; LO2 AC 2.1, 2.2, 2.3)'
    );
    expect(unit.brief!.instructions).toHaveLength(5);
  });

  it('claims no regulator numbers, and says what the institution has not stated', () => {
    const q = othmQualification(workflow);
    expect(q.regulatory).toContainEqual(['Qualification Reference Number', TO_BE_ASSIGNED]);
    expect(q.opportunitiesToPass).toBe('One resit, capped at a pass.');
    expect(q.equality).toBe(NOT_STATED);
    expect(q.entryIsProposal).toBe(true);
    expect(q.unitsMissingCriteria).toEqual([]);
  });

  it('marks a unit whose criteria are not written yet', () => {
    const q = othmQualification({ ...workflow, step4: { modules: [unit1] } });
    expect(q.unitsMissingCriteria).toEqual(['M01']);
    expect(q.units[0].outcomes.every((o) => o.missing)).toBe(true);
  });

  it('builds all three Word documents', async () => {
    for (const [kind, doc] of Object.entries(OTHM_DOCUMENTS)) {
      const zip = await JSZip.loadAsync(await doc.build(workflow));
      const xml = await zip.file('word/document.xml')!.async('string');
      expect(xml).toContain('Diploma in Logistics');
      if (kind !== 'qualification-specification') continue;
      expect(xml).toContain('Regulatory Information');
      expect(xml).toContain(TO_BE_ASSIGNED);
    }
  });
});
