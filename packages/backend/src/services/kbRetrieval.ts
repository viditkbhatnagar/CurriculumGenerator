/**
 * Knowledge-base retrieval for Steps 1 to 5: the standards-library search, the programme's own
 * ingested textbook passages, and a record on the programme of how many passages each step was
 * given (services/kbEvidence).
 *
 * Moved out of workflowService so it can be tested on its own.
 */
import { inPromptCapture } from './promptCapture';
import mongoose from 'mongoose';
import { RAGEngine } from './ragEngine';
import { loggingService } from './loggingService';
import { CurriculumWorkflow } from '../models/CurriculumWorkflow';
import { getWorkflowBookGrounding } from './bookGroundingService';
import { kbEvidencePath } from './kbEvidence';

const ragEngine = new RAGEngine();

// ============================================================================
// KNOWLEDGE BASE CONTEXT RETRIEVAL
// ============================================================================

export interface KBContext {
  content: string;
  source: string;
  relevance: number;
}

/**
 * Retrieve relevant context from the knowledge base for curriculum generation
 * Uses RAG engine for semantic search across ingested documents
 */
export async function retrieveKBContext(
  queries: string[],
  options: {
    maxResults?: number;
    minSimilarity?: number;
    domains?: string[];
    // When set, prepend this workflow's ingested-textbook nodes (highest
    // priority, cited). mloIds narrows the nodes to those serving the outcomes.
    workflowId?: string;
    mloIds?: string[];
    // Which step is asking, so an empty result can be traced to the content it left ungrounded.
    stage?: string;
    // Step 5 searches once per module; its result is recorded per module.
    moduleId?: string;
  } = {}
): Promise<KBContext[]> {
  const {
    maxResults = 15,
    minSimilarity = 0.65,
    domains,
    workflowId,
    mloIds,
    stage,
    moduleId,
  } = options;
  const allResults: KBContext[] = [];

  try {
    for (const query of queries) {
      const results = await ragEngine.semanticSearch(query, {
        maxSources: Math.ceil(maxResults / queries.length),
        minSimilarity,
        domains,
      });

      for (const result of results) {
        allResults.push({
          content: result.content,
          source: result.source?.title || 'Knowledge Base',
          relevance: result.similarityScore,
        });
      }
    }

    // Deduplicate by content similarity and sort by relevance
    const uniqueResults = allResults
      .filter(
        (item, index, self) =>
          index ===
          self.findIndex((t) => t.content.substring(0, 100) === item.content.substring(0, 100))
      )
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, maxResults);

    // Prepend this workflow's own ingested-textbook nodes (highest priority).
    let results = uniqueResults;
    let books = 0;
    if (workflowId) {
      const bookCtx = await getWorkflowBookGrounding(workflowId, mloIds, Math.min(8, maxResults));
      books = bookCtx.length;
      if (bookCtx.length) results = [...bookCtx, ...uniqueResults];
    }
    await recordKbEvidence(workflowId, stage, moduleId, results.length, books);
    // An empty result used to pass unremarked, which is how every step ran without
    // knowledge-base context while the vector index did not exist. /health reports the index.
    if (results.length === 0) {
      loggingService.warn(
        'Generating without knowledge-base evidence: retrieval returned nothing',
        {
          stage,
          workflowId,
          queries: queries.length,
          domains,
        }
      );
    } else {
      loggingService.info('Knowledge-base passages retrieved', {
        stage,
        workflowId,
        passages: results.length,
      });
    }
    return results;
  } catch (error) {
    loggingService.warn('KB context retrieval failed, proceeding without KB context', { error });
    // Book grounding is independent of KB search — still return it if present.
    if (workflowId) {
      try {
        const bookCtx = await getWorkflowBookGrounding(workflowId, mloIds, Math.min(8, maxResults));
        await recordKbEvidence(workflowId, stage, moduleId, bookCtx.length, bookCtx.length);
        return bookCtx;
      } catch {
        /* fall through */
      }
    }
    await recordKbEvidence(workflowId, stage, moduleId, 0, 0);
    return [];
  }
}

/**
 * Records on the programme how many passages a step's search gave the model (services/kbEvidence),
 * so a step written without any is listed among the unresolved issues instead of only in the
 * server log. Never throws: a failed record must not stop generation.
 */
async function recordKbEvidence(
  workflowId: string | undefined,
  stage: string | undefined,
  moduleId: string | undefined,
  passages: number,
  books: number
): Promise<void> {
  if (!workflowId || !stage || !mongoose.isValidObjectId(workflowId)) return;
  // A prompt capture changes nothing on the programme (services/promptCapture).
  if (inPromptCapture()) return;
  try {
    await CurriculumWorkflow.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(workflowId) },
      {
        $set: {
          [`kbEvidence.${kbEvidencePath(stage, moduleId)}`]: { passages, books, at: new Date() },
        },
      }
    );
  } catch (error) {
    loggingService.warn('Could not record knowledge-base evidence', { workflowId, stage, error });
  }
}

/**
 * Format KB context for inclusion in prompts
 */
export function formatKBContextForPrompt(contexts: KBContext[]): string {
  if (contexts.length === 0) {
    return '';
  }

  const formattedContexts = contexts
    .slice(0, 10) // Limit to top 10 most relevant
    .map((ctx, idx) => `[SOURCE ${idx + 1}: ${ctx.source}]\n${ctx.content.substring(0, 800)}`)
    .join('\n\n---\n\n');

  // The header used to call every passage "authoritative" and tell the model to align with it.
  // The passages are whatever the search ranked nearest, and for the BBA that meant a retail
  // skills framework for India, a health supply-chain framework and a Level 7 specification
  // (captured 19 October 2026). The model is now told to judge each one, and to set aside one
  // that does not apply rather than build on it.
  return `
=== KNOWLEDGE BASE REFERENCE MATERIALS ===
The passages below were retrieved from the knowledge base because they resemble this programme's
searches. Each is authoritative only for what it actually says. Some may concern a different
subject, sector or level, or be fragments of a page: ignore any passage that does not apply to
this programme, and never present a passage's content as applying when it does not.

${formattedContexts}

=== END KNOWLEDGE BASE MATERIALS ===
`;
}
