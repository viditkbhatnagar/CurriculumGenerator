/**
 * What each step found in the knowledge base when it was written, and the steps that found
 * nothing.
 *
 * Steps 1 to 5 search the standards library before asking the model to write. When the search
 * found nothing, the step was written from the model's general knowledge, and the only trace was
 * a line in the server log (Rejin's audit and Logan's review, 16 October 2026: "what happens
 * when the search does not return a match?"). Each search now records its result on the
 * programme as `kbEvidence`, and a step that found nothing is listed among the unresolved issues
 * for the subject expert to check.
 *
 * Pure, so it can be tested; the recording itself is in workflowService.retrieveKBContext.
 */

export interface KbEvidenceRecord {
  /** Passages given to the model: library passages plus the programme's own textbook passages. */
  passages: number;
  /** Of those, passages from textbooks ingested for this programme (Step 5.5). */
  books: number;
  at: string | Date;
}

/** Recorded per step ("step1" to "step4"), and per module for Step 5 ("step5" → module id). */
export type KbEvidence = Record<string, KbEvidenceRecord | Record<string, KbEvidenceRecord>>;

/** The key a search is recorded under: its stage, with a module id for Step 5. */
export function kbEvidencePath(stage: string, moduleId?: string): string {
  const clean = (s: string) => s.replace(/[.$]/g, '_');
  return moduleId ? `${clean(stage)}.${clean(moduleId)}` : clean(stage);
}

const isRecord = (v: unknown): v is KbEvidenceRecord =>
  !!v && typeof v === 'object' && typeof (v as KbEvidenceRecord).passages === 'number';

export interface KbGap {
  step: number;
  issue: string;
}

/**
 * The steps, and Step 5 modules, written without a single knowledge-base passage. `moduleLabel`
 * turns a Step 5 module id into the code a reviewer knows it by.
 */
export function kbEvidenceGaps(
  evidence: KbEvidence | undefined,
  moduleLabel: (moduleId: string) => string = (id) => id
): KbGap[] {
  if (!evidence) return [];
  const gaps: KbGap[] = [];
  for (const step of [1, 2, 3, 4]) {
    const record = evidence[`step${step}`];
    if (isRecord(record) && record.passages === 0) {
      gaps.push({
        step,
        issue:
          "Written without any passage from the knowledge base, so it rests on the AI model's general knowledge: check it against the programme's standards",
      });
    }
  }
  const step5 = evidence.step5;
  if (step5 && !isRecord(step5)) {
    const modules = Object.entries(step5).filter(([, r]) => isRecord(r));
    const empty = modules.filter(([, r]) => (r as KbEvidenceRecord).passages === 0);
    if (empty.length) {
      const names = empty.map(([id]) => moduleLabel(id));
      gaps.push({
        step: 5,
        issue: `${empty.length} of ${modules.length} modules had no knowledge-base passage when their sources were chosen: ${names
          .slice(0, 12)
          .join(', ')}${names.length > 12 ? '…' : ''}`,
      });
    }
  }
  return gaps;
}
