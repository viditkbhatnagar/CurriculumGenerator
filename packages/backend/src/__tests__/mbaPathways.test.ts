import { AGU_CATALOGUE_V1_4 } from '../agu/catalogue/catalogueV1_4';
import { courseState, matchProgrammes, pathwayStatuses } from '../agu/pathways/mbaPathways';

const courses = AGU_CATALOGUE_V1_4.courses;
const programme = (title: string, over: Record<string, unknown> = {}) => ({
  _id: `id-${title}`,
  projectName: title,
  currentStep: 4,
  status: 'step4_complete',
  ...over,
});

describe('MBA pathways', () => {
  it('builds each pathway from the 12 core courses and its 4 specialization courses', () => {
    const statuses = pathwayStatuses(courses, []);
    expect(statuses.map((p) => p.id)).toEqual(['fintech', 'finance', 'supply_chain_operations']);
    for (const p of statuses) {
      expect(p.totals.courses).toBe(16);
      expect(p.totals.credits).toBe(48);
      expect(p.ready).toBe(false);
    }
    expect(statuses[2].courses.slice(12).map((c) => c.code)).toEqual([
      'SC01',
      'SC02',
      'SC03',
      'SC06',
    ]);
  });

  it('matches a programme by title, decoding &amp; and ignoring case', () => {
    const matched = matchProgrammes(courses, [
      programme('Diploma in Aviation &amp; Hospitality'),
      programme('lean &amp; six sigma'),
    ]);
    expect(matched.get('SC03')?.projectName).toBe('lean &amp; six sigma');
    expect(matched.get('CR01')).toBeUndefined();
  });

  it('prefers the furthest-on programme when a title is used twice', () => {
    const matched = matchProgrammes(courses, [
      programme('Lean & Six Sigma', { _id: 'early', currentStep: 2 }),
      programme('Lean & Six Sigma', { _id: 'done', status: 'published' }),
    ]);
    expect(matched.get('SC03')?._id).toBe('done');
  });

  it('is ready only when every course is published', () => {
    const all = courses.map((c) =>
      programme(c.title, { status: 'published', publication: { publishedAt: '2027-01-01' } })
    );
    const statuses = pathwayStatuses(courses, all);
    expect(statuses.every((p) => p.ready && p.totals.published === 16)).toBe(true);
    expect(courseState({ _id: 1, status: 'review_pending' })).toBe('submitted');
  });
});

describe('pathway document', () => {
  it('marks an incomplete pathway as a draft and lists what is outstanding', async () => {
    const { pathwayDocxBuffer } = await import('../agu/pathways/pathwayDocx');
    const mammoth = (await import('mammoth')).default;
    const done = courses
      .filter((c) => c.track === 'core')
      .map((c) =>
        programme(c.title, { status: 'published', publication: { publishedAt: '2027-01-01' } })
      );
    const pathway = pathwayStatuses(courses, done)[0];
    const buffer = await pathwayDocxBuffer(
      pathway,
      new Map([
        ['CR01', { step3: { outcomes: [{ code: 'PLO1', statement: 'Prepare statements.' }] } }],
      ]),
      'The 12-course core plus one specialization'
    );
    const text = (await mammoth.extractRawText({ buffer })).value;
    expect(text).toContain('Draft: 12 of 16 courses are published');
    expect(text).toContain('Outstanding');
    expect(text).toContain('FT01 Foundations of FinTech & Digital Finance: not started');
    expect(text).toContain('PLO1: Prepare statements.');
  });
});

describe('topics shared between courses', () => {
  it('flags a topic two courses both teach, but not repetition inside one course', async () => {
    const { sharedTopics } = await import('../agu/pathways/mbaPathways');
    const { repeatedTopics } = await import('../services/step4Validation');
    const overlaps = sharedTopics(
      [
        {
          code: 'CR08',
          modules: [{ code: 'W1', topics: ['Descriptive analytics and dashboards'] }],
        },
        {
          code: 'FT04',
          modules: [
            { code: 'W2', topics: ['Descriptive analytics and dashboards for finance'] },
            { code: 'W3', topics: ['Descriptive analytics and dashboards for finance'] },
          ],
        },
      ],
      repeatedTopics
    );
    expect(overlaps.every((o) => o.first.course !== o.second.course)).toBe(true);
    expect(overlaps[0].first).toEqual({
      course: 'CR08',
      module: 'W1',
      topic: 'Descriptive analytics and dashboards',
    });
    expect(overlaps.map((o) => o.second.course)).toEqual(['FT04', 'FT04']);
  });
});
