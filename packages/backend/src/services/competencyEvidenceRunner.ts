/**
 * Searches the knowledge base for the evidence behind each Step 2 statement, and embeds the
 * statements to find pairs that mean nearly the same thing (see competencyEvidence for why).
 *
 * A dry run reports the score distributions, so the floors can be set from real data. A write
 * re-reads the workflow and adds the evidence to it, so an edit made during the search survives.
 * A statement whose search failed is left unchecked: it is never recorded as "no evidence".
 */
import { ragEngine } from './ragEngine';
import { openaiService } from './openaiService';
import { loggingService } from './loggingService';
import { CurriculumWorkflow } from '../models/CurriculumWorkflow';
import {
  COMPETENCY_LISTS,
  competencyItemsOf,
  CompetencyItem,
  DUPLICATE_SIMILARITY,
  EVIDENCE_FLOOR,
  EvidencePassage,
  evidenceQuery,
  EXCERPT_LENGTH,
  selectEvidence,
  similarPairs,
  SimilarPair,
} from './competencyEvidence';

/** Candidates below this are not kept at all; above it they are kept for calibration. */
const SEARCH_FLOOR = 0.6;
/** Pairs recorded from this similarity up, so the duplicate floor can be lowered later. */
const PAIR_RECORD_FLOOR = 0.75;
const SEARCHES_IN_FLIGHT = 4;

async function inBatches<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) await fn(items[next++]);
    })
  );
}

const quantiles = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (q: number) =>
    sorted.length ? Number(sorted[Math.floor(q * (sorted.length - 1))].toFixed(3)) : null;
  return {
    count: sorted.length,
    min: at(0),
    p10: at(0.1),
    median: at(0.5),
    p90: at(0.9),
    max: at(1),
  };
};

async function searchEvidence(items: CompetencyItem[]) {
  const candidates = new Map<string, EvidencePassage[]>();
  const failures: string[] = [];
  await inBatches(items, SEARCHES_IN_FLIGHT, async (item) => {
    try {
      const results = await ragEngine.semanticSearch(evidenceQuery(item), {
        maxSources: 5,
        minSimilarity: SEARCH_FLOOR,
      });
      candidates.set(
        String(item.id),
        results.map((r) => ({
          sourceTitle: r.source?.title || 'Knowledge base',
          chunkId: r.sourceId ? String(r.sourceId) : undefined,
          excerpt: String(r.content || '').slice(0, EXCERPT_LENGTH),
          score: r.similarityScore,
        }))
      );
    } catch (error) {
      failures.push(`${item.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
  return { candidates, failures };
}

/** Every same-kind pair with its similarity, or null when the statements could not be embedded. */
async function findSimilar(items: CompetencyItem[]): Promise<SimilarPair[] | null> {
  try {
    const vectors = await openaiService.generateEmbeddingsBatch(
      items.map((i) => String(i.statement))
    );
    return similarPairs(items, vectors, -1);
  } catch (error) {
    loggingService.warn('Competency duplicate check failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function checkCompetencyEvidence(
  workflowId: string,
  { dryRun = true }: { dryRun?: boolean } = {}
) {
  const workflow: any = await CurriculumWorkflow.findById(workflowId).lean();
  if (!workflow?.step2) throw new Error('Workflow or Step 2 not found');
  const items = competencyItemsOf(workflow.step2);
  if (!items.length) throw new Error('Step 2 has no competency statements');

  const [{ candidates, failures }, allPairs] = await Promise.all([
    searchEvidence(items),
    findSimilar(items),
  ]);
  const pairs = allPairs && allPairs.filter((p) => p.score >= PAIR_RECORD_FLOOR);
  const best = (id: string) => {
    const scores = (candidates.get(id) || []).map((p) => p.score);
    return scores.length ? Math.max(...scores) : null;
  };
  const statementOf = new Map(items.map((i) => [String(i.id), i.statement]));

  if (!dryRun) {
    const fresh = await CurriculumWorkflow.findById(workflowId);
    if (!fresh?.step2) throw new Error('Workflow or Step 2 not found');
    const checkedAt = new Date().toISOString();
    const step2: any = fresh.step2;
    const withEvidence = (list: CompetencyItem[] | undefined) =>
      (list || []).map((item) =>
        candidates.has(String(item?.id))
          ? {
              ...item,
              evidence: {
                checkedAt,
                statement: item.statement,
                candidates: candidates.get(String(item.id)) || [],
              },
            }
          : item
      );
    fresh.step2 = {
      ...step2,
      ...Object.fromEntries(
        [...COMPETENCY_LISTS, 'attitudeItems']
          .filter((list) => Array.isArray(step2[list]))
          .map((list) => [list, withEvidence(step2[list])])
      ),
      ...(pairs ? { similarStatements: pairs, similarStatementsCheckedAt: checkedAt } : {}),
    };
    fresh.markModified('step2');
    await fresh.save();
  }

  const bestScores = items.map((i) => best(String(i.id))).filter((s): s is number => s !== null);
  return {
    dryRun,
    statements: items.length,
    searched: candidates.size,
    searchFailures: failures,
    bestScores: quantiles(bestScores),
    noCandidateAtAll: items.filter((i) => best(String(i.id)) === null).map((i) => i.id),
    supportedAtFloor: [0.7, 0.75, 0.8, 0.85, 0.9].map((floor) => ({
      floor,
      supported: items.filter(
        (i) => selectEvidence(candidates.get(String(i.id)) || [], floor).length
      ).length,
    })),
    floor: EVIDENCE_FLOOR,
    examples: items.slice(0, 6).map((i) => ({
      id: i.id,
      statement: i.statement,
      top: (candidates.get(String(i.id)) || [])
        .sort((a, b) => b.score - a.score)
        .slice(0, 2)
        .map((p) => ({
          score: Number(p.score.toFixed(3)),
          title: p.sourceTitle,
          excerpt: p.excerpt.slice(0, 160),
        })),
    })),
    duplicates:
      pairs && allPairs
        ? {
            floor: DUPLICATE_SIMILARITY,
            recorded: pairs.length,
            // Every same-kind pair, not only those recorded, so the floor can be set from it.
            scores: quantiles((allPairs || []).map((p) => p.score)),
            top: pairs.slice(0, 10).map((p) => ({
              score: Number(p.score.toFixed(3)),
              first: `${p.first}: ${statementOf.get(p.first)}`,
              second: `${p.second}: ${statementOf.get(p.second)}`,
            })),
          }
        : null,
  };
}
