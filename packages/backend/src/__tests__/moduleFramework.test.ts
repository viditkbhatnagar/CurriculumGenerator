import {
  deliveryGuidance,
  moduleCountFor,
  progressionGuidance,
  structureStatusLine,
  typicalModuleCredits,
} from '../services/moduleFramework';

describe('moduleCountFor', () => {
  it('uses a typical module size for the programme credit system', () => {
    expect(typicalModuleCredits('ects')).toBe(6);
    expect(typicalModuleCredits('uk_credits')).toBe(15);
    expect(typicalModuleCredits('us_semester')).toBe(3);
    // A 36-credit US MBA of 3-credit courses: twelve courses, not six.
    expect(moduleCountFor({ creditFramework: { system: 'us_semester', credits: 36 } }).count).toBe(
      12
    );
    // A 60-credit UK certificate: four 15-credit modules, not ten.
    expect(moduleCountFor({ creditFramework: { system: 'uk_credits', credits: 60 } }).count).toBe(
      4
    );
    expect(moduleCountFor({ creditFramework: { system: 'ects', credits: 180 } }).count).toBe(30);
  });

  it("prefers the author's number and says where the number came from", () => {
    expect(moduleCountFor({ creditFramework: { system: 'ects', credits: 180 } }, 24)).toEqual({
      count: 24,
      basis: 'set by the programme author',
    });
    expect(moduleCountFor({ creditFramework: { system: 'ects', credits: 180 } }).basis).toMatch(
      /180 credits at a typical 6-credit module/
    );
  });

  it('falls back to hours for a programme without credits', () => {
    expect(moduleCountFor({ creditFramework: { system: 'non_credit', totalHours: 600 } })).toEqual({
      count: 5,
      basis: expect.stringMatching(/600 hours/),
    });
  });
});

describe('deliveryGuidance', () => {
  it('matches the modes the setup form actually stores', () => {
    for (const mode of ['online_self_study', 'online_facilitated', 'hybrid_blended', 'in_person']) {
      expect(deliveryGuidance(mode)).not.toMatch(/not recorded/);
    }
    expect(deliveryGuidance('online')).toMatch(/not recorded/);
  });
});

describe('progressionGuidance', () => {
  it('does not make an advanced programme start low on the taxonomy', () => {
    expect(progressionGuidance(7)).toMatch(/even early modules may work at Analyse/);
    expect(progressionGuidance(null)).toMatch(/Earlier modules build foundations/);
  });
});

describe('structureStatusLine', () => {
  it('never claims awarding-body approval', () => {
    expect(structureStatusLine('uploaded')).toMatch(/supplied by the institution/);
    expect(structureStatusLine('uploaded')).toMatch(/not been confirmed as approved/);
    expect(structureStatusLine('outline')).toMatch(/not yet been reviewed/);
  });
});
