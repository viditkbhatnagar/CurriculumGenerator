import { csvField, parseFeedback, MAX_FEEDBACK_CHARS } from '../services/stepFeedbackInput';

const valid = {
  stepNumber: 3,
  reviewerName: 'Dr Sherin',
  satisfactory: 'partly',
  whatChanged: 'Outcomes now use measurable verbs.',
  comments: '',
};

describe('parseFeedback', () => {
  it('accepts a complete entry', () => {
    expect(parseFeedback(valid)).toEqual({
      value: { ...valid, satisfactory: 'partly' },
    });
  });

  it('rejects a step outside 1-14', () => {
    expect(parseFeedback({ ...valid, stepNumber: 0 }).error).toMatch(/stepNumber/);
    expect(parseFeedback({ ...valid, stepNumber: 15 }).error).toMatch(/stepNumber/);
    expect(parseFeedback({ ...valid, stepNumber: 2.5 }).error).toMatch(/stepNumber/);
  });

  it('needs a name, a verdict, and something said', () => {
    expect(parseFeedback({ ...valid, reviewerName: ' ' }).error).toMatch(/name/);
    expect(parseFeedback({ ...valid, satisfactory: 'maybe' }).error).toMatch(/satisfactory/);
    expect(parseFeedback({ ...valid, whatChanged: '  ', comments: '' }).error).toMatch(/Describe/);
  });

  it('trims and caps long text', () => {
    const long = 'x'.repeat(MAX_FEEDBACK_CHARS + 50);
    expect(parseFeedback({ ...valid, comments: long }).value?.comments).toHaveLength(
      MAX_FEEDBACK_CHARS
    );
  });
});

describe('csvField', () => {
  it('quotes and doubles quotes', () => {
    expect(csvField('said "fine", mostly')).toBe('"said ""fine"", mostly"');
  });

  it('stops a spreadsheet reading text as a formula', () => {
    expect(csvField('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
  });
});
