/**
 * Library-wide deduplication (Rejin's design, section 4: "These 14 passages are all treatments of
 * essentially the same concept. They become one knowledge cluster, with 14 supporting sources").
 *
 * Ingestion merges a concept with one already held only when their names match, because
 * closeness of meaning alone cannot tell "the same concept" from "a related one" (see
 * clustering.ts for the calibration). This pass finds the rest: embeddings shortlist each
 * concept's nearest few in its area, a model judges each shortlisted pair strictly, and
 * concepts judged the same are merged into the one with the most evidence. The merged codes
 * stay findable as aliases (`aliasCodes`), so a module that cited them still resolves.
 *
 * Runs over the whole library, so the order books were added in does not matter; safe to repeat.
 */
import { openaiService } from '../services/openaiService';
import { loggingService } from '../services/loggingService';
import { withUsageContext } from '../services/usageContext';
import { candidatePairs, sameConceptClusters, tidyEvidence } from './clustering';
import { KbConcept, KbMeta } from './models';
import { isAiUnavailable } from '../services/aiAvailability';
import { EXTRACTION_MODEL, recomputeDomainStats } from './ingestBook';

const PAIRS_PER_CALL = 40;

const judgeSystem = `You decide whether two entries in a textbook concept index are THE SAME concept.
"same": the same concept under different names or wordings (a synonym, an abbreviation, the same
named framework or method, the same term defined by two books).
"different": anything else, including related concepts, a variant or special case (stochastic vs
plain gradient descent), a part or component, a broader or narrower concept, an opposite (overfitting
vs underfitting), or two members of the same family (precision vs recall).
When unsure, answer "different". Return JSON only.`;

function judgePrompt(pairs: { n: number; a: any; b: any }[]): string {
  const line = (c: any) =>
    `${c.name}${c.aliases?.length ? ` (also: ${c.aliases.slice(0, 4).join(', ')})` : ''}: ${String(c.definition || '').slice(0, 220)}`;
  return `For each numbered pair, answer "same" or "different".

${pairs.map((p) => `${p.n}.\n  A: ${line(p.a)}\n  B: ${line(p.b)}`).join('\n')}

Return: {"answers":[{"n":1,"verdict":"same|different"}]}`;
}

export interface ConsolidationResult {
  concepts: number;
  pairsJudged: number;
  batchesFailed: number;
  judgedSame: number;
  clusters: number;
  clustersTooLarge: number;
  conceptsMerged: number;
}

/** Judging batches run at once; each is one small call of up to 40 pairs. */
const JUDGE_CONCURRENCY = 10;

async function judgeBatch(batch: { n: number; a: any; b: any }[]): Promise<[string, string][]> {
  const reply = await openaiService.generateContent(judgePrompt(batch), judgeSystem, {
    model: EXTRACTION_MODEL,
    reasoningEffort: 'low',
    responseFormat: 'json_object',
    maxTokens: 8000,
    timeout: 300000,
    maxRetries: 3,
  });
  const answers: any[] = JSON.parse(reply)?.answers || [];
  const same: [string, string][] = [];
  for (const ans of answers) {
    const p = batch.find((b) => b.n === Number(ans?.n));
    if (p && String(ans?.verdict).toLowerCase() === 'same') {
      same.push([String(p.a._id), String(p.b._id)]);
    }
  }
  return same;
}

export async function consolidateLibrary(domainKeys?: string[]): Promise<ConsolidationResult> {
  return withUsageContext({ step: 'knowledge-library' }, async () => {
    const filter: any = domainKeys?.length ? { domainKey: { $in: domainKeys } } : {};
    const rows: any[] = await KbConcept.find(filter)
      .select('name aliases definition area domainKey embedding')
      .lean();
    const byId = new Map(rows.map((r) => [String(r._id), r]));
    // Paired within domain and area: "Other" is an area in every domain, and a concept must
    // never move from one domain to another by merging.
    const pairs = candidatePairs(
      rows
        .filter((r) => r.embedding?.length)
        .map((r) => ({ id: String(r._id), area: `${r.domainKey}|${r.area}`, vector: r.embedding }))
    );

    const batches: { n: number; a: any; b: any }[][] = [];
    for (let i = 0; i < pairs.length; i += PAIRS_PER_CALL) {
      batches.push(
        pairs
          .slice(i, i + PAIRS_PER_CALL)
          .map((p, j) => ({ n: j + 1, a: byId.get(p.a), b: byId.get(p.b) }))
      );
    }
    const same: [string, string][] = [];
    let batchesFailed = 0;
    for (let i = 0; i < batches.length; i += JUDGE_CONCURRENCY) {
      const results = await Promise.allSettled(
        batches.slice(i, i + JUDGE_CONCURRENCY).map(judgeBatch)
      );
      for (const r of results) {
        if (r.status === 'fulfilled') {
          same.push(...r.value);
          continue;
        }
        // A model that cannot be reached at all fails the pass; it must not report success.
        if (isAiUnavailable(r.reason)) throw r.reason;
        batchesFailed++;
        loggingService.warn(
          'Library consolidation: a batch could not be judged; its pairs stay separate',
          {
            error: r.reason instanceof Error ? r.reason.message : String(r.reason),
          }
        );
      }
    }
    if (batches.length && batchesFailed === batches.length) {
      throw new Error(`Consolidation judged none of its ${batches.length} batches`);
    }

    const clusters = sameConceptClusters(same);
    const clustersTooLarge =
      sameConceptClusters(same, Number.MAX_SAFE_INTEGER).length - clusters.length;
    let merged = 0;
    for (const ids of clusters) {
      const docs: any[] = await KbConcept.find({ _id: { $in: ids } });
      if (docs.length < 2) continue;
      docs.sort(
        (x, y) =>
          (y.evidence?.length || 0) - (x.evidence?.length || 0) || x.code.localeCompare(y.code)
      );
      const [keep, ...rest] = docs;
      let evidence: any[] = keep.evidence || [];
      for (const d of rest) {
        for (const e of d.evidence || []) evidence = tidyEvidence(evidence, e, e.sectionKey);
        keep.aliases = Array.from(new Set([...keep.aliases, d.name, ...d.aliases]))
          .filter((n) => n !== keep.name)
          .slice(0, 16);
        keep.aliasKeys = Array.from(new Set([...keep.aliasKeys, d.key, ...d.aliasKeys]));
        keep.aliasCodes = Array.from(
          new Set([...(keep.aliasCodes || []), d.code, ...(d.aliasCodes || [])])
        );
        keep.formulae = [
          ...(keep.formulae || []),
          ...(d.formulae || []).filter(
            (f: any) => !(keep.formulae || []).some((g: any) => g.expression === f.expression)
          ),
        ].slice(0, 8);
        if (!keep.subArea && d.subArea) keep.subArea = d.subArea;
        for (const f of [
          'components',
          'applications',
          'misconceptions',
          'prerequisites',
          'related',
          'skillsEnabled',
          'assessmentPossibilities',
        ]) {
          keep[f] = Array.from(new Set([...(keep[f] || []), ...(d[f] || [])])).slice(0, 16);
        }
      }
      keep.evidence = evidence;
      keep.markModified('evidence');
      await keep.save();
      await KbConcept.deleteMany({ _id: { $in: rest.map((d) => d._id) } });
      merged += rest.length;
    }

    const domains = Array.from(new Set(rows.map((r) => r.domainKey).filter(Boolean)));
    await recomputeDomainStats(domains);
    await KbMeta.updateOne({ _id: 'concepts' }, { $inc: { version: 1 } }, { upsert: true });
    const result = {
      concepts: rows.length,
      pairsJudged: pairs.length,
      batchesFailed,
      judgedSame: same.length,
      clusters: clusters.length,
      clustersTooLarge,
      conceptsMerged: merged,
    };
    await KbMeta.updateOne(
      { _id: 'consolidation' },
      { $set: { ...result, at: new Date() } },
      { upsert: true }
    );
    loggingService.info('Library consolidated', result);
    return result;
  });
}
