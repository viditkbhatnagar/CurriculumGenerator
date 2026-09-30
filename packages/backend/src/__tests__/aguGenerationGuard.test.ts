import {
  claimGenerationStart,
  DraftActivity,
  GENERATION_STALE_MS,
  GENERATION_WINDOW_MS,
  generationRefusal,
  isGenerationInFlight,
  isGenerationStale,
  lastActivityAt,
  MAX_GENERATIONS_PER_WINDOW,
  releaseGenerationStart,
  artefactRunRefusal,
  isArtefactRunStale,
} from '../agu/generation/generationGuard';

const NOW = Date.UTC(2026, 8, 30, 12, 0, 0);
const minutesAgo = (m: number) => new Date(NOW - m * 60_000);
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000);
const outlineRun = (startedAt: Date, stage = 'outline') => ({ stage, startedAt });

const draft = (over: Partial<DraftActivity> = {}): DraftActivity => ({
  _id: 'd1',
  status: 'needs_faculty',
  createdAt: hoursAgo(10),
  updatedAt: hoursAgo(9),
  stageRuns: [],
  ...over,
});

describe('lastActivityAt: the clock a running generation is judged by', () => {
  it('is the heartbeat when there is one, even if a later save is newer', () => {
    const d = draft({ heartbeatAt: minutesAgo(30), updatedAt: minutesAgo(1) });
    expect(lastActivityAt(d)).toBe(minutesAgo(30).getTime());
  });

  it('falls back to the last save, then to creation', () => {
    expect(lastActivityAt(draft({ updatedAt: minutesAgo(7) }))).toBe(minutesAgo(7).getTime());
    expect(lastActivityAt(draft({ updatedAt: undefined, createdAt: minutesAgo(9) }))).toBe(
      minutesAgo(9).getTime()
    );
  });

  it('reads ISO strings as well as dates', () => {
    const d = draft({ heartbeatAt: minutesAgo(3).toISOString() });
    expect(lastActivityAt(d)).toBe(minutesAgo(3).getTime());
  });

  it('counts a draft with no usable time as never active', () => {
    expect(lastActivityAt({ status: 'generating' })).toBe(0);
    expect(lastActivityAt(draft({ heartbeatAt: 'not a date', updatedAt: undefined }))).toBe(0);
  });
});

describe('isGenerationStale: when a running generation is written off as interrupted', () => {
  const generating = (over: Partial<DraftActivity>) => draft({ status: 'generating', ...over });

  it('leaves a long run alone while its heartbeat is fresh, however old the last save is', () => {
    const d = generating({ heartbeatAt: minutesAgo(5), updatedAt: minutesAgo(40) });
    expect(isGenerationStale(d, NOW)).toBe(false);
  });

  it('writes off a run whose heartbeat stopped, even if something saved the draft since', () => {
    const d = generating({ heartbeatAt: minutesAgo(20), updatedAt: minutesAgo(1) });
    expect(isGenerationStale(d, NOW)).toBe(true);
  });

  it('judges a run with no heartbeat by its last save', () => {
    expect(isGenerationStale(generating({ updatedAt: minutesAgo(14) }), NOW)).toBe(false);
    expect(isGenerationStale(generating({ updatedAt: minutesAgo(20) }), NOW)).toBe(true);
  });

  it('is stale exactly at the threshold', () => {
    const d = generating({ heartbeatAt: new Date(NOW - GENERATION_STALE_MS) });
    expect(isGenerationStale(d, NOW)).toBe(true);
    const fresher = generating({ heartbeatAt: new Date(NOW - GENERATION_STALE_MS + 1) });
    expect(isGenerationStale(fresher, NOW)).toBe(false);
  });

  it('writes off a draft created but never started, after the same window', () => {
    // A restart just after creation leaves "created" with no generation behind it, and the
    // page polls for as long as the draft says so.
    expect(isGenerationStale(draft({ status: 'created', updatedAt: hoursAgo(5) }), NOW)).toBe(true);
    expect(isGenerationStale(draft({ status: 'created', updatedAt: minutesAgo(2) }), NOW)).toBe(
      false
    );
  });

  it('never applies to a draft that is not generating or about to', () => {
    for (const status of ['failed', 'needs_faculty', 'ready_for_review', 'faculty_accepted']) {
      expect(isGenerationStale(draft({ status, updatedAt: hoursAgo(5) }), NOW)).toBe(false);
    }
  });
});

describe('isGenerationInFlight', () => {
  it('counts a fresh created or generating draft, and nothing else', () => {
    expect(
      isGenerationInFlight(draft({ status: 'generating', updatedAt: minutesAgo(2) }), NOW)
    ).toBe(true);
    expect(isGenerationInFlight(draft({ status: 'created', updatedAt: minutesAgo(2) }), NOW)).toBe(
      true
    );
    expect(isGenerationInFlight(draft({ status: 'failed', updatedAt: minutesAgo(2) }), NOW)).toBe(
      false
    );
    expect(isGenerationInFlight(draft({ status: 'generating', updatedAt: hoursAgo(1) }), NOW)).toBe(
      false
    );
  });
});

describe('generationRefusal: one generation at a time per course (409)', () => {
  it('allows a generation when the course has no drafts', () => {
    expect(generationRefusal([], NOW)).toBeNull();
  });

  it('refuses while another draft of the course is generating', () => {
    const refusal = generationRefusal(
      [draft({ _id: 'other', status: 'generating', heartbeatAt: minutesAgo(2) })],
      NOW
    );
    expect(refusal?.status).toBe(409);
    expect(refusal?.error).toMatch(/still generating/i);
  });

  it('refuses while another draft has been created and is about to start', () => {
    const refusal = generationRefusal(
      [draft({ _id: 'other', status: 'created', updatedAt: minutesAgo(1) })],
      NOW
    );
    expect(refusal?.status).toBe(409);
  });

  it('judges the other draft by its heartbeat', () => {
    const live = draft({
      _id: 'other',
      status: 'generating',
      heartbeatAt: minutesAgo(3),
      updatedAt: hoursAgo(1),
    });
    expect(generationRefusal([live], NOW)?.status).toBe(409);
  });

  it('is not blocked by a generation that was interrupted long ago', () => {
    const dead = draft({ _id: 'other', status: 'generating', heartbeatAt: minutesAgo(45) });
    expect(generationRefusal([dead], NOW)).toBeNull();
  });

  it('does not count the draft being regenerated against itself', () => {
    const self = draft({ _id: 'me', status: 'generating', heartbeatAt: minutesAgo(1) });
    expect(generationRefusal([self], NOW, 'me')).toBeNull();
    expect(generationRefusal([self], NOW)?.status).toBe(409);
  });

  it('matches the excluded draft by id however the id is represented', () => {
    const self = draft({
      _id: { toString: () => 'abc123' },
      status: 'generating',
      updatedAt: minutesAgo(1),
    });
    expect(generationRefusal([self], NOW, 'abc123')).toBeNull();
  });

  it('allows a generation while other drafts are finished, failed or awaiting review', () => {
    const drafts = ['failed', 'needs_faculty', 'ready_for_review', 'faculty_accepted'].map(
      (status, i) => draft({ _id: `d${i}`, status, updatedAt: minutesAgo(1) })
    );
    expect(generationRefusal(drafts, NOW)).toBeNull();
  });
});

describe('generationRefusal: a daily cap on generations per course (429)', () => {
  const runs = (n: number, startedAt: Date, stage = 'outline') =>
    Array.from({ length: n }, () => outlineRun(startedAt, stage));

  it('allows up to the cap', () => {
    const drafts = [draft({ stageRuns: runs(MAX_GENERATIONS_PER_WINDOW - 1, hoursAgo(1)) })];
    expect(generationRefusal(drafts, NOW)).toBeNull();
  });

  it('refuses once the course has started the cap within 24 hours', () => {
    const drafts = [draft({ stageRuns: runs(MAX_GENERATIONS_PER_WINDOW, hoursAgo(1)) })];
    const refusal = generationRefusal(drafts, NOW);
    expect(refusal?.status).toBe(429);
    expect(refusal?.error).toContain(String(MAX_GENERATIONS_PER_WINDOW));
    expect(refusal?.error).toMatch(/24 hours/);
  });

  it('adds up the runs of every draft of the course', () => {
    const drafts = [
      draft({ _id: 'a', stageRuns: runs(4, hoursAgo(2)) }),
      draft({ _id: 'b', stageRuns: runs(3, hoursAgo(5)) }),
      draft({ _id: 'c', stageRuns: runs(3, hoursAgo(20)) }),
    ];
    expect(generationRefusal(drafts, NOW)?.status).toBe(429);
    expect(generationRefusal(drafts.slice(0, 2), NOW)).toBeNull();
  });

  it('counts the draft being regenerated: its earlier runs still happened', () => {
    const self = draft({ _id: 'me', stageRuns: runs(MAX_GENERATIONS_PER_WINDOW, hoursAgo(1)) });
    expect(generationRefusal([self], NOW, 'me')?.status).toBe(429);
  });

  it('counts only runs that started inside the window', () => {
    const justInside = new Date(NOW - GENERATION_WINDOW_MS + 60_000);
    const justOutside = new Date(NOW - GENERATION_WINDOW_MS - 60_000);
    const inside = [draft({ stageRuns: runs(MAX_GENERATIONS_PER_WINDOW, justInside) })];
    const outside = [draft({ stageRuns: runs(MAX_GENERATIONS_PER_WINDOW, justOutside) })];
    expect(generationRefusal(inside, NOW)?.status).toBe(429);
    expect(generationRefusal(outside, NOW)).toBeNull();
  });

  it('counts outline runs only, not repair rounds or faculty edits', () => {
    const drafts = [
      draft({
        stageRuns: [
          ...runs(MAX_GENERATIONS_PER_WINDOW, hoursAgo(1), 'repair'),
          ...runs(MAX_GENERATIONS_PER_WINDOW, hoursAgo(1), 'faculty_edit'),
          ...runs(2, hoursAgo(1), 'outline'),
        ],
      }),
    ];
    expect(generationRefusal(drafts, NOW)).toBeNull();
  });

  it('counts failed outline runs too: a failure still spent the budget', () => {
    const failed = Array.from({ length: MAX_GENERATIONS_PER_WINDOW }, () => ({
      stage: 'outline',
      status: 'failed',
      startedAt: hoursAgo(2),
    }));
    expect(generationRefusal([draft({ stageRuns: failed })], NOW)?.status).toBe(429);
  });

  it('ignores runs with no usable start time, and drafts with no runs at all', () => {
    const drafts = [
      draft({ stageRuns: [{ stage: 'outline' }, { stage: 'outline', startedAt: 'garbage' }] }),
      draft({ _id: 'b', stageRuns: undefined }),
    ];
    expect(generationRefusal(drafts, NOW)).toBeNull();
  });

  it('answers 409 before 429 when both apply, since waiting clears the first', () => {
    const drafts = [
      draft({ _id: 'a', stageRuns: runs(MAX_GENERATIONS_PER_WINDOW, hoursAgo(1)) }),
      draft({ _id: 'b', status: 'generating', heartbeatAt: minutesAgo(1) }),
    ];
    expect(generationRefusal(drafts, NOW)?.status).toBe(409);
  });
});

describe('the start slot: one request at a time starts a generation for a course', () => {
  // The refusals above read the database, and a burst of parallel requests all read it before
  // any of them writes. The slot closes that gap inside one process.
  it('lets one request take the slot and turns a second away while it is held', () => {
    expect(claimGenerationStart('SLOT-A')).toBe(true);
    expect(claimGenerationStart('SLOT-A')).toBe(false);
    releaseGenerationStart('SLOT-A');
  });

  it('is held per course, so two courses can start together', () => {
    expect(claimGenerationStart('SLOT-B')).toBe(true);
    expect(claimGenerationStart('SLOT-C')).toBe(true);
    releaseGenerationStart('SLOT-B');
    releaseGenerationStart('SLOT-C');
  });

  it('can be taken again once released, and releasing twice does no harm', () => {
    expect(claimGenerationStart('SLOT-D')).toBe(true);
    releaseGenerationStart('SLOT-D');
    releaseGenerationStart('SLOT-D');
    expect(claimGenerationStart('SLOT-D')).toBe(true);
    releaseGenerationStart('SLOT-D');
  });
});

describe('artefact runs', () => {
  const run = (minutes: number) => ({ stage: 'artefacts', startedAt: minutesAgo(minutes) });

  it('refuses a second run while one is reporting in, and not once it has gone quiet', () => {
    const live = { artefactStatus: 'generating', artefactHeartbeatAt: minutesAgo(3) };
    const dead = { artefactStatus: 'generating', artefactHeartbeatAt: hoursAgo(2) };
    expect(artefactRunRefusal([live], NOW)?.status).toBe(409);
    expect(artefactRunRefusal([dead], NOW)).toBeNull();
    expect(isArtefactRunStale(dead, NOW)).toBe(true);
    expect(isArtefactRunStale(live, NOW)).toBe(false);
  });

  it('caps a course at ten artefact runs a day, counting failed ones', () => {
    const drafts = [{ stageRuns: Array.from({ length: 10 }, (_, i) => run(i * 30)) }];
    expect(artefactRunRefusal(drafts, NOW)?.status).toBe(429);
    const older = [{ stageRuns: Array.from({ length: 10 }, () => run(25 * 60)) }];
    expect(artefactRunRefusal(older, NOW)).toBeNull();
  });
});
