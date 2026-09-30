/**
 * Whether Step 8 case studies stay within their brief of "hooks only, no assessment questions".
 *
 * `noAssessmentQuestions` was the constant `true`. The step exists to supply material that
 * questions are written from later, and a case carrying its own multiple-choice items or an
 * answer key leaks the assessment into teaching material. This looks for what a question
 * bank looks like: lettered option lists, answer keys and numbered questions. Discussion
 * prompts are open questions by design and are not what it looks for.
 *
 * Pure, no imports, so it can be tested.
 */

/** Three consecutive lettered options: "A) ... B) ... C) ..." or "(a) ... (b) ... (c) ...". */
const OPTION_LIST =
  /(?:^|\s)\(?A[).]\s+\S[\s\S]{0,400}?(?:^|\s)\(?B[).]\s+\S[\s\S]{0,400}?(?:^|\s)\(?C[).]\s+\S|(?:^|\s)\(a\)\s+\S[\s\S]{0,400}?(?:^|\s)\(b\)\s+\S[\s\S]{0,400}?(?:^|\s)\(c\)\s+\S/m;

/** Answer keys and numbered questions. "Q1" alone is left out: it is usually a quarter. */
const ANSWER_KEY =
  /\b(correct answer|answer key|the answer is|model answer)\b|\bQuestion\s+\d+\s*[:.)]/i;

function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => strings(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => strings(v, out));
  return out;
}

/** The titles (or ids) of cases whose text contains question-bank material. */
export function casesWithAssessmentQuestions(
  caseStudies: { id?: string; title?: string }[]
): string[] {
  const flagged: string[] = [];
  for (const cs of caseStudies || []) {
    const text = strings(cs).join('\n');
    if (OPTION_LIST.test(text) || ANSWER_KEY.test(text)) {
      flagged.push(String(cs?.title || cs?.id || 'untitled case'));
    }
  }
  return flagged;
}
