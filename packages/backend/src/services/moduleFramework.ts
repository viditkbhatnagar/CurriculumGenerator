/**
 * The rules Step 4's module framework is built under, stated once and tested.
 *
 * Rejin's audit (17 October 2026) on Step 4:
 * - the module count defaulted to one module per 6 credits in every credit system, so a
 *   60-credit UK certificate became ten 6-credit modules where UK modules are usually 15 credits,
 *   and a US programme of 3-credit courses became half as many modules as it has courses;
 * - every module had to copy the programme's contact ratio, which suits no project, lab or
 *   dissertation module;
 * - progression was a fixed Bloom quota (≥60% lower-order in modules 1-2), wrong for a master's;
 * - delivery-mode guidance compared the mode with "online", "classroom" and "hybrid", while the
 *   stored values are online_self_study, online_facilitated, hybrid_blended and in_person, so no
 *   guidance ever reached the model;
 * - batches were told the module list "has been approved by the awarding institution", even
 *   when the list was the generator's own outline.
 *
 * Pure, so it can be tested.
 */

/** A typical module's credits in each system; null where no convention applies. */
export function typicalModuleCredits(system: unknown): number | null {
  switch (String(system || '')) {
    case 'ects':
      return 6;
    case 'uk':
    case 'uk_credits':
      return 15;
    case 'us_semester':
      return 3;
    default:
      return null;
  }
}

const MIN_MODULES = 4;
const MAX_MODULES = 40;
/** Hours per module when a programme records no credits. */
const HOURS_PER_MODULE = 120;

export interface ModuleCount {
  count: number;
  /** Why this number, for the prompt and the screen. */
  basis: string;
}

/**
 * How many modules a programme should be built from: the author's number if they set one, else
 * the programme's credits divided by a typical module size in its credit system, else hours.
 * A default, not a rule: the institution can set any number from 4 to 40.
 */
export function moduleCountFor(step1: any, requested?: number): ModuleCount {
  if (Number.isInteger(requested) && (requested as number) >= 4 && (requested as number) <= 40) {
    return { count: requested as number, basis: 'set by the programme author' };
  }
  const framework = step1?.creditFramework || {};
  const system = framework.system || framework.creditSystem;
  const credits = Number(framework.credits) || 0;
  const size = typicalModuleCredits(system);
  const clamp = (n: number) => Math.min(MAX_MODULES, Math.max(MIN_MODULES, n));
  if (credits && size) {
    return {
      count: clamp(Math.round(credits / size)),
      basis: `${credits} credits at a typical ${size}-credit module in this credit system (a default the institution can change)`,
    };
  }
  const hours = Number(framework.totalHours) || 120;
  return {
    count: clamp(Math.round(hours / HOURS_PER_MODULE)),
    basis: `${hours} hours at about ${HOURS_PER_MODULE} hours a module, as the programme records no credit size (a default the institution can change)`,
  };
}

const DELIVERY: Record<string, string> = {
  online_self_study:
    'Online, self-study: most learning is asynchronous (recorded explanation, guided reading, practice with feedback, discussion forums). Any live contact is short and scheduled.',
  online_facilitated:
    'Online, facilitated: live online seminars and workshops with a tutor, supported by asynchronous preparation and follow-up.',
  hybrid_blended:
    'Hybrid: a mix of live sessions (online or in person) and self-paced work; use live time for what needs interaction.',
  in_person:
    'In person: lectures, seminars, workshops and labs on campus, with independent study between sessions.',
};

/**
 * What the delivery mode means for activities. It constrains the modality, not the pedagogy:
 * an online programme can still have live seminars, simulations and group projects.
 */
export function deliveryGuidance(mode: unknown): string {
  const text = DELIVERY[String(mode || '')];
  return text
    ? `${text} Choose activities that suit each module's purpose within this mode.`
    : 'Delivery mode not recorded: choose activities that suit each module, and do not assume a mode.';
}

/**
 * How modules should progress at this level. Progression is shown in the complexity of
 * contexts, the autonomy expected and the integration of earlier learning, not only in verbs.
 */
export function progressionGuidance(level: number | null): string {
  if (level && level >= 6) {
    return `At EQF level ${level} even early modules may work at Analyse or Evaluate. Show progression through more complex and less predictable contexts, more learner autonomy and more integration of earlier modules, not by starting lower on Bloom's taxonomy.`;
  }
  return 'Earlier modules build foundations and application; later modules move towards analysis, evaluation and independent work. Show progression through the complexity of contexts and the autonomy expected as well as through verbs.';
}

export type StructureOrigin = 'uploaded' | 'outline';

/** What a batch is told about the module list it must write to. */
export function structureStatusLine(origin: StructureOrigin): string {
  return origin === 'uploaded'
    ? 'The module list below was supplied by the institution and is fixed for this generation. It has not been confirmed as approved by any awarding body. Do not add, remove, merge, split, rename or re-credit any module.'
    : "The module list below was proposed by this generator's outline pass and has not yet been reviewed by the institution. Keep to it for this pass: do not add, remove, merge, split, rename or re-credit any module.";
}

/**
 * The SME's Step 3 settings that must hold for the whole programme. Step 4 never saw them, so an
 * exclusion that happened not to show in the outcomes' wording could come back as a topic.
 */
export function smeConstraintLines(step3: any): string {
  const lines: string[] = [];
  if (step3?.contextConstraints) lines.push(`CONTEXT CONSTRAINTS: ${step3.contextConstraints}`);
  if (step3?.stakeholderPriorities)
    lines.push(`STAKEHOLDER PRIORITIES: ${step3.stakeholderPriorities}`);
  const exclusions = Array.isArray(step3?.exclusions) ? step3.exclusions.filter(Boolean) : [];
  if (exclusions.length)
    lines.push(
      `EXCLUSIONS (do not include anywhere, as a topic or otherwise): ${exclusions.join(', ')}`
    );
  return lines.length
    ? `SME SETTINGS FOR THE WHOLE PROGRAMME (from Step 3):\n${lines.join('\n')}`
    : '';
}
