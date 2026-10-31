import { isRunOutstanding, stepRunStatus } from '../services/stepRunStatus';

const at = (minute: number) => new Date(Date.UTC(2026, 9, 28, 19, minute));

describe('isRunOutstanding', () => {
  it('is false for a step that was opened but never run', () => {
    expect(isRunOutstanding({ completedAt: undefined })).toBe(false);
    expect(isRunOutstanding(undefined)).toBe(false);
  });

  it('is true for a run that has not ended, completed or failed since it started', () => {
    expect(isRunOutstanding({ runStartedAt: at(10) })).toBe(true);
    expect(isRunOutstanding({ runStartedAt: at(10), completedAt: at(5) })).toBe(true);
  });

  it('is false once the run ended, the step completed or the run failed', () => {
    expect(isRunOutstanding({ runStartedAt: at(10), runEndedAt: at(12) })).toBe(false);
    expect(isRunOutstanding({ runStartedAt: at(10), completedAt: at(12) })).toBe(false);
    expect(isRunOutstanding({ runStartedAt: at(10), failedAt: at(12) })).toBe(false);
  });

  it('reads dates stored as strings', () => {
    expect(
      isRunOutstanding({ runStartedAt: at(10).toISOString(), runEndedAt: at(9).toISOString() })
    ).toBe(true);
  });
});

describe('stepRunStatus', () => {
  const queueEnabled = true;

  it("reports a step opened by the previous step's approval as pending, not failed (Logan's Step 2)", () => {
    expect(stepRunStatus({ jobState: null, hasData: false, progress: {}, queueEnabled })).toEqual({
      status: 'pending',
      stalled: false,
    });
  });

  it('reports a run whose job vanished before it ended as stalled', () => {
    expect(
      stepRunStatus({
        jobState: null,
        hasData: true,
        progress: { runStartedAt: at(10) },
        queueEnabled,
      })
    ).toEqual({ status: 'failed', stalled: true });
  });

  it("follows the job's state while the job exists", () => {
    const progress = { runStartedAt: at(10) };
    expect(
      stepRunStatus({ jobState: 'active', hasData: true, progress, queueEnabled }).status
    ).toBe('processing');
    expect(
      stepRunStatus({ jobState: 'waiting', hasData: false, progress, queueEnabled }).status
    ).toBe('queued');
  });

  it('reports a finished run from its data once the job record is gone', () => {
    const progress = { runStartedAt: at(10), runEndedAt: at(20) };
    expect(stepRunStatus({ jobState: null, hasData: true, progress, queueEnabled })).toEqual({
      status: 'completed',
      stalled: false,
    });
  });

  it('takes an outstanding run to be still going when steps run in-process', () => {
    expect(
      stepRunStatus({
        jobState: null,
        hasData: true,
        progress: { runStartedAt: at(10) },
        queueEnabled: false,
      })
    ).toEqual({ status: 'processing', stalled: false });
  });
});
