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
  judgedSame: number;
  clusters: number;
  conceptsMerged: number;
}

export async function consolidateLibrary(domainKeys?: string[]): Promise<ConsolidationResult> {
  return withUsageContext({ step: 'knowledge-library' }, async () => {
    const filter: any = domainKeys?.length ? { domainKey: { $in: domainKeys } } : {};
    const rows: any[] = await KbConcept.find(filter)
      .select('name aliases definition area domainKey embedding evidence')
      .lean();
    const byId = new Map(rows.map((r) => [String(r._id), r]));
    const pairs = candidatePairs(
      rows
        .filter((r) => r.embedding?.length)
        .map((r) => ({ id: String(r._id), area: r.area, vector: r.embedding }))
    );

    const same: [string, string][] = [];
    for (let i = 0; i < pairs.length; i += PAIRS_PER_CALL) {
      const batch = pairs
        .slice(i, i + PAIRS_PER_CALL)
        .map((p, j) => ({ n: j + 1, ...p, a: byId.get(p.a), b: byId.get(p.b) }));
      try {
        const reply = await openaiService.generateContent(judgePrompt(batch), judgeSystem, {
          model: EXTRACTION_MODEL,
          reasoningEffort: 'low',
          responseFormat: 'json_object',
          maxTokens: 8000,
          timeout: 300000,
          maxRetries: 3,
        });
        const answers: any[] = JSON.parse(reply)?.answers || [];
        for (const ans of answers) {
          const p = batch.find((b) => b.n === Number(ans?.n));
          if (p && String(ans?.verdict).toLowerCase() === 'same')
            same.push([p.a._id.toString(), p.b._id.toString()]);
        }
      } catch (error) {
        loggingService.warn(
          'Library consolidation: a batch could not be judged; its pairs stay separate',
          {
            error: error instanceof Error ? error.message : String(error),
          }
        );
      }
    }

    const clusters = sameConceptClusters(same);
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
      judgedSame: same.length,
      clusters: clusters.length,
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
