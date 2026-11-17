import { step5ProgressAt } from '../services/step5Progress';

describe('step5ProgressAt', () => {
  it('starts at 5 before any module has finished', () => {
    expect(step5ProgressAt('modules', 0, 4)).toBe(5);
  });

  it('moves up with each finished module and reaches 90 when all are done', () => {
    expect(step5ProgressAt('modules', 1, 4)).toBe(26);
    expect(step5ProgressAt('modules', 2, 4)).toBe(48);
    expect(step5ProgressAt('modules', 4, 4)).toBe(90);
  });

  it('never goes past the module span or below the start', () => {
    expect(step5ProgressAt('modules', 9, 4)).toBe(90);
    expect(step5ProgressAt('modules', -1, 4)).toBe(5);
    expect(step5ProgressAt('modules', 1, 0)).toBe(5);
  });

  it('reports the later stages at fixed points, in order', () => {
    expect(step5ProgressAt('matching')).toBe(90);
    expect(step5ProgressAt('saving')).toBe(95);
  });
});
