import { step7Percent } from '../services/step7Progress';

describe('step7Percent', () => {
  it('moves through 5-85% as modules finish', () => {
    expect(step7Percent({ stage: 'formative', completedSteps: 0, totalSteps: 6 })).toBe(5);
    expect(step7Percent({ stage: 'formative', completedSteps: 3, totalSteps: 6 })).toBe(45);
    expect(step7Percent({ stage: 'formative', completedSteps: 6, totalSteps: 6 })).toBe(85);
  });

  it('then the summative, samples and LMS packages', () => {
    expect(step7Percent({ stage: 'summative' })).toBe(88);
    expect(step7Percent({ stage: 'samples' })).toBe(93);
    expect(step7Percent({ stage: 'lms' })).toBe(97);
  });

  it('does not move the bar for completion or an error report', () => {
    expect(step7Percent({ stage: 'complete' })).toBeNull();
    expect(step7Percent({ stage: 'error' })).toBeNull();
  });
});
