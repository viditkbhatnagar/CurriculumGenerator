/**
 * When a generation may start, and when a running one is written off as interrupted.
 *
 * Every generation spends money: up to three model calls of 16,000 tokens and a search against
 * a metered OpenAlex key. Where authentication falls back to the mock administrator (AUTH0_*
 * unset) anyone who can reach the API can start one, so each course gets two limits: one
 * generation at a time, and a daily cap. The same module owns the staleness rule, because "is
 * this generation still alive" decides both whether the status sweep fails a draft and whether
 * that draft blocks the next generation.
 *
 * Pure: it is given plain data about a course's drafts, so the rules can be tested without a
 * database.
 */

/**
 * A generation runs in the web process, so a deploy or restart kills it mid-flight and its
 * draft would say "generating" forever. After this long without a heartbeat it is treated as
 * interrupted. It has to outlast the longest single step (one model call), because the
 * heartbeat is recorded between steps; a call that takes longer is indistinguishable from a
 * dead process.
 */
export const GENERATION_STALE_MS = 15 * 60 * 1000;

/** The rolling window the daily cap is counted over. */
export const GENERATION_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * The most outline generations a course may start in the window. A faculty member working a
 * course through needs a handful (a first draft, a few regenerations with changed inputs); ten
 * leaves room for that and stops a loop from spending the model budget and the day's OpenAlex
 * allowance (about one Step 5 run) on one course. The cap is exact: the eleventh is refused.
 */
export const MAX_GENERATIONS_PER_WINDOW = 10;

type Time = Date | string | number | null | undefined;

/** The fields of a stored draft these rules read. */
export interface DraftActivity {
  _id?: unknown;
  status?: string;
  createdAt?: Time;
  updatedAt?: Time;
  heartbeatAt?: Time;
  stageRuns?: { stage?: string; startedAt?: Time }[];
}

export interface GenerationRefusal {
  status: 409 | 429;
  error: string;
}

const millis = (t: Time): number => (t === null || t === undefined ? NaN : new Date(t).getTime());

/**
 * When the draft last showed it was alive: its heartbeat if it has one, else its last save,
 * else its creation. A draft with no readable time counts as never active (0).
 */
export function lastActivityAt(draft: DraftActivity): number {
  const at = millis(draft.heartbeatAt ?? draft.updatedAt ?? draft.createdAt);
  return Number.isFinite(at) ? at : 0;
}

/**
 * Whether a draft that says it is generating, or was created and never started, has gone quiet
 * for too long to be believed. A restart just after a draft is created leaves it "created" with
 * no generation behind it, and the page polls for as long as it says so.
 */
export function isGenerationStale(draft: DraftActivity, now: number = Date.now()): boolean {
  const pending = draft.status === 'generating' || draft.status === 'created';
  return pending && now - lastActivityAt(draft) >= GENERATION_STALE_MS;
}

/**
 * Whether a generation is, as far as anyone can tell, running or about to: a draft that has
 * been created (its generation starts a moment later) or is generating, and is not stale.
 */
export function isGenerationInFlight(draft: DraftActivity, now: number = Date.now()): boolean {
  const pending = draft.status === 'created' || draft.status === 'generating';
  return pending && now - lastActivityAt(draft) < GENERATION_STALE_MS;
}

/**
 * The reason a course may not start another generation now, or null when it may.
 *
 * `drafts` are all the drafts of one course. `exceptId` is the draft about to be regenerated:
 * it is left out of the in-flight test (the route has already refused if it is generating) but
 * its earlier runs still count towards the cap.
 *
 * The cap counts `outline` stage runs that started inside the window, failed ones included: a
 * failed generation spent the same budget. Repair rounds belong to the generation that started
 * them and faculty edits spend nothing, so neither counts. The 409 is checked first because
 * waiting for the running generation clears it, while the 429 has to wait out the window.
 */
export function generationRefusal(
  drafts: DraftActivity[],
  now: number = Date.now(),
  exceptId?: string
): GenerationRefusal | null {
  const others = exceptId === undefined ? drafts : drafts.filter((d) => String(d._id) !== exceptId);
  if (others.some((d) => isGenerationInFlight(d, now))) {
    return {
      status: 409,
      error:
        'Another draft of this course is still generating. Wait for it to finish, or to be marked failed if it was interrupted, before starting another.',
    };
  }
  const since = now - GENERATION_WINDOW_MS;
  const started = drafts
    .flatMap((d) => d.stageRuns ?? [])
    .filter((run) => run.stage === 'outline' && millis(run.startedAt) >= since).length;
  if (started >= MAX_GENERATIONS_PER_WINDOW) {
    return {
      status: 429,
      error: `This course has already started ${started} generations in the last 24 hours, the most allowed (${MAX_GENERATIONS_PER_WINDOW}). Each one spends model and source-search budget. Edit the existing draft, or try again later.`,
    };
  }
  return null;
}

const starting = new Set<string>();

/**
 * Take the start-up slot for a course. The refusals above read the database, and a burst of
 * parallel requests all read it before any of them writes, so each would pass. Only one request
 * per course holds the slot between its check and its write; the rest are turned away. The slot
 * lives in memory, which is enough because generations run in this process too. Always release
 * it in a `finally`.
 */
export function claimGenerationStart(courseCode: string): boolean {
  if (starting.has(courseCode)) return false;
  starting.add(courseCode);
  return true;
}

export function releaseGenerationStart(courseCode: string): void {
  starting.delete(courseCode);
}
