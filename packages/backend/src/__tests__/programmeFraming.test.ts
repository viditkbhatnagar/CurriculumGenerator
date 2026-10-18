import {
  PROGRAMME_STATUS,
  programmeContextBlock,
  programmeFraming,
} from '../services/programmeFraming';

describe('programmeFraming', () => {
  // Real programmes in production, with the level the setup form gave them.
  it.each([
    ['Bachelor in Business Administration', 'diploma', 'ects', 'bachelor', 6],
    [
      'Master of Business Administration in Digital Business',
      'diploma',
      'us_semester',
      'master',
      7,
    ],
    [
      'Post Graduate  Diploma in Machine Learning amp; Applied AI',
      'diploma',
      'us_semester',
      'postgraduate-diploma',
      7,
    ],
    [
      'PG Diploma in AI Strategy &amp; Governance',
      'diploma',
      'us_semester',
      'postgraduate-diploma',
      7,
    ],
    ['Diploma in Logistics and Supply Chain Management', 'diploma', 'uk_credits', 'diploma', null],
    [
      'Certified Customer Service Professional',
      'micro-credential',
      'ects',
      'micro-credential',
      null,
    ],
    [
      'Business Analytics & AI for Decision-Making',
      'certificate',
      'us_semester',
      'certificate',
      null,
    ],
  ])('reads "%s" (form %s, %s) as %s', (programTitle, academicLevel, system, type, level) => {
    const framing = programmeFraming({ programTitle, academicLevel, creditFramework: { system } });
    expect(framing.type).toBe(type);
    expect(framing.level).toBe(level);
  });

  it('never reads a postgraduate diploma as a plain diploma, or master data as a degree', () => {
    expect(programmeFraming({ programTitle: 'Postgraduate Diploma in HR' }).type).toBe(
      'postgraduate-diploma'
    );
    expect(
      programmeFraming({
        programTitle: 'Master Data Management Essentials',
        academicLevel: 'certificate',
      }).type
    ).toBe('certificate');
  });

  it('prefers what the institution states over the title', () => {
    const framing = programmeFraming({
      programTitle: 'Diploma in Applied Fashion Design',
      qualificationType: 'higher-diploma',
      frameworkLevel: 'MQF 5',
      governingFramework: 'Malta Qualifications Framework',
    });
    expect(framing).toMatchObject({
      type: 'higher-diploma',
      level: 5,
      basis: 'stated by the institution',
      levelBasis: 'stated by the institution',
      governingFramework: 'Malta Qualifications Framework',
    });
  });

  it('takes a level written in the title', () => {
    expect(programmeFraming({ programTitle: 'Level 5 Diploma in Management' }).level).toBe(5);
  });
});

describe('programmeContextBlock', () => {
  it('gives the level descriptor and where the level came from', () => {
    const block = programmeContextBlock(
      programmeFraming({
        programTitle: 'Bachelor in Business Administration',
        academicLevel: 'diploma',
      })
    );
    expect(block).toContain("Qualification type: bachelor's degree (from the programme title)");
    expect(block).toContain('EQF level 6');
    expect(block).toContain('critical understanding of theories and principles');
    expect(block).not.toMatch(/vocational/i);
  });

  it('says plainly when no level is recorded, rather than inventing one', () => {
    const block = programmeContextBlock(
      programmeFraming({ programTitle: 'Certified Customer Service Professional' })
    );
    expect(block).toContain('Level: not recorded');
    expect(block).not.toContain('Level descriptor');
  });

  it('states that the programme is not accredited', () => {
    const block = programmeContextBlock(programmeFraming({ programTitle: 'MBA' }));
    expect(block).toContain(PROGRAMME_STATUS);
    expect(PROGRAMME_STATUS).toMatch(/not accredited/);
  });
});
