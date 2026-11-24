/**
 * How Step 13 words its exam duration and section headings.
 *
 * Logan Pacey, 21 November 2026, re-testing the Diploma in Logistics pilot (workflow
 * 6af5a0a3b706bd9a5b7af54a): "The Section B heading shows '3 scenarios' without the question
 * count, and Duration is blank on the page, although the data says 3 hours." The page read
 * `overview.duration`; the stored exam carries `overview.totalDuration` ("3 hours"). Both
 * shapes, and a bare number of minutes, are accepted here so a stored exam shows its length.
 *
 * Pure, so it can be tested.
 */

const DURATION_KEYS = ['totalDuration', 'duration', 'durationMinutes', 'examDuration'] as const;

/** "180" or 180 as "3 hours"; "90" as "90 minutes". Text that says a unit is kept as written. */
function fromMinutes(minutes: number): string {
  if (minutes >= 60 && minutes % 60 === 0) {
    const h = minutes / 60;
    return `${h} ${h === 1 ? 'hour' : 'hours'}`;
  }
  return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
}

/** The exam's stored length as text, or an empty string when none is stored. */
export function examDuration(overview: unknown): string {
  const o = (overview || {}) as Record<string, unknown>;
  for (const key of DURATION_KEYS) {
    const v = o[key];
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) return fromMinutes(v);
    if (typeof v === 'string' && v.trim()) {
      const s = v.trim();
      return /^\d+(\.\d+)?$/.test(s) ? fromMinutes(Number(s)) : s;
    }
  }
  return '';
}

const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;

/** "3 scenarios, 8 questions": the scenarios and the questions inside them. */
export function sectionBCountLabel(sectionB: unknown): string {
  const scenarios = Array.isArray(sectionB) ? sectionB : [];
  const questions = scenarios.reduce(
    (n: number, s: any) => n + (Array.isArray(s?.questions) ? s.questions.length : 0),
    0
  );
  return `${plural(scenarios.length, 'scenario')}, ${plural(questions, 'question')}`;
}

const MODE_LABELS: Record<string, string> = {
  online_self_study: 'online self-study',
  online_facilitated: 'online, facilitated',
  hybrid_blended: 'hybrid / blended',
  in_person: 'in person',
  face_to_face: 'in person',
};

/**
 * The exam's conditions: what may be used and how it is sat.
 *
 * Logan Pacey, 23 November 2026: "the 'Conditions:' line on the overview is still blank". The page
 * read `overview.conditions`, which the generator has never written; it writes
 * `permittedMaterials` and `deliveryModes`. A stored `conditions` (older exams, edits) still wins.
 */
export function examConditions(overview: unknown): string {
  const o = (overview || {}) as Record<string, unknown>;
  const stated = [o.conditions, o.examConditions].find(
    (v): v is string => typeof v === 'string' && v.trim().length > 0
  );
  if (stated) return stated.trim();
  const materials = typeof o.permittedMaterials === 'string' ? o.permittedMaterials.trim() : '';
  const modes = (Array.isArray(o.deliveryModes) ? o.deliveryModes : [])
    .filter((m): m is string => typeof m === 'string' && m.trim().length > 0)
    .map((m) => MODE_LABELS[m] || m.replace(/_/g, ' '));
  const sat = modes.length ? `Sat ${modes.join(' or ')}.` : '';
  return [sat, materials].filter(Boolean).join(' ');
}
