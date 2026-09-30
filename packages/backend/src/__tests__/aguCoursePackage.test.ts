import mammoth from 'mammoth';
import { briefItems, coursePackageBuffer } from '../agu/export/coursePackageDocx';
import { AGU_CATALOGUE_V1_4, catalogueCourse } from '../agu/catalogue/catalogueV1_4';
import { DISCLOSURES } from '../agu/rules/usUtahRules';
import { validDraft } from './fixtures/aguDraftFixture';

describe('briefItems', () => {
  it('turns an inline enumeration into a lead-in and a list', () => {
    const brief =
      'Using a provided dataset, deliver: (1) a one-page decision brief; (2) a data preparation log; and (3) a short reflection.';
    expect(briefItems(brief)).toEqual({
      lead: 'Using a provided dataset, deliver:',
      items: [
        '(1) a one-page decision brief',
        '(2) a data preparation log',
        '(3) a short reflection.',
      ],
    });
  });

  it('leaves a brief with no enumeration as written', () => {
    expect(briefItems('Write a 2,000-word report on the case.')).toEqual({
      lead: 'Write a 2,000-word report on the case.',
      items: [],
    });
  });

  it('does not split on a single parenthesised number', () => {
    expect(briefItems('Answer question (1) in full.').items).toEqual([]);
  });
});

describe('institutional disclosures in the course package', () => {
  // The rule pack says which documents carry each disclosure (requiredIn). The export placed
  // them by hand and left three out: the course specification had neither the registration
  // nor the accreditation statement, and the contact-hour map lacked the credit qualifier.
  const TEMPLATES: [string, string][] = [
    ['T01 · Course Specification', 'course_specification'],
    ['T02 · Syllabus (student-facing)', 'syllabus'],
    ['T04 · Contact-Hour Map', 'contact_hour_map'],
  ];
  let sections: Map<string, string>;

  beforeAll(async () => {
    const buffer = await coursePackageBuffer({
      draft: validDraft(),
      course: catalogueCourse('CR08')!,
      catalogue: AGU_CATALOGUE_V1_4,
      findings: [],
      status: 'ready_for_review',
      version: 1,
      sourcesOffered: 12,
      stageRuns: [],
    });
    const html = (await mammoth.convertToHtml({ buffer })).value;
    const text = (fragment: string) =>
      fragment
        .replace(/<[^>]+>/g, ' ')
        .replace(/&#39;|&rsquo;/g, '’')
        .replace(/\s+/g, ' ');
    sections = new Map(
      html
        .split('<h1>')
        .slice(1)
        .map((part) => [text(part.slice(0, part.indexOf('</h1>'))).trim(), text(part)])
    );
  });

  it.each(TEMPLATES)('%s carries every disclosure the rule pack requires in it', (heading, doc) => {
    const section = sections.get(heading);
    expect(section).toBeDefined();
    const required = DISCLOSURES.filter((d) => d.requiredIn.includes(doc));
    expect(required.length).toBeGreaterThan(0);
    for (const d of required) expect(section).toContain(d.text.replace(/\s+/g, ' '));
  });
});
