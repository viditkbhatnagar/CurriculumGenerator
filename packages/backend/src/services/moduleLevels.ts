/**
 * The year and academic level of each module, and where it sits in the programme.
 *
 * Logan Pacey's re-test of 2 November 2026 (a 60-credit Certificate in Business Analytics,
 * four modules of 15 credits) found no module with a level or a year anywhere in Steps 4 to 14.
 * The only trace was `phase`, hard-coded by sequence number (early up to 2, late from 6), which
 * tagged the final module of a four-module programme "middle". Case studies then took their
 * level from the programme's one-word label, so all eight were introductory.
 *
 * A module's level now comes from, in order: a value the author set; the programme blueprint's
 * group ("Year 2 – Level 5"); and otherwise the programme's own level (services/programmeFraming)
 * spread over its years by credit volume. A programme of one year's credits or less sits at one
 * level; a three-year bachelor's degree runs 4, 5, 6. The position (early, middle, late) comes
 * from the module's place in the sequence, with the final module always late.
 *
 * Levels are stored on the modules when Step 4 is generated. `levelsFor` also derives them for
 * a workflow that predates this, so no migration is needed. Pure, so it can be tested.
 */
import { levelFromText } from './caseStudySpec';
import { programmeFraming, QualificationType } from './programmeFraming';
import { creditsForHours } from '../utils/credits';

export type LevelFramework = 'RQF' | 'FHEQ' | 'EQF';
export type LevelOrigin = 'blueprint' | 'derived' | 'author';
export type ModulePosition = 'early' | 'middle' | 'late';

export interface ModuleLevel {
  year: number;
  level: number;
  levelFramework: LevelFramework;
  /** "RQF Level 4 · Year 1" */
  levelLabel: string;
  levelOrigin: LevelOrigin;
  position: ModulePosition;
}

interface ModuleLike {
  sequence?: number;
  sequenceOrder?: number;
  credits?: number;
  totalHours?: number;
  group?: string;
  isElective?: boolean;
  year?: unknown;
  level?: unknown;
  levelFramework?: unknown;
  levelOrigin?: unknown;
}

/** Credits in one year of full-time study, by credit system. */
const YEAR_CREDITS: Record<string, number> = { uk_credits: 120, ects: 60, us_semester: 30 };

/**
 * EQF level to the UK's RQF/FHEQ level. The UK scale runs 1–8 with level 4 the first level of
 * higher education, which is EQF 5; from EQF 6 the two agree (a bachelor's degree is level 6).
 * EQF 1–3 are passed through. A reference table, used when the institution states no UK level.
 */
const EQF_TO_UK: Record<number, number> = { 4: 3, 5: 4, 6: 6, 7: 7, 8: 8 };
export const ukLevelFromEqf = (eqf: number): number => EQF_TO_UK[eqf] ?? eqf;

/** The programme's level when its title and form state none: certificate and diploma are EQF 5. */
const DEFAULT_EQF: Partial<Record<QualificationType, number>> = {
  'micro-credential': 4,
  certificate: 5,
  diploma: 5,
};

/** Types whose own top level is fixed in the UK scale whatever the EQF table says. */
const UK_TOP: Partial<Record<QualificationType, number>> = { 'higher-diploma': 5 };

const DEGREE_TYPES: QualificationType[] = [
  'bachelor',
  'postgraduate-certificate',
  'postgraduate-diploma',
  'master',
  'doctorate',
];

const positionOf = (rank: number, count: number): ModulePosition => {
  if (rank >= count - 1) return 'late';
  return (['early', 'middle', 'late'] as const)[Math.floor((rank * 3) / count)];
};

const sequenceOf = (m: ModuleLike, index: number): number =>
  m.sequence ?? m.sequenceOrder ?? index + 1;

const isLevel = (v: unknown): v is number => typeof v === 'number' && v >= 1 && v <= 8;

export function levelLabelOf(framework: LevelFramework, level: number, year: number): string {
  return `${framework} Level ${level} · Year ${year}`;
}

function programmeLevels(step1: any) {
  const framing = programmeFraming(step1);
  const system: string = String(step1?.creditFramework?.system || '');
  const framework: LevelFramework =
    system === 'uk_credits' ? (DEGREE_TYPES.includes(framing.type) ? 'FHEQ' : 'RQF') : 'EQF';
  const eqf = framing.level ?? DEFAULT_EQF[framing.type] ?? null;
  const top =
    eqf == null ? null : framework === 'EQF' ? eqf : (UK_TOP[framing.type] ?? ukLevelFromEqf(eqf));
  return { framing, system, framework, top };
}

/** The module's credits, stated or from its hours. */
const creditsOf = (m: ModuleLike, system: unknown): number =>
  Number(m.credits) || creditsForHours(m.totalHours, system as string) || 0;

/** The programme's credits, or null when neither Step 1 nor the modules state them. */
function programmeCredits(step1: any, modules: ModuleLike[]): number | null {
  const stated = Number(step1?.creditFramework?.credits);
  if (stated > 0) return stated;
  const system = step1?.creditFramework?.system;
  const sum = modules.filter((m) => !m.isElective).reduce((s, m) => s + creditsOf(m, system), 0);
  return sum > 0 ? sum : null;
}

/**
 * Each module's level, in the order given. Values the author set are kept as they are; a
 * stored blueprint or derived value is kept too, so a regeneration that follows an edit does
 * not move what was shown. The position is always recomputed from the sequence.
 */
export function deriveModuleLevels(modules: ModuleLike[], step1: any): ModuleLevel[] {
  const list = modules || [];
  const { system, framework, top, framing } = programmeLevels(step1);
  const creditSystem = step1?.creditFramework?.system;
  const credits = programmeCredits(step1, list);
  const yearCredits = YEAR_CREDITS[system];
  const years = credits && yearCredits ? Math.max(1, Math.ceil(credits / yearCredits)) : 1;
  const ladder =
    framework !== 'EQF' && (framing.type === 'bachelor' || framing.type === 'higher-diploma');

  const bySequence = list
    .map((m, i) => ({ i, seq: sequenceOf(m, i) }))
    .sort((a, b) => a.seq - b.seq || a.i - b.i);
  const rankOf = new Map(bySequence.map((x, rank) => [x.i, rank]));

  // The year a module falls in is the year its credits start in, counting core modules only.
  let cumulative = 0;
  const yearOfIndex = new Map<number, number>();
  for (const { i } of bySequence) {
    const m = list[i];
    yearOfIndex.set(
      i,
      years > 1 ? Math.min(years, Math.floor(cumulative / (yearCredits || 1)) + 1) : 1
    );
    if (!m.isElective) cumulative += creditsOf(m, creditSystem);
  }

  return list.map((m, i): ModuleLevel => {
    const position = positionOf(rankOf.get(i) as number, list.length);
    const stored = m.levelOrigin as LevelOrigin | undefined;
    if (
      isLevel(m.level) &&
      (stored === 'author' || stored === 'blueprint' || stored === 'derived')
    ) {
      const fw = (
        ['RQF', 'FHEQ', 'EQF'].includes(String(m.levelFramework)) ? m.levelFramework : framework
      ) as LevelFramework;
      const year =
        typeof m.year === 'number' && m.year >= 1 ? m.year : (yearOfIndex.get(i) as number);
      return {
        year,
        level: m.level,
        levelFramework: fw,
        levelLabel: levelLabelOf(fw, m.level, year),
        levelOrigin: stored,
        position,
      };
    }

    const group = String(m.group || '');
    const explicitLevel = /level\s*[3-8]/i.test(group) ? levelFromText(group) : null;
    const groupYear = /year\s*([1-4])/i.exec(group);
    const year = groupYear ? Number(groupYear[1]) : (yearOfIndex.get(i) as number);
    let level: number | null = explicitLevel;
    if (level == null && top != null) level = ladder ? Math.min(top, 3 + year) : top;
    if (level == null) level = levelFromText(group) ?? levelFromText(framing.typeLabel) ?? 5;
    return {
      year,
      level,
      levelFramework: framework,
      levelLabel: levelLabelOf(framework, level, year),
      levelOrigin: explicitLevel != null || groupYear ? 'blueprint' : 'derived',
      position,
    };
  });
}

/** The modules with their levels written in (new objects); author-set values are untouched. */
export function withModuleLevels<T extends ModuleLike>(modules: T[], step1: any): T[] {
  const levels = deriveModuleLevels(modules, step1);
  return (modules || []).map((m, i) => ({
    ...m,
    year: levels[i].year,
    level: levels[i].level,
    levelFramework: levels[i].levelFramework,
    levelLabel: levels[i].levelLabel,
    levelOrigin: levels[i].levelOrigin,
    phase: levels[i].position,
  }));
}

/** Levels for a workflow's Step 4 modules: stored where present, derived otherwise. */
export function levelsFor(workflow: any): ModuleLevel[] {
  return deriveModuleLevels(workflow?.step4?.modules || [], workflow?.step1);
}

/** The module's level on the UK scale 3–7 that case studies are specified in. */
export function ukLevelOf(level: Pick<ModuleLevel, 'level' | 'levelFramework'>): number {
  return level.levelFramework === 'EQF' ? ukLevelFromEqf(level.level) : level.level;
}
