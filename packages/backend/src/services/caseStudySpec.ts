/**
 * What a module's case study should be like at its level: length, protagonist, difficulty.
 *
 * Two faults (Rejin's audit and Logan's review, 16 October 2026):
 * - The tier came from the programme's level alone, so every case in a three-year degree was
 *   written to the same tier, and difficulty was "intermediate" for all of them.
 * - Length was stated three ways that disagreed: "2–6 pages" (up to "10–15 pages") in the prompt,
 *   a 400–600 or 800–1,200-word scenario in the same prompt, and a 400–800-word check afterwards.
 *
 * The level is now the module's own year when Step 4 records one ("Year 2 – Level 5"), else the
 * programme's; and length is one range of words, from which the pages and the check both follow.
 *
 * Pure, so it can be tested.
 */

export type CaseDifficulty = 'introductory' | 'intermediate' | 'advanced';

export interface CaseSpec {
  /** The academic level the case is written for (UK framework: 3 to 7). */
  level: number;
  tier: number;
  description: string;
  /** The scenario's length in words; pages are derived from it. */
  words: { min: number; max: number };
  pages: string;
  protagonist: string;
  difficulty: CaseDifficulty;
}

/** About this many words to a printed page. */
const WORDS_PER_PAGE = 450;

const SPECS: Record<number, Omit<CaseSpec, 'level' | 'pages'>> = {
  3: {
    tier: 5,
    description: 'Introductory certificate or short course',
    words: { min: 400, max: 700 },
    protagonist: 'Entry-level Professional',
    difficulty: 'introductory',
  },
  4: {
    tier: 4,
    description: 'First year of a degree, or a vocational diploma',
    words: { min: 500, max: 900 },
    protagonist: 'Supervisor / Team Leader',
    difficulty: 'introductory',
  },
  5: {
    tier: 3,
    description: 'Second year of a degree, or a higher diploma',
    words: { min: 700, max: 1200 },
    protagonist: 'Mid-level Manager / Specialist',
    difficulty: 'intermediate',
  },
  6: {
    tier: 2,
    description: 'Final year of a degree, or a graduate diploma',
    words: { min: 1000, max: 1600 },
    protagonist: 'Senior Manager / Director',
    difficulty: 'advanced',
  },
  7: {
    tier: 1,
    description: "Master's or MBA",
    words: { min: 1500, max: 2500 },
    protagonist: 'C-level / General Manager',
    difficulty: 'advanced',
  },
};

/** A level from free text: "Level 5", "Year 2", or a qualification name. Null if none is stated. */
export function levelFromText(text: unknown): number | null {
  const t = String(text || '').toLowerCase();
  const level = t.match(/level\s*([3-8])/);
  if (level) return Math.min(7, Number(level[1]));
  const year = t.match(/year\s*([1-4])/);
  if (year) return Math.min(7, Number(year[1]) + 3);
  if (/master|mba|postgraduate|level 7/.test(t)) return 7;
  if (/bachelor|undergraduate|degree|honours/.test(t)) return 6;
  if (/higher national|hnd|foundation degree|advanced diploma/.test(t)) return 5;
  if (/diploma/.test(t)) return 5;
  if (/certificate|micro-?credential|short course/.test(t)) return 3;
  return null;
}

/**
 * The level a module's case is written for: the module's own year or level from Step 4 when it
 * has one, otherwise the programme's.
 */
export function caseLevelFor(module: unknown, programmeLevel: unknown): number {
  const group = (module as { group?: unknown } | null | undefined)?.group;
  return levelFromText(group) ?? levelFromText(programmeLevel) ?? 5;
}

export function caseSpecFor(level: number): CaseSpec {
  const l = Math.max(3, Math.min(7, Math.round(level)));
  const spec = SPECS[l];
  const pages = (n: number) => Math.max(1, Math.round(n / WORDS_PER_PAGE));
  const [low, high] = [pages(spec.words.min), pages(spec.words.max)];
  return {
    ...spec,
    level: l,
    pages: low === high ? `about ${low} page${low === 1 ? '' : 's'}` : `about ${low}–${high} pages`,
  };
}

/**
 * Whether a scenario's length suits its level. A sixth either side of the range is allowed, as
 * the model counts words loosely; outside that the case is too thin or too long for its level.
 */
export function caseLengthValid(wordCount: number, words: { min: number; max: number }): boolean {
  return wordCount >= Math.floor(words.min * 0.85) && wordCount <= Math.ceil(words.max * 1.15);
}

/** What each tier's case is like beyond its length, for the writer's tier guide. */
const TIER_CHARACTER: Record<number, string> = {
  7: 'High ambiguity, several valid answers; complex strategic decisions with many stakeholders. Exhibits: financial statements, market data, organisation charts.',
  6: 'Moderate ambiguity; a senior manager facing operational or strategic challenges. Exhibits: process maps, performance data, project plans.',
  5: 'Structured problems; a manager or team leader. Exhibits: data tables, simplified scenarios.',
  4: 'Concrete and tool-based. Exhibits: templates, calculators, process documents, forms.',
  3: 'Workplace language; a single clear decision. Exhibits: checklists, simple scenarios, job aids.',
};

/** The tier guide given to the case writer, with every length taken from caseSpecFor. */
export function caseTierGuide(): string {
  return [7, 6, 5, 4, 3]
    .map((level) => {
      const s = caseSpecFor(level);
      return `**Tier ${s.tier}** = Level ${level}: ${s.description}
- Scenario of ${s.words.min}–${s.words.max} words (${s.pages}); exhibits are extra
- Protagonist: ${s.protagonist}; difficulty: ${s.difficulty}
- ${TIER_CHARACTER[level]}`;
    })
    .join('\n\n');
}
