/**
 * What every downstream prompt tells the model about one module's level and place.
 *
 * Logan Pacey's re-test of 2 November 2026 found content at Steps 5 to 11 pitched without
 * regard to where in the programme a module sat: all eight case studies were introductory,
 * and nothing told a module what the earlier ones had taught, so topics were taught again.
 * The prompts carried only the programme's one-word level ("ACADEMIC LEVEL: certificate"),
 * rebuilt by hand at each step.
 *
 * The block states the module's year, level and position (services/moduleLevels), the level
 * descriptor for that level, and what the earlier modules taught, in a capped summary, with the
 * instruction to build on it. Pure, so it can be tested.
 */
import { EQF_DESCRIPTORS } from './programmeFraming';
import { levelsFor, ModuleLevel } from './moduleLevels';

/** The most characters one earlier module's summary may take. */
export const EARLIER_MODULE_CHARS = 240;
/** The most characters the whole earlier-modules list may take before old modules shrink to titles. */
export const EARLIER_TOTAL_CHARS = 2400;

const ORIGIN_NOTE: Record<ModuleLevel['levelOrigin'], string> = {
  author: 'set by the programme author',
  blueprint: "from the programme's module blueprint",
  derived: "derived from the programme's level and credit volume",
};

const POSITION_NOTE: Record<ModuleLevel['position'], string> = {
  early: 'an early module: establish foundations and vocabulary, with substantial support',
  middle: 'a middle module: apply and connect what the earlier modules established',
  late: 'a late module: integrate, evaluate and extend, with learners working independently',
};

/** The EQF level whose descriptor applies to a UK-scale level (the inverse of the reference table). */
const UK_TO_EQF: Record<number, number> = { 3: 4, 4: 5, 5: 5, 6: 6, 7: 7, 8: 8 };

const sequenceOf = (m: any, i: number): number => m?.sequence ?? m?.sequenceOrder ?? i + 1;

const topicTitle = (t: unknown): string =>
  typeof t === 'string' ? t : String((t as { title?: unknown } | null)?.title || '');

const clip = (text: string, max: number): string =>
  text.length <= max ? text : `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;

/** One earlier module: its code and title, then its topics and outcome statements, capped. */
function summaryOf(m: any, max: number): string {
  const head = `${m.code || m.moduleCode || m.id} – ${m.title || 'untitled'}`;
  const topics = (m.topics || []).map(topicTitle).filter(Boolean).slice(0, 6).join('; ');
  const outcomes = (m.mlos || [])
    .map((o: any) => String(o?.statement || '').trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(' / ');
  const body = [topics && `topics: ${topics}`, outcomes && `outcomes: ${outcomes}`]
    .filter(Boolean)
    .join(' | ');
  return body ? `${head}: ${clip(body, max)}` : head;
}

/** The modules a module follows: core modules with a lower sequence, and its own elective track. */
function earlierModules(modules: any[], index: number): any[] {
  const own = modules[index];
  const seq = sequenceOf(own, index);
  return modules
    .map((m, i) => ({ m, i, seq: sequenceOf(m, i) }))
    .filter(
      ({ m, i, seq: s }) =>
        i !== index && s < seq && (!m.isElective || (own.isElective && m.group === own.group))
    )
    .sort((a, b) => a.seq - b.seq)
    .map((x) => x.m);
}

/** The earlier-modules lines: recent modules in full, oldest shrunk to titles once the budget is spent. */
function earlierLines(earlier: any[]): string[] {
  const lines = earlier.map((m) => summaryOf(m, EARLIER_MODULE_CHARS));
  let total = lines.reduce((s, l) => s + l.length, 0);
  for (let i = 0; i < lines.length && total > EARLIER_TOTAL_CHARS; i++) {
    const short = summaryOf({ ...earlier[i], topics: [], mlos: [] }, 0);
    total -= lines[i].length - short.length;
    lines[i] = short;
  }
  return lines;
}

/**
 * The block for one module, given as its index in Step 4 or as the module itself. Returns an
 * empty string when the module is not in Step 4, so a prompt can include it unconditionally.
 */
export function moduleContextBlock(workflow: any, moduleOrIndex: number | any): string {
  const modules: any[] = workflow?.step4?.modules || [];
  const index =
    typeof moduleOrIndex === 'number'
      ? moduleOrIndex
      : modules.findIndex(
          (m) =>
            m === moduleOrIndex ||
            (moduleOrIndex?.id && m.id === moduleOrIndex.id) ||
            (moduleOrIndex?.code && m.code === moduleOrIndex.code)
        );
  const module = modules[index];
  if (!module) return '';

  const level = levelsFor(workflow)[index];
  const eqf =
    level.levelFramework === 'EQF' ? level.level : (UK_TO_EQF[level.level] ?? level.level);
  const descriptor = EQF_DESCRIPTORS[eqf];
  const ordered = modules.filter((m) => !m.isElective).length || modules.length;
  const place = module.isElective ? '' : ` (module ${sequenceOf(module, index)} of ${ordered})`;
  const lines = [
    '=== THIS MODULE: LEVEL AND PLACE IN THE PROGRAMME ===',
    `Module: ${module.code || module.moduleCode || module.id} – ${module.title || 'untitled'}`,
    `Level: ${level.levelLabel} (${ORIGIN_NOTE[level.levelOrigin]})`,
    `Position: ${POSITION_NOTE[level.position]}${place}`,
  ];
  if (descriptor) {
    lines.push(
      '',
      `Level descriptor (EQF level ${eqf}, Council Recommendation 2017/C 189/03, Annex II; a reference descriptor):`,
      `- Knowledge: ${descriptor.knowledge}`,
      `- Skills: ${descriptor.skills}`,
      `- Responsibility and autonomy: ${descriptor.responsibility}`,
      "Pitch this module's depth, complexity and learner autonomy to its level, not to the programme's first or last module."
    );
  }

  const earlier = earlierModules(modules, index);
  lines.push('');
  if (earlier.length) {
    lines.push(
      'Earlier modules taught (build on these; do not re-teach them):',
      ...earlierLines(earlier).map((l) => `- ${l}`)
    );
  } else {
    lines.push('This is the first module: nothing has been taught before it.');
  }
  return lines.join('\n');
}
