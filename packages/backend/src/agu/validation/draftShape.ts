/**
 * Checks the shape of a PATCH body before anything reads it.
 *
 * The route's only check was that `outcomes` and `weeks` were arrays. A body with nothing else
 * in it reached `validateDraft`, which threw on the missing lists, and because Express 4 never
 * answers a rejected async handler the request hung and a critical alert fired. This returns
 * the problems instead, worded for the person editing: which field, and what it must be.
 *
 * What it guarantees about a body with no problems: every list is a list, every element carries
 * its fields with the right types, numbers are numbers in range, enumerations hold a known
 * value, the week count is the catalogue's, nothing is absurdly large, and every URL field is an
 * http or https address. Fields the engine does not define are allowed (they are still scanned
 * for prohibited claims) but are held to the same size and link rules. Text may be empty: an
 * editor clears a field before retyping it, and validateDraft reports the gap.
 *
 * `locked`, `courseCode` and `catalogueVersion` are not checked: the route restores them from
 * the catalogue whatever the client sent.
 *
 * Pure, no I/O, and no schema library (none is a backend dependency).
 */
import { AGU_CATALOGUE_V1_4 } from '../catalogue/catalogueV1_4';
import { AccessStatus, AssessmentComponent, BloomLevel, CaseStudy, Origin } from '../draft/types';

/** The longest any one piece of text may be. Briefs and rationales run to a few thousand. */
export const MAX_TEXT_LENGTH = 10_000;
/** The most items any one list may hold. The largest real list is a few dozen. */
export const MAX_LIST_ITEMS = 200;
/** How many problems are listed before the rest are only counted. */
export const MAX_PROBLEMS = 25;

const MAX_DEPTH = 10;
const MAX_HOURS = 500;
const MAX_MINUTES = 1440;
const MAX_URL_LENGTH = 2048;
const WEEKS = AGU_CATALOGUE_V1_4.courseShape.weeks.value;

// Typed as complete records so that adding a value to the union in draft/types.ts fails to
// compile here until the check is told about it.
const BLOOM_LEVELS: Record<BloomLevel, true> = {
  remember: true,
  understand: true,
  apply: true,
  analyse: true,
  evaluate: true,
  create: true,
};
const ORIGINS: Record<Origin, true> = {
  catalogue: true,
  faculty: true,
  sourced: true,
  proposal: true,
  hypothetical: true,
};
const COMPONENTS: Record<AssessmentComponent, true> = {
  applied_assignment: true,
  weekly_quiz_discussion: true,
  final_exam: true,
  capstone_component: true,
};
const ACCESS: Record<AccessStatus, true> = {
  open: true,
  original: true,
  licensed: true,
  unknown: true,
  paywalled: true,
};
const CASE_SOURCES: Record<CaseStudy['source'], true> = {
  original: true,
  licensed: true,
  open: true,
  hypothetical: true,
};

interface Range {
  min: number;
  max: number;
  whole?: boolean;
}
const HOURS: Range = { min: 0, max: MAX_HOURS };
const MINUTES: Range = { min: 0, max: MAX_MINUTES };
const PERCENT: Range = { min: 0, max: 100 };
const WEEK_NUMBER: Range = { min: 1, max: WEEKS, whole: true };

type Obj = Record<string, unknown>;
const isObject = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isAbsent = (v: unknown): boolean => v === undefined || v === null;

/** Control characters (U+0000-U+001F, U+007F) have no place in an address. */
const hasControlCharacter = (value: string): boolean =>
  Array.from(value).some((c) => {
    const code = c.charCodeAt(0);
    return code < 0x20 || code === 0x7f;
  });

/**
 * Whether a value is a link that is safe to put in an href: an absolute http or https address,
 * with no whitespace or control characters, no embedded credentials, and a sane length. A
 * `javascript:` or `data:` address would run in the page's origin when clicked.
 */
export function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > MAX_URL_LENGTH) return false;
  if (!/^https?:\/\//i.test(value) || /\s/.test(value) || hasControlCharacter(value)) return false;
  try {
    const url = new URL(value);
    const web = url.protocol === 'http:' || url.protocol === 'https:';
    return web && url.hostname !== '' && url.username === '' && url.password === '';
  } catch {
    return false;
  }
}

/** Collects problems while the field checks below describe what each field must be. */
class Checker {
  readonly problems: string[] = [];

  add(message: string): void {
    this.problems.push(message);
  }

  text(o: Obj, key: string, at: string, opts: { optional?: boolean; nonEmpty?: boolean } = {}) {
    const v = o[key];
    if (isAbsent(v)) {
      if (!opts.optional) this.add(`${at}.${key} is required`);
    } else if (typeof v !== 'string') this.add(`${at}.${key} must be text`);
    else if (opts.nonEmpty && !v.trim()) this.add(`${at}.${key} must not be empty`);
  }

  number(o: Obj, key: string, at: string, range: Range) {
    const v = o[key];
    if (isAbsent(v)) return this.add(`${at}.${key} is required`);
    const ok =
      typeof v === 'number' &&
      Number.isFinite(v) &&
      v >= range.min &&
      v <= range.max &&
      (!range.whole || Number.isInteger(v));
    if (!ok) {
      const kind = range.whole ? 'a whole number' : 'a number';
      this.add(`${at}.${key} must be ${kind} from ${range.min} to ${range.max}`);
    }
  }

  flag(o: Obj, key: string, at: string) {
    const v = o[key];
    if (isAbsent(v)) this.add(`${at}.${key} is required`);
    else if (typeof v !== 'boolean') this.add(`${at}.${key} must be true or false`);
  }

  choice(o: Obj, key: string, at: string, allowed: Record<string, true>) {
    const v = o[key];
    if (isAbsent(v)) return this.add(`${at}.${key} is required`);
    if (typeof v !== 'string' || !Object.prototype.hasOwnProperty.call(allowed, v)) {
      this.add(`${at}.${key} must be one of: ${Object.keys(allowed).join(', ')}`);
    }
  }

  list(
    o: Obj,
    key: string,
    at: string,
    each: (item: unknown, path: string) => void,
    optional = false
  ) {
    const v = o[key];
    if (isAbsent(v)) {
      if (!optional) this.add(`${at}.${key} is required`);
    } else if (!Array.isArray(v)) this.add(`${at}.${key} must be a list`);
    else v.slice(0, MAX_LIST_ITEMS).forEach((item, i) => each(item, `${at}.${key}[${i}]`));
  }

  strings(o: Obj, key: string, at: string, optional = false) {
    this.list(
      o,
      key,
      at,
      (item, path) => {
        if (typeof item !== 'string') this.add(`${path} must be text`);
      },
      optional
    );
  }

  objects(
    o: Obj,
    key: string,
    at: string,
    each: (item: Obj, path: string) => void,
    optional = false
  ) {
    this.list(
      o,
      key,
      at,
      (item, path) => {
        if (isObject(item)) each(item, path);
        else this.add(`${path} must be an object`);
      },
      optional
    );
  }

  object(o: Obj, key: string, at: string, each: (item: Obj, path: string) => void) {
    const v = o[key];
    if (isAbsent(v)) this.add(`${at}.${key} is required`);
    else if (!isObject(v)) this.add(`${at}.${key} must be an object`);
    else each(v, `${at}.${key}`);
  }
}

function checkFields(c: Checker, draft: Obj): void {
  c.objects(draft, 'outcomes', 'draft', (o, at) => {
    c.text(o, 'id', at, { nonEmpty: true });
    c.text(o, 'statement', at);
    c.choice(o, 'bloomLevel', at, BLOOM_LEVELS);
    c.choice(o, 'origin', at, ORIGINS);
    c.objects(
      o,
      'evidence',
      at,
      (e, p) => {
        c.text(e, 'sourceId', p, { nonEmpty: true });
        c.text(e, 'locator', p, { optional: true });
        c.text(e, 'quote', p, { optional: true });
      },
      true
    );
  });

  c.objects(draft, 'weeks', 'draft', (w, at) => {
    c.number(w, 'number', at, WEEK_NUMBER);
    c.text(w, 'theme', at);
    c.strings(w, 'outcomeIds', at);
    c.object(w, 'liveLecture', at, (l, p) => {
      c.text(l, 'title', p);
      c.strings(l, 'topics', p);
      c.number(l, 'hours', p, HOURS);
      c.objects(l, 'runSheet', p, (s, q) => {
        c.number(s, 'startMinute', q, MINUTES);
        c.number(s, 'endMinute', q, MINUTES);
        c.text(s, 'segment', q);
        c.text(s, 'activity', q);
        c.text(s, 'materials', q, { optional: true });
        c.strings(s, 'outcomeIds', q, true);
      });
    });
    c.objects(w, 'monitoredStudy', at, (m, p) => {
      c.text(m, 'id', p, { nonEmpty: true });
      c.text(m, 'activity', p);
      c.text(m, 'facultyRole', p);
      c.text(m, 'evidenceLogged', p);
      c.number(m, 'hours', p, HOURS);
    });
    c.objects(w, 'independentStudy', at, (m, p) => {
      c.text(m, 'id', p, { nonEmpty: true });
      c.text(m, 'activity', p);
      c.number(m, 'hours', p, HOURS);
    });
    c.strings(w, 'gradedItemsDue', at);
  });
  if (Array.isArray(draft.weeks) && draft.weeks.length !== WEEKS) {
    c.add(`draft.weeks must have ${WEEKS} weeks, not ${draft.weeks.length}`);
  }

  c.objects(draft, 'assessments', 'draft', (a, at) => {
    c.text(a, 'id', at, { nonEmpty: true });
    c.choice(a, 'component', at, COMPONENTS);
    c.text(a, 'title', at);
    c.number(a, 'weight', at, PERCENT);
    c.number(a, 'weekDue', at, WEEK_NUMBER);
    c.strings(a, 'outcomeIds', at);
    c.flag(a, 'proctored', at);
    c.text(a, 'aiUse', at);
    c.text(a, 'brief', at, { optional: true });
    c.objects(
      a,
      'rubric',
      at,
      (r, p) => {
        c.text(r, 'outcomeId', p);
        c.text(r, 'criterion', p);
        c.number(r, 'weight', p, PERCENT);
        c.text(r, 'excellent', p);
        c.text(r, 'good', p);
        c.text(r, 'belowStandard', p);
      },
      true
    );
  });

  // `link` is judged with every other URL field in scan(), so it is not checked here.
  c.objects(draft, 'readings', 'draft', (r, at) => {
    c.text(r, 'id', at, { nonEmpty: true });
    c.text(r, 'citation', at);
    c.number(r, 'week', at, WEEK_NUMBER);
    c.flag(r, 'required', at);
    c.choice(r, 'access', at, ACCESS);
    c.text(r, 'sourceId', at, { optional: true });
  });

  c.objects(draft, 'cases', 'draft', (k, at) => {
    c.text(k, 'id', at, { nonEmpty: true });
    c.text(k, 'title', at);
    c.number(k, 'week', at, WEEK_NUMBER);
    c.choice(k, 'source', at, CASE_SOURCES);
    c.strings(k, 'outcomeIds', at);
    c.text(k, 'rights', at);
  });

  c.objects(draft, 'narrative', 'draft', (n, at) => {
    c.text(n, 'field', at, { nonEmpty: true });
    c.text(n, 'text', at);
  });
}

/** Keys the route restores from the catalogue, so nothing in them is stored. */
const RESTORED_KEYS = new Set(['locked', 'courseCode', 'catalogueVersion']);

/** A key that holds an address by its name: link, url, href, src, sourceUrl, pdfLink ... */
const URL_KEY = /^(link|url|href|src)$|(Link|Url|URL|Href)$/;

/**
 * Everything that applies to every value whatever its name: size, depth, and the rule that a
 * field named like an address holds an http or https one (or nothing).
 */
function scan(c: Checker, value: unknown, path: string, depth: number): void {
  if (typeof value === 'string') {
    if (value.length > MAX_TEXT_LENGTH) {
      c.add(`${path} is longer than ${MAX_TEXT_LENGTH.toLocaleString('en-US')} characters`);
    }
    return;
  }
  if (value === null || typeof value !== 'object') return;
  if (depth > MAX_DEPTH) {
    c.add(`${path} is nested too deeply`);
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > MAX_LIST_ITEMS) c.add(`${path} has more than ${MAX_LIST_ITEMS} items`);
    value.slice(0, MAX_LIST_ITEMS).forEach((item, i) => scan(c, item, `${path}[${i}]`, depth + 1));
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (depth === 0 && RESTORED_KEYS.has(key)) continue;
    const at = `${path}.${key}`;
    if (URL_KEY.test(key) && !isAbsent(child) && child !== '' && !isHttpUrl(child)) {
      c.add(`${at} must be an http or https address`);
    }
    scan(c, child, at, depth + 1);
  }
}

/**
 * The problems with a PATCH body, or an empty list when it can be saved. `body` is the request
 * body: `{ draft: { outcomes: [...], weeks: [...], ... } }`. Nothing else in it is read.
 */
export function checkDraftShape(body: unknown): string[] {
  const draft = isObject(body) ? body.draft : undefined;
  if (!isObject(draft)) {
    return ['Send the whole draft to save: the request body must be { "draft": { ... } }.'];
  }
  const c = new Checker();
  checkFields(c, draft);
  scan(c, draft, 'draft', 0);
  const { problems } = c;
  if (problems.length <= MAX_PROBLEMS) return problems;
  return [
    ...problems.slice(0, MAX_PROBLEMS),
    `...and ${problems.length - MAX_PROBLEMS} more problems`,
  ];
}
