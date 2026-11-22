import { packMismatch, syllabusBandLabels } from '../services/syllabusAssessmentRules';

const LEGACY = ['Fail', 'Pass', 'Merit', 'Distinction'];
const DESCRIPTIVE = ['Not yet demonstrated', 'Satisfactory', 'Good', 'Excellent'];

describe('syllabusBandLabels', () => {
  it('is descriptive when the institution entered no scale', () => {
    expect(syllabusBandLabels('', LEGACY)).toEqual(DESCRIPTIVE);
    expect(syllabusBandLabels(undefined, undefined)).toEqual(DESCRIPTIVE);
  });
  it('does not adopt the default Fail/Pass/Merit/Distinction under an unrelated scale', () => {
    expect(syllabusBandLabels('Percentage marks, 40 to pass', LEGACY)).toEqual(DESCRIPTIVE);
  });
  it('uses Fail/Pass/Merit/Distinction when the entered scale names them', () => {
    expect(syllabusBandLabels('Fail, Pass, Merit and Distinction', LEGACY)).toEqual(LEGACY);
  });
  it('uses the pack labels for an entered scale when they are four distinct names', () => {
    expect(syllabusBandLabels('A to D', ['A', 'B', 'C', 'D'])).toEqual(['A', 'B', 'C', 'D']);
    expect(syllabusBandLabels('A to D', ['A', 'A', 'C', 'D'])).toEqual(DESCRIPTIVE);
    expect(syllabusBandLabels('A to D', ['A', 'B'])).toEqual(DESCRIPTIVE);
  });
});

describe('packMismatch', () => {
  const step7 = { title: 'Case Pack', assessmentType: 'Mini-case exercises', weighting: 100 };
  const pack = (overview: any) => ({ variant: { overview } });

  it('flags a different type, and says the pack predates Step 7 when it does', () => {
    const msg = packMismatch({
      step7,
      ...pack({ title: 'Old', assignmentType: 'MCQ knowledge checks', weighting: 100 }),
      packAt: '2026-11-12T00:00:00Z',
      step7At: '2026-11-19T00:00:00Z',
    });
    expect(msg).toMatch(/predates the current Step 7/);
    expect(msg).toMatch(/type "MCQ knowledge checks"/);
  });
  it('flags a different weighting', () => {
    expect(
      packMismatch({ step7, ...pack({ assignmentType: 'Mini-case exercises', weighting: 60 }) })
    ).toMatch(/weighting 60%/);
  });
  it('flags a different title only when the pack is older', () => {
    const v = pack({ title: 'Old', assignmentType: 'Mini-case exercises', weighting: 100 });
    expect(packMismatch({ step7, ...v })).toBeNull();
    expect(
      packMismatch({ step7, ...v, packAt: '2026-11-19T00:00:00Z', step7At: '2026-11-12T00:00:00Z' })
    ).toBeNull();
    expect(
      packMismatch({ step7, ...v, packAt: '2026-11-12T00:00:00Z', step7At: '2026-11-19T00:00:00Z' })
    ).toMatch(/title "Old"/);
  });
  it('is null when type and weighting agree, ignoring case', () => {
    expect(
      packMismatch({ step7, ...pack({ assignmentType: 'mini-case Exercises', weighting: 100 }) })
    ).toBeNull();
  });
});
