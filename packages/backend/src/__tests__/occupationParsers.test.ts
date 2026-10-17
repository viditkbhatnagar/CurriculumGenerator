/**
 * The four national occupation classifications Rejin chose (India, US, UK, Singapore; 16 October
 * 2026), each parsed from its official format into one record shape. Fixtures follow the real
 * files' layouts, including the quirks found building the data.
 */
import {
  parseCsv,
  parseNco,
  parseNcoDescriptions,
  parseOnet,
  parseSsoc,
  parseUkSoc,
} from '../services/occupations/occupationParsers';

describe('O*NET (US)', () => {
  it('reads quoted CSV, core tasks first, and alternate titles', () => {
    expect(parseCsv('a,"b, c","say ""hi"""\n1,2,3\n')).toEqual([
      ['a', 'b, c', 'say "hi"'],
      ['1', '2', '3'],
    ]);
    const [dev] = parseOnet(
      'O*NET-SOC Code,Title,Description\n15-1252.00,Software Developers,"Research, design, and develop software."\n',
      'O*NET-SOC Code,Title,Task ID,Task,Task Type,Incumbents Responding,Date,Domain Source\n' +
        '15-1252.00,Software Developers,1,Write documentation.,Supplemental,,,\n' +
        '15-1252.00,Software Developers,2,Analyze user needs.,Core,,,\n',
      'O*NET-SOC Code,Title,Job Title,Short Title,Source(s)\n15-1252.00,Software Developers,Application Developer,,08\n'
    );
    expect(dev).toMatchObject({
      system: 'O*NET-SOC 2019',
      country: 'US',
      code: '15-1252.00',
      description: 'Research, design, and develop software.',
      tasks: ['Analyze user needs.', 'Write documentation.'],
      alternateTitles: ['Application Developer'],
    });
  });
});

describe('Extended SOC 2020 (UK)', () => {
  it('gives each sub-unit group its unit group and entry routes', () => {
    const rows = [
      ['soc-y1aa', '', '', '', '1111', '', 'Chief executives and senior officials', ''],
      [
        '',
        '',
        '',
        '',
        '',
        'TYPICAL ENTRY ROUTES AND ASSOCIATED QUALIFICATIONS',
        '',
        'Entry is by appointment.',
      ],
      [
        'soc-y1ac',
        '',
        '',
        '',
        '',
        '1111/02',
        'Chief executives',
        'Chief executive officers manage a company.',
      ],
      ['', '', '', '111', '', '', 'Chief Executives and Senior Officials', ''],
    ];
    expect(parseUkSoc(rows)).toEqual([
      expect.objectContaining({
        code: '1111/02',
        title: 'Chief executives',
        group: { code: '1111', title: 'Chief executives and senior officials' },
        entryRoutes: 'Entry is by appointment.',
      }),
    ]);
  });
});

describe('SSOC 2024 (Singapore)', () => {
  it("gives occupations their unit group's tasks, without markers or control characters", () => {
    const rows = [
      [
        '2512',
        'Software Developers',
        '',
        'Develop software.',
        '- researching requirements\n- designing systems',
        '',
        '',
        '',
      ],
      [
        '25121',
        'Software developer',
        '',
        'Software developer designs software.',
        '',
        '',
        '•\u009f Full stack developer •\u009f Blockchain developer',
        '',
      ],
    ];
    expect(parseSsoc(rows)).toEqual([
      expect.objectContaining({
        code: '25121',
        tasks: ['researching requirements', 'designing systems'],
        alternateTitles: ['Full stack developer', 'Blockchain developer'],
        group: { code: '2512', title: 'Software Developers' },
      }),
    ]);
  });
});

describe('NCO 2015 (India)', () => {
  const volume1 = [
    'Division    1                Managers',
    'Family      1112             Senior Government Officials',
    '            1112.0200        Diplomat                                             1121.20',
    '            1112.0600        Administrative and Executive Officials, Quasi        1123.10',
    '                             Government (Central)',
    'Family      4110             General Office Clerks',
    '            4110.0100 Clerk, General                              4190.10',
    'Family       7222.0100 Marker, Metal                                 7222.10',
  ].join('\n');
  const volume2 = [
    'VOLUME II A',
    '1112.0200',
    'Diplomat',
    'Diplomat represents Union of India in other',
    'National Classification of Occupations – 2015 Division 1',
    '8',
    'countries. Negotiates agreements.',
    'ISCO 08 Unit Group Details:',
    'Code 1112',
    '9999.0100',
    'Unlisted Trade Worker',
    'Unlisted Trade Worker does work.',
  ].join('\n');

  it('reads the structure: wrapped titles, single spaces, and codes on a Family line', () => {
    const { records } = parseNco(volume1, [volume2]);
    const byCode = Object.fromEntries(records.map((r) => [r.code, r]));
    expect(byCode['1112.0600'].title).toBe(
      'Administrative and Executive Officials, Quasi Government (Central)'
    );
    expect(byCode['4110.0100'].title).toBe('Clerk, General');
    expect(byCode['7222.0100'].title).toBe('Marker, Metal');
    expect(byCode['1112.0200'].group).toEqual({
      code: '1112',
      title: 'Senior Government Officials',
    });
  });

  it('reads descriptions without the title, page headers or the ISCO footer', () => {
    const { records } = parseNco(volume1, [volume2]);
    const diplomat = records.find((r) => r.code === '1112.0200');
    expect(diplomat?.description).toBe(
      'Diplomat represents Union of India in other countries. Negotiates agreements.'
    );
  });

  it('keeps an occupation Volume I does not list, titled from Volume II', () => {
    const unlisted = new Map<string, string>();
    parseNcoDescriptions(volume2, new Map(), unlisted);
    expect(unlisted.get('9999.0100')).toBe('Unlisted Trade Worker');
    const { records } = parseNco(volume1, [volume2]);
    expect(records.find((r) => r.code === '9999.0100')?.description).toBe(
      // The title line is removed; the description itself names the occupation, as NCO's do.
      'Unlisted Trade Worker does work.'
    );
  });
});
