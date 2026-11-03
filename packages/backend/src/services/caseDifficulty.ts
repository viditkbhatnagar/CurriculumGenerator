/**
 * How hard each module's cases are, what each case is about, and a check on both.
 *
 * Logan Pacey's re-test of 2 November 2026 (a four-module certificate, two cases per module):
 * all eight cases were introductory, because the programme's one-word level ("certificate")
 * mapped to level 3 and every module took it. The two cases of a module each received the whole
 * topic list and differed only in case type, so seven of the eight were about dashboards and the
 * pairs were near-duplicates.
 *
 * In a programme whose modules all share one level, difficulty now rises with the module's
 * position: introductory, intermediate, then advanced for the late modules, the last of which is
 * always advanced, with the protagonist and length of the next tier up. Where modules are at
 * different levels the level sets the tier, as before. Each case is given its own topic from the
 * module's list, and the programme's cases are checked in code. Pure, so it can be tested.
 */
import { CaseDifficulty, CaseSpec, caseSpecFor } from './caseStudySpec';
import { ModuleLevel, ukLevelOf } from './moduleLevels';

const BY_POSITION: Record<ModuleLevel['position'], CaseDifficulty> = {
  early: 'introductory',
  middle: 'intermediate',
  late: 'advanced',
};

const DIFFICULTY_RANK: Record<string, number> = { introductory: 0, intermediate: 1, advanced: 2 };

/** The tier a module's cases are written to, from its level and place (levels parallel to modules). */
export function caseSpecForModule(levels: ModuleLevel[], index: number): CaseSpec {
  const own = levels[index];
  if (!own) return caseSpecFor(5);
  const level = Math.max(3, Math.min(7, ukLevelOf(own)));
  const base = caseSpecFor(level);
  const singleLevel = new Set(levels.map((l) => l.level)).size === 1;
  if (!singleLevel) return base;
  // One level throughout: rise by position. A late module borrows the next tier's protagonist,
  // length and character (a team leader's case becomes a manager's), keeping the level's name.
  const stepUp = own.position === 'late' ? caseSpecFor(Math.min(7, level + 1)) : base;
  return {
    ...stepUp,
    level,
    description: base.description,
    difficulty: BY_POSITION[own.position],
  };
}

const topicTitle = (t: unknown): string =>
  typeof t === 'string' ? t : String((t as { title?: unknown } | null)?.title || '');

/**
 * A topic for each of a module's cases, spread across its list so no two cases share one
 * (while the module has at least as many topics as cases). Deterministic, so a regenerated case
 * keeps its topic.
 */
export function caseTopicsFor(module: { topics?: unknown[] }, caseCount = 2): string[] {
  const topics = (module?.topics || []).map(topicTitle).filter(Boolean);
  if (!topics.length) return Array(caseCount).fill('');
  return Array.from(
    { length: caseCount },
    (_, k) => topics[Math.floor((k * topics.length) / caseCount)]
  );
}

export interface CaseDifficultyChecks {
  difficultyRising: boolean | null;
  capstoneCaseHighest: boolean | null;
  casesHaveDistinctTopics: boolean | null;
  problems: string[];
}

const words = (title: string) =>
  new Set((title.toLowerCase().match(/[a-z]+/g) ?? ([] as string[])).filter((w) => w.length > 2));

/** Two titles this alike (shared words over all words) are called near-identical. */
const TITLE_SIMILARITY = 0.8;

const similar = (a: string, b: string): boolean => {
  const [x, y] = [words(a), words(b)];
  if (!x.size || !y.size) return false;
  const shared = [...x].filter((w) => y.has(w)).length;
  return shared / (x.size + y.size - shared) >= TITLE_SIMILARITY;
};

/**
 * The programme's cases against its module order: difficulty never falls from one module to the
 * next, the final module's cases are among the hardest, and no module's two cases share a topic
 * or a near-identical title. Null where there is nothing to compare.
 */
export function caseDifficultyChecks(
  cases: { moduleId?: string; difficulty?: string; title?: string; focusTopic?: string }[],
  modules: { id?: string; code?: string; topics?: unknown[] }[]
): CaseDifficultyChecks {
  const problems: string[] = [];
  const nameOf = (m: { id?: string; code?: string }) => String(m.code || m.id || '');
  const rows = modules
    .map((m) => ({ m, own: cases.filter((c) => c.moduleId === m.id) }))
    .filter((r) => r.own.length);
  if (!rows.length) {
    return {
      difficultyRising: null,
      capstoneCaseHighest: null,
      casesHaveDistinctTopics: null,
      problems,
    };
  }

  const rankOf = (c: { difficulty?: string }) => DIFFICULTY_RANK[String(c.difficulty)] ?? -1;
  const hardest = rows.map((r) => Math.max(...r.own.map(rankOf)));
  const fallsAt = hardest.findIndex((h, i) => i > 0 && h < hardest[i - 1]);
  const difficultyRising = fallsAt === -1;
  if (!difficultyRising) {
    problems.push(
      `Case difficulty falls from ${nameOf(rows[fallsAt - 1].m)} to ${nameOf(rows[fallsAt].m)}.`
    );
  }

  const capstoneCaseHighest = hardest[hardest.length - 1] >= Math.max(...hardest);
  if (!capstoneCaseHighest) {
    problems.push(
      `The final module's cases (${nameOf(rows[rows.length - 1].m)}) are easier than an earlier module's.`
    );
  }

  const shared: string[] = [];
  for (const { m, own } of rows) {
    const topics = own.map((c) => c.focusTopic || '').filter(Boolean);
    // A module with one topic has nothing else to give its second case.
    const sameTopic = (m.topics || []).length >= 2 && new Set(topics).size < topics.length;
    const sameTitle = own.some((a, i) =>
      own.slice(i + 1).some((b) => similar(a.title || '', b.title || ''))
    );
    if (sameTopic || sameTitle) shared.push(nameOf(m));
  }
  const casesHaveDistinctTopics = shared.length === 0;
  if (!casesHaveDistinctTopics) {
    problems.push(`The cases of ${shared.join(', ')} share a topic or have near-identical titles.`);
  }
  return { difficultyRising, capstoneCaseHighest, casesHaveDistinctTopics, problems };
}
