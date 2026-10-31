import {
  isStepStopped,
  StepStopped,
  step7TimeLimitMinutes,
  stopReason,
} from '../services/stepStop';

const MIN = 60 * 1000;
const t0 = Date.UTC(2026, 9, 28, 19, 0);

describe('step7TimeLimitMinutes', () => {
  it('allows twice the expected time for the rounds of calls and the stages after them', () => {
    expect(step7TimeLimitMinutes(6, 3, 6)).toBe(48);
    expect(step7TimeLimitMinutes(46, 3, 6)).toBe(174);
  });

  it('never allows less than one round, whatever it is given', () => {
    expect(step7TimeLimitMinutes(0, 0, 0)).toBe(36);
  });
});

describe('stopReason', () => {
  const base = { step: 7, processingStartedAt: t0, limitMinutes: 48 };

  it('carries on with no request and time to spare', () => {
    expect(stopReason({ ...base, now: t0 + 10 * MIN })).toBeNull();
  });

  it('stops when the author asked after the run was queued', () => {
    const reason = stopReason({
      ...base,
      now: t0 + 5 * MIN,
      runQueuedAt: new Date(t0 - MIN),
      stopRequestedAt: new Date(t0 + 4 * MIN),
    });
    expect(reason).toMatch(/stopped on request/);
  });

  it('honours a request made while the run was still waiting in the queue', () => {
    expect(
      stopReason({
        ...base,
        now: t0,
        runQueuedAt: new Date(t0 - 2 * MIN),
        stopRequestedAt: new Date(t0 - MIN),
      })
    ).toMatch(/stopped on request/);
  });

  it('ignores a request left over from an earlier run', () => {
    expect(
      stopReason({
        ...base,
        now: t0 + 5 * MIN,
        runQueuedAt: new Date(t0 - MIN),
        stopRequestedAt: new Date(t0 - 60 * MIN),
      })
    ).toBeNull();
  });

  it('stops a run that has outlived its time limit, and says how long it had', () => {
    expect(stopReason({ ...base, now: t0 + 49 * MIN })).toMatch(/after 48 minutes/);
  });
});

describe('isStepStopped', () => {
  it('recognises a stop and nothing else', () => {
    expect(isStepStopped(new StepStopped('x'))).toBe(true);
    expect(isStepStopped(new Error('x'))).toBe(false);
    expect(isStepStopped('StepStopped')).toBe(false);
  });
});
