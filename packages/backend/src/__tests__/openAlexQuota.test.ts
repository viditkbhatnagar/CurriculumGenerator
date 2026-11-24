/**
 * OpenAlex 429s: a spent daily budget surfaces as SourceLookupUnavailable (daily) and is never
 * cached or read as "no sources"; a throttle is waited out (Logan Pacey, 23 November 2026).
 */
import {
  searchAcademicSources,
  SourceLookupUnavailable,
  isDailyLookupLimit,
} from '../services/academicSourceService';
import { classifyLimit, throttleDelayMs, budgetMessage } from '../services/openAlexLimits';

const response = (status: number, body: unknown, headers: Record<string, string> = {}) => ({
  status,
  ok: status >= 200 && status < 300,
  headers: { get: (h: string) => headers[h.toLowerCase()] ?? null },
  json: async () => body,
});

describe('classifyLimit', () => {
  it('reads a spent budget from the body or the remaining header', () => {
    expect(classifyLimit({ error: 'not_enough_credits' }, null)).toBe('budget');
    expect(classifyLimit({}, '0')).toBe('budget');
  });
  it('treats anything else as a throttle', () => {
    expect(classifyLimit({ error: 'Too many requests' }, '0.08')).toBe('throttle');
    expect(classifyLimit(null, null)).toBe('throttle');
  });
});

describe('throttleDelayMs', () => {
  it('doubles from two seconds and honours Retry-After, capped at a minute', () => {
    expect([0, 1, 2, 3].map((a) => throttleDelayMs(a, null))).toEqual([2000, 4000, 8000, 16000]);
    expect(throttleDelayMs(0, '5')).toBe(5000);
    expect(throttleDelayMs(0, '600')).toBe(60000);
  });
});

describe('budgetMessage', () => {
  it('says when the allowance resets', () => {
    expect(budgetMessage(7200)).toMatch(/midnight UTC, in about 2 hours/);
    expect(budgetMessage(0)).toMatch(/midnight UTC\.$/);
  });
});

describe('OpenAlex 429 handling', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
    jest.useRealTimers();
  });

  it('stops with a daily SourceLookupUnavailable when the budget is spent', async () => {
    global.fetch = jest.fn(async () =>
      response(429, { error: 'not_enough_credits' }, { 'x-ratelimit-reset': '7200' })
    ) as any;
    const run = searchAcademicSources('logistics');
    await expect(run).rejects.toThrow(SourceLookupUnavailable);
    await expect(searchAcademicSources('logistics')).rejects.toThrow(/about 2 hours/);
    const error = await searchAcademicSources('logistics').catch((e) => e);
    expect(isDailyLookupLimit(error)).toBe(true);
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(3); // no waiting and retrying
  });

  it('waits out a throttle and then answers', async () => {
    let calls = 0;
    global.fetch = jest.fn(async () => {
      calls += 1;
      return calls === 1
        ? response(429, { error: 'Too many requests' }, { 'retry-after': '0.01' })
        : response(200, { results: [] });
    }) as any;
    await expect(searchAcademicSources('warehousing throttle')).resolves.toBeDefined();
    expect(calls).toBe(2);
  });

  it('gives up on a throttle that never clears, without calling it the daily limit', async () => {
    jest.useFakeTimers({ advanceTimers: true });
    global.fetch = jest.fn(async () => response(429, {}, {})) as any;
    const pending = searchAcademicSources('transport never clears').catch((e) => e);
    await jest.advanceTimersByTimeAsync(120_000);
    const error = await pending;
    expect(error).toBeInstanceOf(SourceLookupUnavailable);
    expect(isDailyLookupLimit(error)).toBe(false);
  });
});
