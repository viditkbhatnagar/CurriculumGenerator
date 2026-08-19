/**
 * Redistribute multiple-choice answer positions.
 *
 * Measured on a generated bank of 645 items: the correct option was the longest in 82% of
 * them and option A in 69%, against 25% by chance. A candidate who always picked the
 * longest option would have scored 82% without studying, which invalidates the bank as
 * evidence of achievement.
 *
 * Asking the model not to do this helps but cannot guarantee it, so position is corrected
 * deterministically after generation. Length bias cannot be fixed by moving options around
 * — that needs the distractors written to match, which is a prompt rule — but position is
 * arithmetic, and this removes the larger of the two exploits.
 *
 * The rotation is derived from the question itself rather than a random source, so the same
 * bank always balances the same way and a regenerated export does not reshuffle answers
 * under a marker who has already printed it.
 */

export interface McqLike {
  questionType?: string;
  questionText?: string;
  questionNumber?: number;
  options?: string[];
  correctAnswer?: unknown;
  correctOptionIndex?: number;
}

/** Stable small integer from a string, so shuffling is reproducible across runs. */
function stableHash(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/** Which option is currently correct, by index, or -1 when it cannot be determined. */
export function correctIndexOf(question: McqLike): number {
  if (!Array.isArray(question.options) || question.options.length === 0) return -1;
  if (
    typeof question.correctOptionIndex === 'number' &&
    question.correctOptionIndex >= 0 &&
    question.correctOptionIndex < question.options.length
  ) {
    return question.correctOptionIndex;
  }
  if (typeof question.correctAnswer === 'number') {
    return question.correctAnswer >= 0 && question.correctAnswer < question.options.length
      ? question.correctAnswer
      : -1;
  }
  if (typeof question.correctAnswer === 'string') {
    return question.options.findIndex((option) => option === question.correctAnswer);
  }
  return -1;
}

/**
 * Move each item's correct option to a position determined by a stable hash, spreading the
 * answer key evenly across A/B/C/D. Rewrites `options`, `correctOptionIndex` and
 * `correctAnswer` together so they cannot disagree.
 *
 * Questions whose correct option cannot be identified are left untouched: silently
 * reordering options on an item whose key is ambiguous would corrupt it.
 */
export function balanceMcqPositions(questions: McqLike[]): {
  balanced: number;
  skipped: number;
} {
  let balanced = 0;
  let skipped = 0;

  for (const question of questions || []) {
    const isMcq = String(question.questionType || '').toLowerCase() === 'mcq';
    if (!isMcq || !Array.isArray(question.options) || question.options.length < 2) continue;

    const from = correctIndexOf(question);
    if (from < 0) {
      skipped += 1;
      continue;
    }

    const options = [...question.options];
    const correct = options[from];
    const target =
      stableHash(`${question.questionText || ''}|${question.questionNumber || 0}`) % options.length;
    if (target === from) {
      // Already where it should be; still normalise the key fields.
      question.correctOptionIndex = from;
      question.correctAnswer = correct;
      balanced += 1;
      continue;
    }

    options.splice(from, 1);
    options.splice(target, 0, correct);

    question.options = options;
    question.correctOptionIndex = target;
    question.correctAnswer = correct;
    balanced += 1;
  }

  return { balanced, skipped };
}
