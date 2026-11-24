import {
  examConditions,
  examDuration,
  sectionBCountLabel,
} from '../../../frontend/src/lib/examDisplay';

describe('examDuration', () => {
  it('reads the stored totalDuration text', () => {
    expect(examDuration({ totalDuration: '3 hours' })).toBe('3 hours');
  });
  it('reads the older duration field', () => {
    expect(examDuration({ duration: '90 minutes' })).toBe('90 minutes');
  });
  it('words a number of minutes', () => {
    expect(examDuration({ durationMinutes: 180 })).toBe('3 hours');
    expect(examDuration({ duration: 90 })).toBe('90 minutes');
    expect(examDuration({ examDuration: '60' })).toBe('1 hour');
  });
  it('is empty when nothing is stored', () => {
    expect(examDuration({})).toBe('');
    expect(examDuration(undefined)).toBe('');
  });
});

describe('sectionBCountLabel', () => {
  it('counts the questions inside the scenarios', () => {
    const b = [{ questions: [1, 2, 3] }, { questions: [1, 2] }, { questions: [1, 2, 3] }];
    expect(sectionBCountLabel(b)).toBe('3 scenarios, 8 questions');
  });
  it('uses singular forms and tolerates missing questions', () => {
    expect(sectionBCountLabel([{ questions: [1] }])).toBe('1 scenario, 1 question');
    expect(sectionBCountLabel([{}])).toBe('1 scenario, 0 questions');
    expect(sectionBCountLabel(undefined)).toBe('0 scenarios, 0 questions');
  });
});

describe('examConditions', () => {
  it('builds the line from the delivery mode and permitted materials the generator stores', () => {
    expect(
      examConditions({
        deliveryModes: ['hybrid_blended'],
        permittedMaterials: 'Restricted open book: approved course notes are permitted.',
      })
    ).toBe('Sat hybrid / blended. Restricted open book: approved course notes are permitted.');
  });
  it('prefers a stated conditions field', () => {
    expect(
      examConditions({ conditions: 'Closed book, invigilated', permittedMaterials: 'x' })
    ).toBe('Closed book, invigilated');
  });
  it('is empty when nothing is stored', () => {
    expect(examConditions({})).toBe('');
    expect(examConditions(undefined)).toBe('');
  });
});
