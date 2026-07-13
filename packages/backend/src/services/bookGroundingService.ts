/**
 * Book grounding — retrieve the source-grounded knowledge nodes decomposed from
 * a workflow's OWN sourced textbooks (Step 5.5 / Book Ingestion) and format them
 * for injection into downstream generation prompts (Steps 6-13).
 *
 * Workflow-scoped and MLO-targeted (a curriculum only ever grounds on its own
 * books). Returns nothing when no books have been ingested, so every caller is
 * a no-op until an SME opts a book in. See docs/book-ingestion/.
 */

import { loggingService } from './loggingService';

export interface GroundingContext {
  content: string;
  source: string; // "<Book title> — <source location>"
  relevance: number;
}

/**
 * This workflow's ingested-textbook nodes, ranked by MLO overlap + confidence.
 * @param mloIds narrow to nodes serving these outcomes (falls back to top nodes)
 */
export async function getWorkflowBookGrounding(
  workflowId: string,
  mloIds?: string[],
  maxNodes = 8
): Promise<GroundingContext[]> {
  try {
    const { BookIntelligence } = await import('../models/BookIntelligence');
    const books = await BookIntelligence.find({
      workflowId,
      status: { $in: ['ready', 'needs_review'] },
    }).select('bookTitle nodes');
    if (!books.length) return [];

    const wanted = new Set((mloIds || []).filter(Boolean));
    const scored: Array<{ ctx: GroundingContext; score: number }> = [];
    for (const b of books) {
      for (const n of ((b as any).nodes as any[]) || []) {
        if (!n?.detailedContent) continue;
        const overlap = wanted.size
          ? (n.mloIds || []).filter((m: string) => wanted.has(m)).length
          : 0;
        if (wanted.size && overlap === 0) continue; // MLO filter: only serving nodes
        const conf = n.confidence === 'High' ? 1 : n.confidence === 'Medium' ? 0.8 : 0.6;
        scored.push({
          ctx: {
            content: n.detailedContent,
            source: `${(b as any).bookTitle} — ${n.sourceLocation || n.title}`,
            relevance: 0.99,
          },
          score: overlap * 10 + conf,
        });
      }
    }
    // If the MLO filter matched nothing, fall back to the top core nodes.
    if (!scored.length && wanted.size) return getWorkflowBookGrounding(workflowId, [], maxNodes);

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, maxNodes)
      .map((s) => s.ctx);
  } catch (error) {
    loggingService.warn('Book grounding retrieval failed (continuing)', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/** Format grounding nodes as a promptable block (empty string when none). */
export function formatBookGrounding(contexts: GroundingContext[]): string {
  if (!contexts.length) return '';
  const body = contexts
    .slice(0, 10)
    .map((c, i) => `[TEXTBOOK SOURCE ${i + 1}: ${c.source}]\n${c.content.substring(0, 800)}`)
    .join('\n\n---\n\n');
  return `
=== SOURCED TEXTBOOK KNOWLEDGE ===
The following is decomposed from this programme's own sourced textbooks. Ground your
output in it where relevant and cite the source location; do not contradict it or invent
beyond it.

${body}

=== END TEXTBOOK KNOWLEDGE ===
`;
}

/** Convenience: retrieve + format in one call. */
export async function buildBookGroundingBlock(
  workflowId: string,
  mloIds?: string[],
  maxNodes = 8
): Promise<string> {
  return formatBookGrounding(await getWorkflowBookGrounding(workflowId, mloIds, maxNodes));
}
