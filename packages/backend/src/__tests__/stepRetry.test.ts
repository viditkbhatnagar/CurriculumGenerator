import { retryNotice, RETRY_BACKOFF_MS } from '../services/stepRetry';

describe('retryNotice', () => {
  const finishedOn = Date.parse('2026-11-23T16:08:08Z');

  it('reports the stopped attempt and when the next one starts', () => {
    const n = retryNotice({
      state: 'delayed',
      attemptsMade: 1,
      maxAttempts: 3,
      failedReason: 'OpenAlex kept asking us to slow down.',
      finishedOn,
    });
    expect(n).toEqual({
      failedAttempt: 1,
      maxAttempts: 3,
      reason: 'OpenAlex kept asking us to slow down.',
      phase: 'waiting',
      nextAttemptAt: new Date(finishedOn + RETRY_BACKOFF_MS).toISOString(),
    });
  });

  it('says the retry is running once it has started', () => {
    const n = retryNotice({ state: 'active', attemptsMade: 2, maxAttempts: 3, failedReason: 'x' });
    expect(n?.phase).toBe('running');
    expect(n?.nextAttemptAt).toBeNull();
  });

  it('is null for a first attempt, a finished job or no job', () => {
    expect(retryNotice({ state: 'active', attemptsMade: 0, failedReason: '' })).toBeNull();
    expect(retryNotice({ state: 'completed', attemptsMade: 1, failedReason: 'x' })).toBeNull();
    expect(retryNotice({ state: 'failed', attemptsMade: 3, failedReason: 'x' })).toBeNull();
    expect(retryNotice(null)).toBeNull();
  });
});
