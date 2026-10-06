import { AGU_CATALOGUE_V1_4, catalogueCourse } from '../agu/catalogue/catalogueV1_4';

const { courses, credentials, courseShape } = AGU_CATALOGUE_V1_4;

describe('AGU catalogue v1.4', () => {
  it('holds the 24 unique MBA courses the specifications name', () => {
    const codes = courses.map((c) => c.code);
    expect(new Set(codes).size).toBe(24);
    expect(codes).toEqual([
      'CR01',
      'CR02',
      'CR03',
      'CR04',
      'CR05',
      'CR06',
      'CR07',
      'CR08',
      'CR09',
      'CR10',
      'CR11',
      'CR12',
      'FT01',
      'FT02',
      'FT04',
      'FT06',
      'FN01',
      'FN02',
      'FN04',
      'FN06',
      'SC01',
      'SC02',
      'SC03',
      'SC06',
    ]);
  });

  it('gives every course 3 SCH and 135 hours (45 contact, 90 independent)', () => {
    for (const c of courses) {
      expect(c.semesterCredits).toBe(3);
      expect(c.hours).toEqual({ total: 135, contact: 45, independent: 90 });
    }
  });

  it('has a 12-course core and three four-course tracks, each ending in a capstone', () => {
    expect(courses.filter((c) => c.track === 'core')).toHaveLength(12);
    for (const track of ['fintech', 'finance', 'supply_chain_operations'] as const) {
      const t = courses.filter((c) => c.track === track);
      expect(t.map((c) => c.role)).toEqual(['entry', 'concentration', 'concentration', 'capstone']);
    }
  });

  it('applies the gateways to MBA candidates: CR02 for Finance and FinTech, CR05 for Supply Chain', () => {
    for (const c of courses.filter((x) => x.track === 'fintech' || x.track === 'finance')) {
      expect(c.mbaGateway).toBe('CR02');
    }
    for (const c of courses.filter((x) => x.track === 'supply_chain_operations')) {
      expect(c.mbaGateway).toBe('CR05');
    }
    expect(courses.filter((c) => c.track === 'core').every((c) => !c.mbaGateway)).toBe(true);
  });

  it('keeps capstones and CR11 out of experiential RPL', () => {
    const notEligible = courses.filter((c) => c.rplEligible === 'not_eligible').map((c) => c.code);
    expect(notEligible.sort()).toEqual(['CR11', 'FN06', 'FT06', 'SC06']);
  });

  it('marks the six courses the catalogue gives no topical description', () => {
    const missing = courses.filter((c) => c.descriptionMissing).map((c) => c.code);
    expect(missing.sort()).toEqual(['FN01', 'FN06', 'FT01', 'FT06', 'SC01', 'SC06']);
  });

  it('reconciles the credential totals with the course hours', () => {
    const byId = Object.fromEntries(credentials.map((c) => [c.id, c]));
    expect(byId.course_certificate.learningHours).toBe(135);
    expect(byId.specialized_diploma).toMatchObject({
      courses: 5,
      semesterCredits: 15,
      learningHours: 5 * 135,
    });
    expect(byId.mba).toMatchObject({ courses: 16, semesterCredits: 48, learningHours: 16 * 135 });
  });

  it('shapes a course as four weeks of one 3-hour lecture, 4-6 outcomes and 40/20/40', () => {
    expect(courseShape.weeks.value * courseShape.liveLectureHours.value).toBe(12);
    expect(courseShape.outcomeCount.value).toEqual({ min: 4, max: 6 });
    expect(courseShape.assessment.value.reduce((n, a) => n + a.weight, 0)).toBe(100);
  });

  it('is the edition AGU confirmed as approved (3 October 2026)', () => {
    expect(AGU_CATALOGUE_V1_4.edition.approvalStatus).toBe('approved');
  });

  it('finds a course by code regardless of case', () => {
    expect(catalogueCourse('cr08')?.title).toBe('Business Analytics & AI for Decision-Making');
    expect(catalogueCourse('XX99')).toBeUndefined();
  });
});
