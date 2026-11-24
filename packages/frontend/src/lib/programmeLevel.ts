/**
 * The programme's academic level, set in Step 1 and never assumed without anyone noticing.
 *
 * Logan Pacey, email of 12 November 2026: an RQF Level 4 fallback is fine for a certificate,
 * but the level must be a field in Step 1, pre-filled from the credential type, and where the
 * pre-filled value was used unchanged both Step 1 and Step 4 must say so, so a reviewer
 * confirms it. Until now the level was derived in code (services/moduleLevels) and nobody was
 * told when it was a guess.
 *
 * Two values are stored on step1: `programmeLevel`, a whole number 3 to 8 on the UK scale
 * (RQF, or FHEQ for a degree), and `programmeLevelOrigin`. The origin is 'stated' when the
 * author chose or confirmed the level in Step 1, and 'default' when the pre-filled value was
 * sent without the author touching it. A workflow saved before this field existed has neither,
 * so it counts as 'default'. This file is mirrored from backend/src/services/programmeLevel.ts for the Step 1 form.
 * Pure, so it can be tested.
 */

export type ProgrammeLevelOrigin = 'stated' | 'default';

export const MIN_PROGRAMME_LEVEL = 3;
export const MAX_PROGRAMME_LEVEL = 8;

/** The level when nothing but the credential type is known; a micro-credential is a short certificate. */
export const FALLBACK_LEVEL = 4;

/** Most specific first: "Postgraduate Diploma" is not "Diploma". */
const TITLE_LEVELS: Array<[RegExp, number]> = [
  [/\b(doctor of|doctorate|ph\.?d)\b/i, 8],
  [/\b(mba|master of|master's|masters (in|of)|m\.?sc|m\.?res|ll\.?m)\b/i, 7],
  [/\b(post\s*-?\s*graduate|pg|executive)\s+(diploma|cert(ificate)?)\b/i, 7],
  [/\b(bachelor|bba|b\.?sc|honours degree)\b/i, 6],
];

const FORM_LEVELS: Record<string, number> = {
  certificate: 4,
  'micro-credential': 4,
  diploma: 5,
  // Logan Pacey, 12 November 2026: Bachelor 6, Postgraduate/Executive Diploma 7, MBA 7.
  bachelor: 6,
  'postgraduate-diploma': 7,
  master: 7,
};

export const isProgrammeLevel = (v: unknown): v is number =>
  typeof v === 'number' &&
  Number.isInteger(v) &&
  v >= MIN_PROGRAMME_LEVEL &&
  v <= MAX_PROGRAMME_LEVEL;

/** The pre-filled level: a "Level N" in the title, then the title's credential, then the form's type. */
export function defaultLevelFor(academicLevel: unknown, programTitle: unknown): number {
  const title = String(programTitle ?? '');
  const stated = /\blevel\s*([3-8])\b/i.exec(title);
  if (stated) return Number(stated[1]);
  const byTitle = TITLE_LEVELS.find(([pattern]) => pattern.test(title));
  if (byTitle) return byTitle[1];
  return FORM_LEVELS[String(academicLevel ?? '')] ?? FALLBACK_LEVEL;
}

/** The level and origin to store from a Step 1 request; null when the request carries none. */
export function programmeLevelFromInput(input: {
  programmeLevel?: unknown;
  programmeLevelOrigin?: unknown;
}): { programmeLevel: number; programmeLevelOrigin: ProgrammeLevelOrigin } | null {
  const level = Number(input.programmeLevel);
  if (!isProgrammeLevel(level)) return null;
  return {
    programmeLevel: level,
    programmeLevelOrigin: input.programmeLevelOrigin === 'stated' ? 'stated' : 'default',
  };
}

/** The stored origin of a workflow's step1; absent means the level was never stated. */
export const levelOriginOf = (step1: any): ProgrammeLevelOrigin =>
  isProgrammeLevel(step1?.programmeLevel) && step1?.programmeLevelOrigin === 'stated'
    ? 'stated'
    : 'default';

/** The sentence a reviewer sees when the level was defaulted; null when the author stated it. */
export function defaultedLevelNote(
  origin: ProgrammeLevelOrigin,
  framework: string,
  level: number | null
): string | null {
  if (origin === 'stated' || level == null) return null;
  return `Level not stated, defaulted to ${framework} ${level}`;
}

/** The EQF level that matches a UK-scale level, for the EQF reference text and credit systems. */
const UK_TO_EQF: Record<number, number> = { 3: 4, 4: 5, 5: 5, 6: 6, 7: 7, 8: 8 };
export const eqfFromUkLevel = (level: number): number => UK_TO_EQF[level] ?? level;
