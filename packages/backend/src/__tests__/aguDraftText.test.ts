import { AGU_CATALOGUE_V1_4 } from '../agu/catalogue/catalogueV1_4';
import { CourseDraft } from '../agu/draft/types';
import { DISCLOSURES } from '../agu/rules/usUtahRules';
import { collectDraftText } from '../agu/validation/draftText';
import { validateDraft } from '../agu/validation/validateDraft';
import { validDraft } from './fixtures/aguDraftFixture';

const CLAIM = 'AGU is an accredited university.';

// Every free-text field AGU writes. Each entry plants the same accreditation claim in one field
// and names the path a finding must point at. The extra keys (scenario, annotation) are fields
// the engine does not write yet: the scan walks the object, so it must reach them anyway.
const PLANTS: [string, (d: CourseDraft) => void][] = [
  ['outcomes[0].statement', (d) => (d.outcomes[0].statement = CLAIM)],
  ['weeks[0].theme', (d) => (d.weeks[0].theme = CLAIM)],
  ['weeks[0].liveLecture.title', (d) => (d.weeks[0].liveLecture.title = CLAIM)],
  ['weeks[0].liveLecture.topics[0]', (d) => (d.weeks[0].liveLecture.topics[0] = CLAIM)],
  [
    'weeks[0].liveLecture.runSheet[1].activity',
    (d) => (d.weeks[0].liveLecture.runSheet[1].activity = CLAIM),
  ],
  [
    'weeks[0].liveLecture.runSheet[1].materials',
    (d) => (d.weeks[0].liveLecture.runSheet[1].materials = CLAIM),
  ],
  [
    'weeks[0].liveLecture.runSheet[1].segment',
    (d) => (d.weeks[0].liveLecture.runSheet[1].segment = CLAIM),
  ],
  ['weeks[0].monitoredStudy[0].activity', (d) => (d.weeks[0].monitoredStudy[0].activity = CLAIM)],
  [
    'weeks[0].monitoredStudy[0].facultyRole',
    (d) => (d.weeks[0].monitoredStudy[0].facultyRole = CLAIM),
  ],
  [
    'weeks[0].monitoredStudy[0].evidenceLogged',
    (d) => (d.weeks[0].monitoredStudy[0].evidenceLogged = CLAIM),
  ],
  [
    'weeks[0].independentStudy[0].activity',
    (d) => (d.weeks[0].independentStudy[0].activity = CLAIM),
  ],
  ['weeks[0].gradedItemsDue[0]', (d) => d.weeks[0].gradedItemsDue.push(CLAIM)],
  ['assessments[0].title', (d) => (d.assessments[0].title = CLAIM)],
  ['assessments[0].brief', (d) => (d.assessments[0].brief = CLAIM)],
  ['assessments[0].aiUse', (d) => (d.assessments[0].aiUse = CLAIM)],
  [
    'assessments[0].rubric[0].criterion',
    (d) =>
      (d.assessments[0].rubric = [
        {
          outcomeId: 'CLO1',
          criterion: CLAIM,
          weight: 100,
          excellent: 'x',
          good: 'y',
          belowStandard: 'z',
        },
      ]),
  ],
  ['cases[0].title', (d) => (d.cases[0].title = CLAIM)],
  ['cases[0].rights', (d) => (d.cases[0].rights = CLAIM)],
  ['cases[0].scenario', (d) => ((d.cases[0] as any).scenario = CLAIM)],
  ['readings[0].annotation', (d) => ((d.readings[0] as any).annotation = CLAIM)],
  ['guide.intro', (d) => d.narrative.push({ field: 'guide.intro', text: CLAIM })],
];

const claimFindings = (d: CourseDraft) =>
  validateDraft(d, AGU_CATALOGUE_V1_4).filter((f) => f.code.startsWith('CLAIM_'));

describe('the claim scan reaches every free-text field of a draft', () => {
  it('finds nothing in the known-good draft', () => {
    expect(claimFindings(validDraft())).toEqual([]);
  });

  it.each(PLANTS)('finds a claim planted in %s and names that field', (path, plant) => {
    const d = validDraft();
    plant(d);
    const found = claimFindings(d);
    expect(found.map((f) => f.path)).toEqual([path]);
    expect(found[0]).toMatchObject({ code: 'CLAIM_ACCREDITATION', severity: 'blocking' });
    expect(found[0].message).toContain(path);
  });

  it('finds every claim when several fields carry one', () => {
    const d = validDraft();
    d.outcomes[1].statement = CLAIM;
    d.assessments[2].aiUse = 'Guaranteed job placement is not affected by AI use.';
    const paths = claimFindings(d).map((f) => f.path);
    expect(paths).toEqual(['outcomes[1].statement', 'assessments[2].aiUse']);
  });

  it('still scans an edited field after the stored narrative went stale', () => {
    // The narrative was written at generation time; a later edit never reaches it.
    const d = validDraft();
    d.narrative = [{ field: 'disclosure.registration', text: DISCLOSURES[0].text }];
    d.weeks[2].theme = CLAIM;
    expect(claimFindings(d).map((f) => f.path)).toEqual(['weeks[2].theme']);
  });
});

describe('what the claim scan leaves alone', () => {
  it('does not flag a reading whose citation, link, doi, authors or title mention accreditation', () => {
    const d = validDraft();
    Object.assign(d.readings[0], {
      citation: 'Smith, J. (2022). Accreditation of business schools. Journal of Higher Education.',
      link: 'https://example.org/accreditation-of-business-schools.pdf',
      doi: '10.1000/accreditation.2022',
      authors: ['Accredited Schools Council', 'DEAC Research Group'],
      title: 'AACSB accreditation and the business school',
      sourceId: 'doi:10.1000/accreditation.2022',
    });
    expect(claimFindings(d)).toEqual([]);
  });

  it('still flags AGU’s own words about the same reading', () => {
    const d = validDraft();
    Object.assign(d.readings[0], {
      citation: 'Smith, J. (2022). Accreditation of business schools.',
      annotation: CLAIM,
    });
    expect(claimFindings(d).map((f) => f.path)).toEqual(['readings[0].annotation']);
  });

  it('does not flag a quotation stored as evidence for an outcome', () => {
    const d = validDraft();
    d.outcomes[0].evidence = [
      { sourceId: 'doi:10.1/x', locator: 'p. 4', quote: 'Schools are accredited by DEAC.' },
    ];
    expect(claimFindings(d)).toEqual([]);
  });

  it('does not scan the locked catalogue facts, which faculty cannot change', () => {
    const d = validDraft();
    d.locked.description = 'An accredited programme.';
    expect(claimFindings(d)).toEqual([]);
  });

  it('does not scan identifiers or fixed vocabulary', () => {
    const d = validDraft();
    d.outcomes[0].id = 'DEAC-accredited';
    d.weeks[0].outcomeIds = ['DEAC-accredited'];
    d.cases[0].source = 'original';
    expect(claimFindings(d)).toEqual([]);
  });
});

describe('collectDraftText', () => {
  it('returns each string with the path it came from, narrative last under its own field', () => {
    const d = validDraft();
    const { fields } = collectDraftText(d);
    const byField = new Map(fields.map((f) => [f.field, f.text]));
    expect(byField.get('outcomes[0].statement')).toBe(d.outcomes[0].statement);
    expect(byField.get('weeks[3].liveLecture.runSheet[2].segment')).toBe('Wrap-up & next steps');
    expect(byField.get('assessments[1].aiUse')).toBe('No AI use during quizzes.');
    expect(fields[fields.length - 1]).toEqual({
      field: 'syllabus.description',
      text: DISCLOSURES[0].text,
    });
  });

  it('skips empty and non-string values, and numbers and flags', () => {
    const d = validDraft();
    d.weeks[0].theme = '   ';
    const fields = collectDraftText(d).fields.map((f) => f.field);
    expect(fields).not.toContain('weeks[0].theme');
    expect(fields).not.toContain('weeks[0].number');
    expect(fields).not.toContain('assessments[0].proctored');
    expect(fields).not.toContain('assessments[0].weight');
  });

  it('copes with a draft that is missing lists, or is not an object', () => {
    expect(collectDraftText({} as CourseDraft)).toEqual({ fields: [], tooDeep: [] });
    expect(collectDraftText(null as unknown as CourseDraft)).toEqual({ fields: [], tooDeep: [] });
    expect(collectDraftText({ narrative: 'x' } as unknown as CourseDraft).fields).toEqual([]);
  });

  it('reports a value nested too deeply to read instead of skipping it silently', () => {
    const d = validDraft();
    let deep: Record<string, unknown> = { note: CLAIM };
    for (let i = 0; i < 40; i++) deep = { next: deep };
    (d.cases[0] as any).extra = deep;
    const { tooDeep } = collectDraftText(d);
    expect(tooDeep).toHaveLength(1);
    expect(tooDeep[0]).toMatch(/^cases\[0\]\.extra\./);
    const findings = validateDraft(d, AGU_CATALOGUE_V1_4);
    expect(findings).toContainEqual(
      expect.objectContaining({ code: 'DRAFT_TOO_DEEP', severity: 'blocking' })
    );
  });
});
