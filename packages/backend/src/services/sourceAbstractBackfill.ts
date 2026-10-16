/**
 * Gives a programme's Step 5 sources their abstracts, looked up by DOI.
 *
 * Step 5 has always read each OpenAlex paper's abstract (to judge relevance) and then thrown it
 * away, so programmes generated before 16 October 2026 hold citations only. The abstract is the
 * one piece of a source's own content the lesson writer can be given (services/lessonSources).
 * Each source is updated in place by its id; nothing else in Step 5 is touched.
 */
import mongoose from 'mongoose';
import { CurriculumWorkflow } from '../models/CurriculumWorkflow';
import { abstractsByDoi, normaliseDoi } from './academicSourceService';

export async function backfillSourceAbstracts(workflowId: string) {
  const wf: any = await CurriculumWorkflow.findById(workflowId, { 'step5.sources': 1 }).lean();
  if (!wf) throw new Error('Workflow not found');
  const sources: any[] = wf.step5?.sources || [];
  const missing = sources.filter((s) => s?.id && s?.doi && !s?.abstract);
  const abstracts = await abstractsByDoi(missing.map((s) => s.doi));
  const updates = missing
    .map((s) => ({ id: s.id, abstract: abstracts.get(normaliseDoi(s.doi)) }))
    .filter((u): u is { id: string; abstract: string } => !!u.abstract);
  if (updates.length) {
    const _id = new mongoose.Types.ObjectId(workflowId);
    await CurriculumWorkflow.collection.bulkWrite(
      updates.map((u) => ({
        updateOne: {
          filter: { _id, 'step5.sources.id': u.id },
          update: { $set: { 'step5.sources.$.abstract': u.abstract } },
        },
      }))
    );
  }
  return {
    sources: sources.length,
    withDoi: sources.filter((s) => s?.doi).length,
    alreadyHadAbstract: sources.filter((s) => s?.abstract).length,
    looked: missing.length,
    added: updates.length,
  };
}
