/**
 * Judging whether a source belongs to a module, by meaning rather than by words.
 *
 * Keyword overlap cannot do this job, and the failures are not subtle. A curriculum
 * reviewer found, in one pass: a module on Financial Accounting Fundamentals paired with
 * "Interpretable machine learning: Fundamental principles and 10 grand challenges";
 * Introduction to Marketing paired with "An Introduction to Deep Reinforcement Learning";
 * Leadership & Personal Effectiveness paired with "Influencers on Instagram: antecedents
 * and consequences of opinion leadership"; and International Business paired with the
 * Global Burden of Disease study, on the strength of "global, regional and national".
 *
 * Every one of those is a legitimate, peer-reviewed paper matched on a shared word. No
 * amount of tuning fixes that, because term overlap is precisely what produced it —
 * weighting the terms differently only changes which collisions win. What is needed is a
 * representation in which "Fundamentals of Financial Accounting" and "fundamental
 * principles of machine learning" are far apart despite sharing a stem, and in which
 * "double-entry bookkeeping" and "the accounting equation" are close despite sharing
 * nothing. That is what an embedding gives.
 *
 * The model is the one this codebase already uses for its knowledge base
 * (text-embedding-3-large at 1536 dimensions), so this adds no new dependency, and the
 * cost is negligible next to generation: about 500k tokens for a 46-module programme,
 * roughly $0.07, against ~$12 of completion tokens for the same run.
 */
import { openaiService } from './openaiService';
import { loggingService } from './loggingService';

export interface ModuleSemantics {
  moduleId: string;
  /** The module as a whole: title, topics and every learning outcome. */
  moduleVector: number[];
  /** One vector per learning outcome, for deciding which outcome a source supports. */
  mloVectors: { mloId: string; vector: number[] }[];
}

export interface ScoredSource<T> {
  source: T;
  /** Cosine similarity to the module as a whole, -1..1. */
  moduleScore: number;
}

/**
 * Cosine similarity. OpenAI returns unit-length vectors, so the dot product alone would
 * do; the norms are kept so this stays correct if that ever changes.
 */
export function cosine(a: number[], b: number[]): number {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** What a module is about, in the words the curriculum itself uses. */
function moduleText(module: {
  title?: string;
  topics?: string[];
  mlos?: { statement?: string }[];
}): string {
  const topics = (module.topics || []).filter(Boolean).join('; ');
  const outcomes = (module.mlos || [])
    .map((m) => m.statement)
    .filter(Boolean)
    .join(' ');
  return [module.title, topics, outcomes].filter(Boolean).join('. ').slice(0, 4000);
}

/** What a source is about. The abstract carries most of the signal; the title alone is thin. */
export function sourceText(source: { title?: string; abstract?: string }): string {
  return [source.title, source.abstract].filter(Boolean).join('. ').slice(0, 4000);
}

/**
 * Embed every module and every learning outcome in one pass.
 *
 * One batched request per ~100 texts, so a 46-module programme with four outcomes each is
 * about 230 texts: three requests.
 */
export async function buildModuleSemantics(
  modules: {
    id: string;
    title?: string;
    topics?: string[];
    mlos?: { id?: string; statement?: string }[];
  }[]
): Promise<Map<string, ModuleSemantics>> {
  const texts: string[] = [];
  const plan: { moduleId: string; mloId?: string }[] = [];

  for (const module of modules) {
    texts.push(moduleText(module));
    plan.push({ moduleId: module.id });
    for (const mlo of module.mlos || []) {
      if (!mlo.id || !mlo.statement) continue;
      // Prefixed with the module title so a terse outcome ("apply prioritisation and
      // time management") is read in the subject it belongs to.
      texts.push(`${module.title || ''}. ${mlo.statement}`.slice(0, 2000));
      plan.push({ moduleId: module.id, mloId: mlo.id });
    }
  }

  const vectors = await openaiService.generateEmbeddingsBatch(texts);
  if (vectors.length !== texts.length) {
    throw new Error(
      `Embedding count mismatch while preparing module semantics: asked for ${texts.length}, received ${vectors.length}`
    );
  }

  const semantics = new Map<string, ModuleSemantics>();
  for (const module of modules) {
    semantics.set(module.id, { moduleId: module.id, moduleVector: [], mloVectors: [] });
  }
  plan.forEach((entry, index) => {
    const record = semantics.get(entry.moduleId);
    if (!record) return;
    if (entry.mloId) {
      record.mloVectors.push({ mloId: entry.mloId, vector: vectors[index] });
    } else {
      record.moduleVector = vectors[index];
    }
  });

  loggingService.info('Built module semantics for source relevance', {
    modules: modules.length,
    embeddedTexts: texts.length,
  });
  return semantics;
}

/**
 * Order candidates by how close they are in meaning to the module.
 *
 * Ordering only — nothing is rejected for scoring low. A page of candidates holds about
 * fifty and six are used, so which six is the whole question; a hard cut-off was measured
 * against a hand-labelled set and would have deleted sources a subject expert would keep.
 * Ranking cannot lose a good source, it can only place one lower.
 */
export async function rankByMeaning<T extends { title?: string; abstract?: string }>(
  candidates: T[],
  semantics: ModuleSemantics | undefined
): Promise<ScoredSource<T>[]> {
  if (!semantics?.moduleVector?.length || candidates.length === 0) {
    return candidates.map((source) => ({ source, moduleScore: 0 }));
  }

  const vectors = await openaiService.generateEmbeddingsBatch(candidates.map(sourceText));
  if (vectors.length !== candidates.length) {
    // Better to keep the incoming order than to pair scores with the wrong sources.
    loggingService.warn('Embedding count mismatch while ranking candidates; keeping order', {
      candidates: candidates.length,
      vectors: vectors.length,
    });
    return candidates.map((source) => ({ source, moduleScore: 0 }));
  }

  return candidates
    .map((source, index) => ({
      source,
      moduleScore: cosine(vectors[index], semantics.moduleVector),
      vector: vectors[index],
    }))
    .sort((a, b) => b.moduleScore - a.moduleScore);
}

/**
 * How well a source matches each of a module's learning outcomes.
 *
 * Every score is returned, not just the winner, and the caller stores them. That matters
 * because the threshold for "close enough to claim this outcome" is a judgement that will
 * need revisiting: with the scores on the document, the mapping can be re-derived later
 * at no cost instead of paying for another generation to try a different number.
 */
export async function scoreAgainstMLOs<T extends { title?: string; abstract?: string }>(
  sources: T[],
  semantics: ModuleSemantics | undefined
): Promise<Map<T, Record<string, number>>> {
  const scores = new Map<T, Record<string, number>>();
  if (!semantics?.mloVectors?.length || sources.length === 0) return scores;

  const vectors = await openaiService.generateEmbeddingsBatch(sources.map(sourceText));
  if (vectors.length !== sources.length) {
    loggingService.warn('Embedding count mismatch while scoring outcomes; skipping', {
      sources: sources.length,
      vectors: vectors.length,
    });
    return scores;
  }

  sources.forEach((source, index) => {
    const perMlo: Record<string, number> = {};
    for (const { mloId, vector } of semantics.mloVectors) {
      perMlo[mloId] = Number(cosine(vectors[index], vector).toFixed(4));
    }
    scores.set(source, perMlo);
  });
  return scores;
}

/**
 * How well each source fits every module in the programme.
 *
 * Used to check placement rather than to choose sources: a source assigned to one module
 * that reads as a much better fit for another is almost certainly misplaced, and saying
 * which module it belongs to is more useful to a reviewer than simply calling it wrong.
 */
export async function scoreAgainstModules<T extends { title?: string; abstract?: string }>(
  sources: T[],
  modules: { id: string }[],
  semantics: Map<string, ModuleSemantics>
): Promise<Map<T, Record<string, number>>> {
  const scores = new Map<T, Record<string, number>>();
  if (sources.length === 0 || semantics.size === 0) return scores;

  const vectors = await openaiService.generateEmbeddingsBatch(sources.map(sourceText));
  if (vectors.length !== sources.length) {
    loggingService.warn('Embedding count mismatch while checking placement; skipping', {
      sources: sources.length,
      vectors: vectors.length,
    });
    return scores;
  }

  sources.forEach((source, index) => {
    const perModule: Record<string, number> = {};
    for (const module of modules) {
      const moduleVector = semantics.get(module.id)?.moduleVector;
      if (moduleVector?.length) {
        perModule[module.id] = Number(cosine(vectors[index], moduleVector).toFixed(4));
      }
    }
    scores.set(source, perModule);
  });
  return scores;
}

/**
 * Minimum similarity for a source to be said to support an outcome.
 *
 * Deliberately cautious. Claiming support that does not exist is the failure that matters
 * here: the per-module tick reading "every outcome has a source behind it" is what an
 * awarding body leans on, and it was previously satisfied by assigning whichever outcome
 * happened to sit at array index 0 whenever nothing scored above zero. An outcome with no
 * genuine backing should show as uncovered.
 *
 * Every score is persisted alongside the assignment, so this number can be re-derived
 * against real data without another generation.
 */
export const MLO_SUPPORT_FLOOR = 0.25;

/** How many outcomes one source may reasonably be said to support. */
export const MAX_MLOS_PER_SOURCE = 2;
