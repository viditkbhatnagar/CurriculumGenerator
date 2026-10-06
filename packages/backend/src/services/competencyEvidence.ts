/**
 * The evidence behind each Step 2 competency statement, and statements that look alike.
 *
 * The 21 September review (5.2, 4.5) found the competency framework "not auditable": each
 * statement carried a source label the model wrote ("SHRM BoCK - Talent Acquisition Domain"),
 * which showed nothing about what supported it, and several statements were generic and
 * overlapping. It asked to "show evidence and confidence for every competency, and require
 * expert review of gaps and duplication".
 *
 * Each statement is searched for in the knowledge base (competencyEvidenceRunner). The passages
 * that match it, with their similarity, are stored on the statement as its evidence; a statement
 * with none is reported for expert review, and so is every pair of statements whose meanings are
 * nearly the same. The model's own source label is kept, but shown as the AI's claim.
 *
 * The scores are stored, so the floors can be re-derived from real data without searching
 * again (as in sourceRelevanceService). Pure, so it can be tested.
 */

export const COMPETENCY_LISTS = ['knowledgeItems', 'skillItems', 'competencyItems'] as const;

export interface CompetencyItem {
  id?: string;
  type?: string;
  statement?: string;
  description?: string;
  importance?: string;
  source?: string;
  evidence?: ItemEvidence;
}

export interface EvidencePassage {
  sourceTitle: string;
  chunkId?: string;
  excerpt: string;
  score: number;
}

export interface ItemEvidence {
  checkedAt: string;
  /**
   * The wording the search was for. Evidence for other wording is treated as not checked, so an
   * edit by any route (the form, the AI assistant) cannot leave old evidence on a new statement.
   */
  statement: string;
  /**
   * Every passage the search returned, with its score. Which count as evidence is decided when
   * read (supportingPassages), so the floor can be retuned without searching again.
   */
  candidates: EvidencePassage[];
}

/**
 * The knowledge-base search score a passage needs to count as evidence. Atlas reports
 * `(1 + cosine) / 2`, so 0.5 is unrelated text.
 *
 * Set from a production dry run (2026-10-06) with a control. Best scores per statement: BBA
 * 0.816-0.844 and Logistics 0.780-0.868, whose top passages were on topic; Clinical Research,
 * whose subject the knowledge base does not cover, 0.745-0.828, with passages mostly unrelated
 * (pharmacovigilance matched to HSE procedures). At 0.80 Clinical Research has 3 of 20
 * statements supported (generic ethics and learning, which the HR standards do cover), Logistics
 * 18 of 21 and the BBA 20 of 20. Scores overlap around 0.78-0.80, so a statement just below the
 * floor may have real support; it goes to expert review, which is the safe direction.
 */
export const EVIDENCE_FLOOR = 0.8;
export const MAX_PASSAGES = 3;
export const EXCERPT_LENGTH = 300;

/**
 * Two statements of the same kind this alike in meaning (cosine of their embeddings) are
 * flagged as possibly the same competency. On 2026-10-06 the most alike distinct pair in four
 * programmes measured 0.71 (Fashion: hand illustration and CAD, against pattern making) and the
 * rest at most 0.55; reworded duplicates sit well above that. Pairs are stored from 0.5, so this
 * can be lowered from stored scores.
 */
export const DUPLICATE_SIMILARITY = 0.8;

/** Every statement of a Step 2 framework, under the list names stored data uses. */
export function competencyItemsOf(
  step2: Record<string, unknown> | null | undefined
): CompetencyItem[] {
  if (!step2) return [];
  const competencies = (
    Array.isArray(step2.competencyItems) && (step2.competencyItems as unknown[]).length
      ? step2.competencyItems
      : step2.attitudeItems
  ) as CompetencyItem[] | undefined;
  return [
    ...((step2.knowledgeItems as CompetencyItem[]) || []),
    ...((step2.skillItems as CompetencyItem[]) || []),
    ...(competencies || []),
  ].filter((item) => item && typeof item.statement === 'string' && item.statement.trim());
}

/** What is searched for: the statement, with its description for context. */
export function evidenceQuery(item: CompetencyItem): string {
  return [item.statement, item.description].filter(Boolean).join('. ').slice(0, 1000);
}

/** The passages that count as evidence: at or above the floor, one per chunk, best first. */
export function selectEvidence(
  candidates: EvidencePassage[],
  floor: number = EVIDENCE_FLOOR
): EvidencePassage[] {
  const seen = new Set<string>();
  return [...(candidates || [])]
    .filter((p) => p.score >= floor)
    .sort((a, b) => b.score - a.score)
    .filter((p) => {
      const key = p.chunkId || p.excerpt.slice(0, 100);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_PASSAGES);
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

export interface SimilarPair {
  first: string;
  second: string;
  score: number;
  /** The two statements as compared; a pair is ignored once either has been reworded. */
  texts?: [string, string];
}

/**
 * Pairs of statements of the same kind (knowledge with knowledge, and so on) whose embeddings
 * are at least `floor` alike, most alike first. Knowledge and skill statements about one topic
 * share words by design, so they are not compared with each other.
 */
export function similarPairs(
  items: CompetencyItem[],
  vectors: number[][],
  floor: number = DUPLICATE_SIMILARITY
): SimilarPair[] {
  const kindOf = (item: CompetencyItem) =>
    String(item.type || item.id?.charAt(0) || '')
      .toLowerCase()
      .charAt(0);
  const pairs: SimilarPair[] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (!vectors[i] || !vectors[j] || kindOf(items[i]) !== kindOf(items[j])) continue;
      const score = cosine(vectors[i], vectors[j]);
      if (score >= floor) {
        pairs.push({
          first: String(items[i].id),
          second: String(items[j].id),
          score,
          texts: [String(items[i].statement), String(items[j].statement)],
        });
      }
    }
  }
  return pairs.sort((a, b) => b.score - a.score);
}

export interface EvidenceSummary {
  statements: number;
  checked: number;
  supported: number;
  /** Ids of checked statements with no passage at or above the floor. */
  unsupported: string[];
}

/** The statement's evidence, if it was found for the statement's present wording. */
export function currentEvidence(item: CompetencyItem): ItemEvidence | undefined {
  const evidence = item.evidence;
  return evidence?.checkedAt && evidence.statement === item.statement ? evidence : undefined;
}

/** The passages that support a statement, under the current floor. */
export function supportingPassages(item: CompetencyItem): EvidencePassage[] {
  return selectEvidence(currentEvidence(item)?.candidates || []);
}

/** Likely duplicates at the current floor, leaving out pairs either of which has been reworded. */
export function currentDuplicates(
  step2: Record<string, unknown> | null | undefined
): SimilarPair[] {
  const statementOf = new Map(competencyItemsOf(step2).map((i) => [String(i.id), i.statement]));
  return ((step2?.similarStatements as SimilarPair[]) || []).filter(
    (p) =>
      p.score >= DUPLICATE_SIMILARITY &&
      (!p.texts ||
        (statementOf.get(p.first) === p.texts[0] && statementOf.get(p.second) === p.texts[1]))
  );
}

/** How many statements have been checked, and which have no evidence. */
export function evidenceSummary(
  step2: Record<string, unknown> | null | undefined
): EvidenceSummary {
  const items = competencyItemsOf(step2);
  const checked = items.filter((i) => currentEvidence(i));
  const unsupported = checked.filter((i) => !supportingPassages(i).length);
  return {
    statements: items.length,
    checked: checked.length,
    supported: checked.length - unsupported.length,
    unsupported: unsupported.map((i) => String(i.id)),
  };
}

/** The evidence for one statement, as the export prints it. */
export function evidenceLabel(item: CompetencyItem): string {
  if (!currentEvidence(item)) return 'Not checked';
  const passages = supportingPassages(item);
  if (!passages.length) return 'No supporting passage found in the knowledge base';
  return passages
    .slice(0, 2)
    .map((p) => `${p.sourceTitle} (match ${p.score.toFixed(2)})`)
    .join('; ');
}
