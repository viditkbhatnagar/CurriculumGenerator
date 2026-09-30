import { AGU_CATALOGUE_V1_4, catalogueCourse } from '../agu/catalogue/catalogueV1_4';
import { draftFromOutline } from '../agu/generation/outlinePrompt';
import {
  checkDraftShape,
  isHttpUrl,
  MAX_LIST_ITEMS,
  MAX_PROBLEMS,
  MAX_TEXT_LENGTH,
} from '../agu/validation/draftShape';
import { validateDraft } from '../agu/validation/validateDraft';
import { validDraft } from './fixtures/aguDraftFixture';
import { modelAnswer, sources } from './fixtures/aguOutlineFixture';

type Loose = Record<string, any>;

/** A valid draft as the JSON a client would send, changed by `edit`. */
const bodyWith = (edit: (draft: Loose) => void = () => undefined): Loose => {
  const draft = JSON.parse(JSON.stringify(validDraft()));
  edit(draft);
  return { draft };
};
const problemsWith = (edit: (draft: Loose) => void) => checkDraftShape(bodyWith(edit));

describe('checkDraftShape: what a good draft looks like', () => {
  it('accepts a complete draft', () => {
    expect(checkDraftShape(bodyWith())).toEqual([]);
  });

  it('accepts a draft the generator built, so faculty can save edits to it', () => {
    const { draft } = draftFromOutline(
      modelAnswer,
      catalogueCourse('CR08')!,
      AGU_CATALOGUE_V1_4,
      sources
    );
    expect(checkDraftShape({ draft })).toEqual([]);
    // ... and after the round trip through the database and the browser.
    expect(checkDraftShape({ draft: JSON.parse(JSON.stringify(draft)) })).toEqual([]);
  });

  it('accepts optional fields that are absent, undefined or null', () => {
    const problems = problemsWith((d) => {
      d.assessments[0].brief = undefined;
      d.assessments[0].rubric = null;
      d.readings[0].link = null;
      d.readings[1].link = '';
      d.readings[2].sourceId = undefined;
      d.weeks[0].liveLecture.runSheet[0].materials = undefined;
    });
    expect(problems).toEqual([]);
  });

  it('accepts empty text, so faculty can clear a field while editing', () => {
    expect(problemsWith((d) => (d.weeks[0].theme = ''))).toEqual([]);
  });

  it('accepts fields the engine does not define, so later fields survive a save', () => {
    expect(
      problemsWith((d) => {
        d.cases[0].scenario = 'A retailer forecasts demand.';
        d.readings[0].annotation = 'Read sections 2 and 3.';
      })
    ).toEqual([]);
  });

  it('ignores what the route restores from the catalogue, and any status the client sends', () => {
    const body = bodyWith((d) => {
      d.locked = 'not even an object';
      d.courseCode = 7;
      d.catalogueVersion = null;
    });
    body.status = 'faculty_accepted';
    expect(checkDraftShape(body)).toEqual([]);
  });

  it('produces a draft that validateDraft can read without throwing', () => {
    const body = bodyWith();
    expect(checkDraftShape(body)).toEqual([]);
    expect(() => validateDraft(body.draft, AGU_CATALOGUE_V1_4)).not.toThrow();
  });
});

describe('checkDraftShape: a body that is not a draft', () => {
  it.each([
    [undefined],
    [null],
    ['draft'],
    [42],
    [[]],
    [{}],
    [{ draft: null }],
    [{ draft: 'x' }],
    [{ draft: [] }],
  ])('asks for the whole draft when the body is %j', (body) => {
    const problems = checkDraftShape(body);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/whole draft/i);
  });

  it('names every list a partial draft is missing, and its week count (the F26 body)', () => {
    const problems = checkDraftShape({ draft: { outcomes: [], weeks: [] } });
    expect(problems).toEqual(
      expect.arrayContaining([
        'draft.assessments is required',
        'draft.readings is required',
        'draft.cases is required',
        'draft.narrative is required',
        'draft.weeks must have 4 weeks, not 0',
      ])
    );
  });
});

describe('checkDraftShape: week count', () => {
  it('needs exactly the number of weeks the catalogue sets', () => {
    expect(problemsWith((d) => d.weeks.pop())).toEqual(['draft.weeks must have 4 weeks, not 3']);
    expect(problemsWith((d) => d.weeks.push(d.weeks[0]))).toEqual([
      'draft.weeks must have 4 weeks, not 5',
    ]);
  });
});

describe('checkDraftShape: element fields and types', () => {
  const cases: [string, (d: Loose) => void, string][] = [
    ['an outcome with no id', (d) => delete d.outcomes[0].id, 'draft.outcomes[0].id is required'],
    ['an empty id', (d) => (d.outcomes[0].id = ' '), 'draft.outcomes[0].id must not be empty'],
    [
      'a statement that is a number',
      (d) => (d.outcomes[0].statement = 5),
      'draft.outcomes[0].statement must be text',
    ],
    [
      'an unknown Bloom level',
      (d) => (d.outcomes[0].bloomLevel = 'know'),
      'draft.outcomes[0].bloomLevel must be one of: remember, understand, apply, analyse, evaluate, create',
    ],
    [
      'an unknown origin',
      (d) => (d.outcomes[1].origin = 'model'),
      'draft.outcomes[1].origin must be one of: catalogue, faculty, sourced, proposal, hypothetical',
    ],
    [
      'an evidence reference with no source',
      (d) => (d.outcomes[0].evidence = [{ quote: 'q' }]),
      'draft.outcomes[0].evidence[0].sourceId is required',
    ],
    [
      'a week without a lecture',
      (d) => delete d.weeks[0].liveLecture,
      'draft.weeks[0].liveLecture is required',
    ],
    [
      'lecture hours given as text',
      (d) => (d.weeks[1].liveLecture.hours = '3'),
      'draft.weeks[1].liveLecture.hours must be a number from 0 to 500',
    ],
    [
      'lecture hours that are not finite',
      (d) => (d.weeks[1].liveLecture.hours = Infinity),
      'draft.weeks[1].liveLecture.hours must be a number from 0 to 500',
    ],
    [
      'topics that are not a list',
      (d) => (d.weeks[0].liveLecture.topics = 'Topic 1'),
      'draft.weeks[0].liveLecture.topics must be a list',
    ],
    [
      'a topic that is not text',
      (d) => (d.weeks[0].liveLecture.topics = ['ok', 2]),
      'draft.weeks[0].liveLecture.topics[1] must be text',
    ],
    [
      'an outcome reference that is not text',
      (d) => (d.weeks[2].outcomeIds = ['CLO3', 3]),
      'draft.weeks[2].outcomeIds[1] must be text',
    ],
    [
      'a run-sheet minute given as text',
      (d) => (d.weeks[0].liveLecture.runSheet[0].startMinute = '0'),
      'draft.weeks[0].liveLecture.runSheet[0].startMinute must be a number from 0 to 1440',
    ],
    [
      'negative monitored hours',
      (d) => (d.weeks[0].monitoredStudy[0].hours = -8),
      'draft.weeks[0].monitoredStudy[0].hours must be a number from 0 to 500',
    ],
    [
      'a monitored activity with no faculty role field',
      (d) => delete d.weeks[3].monitoredStudy[0].facultyRole,
      'draft.weeks[3].monitoredStudy[0].facultyRole is required',
    ],
    [
      'independent hours that are a boolean',
      (d) => (d.weeks[0].independentStudy[0].hours = true),
      'draft.weeks[0].independentStudy[0].hours must be a number from 0 to 500',
    ],
    [
      'a week number that is not a whole week',
      (d) => (d.weeks[0].number = 1.5),
      'draft.weeks[0].number must be a whole number from 1 to 4',
    ],
    [
      'a weight given as text',
      (d) => (d.assessments[0].weight = '40'),
      'draft.assessments[0].weight must be a number from 0 to 100',
    ],
    [
      'a weight over 100',
      (d) => (d.assessments[0].weight = 140),
      'draft.assessments[0].weight must be a number from 0 to 100',
    ],
    [
      'an assessment due in a week the course does not have',
      (d) => (d.assessments[1].weekDue = 5),
      'draft.assessments[1].weekDue must be a whole number from 1 to 4',
    ],
    [
      'proctored given as text',
      (d) => (d.assessments[2].proctored = 'yes'),
      'draft.assessments[2].proctored must be true or false',
    ],
    [
      'an unknown assessment component',
      (d) => (d.assessments[0].component = 'essay'),
      'draft.assessments[0].component must be one of: applied_assignment, weekly_quiz_discussion, final_exam, capstone_component',
    ],
    [
      'a rubric that is not a list',
      (d) => (d.assessments[0].rubric = 'by effort'),
      'draft.assessments[0].rubric must be a list',
    ],
    [
      'a rubric criterion with no weight',
      (d) =>
        (d.assessments[0].rubric = [
          { outcomeId: 'CLO1', criterion: 'c', excellent: 'e', good: 'g', belowStandard: 'b' },
        ]),
      'draft.assessments[0].rubric[0].weight is required',
    ],
    [
      'required given as text',
      (d) => (d.readings[0].required = 'yes'),
      'draft.readings[0].required must be true or false',
    ],
    [
      'an unknown access status',
      (d) => (d.readings[0].access = 'free'),
      'draft.readings[0].access must be one of: open, original, licensed, unknown, paywalled',
    ],
    [
      'a reading week that is text',
      (d) => (d.readings[3].week = 'four'),
      'draft.readings[3].week must be a whole number from 1 to 4',
    ],
    [
      'an unknown case source',
      (d) => (d.cases[0].source = 'invented'),
      'draft.cases[0].source must be one of: original, licensed, open, hypothetical',
    ],
    [
      'a case with no rights field',
      (d) => delete d.cases[0].rights,
      'draft.cases[0].rights is required',
    ],
    [
      'a narrative entry whose text is a number',
      (d) => (d.narrative[0].text = 7),
      'draft.narrative[0].text must be text',
    ],
    [
      'a narrative entry with no field name',
      (d) => (d.narrative[0].field = ''),
      'draft.narrative[0].field must not be empty',
    ],
    [
      'a list item that is null',
      (d) => (d.outcomes[0] = null),
      'draft.outcomes[0] must be an object',
    ],
    [
      'a list item that is a string',
      (d) => (d.readings = ['r1']),
      'draft.readings[0] must be an object',
    ],
    ['a list that is an object', (d) => (d.cases = { 0: {} }), 'draft.cases must be a list'],
  ];

  it.each(cases)('rejects %s', (_name, edit, expected) => {
    expect(problemsWith(edit)).toEqual([expected]);
  });

  it('reports every problem it finds, not only the first', () => {
    const problems = problemsWith((d) => {
      d.outcomes[0].statement = 5;
      d.weeks[0].liveLecture.hours = 'x';
      d.assessments[0].proctored = 1;
    });
    expect(problems).toHaveLength(3);
  });

  it('stops listing after MAX_PROBLEMS and says how many more there were', () => {
    const problems = problemsWith((d) => {
      d.outcomes = Array.from({ length: 100 }, () => ({}));
    });
    expect(problems).toHaveLength(MAX_PROBLEMS + 1);
    expect(problems[MAX_PROBLEMS]).toMatch(/^\.\.\.and \d+ more problems$/);
  });
});

describe('checkDraftShape: links (F28)', () => {
  const link = (value: unknown) => problemsWith((d) => (d.readings[0].link = value));
  const refusal = 'draft.readings[0].link must be an http or https address';

  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(document.cookie)',
    ' javascript:alert(1)',
    '\tjavascript:alert(1)',
    'jav\nascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    'ftp://example.org/paper.pdf',
    '//evil.example/paper.pdf',
    '/relative/path.pdf',
    'example.org/paper.pdf',
    'http://',
    'https://',
    'https://example.org/a b',
    'https://user:secret@example.org/paper.pdf',
    `https://example.org/${'a'.repeat(3000)}`,
  ])('rejects the link %j', (value) => {
    expect(link(value)).toEqual([refusal]);
  });

  it.each([5, true, {}, ['https://example.org/a.pdf']])('rejects a link that is %j', (value) => {
    expect(link(value)).toEqual([refusal]);
  });

  it.each([
    'https://example.org/paper.pdf',
    'http://example.org/a?b=1&c=2#frag',
    'HTTPS://EXAMPLE.ORG/PAPER.PDF',
    'https://doi.org/10.1000/182',
  ])('accepts the link %j', (value) => {
    expect(link(value)).toEqual([]);
  });

  it('checks every URL-shaped field, not just readings[].link', () => {
    const problems = problemsWith((d) => {
      d.cases[0].url = 'javascript:alert(1)';
      d.readings[1].sourceUrl = 'data:text/html,x';
      d.outcomes[0].evidence = [{ sourceId: 's', link: 'javascript:alert(2)' }];
      d.weeks[0].liveLecture.homepage = 'https://example.org/still-fine';
    });
    expect(problems).toEqual([
      'draft.outcomes[0].evidence[0].link must be an http or https address',
      'draft.readings[1].sourceUrl must be an http or https address',
      'draft.cases[0].url must be an http or https address',
    ]);
  });

  describe('isHttpUrl', () => {
    it('is true only for http and https addresses', () => {
      expect(isHttpUrl('https://example.org/x')).toBe(true);
      expect(isHttpUrl('javascript:alert(1)')).toBe(false);
      expect(isHttpUrl(undefined)).toBe(false);
      expect(isHttpUrl(null)).toBe(false);
    });
  });
});

describe('checkDraftShape: size and depth', () => {
  it('accepts text at the limit and rejects text over it', () => {
    expect(problemsWith((d) => (d.assessments[0].brief = 'x'.repeat(MAX_TEXT_LENGTH)))).toEqual([]);
    expect(problemsWith((d) => (d.assessments[0].brief = 'x'.repeat(MAX_TEXT_LENGTH + 1)))).toEqual(
      ['draft.assessments[0].brief is longer than 10,000 characters']
    );
  });

  it('rejects text over the limit in a field the engine does not define', () => {
    expect(problemsWith((d) => (d.cases[0].scenario = 'x'.repeat(MAX_TEXT_LENGTH + 1)))).toEqual([
      'draft.cases[0].scenario is longer than 10,000 characters',
    ]);
  });

  it('rejects a list with more than MAX_LIST_ITEMS items', () => {
    const problems = problemsWith((d) => {
      d.weeks[0].gradedItemsDue = Array.from({ length: MAX_LIST_ITEMS + 1 }, (_, i) => `Item ${i}`);
    });
    expect(problems).toEqual([
      `draft.weeks[0].gradedItemsDue has more than ${MAX_LIST_ITEMS} items`,
    ]);
  });

  it('rejects a value nested too deeply', () => {
    const problems = problemsWith((d) => {
      let deep: Loose = { text: 'x' };
      for (let i = 0; i < 40; i++) deep = { next: deep };
      d.cases[0].extra = deep;
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/^draft\.cases\[0\]\.extra\..* is nested too deeply$/);
  });
});
