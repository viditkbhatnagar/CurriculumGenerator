import { facultyInputsFrom, MAX_FACULTY_INPUT_LENGTH } from '../agu/generation/facultyInputs';

const EMPTY = { emphasis: '', learners: '', tools: '', context: '', notes: '' };

describe('facultyInputsFrom: what a request may put in the stored inputs', () => {
  it('gives all five keys, empty when they were not sent', () => {
    expect(facultyInputsFrom(undefined)).toEqual(EMPTY);
    expect(facultyInputsFrom({})).toEqual(EMPTY);
  });

  it('keeps the five known keys as they were written', () => {
    const inputs = {
      emphasis: 'applied, no-code',
      learners: 'working professionals',
      tools: 'Excel',
      context: 'retail and logistics',
      notes: 'cover forecasting',
    };
    expect(facultyInputsFrom(inputs)).toEqual(inputs);
  });

  it('drops keys it does not know', () => {
    const cleaned = facultyInputsFrom({ emphasis: 'a', status: 'faculty_accepted', admin: true });
    expect(cleaned).toEqual({ ...EMPTY, emphasis: 'a' });
    expect(Object.keys(cleaned).sort()).toEqual([
      'context',
      'emphasis',
      'learners',
      'notes',
      'tools',
    ]);
  });

  it.each([5, true, null, ['a', 'b'], { nested: 'x' }, undefined])(
    'drops a value that is not a string: %j',
    (value) => {
      expect(facultyInputsFrom({ emphasis: value })).toEqual(EMPTY);
    }
  );

  it('trims whitespace, so a blank input reads as not given to the prompt', () => {
    expect(facultyInputsFrom({ emphasis: '  \n\t ', tools: '  Excel  ' })).toEqual({
      ...EMPTY,
      tools: 'Excel',
    });
  });

  it('cuts text at the limit instead of storing it all', () => {
    const long = 'x'.repeat(MAX_FACULTY_INPUT_LENGTH + 500);
    const cleaned = facultyInputsFrom({ notes: long });
    expect(cleaned.notes).toHaveLength(MAX_FACULTY_INPUT_LENGTH);
    expect(facultyInputsFrom({ notes: 'y'.repeat(MAX_FACULTY_INPUT_LENGTH) }).notes).toHaveLength(
      MAX_FACULTY_INPUT_LENGTH
    );
  });

  it.each([null, 'emphasis', 12, ['emphasis'], true])(
    'treats input that is not an object as nothing sent: %j',
    (raw) => {
      expect(facultyInputsFrom(raw)).toEqual(EMPTY);
    }
  );

  it('reads only properties the request itself carries, not inherited ones', () => {
    const inherited = Object.create({ emphasis: 'from the prototype' });
    expect(facultyInputsFrom(inherited)).toEqual(EMPTY);
  });
});

describe('facultyInputsFrom: merging onto the stored inputs (regenerate)', () => {
  const stored = {
    emphasis: 'applied',
    learners: 'managers',
    tools: 'Excel',
    context: 'retail',
    notes: 'keep it short',
  };

  it('replaces only the keys the request sends', () => {
    expect(facultyInputsFrom({ tools: 'Power BI' }, stored)).toEqual({
      ...stored,
      tools: 'Power BI',
    });
  });

  it('lets an empty string clear a stored value', () => {
    expect(facultyInputsFrom({ notes: '' }, stored)).toEqual({ ...stored, notes: '' });
  });

  it('keeps the stored value when the request sends something that is not a string', () => {
    expect(facultyInputsFrom({ tools: 7, context: { a: 1 } }, stored)).toEqual(stored);
  });

  it('keeps every stored value when the request sends nothing', () => {
    expect(facultyInputsFrom(undefined, stored)).toEqual(stored);
    expect(facultyInputsFrom('x', stored)).toEqual(stored);
  });

  it('cleans what was stored before these rules existed', () => {
    const legacy = { emphasis: 42, tools: ' Excel ', notes: 'n'.repeat(9000), extra: 'kept?' };
    const cleaned = facultyInputsFrom({}, legacy);
    expect(cleaned).toEqual({
      ...EMPTY,
      tools: 'Excel',
      notes: 'n'.repeat(MAX_FACULTY_INPUT_LENGTH),
    });
  });

  it('does not change the object it was given', () => {
    const snapshot = JSON.parse(JSON.stringify(stored));
    facultyInputsFrom({ tools: 'Power BI' }, stored);
    expect(stored).toEqual(snapshot);
  });

  it('treats create and regenerate alike: the same request gives the same values', () => {
    const request = { emphasis: ' a ', learners: 3, unknown: 'x', notes: 'n' };
    expect(facultyInputsFrom(request, {})).toEqual(facultyInputsFrom(request));
    expect(facultyInputsFrom(request, EMPTY)).toEqual(facultyInputsFrom(request));
  });
});
