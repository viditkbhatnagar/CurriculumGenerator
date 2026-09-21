/**
 * Which module outcome a lesson actually delivers.
 *
 * Lessons used to be handed outcomes by position: lesson n received outcome ((n-1) mod 4)+1 and
 * (n mod 4)+1, rotating through the module regardless of what the lesson taught. Nothing about
 * the lesson influenced it. In the reviewed programme that put the wrong outcome on 17 of 30
 * lessons — the lesson teaching "simple and compound interest and ordinary annuities" was mapped
 * to "Use Excel to clean a small dataset" and to probability, while the module's actual interest
 * and annuities outcome was never claimed by it.
 *
 * That was invisible for as long as the document printed bare codes. Printing the outcome
 * statements beside each lesson, which the reviewer asked for so she could read the plan on its
 * own, is what made a mechanical rotation obvious: a lecturer reading the interest lesson now
 * sees it claiming to deliver a spreadsheet outcome.
 *
 * Matching is by shared subject vocabulary and nothing else — no model call — so the assignment
 * is deterministic, inspectable, and identical on every regeneration.
 */

export interface AssignableMLO {
  id?: string;
  statement?: string;
}

/** Words too common to carry subject meaning; matching on these would pair everything with everything. */
const STOP = new Set([
  'apply',
  'using',
  'use',
  'used',
  'with',
  'from',
  'that',
  'this',
  'their',
  'there',
  'which',
  'into',
  'about',
  'these',
  'those',
  'will',
  'able',
  'learners',
  'learner',
  'student',
  'students',
  'simple',
  'basic',
  'routine',
  'business',
  'businesses',
  'given',
  'within',
  'across',
  'between',
  'appropriate',
  'relevant',
  'present',
  'results',
  'result',
  'data',
  'analysis',
  'analyse',
  'analyze',
  'evaluate',
  'create',
  'understand',
  'demonstrate',
  'identify',
  'explain',
  'produce',
  'prepare',
  'calculate',
  'compute',
  'select',
  'support',
  'decision',
  'decisions',
  'make',
  'making',
]);

/** Meaningful words in a string, lowercased and de-duplicated. */
function terms(text: string): Set<string> {
  return new Set(
    String(text || '')
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((w) => w.length > 3 && !STOP.has(w))
  );
}

/**
 * How well a lesson's subject matches an outcome, as the number of subject words in common.
 *
 * A plain count rather than a ratio: a long outcome should not be penalised for saying more, and
 * the only question here is which outcome this lesson serves best.
 */
export function matchScore(lessonText: string, mlo: AssignableMLO): number {
  const a = terms(lessonText);
  const b = terms(mlo?.statement || '');
  let score = 0;
  for (const w of a) if (b.has(w)) score += 1;
  return score;
}

/**
 * Assign every lesson the outcome it actually delivers, and guarantee every outcome is delivered
 * somewhere.
 *
 * `lessonTexts[i]` is what lesson i is about — its topic and title. Returns, per lesson, the
 * indices of the outcomes it serves: its best match first, and a second only where that second
 * genuinely shares subject matter, so a lesson never claims an outcome it has nothing to do with.
 *
 * Any outcome that wins no lesson on merit is then attached to the lesson that scored it highest.
 * Without that an outcome could go untaught and the module would fail its own coverage check —
 * the rotation's one virtue was that it never left an outcome unclaimed, and that is kept.
 */
export function assignMlosToLessons(lessonTexts: string[], mlos: AssignableMLO[]): number[][] {
  const n = mlos?.length || 0;
  if (n === 0) return lessonTexts.map(() => []);
  if (n === 1) return lessonTexts.map(() => [0]);

  const scores = lessonTexts.map((text) => mlos.map((m) => matchScore(text, m)));

  const assigned: number[][] = scores.map((row, lesson) => {
    const ranked = row
      .map((score, index) => ({ score, index }))
      .sort((a, b) => b.score - a.score || a.index - b.index);

    // No word in common with any outcome: fall back to the rotation rather than guess, so the
    // module still spreads across its outcomes.
    if (ranked[0].score === 0) return [lesson % n];

    const picked = [ranked[0].index];
    // A second outcome only when the lesson genuinely touches it, and never on a lone stray word.
    if (ranked[1] && ranked[1].score >= 2 && ranked[1].score >= ranked[0].score / 2) {
      picked.push(ranked[1].index);
    }
    return picked;
  });

  // Every outcome must be taught somewhere.
  for (let mlo = 0; mlo < n; mlo++) {
    if (assigned.some((a) => a.includes(mlo))) continue;
    let best = 0;
    let bestScore = -1;
    for (let lesson = 0; lesson < scores.length; lesson++) {
      if (scores[lesson][mlo] > bestScore) {
        bestScore = scores[lesson][mlo];
        best = lesson;
      }
    }
    if (assigned[best]) assigned[best] = [...new Set([...assigned[best], mlo])];
  }

  return assigned;
}
