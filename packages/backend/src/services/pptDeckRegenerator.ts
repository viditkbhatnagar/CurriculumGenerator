/**
 * Writes chosen Step 11 decks again, in the background: the decks with problems (cut off,
 * outlines, or naming CIPD), or every deck of chosen modules, optionally only those written
 * before a given time (chosenForRewrite), which makes a run restartable.
 *
 * Each module's archive in S3 is copied to a dated backup before it is replaced, and the module's
 * entry in the workflow is replaced with a positional update, so nothing else in Step 11 is
 * touched and the change can be undone.
 */
import mongoose from 'mongoose';
import { CopyObjectCommand } from '@aws-sdk/client-s3';
import config from '../config';
import { loggingService } from './loggingService';
import { CurriculumWorkflow } from '../models/CurriculumWorkflow';
import { loadModulePlans } from './step10Store';
import { hydrateModuleDecks, offloadModuleDecks } from './pptDeckStore';
import { getS3Client, isS3Configured } from './s3Service';
import { chosenForRewrite, deckProblems, replacesDeck } from './pptLessonContent';

export type DeckSelection = 'problems' | 'all';

export interface DeckRun {
  workflowId: string;
  running: boolean;
  startedAt: string;
  finishedAt?: string;
  selection: DeckSelection;
  /** Only decks written before this time are rewritten. */
  before?: string;
  modules: string[];
  decksPlanned: number;
  decksWritten: number;
  /** Written again but not better than the stored deck, so not replaced. */
  decksKept: number;
  decksFailed: number;
  errors: string[];
}

const LESSONS_IN_FLIGHT = 6;
const runs = new Map<string, DeckRun>();
export const deckRun = (workflowId: string) => runs.get(workflowId);

async function backup(key: string) {
  if (!key || !isS3Configured()) return;
  await getS3Client().send(
    new CopyObjectCommand({
      Bucket: config.s3.bucket,
      CopySource: encodeURI(`${config.s3.bucket}/${key}`),
      Key: `${key}.backup-${new Date().toISOString().replace(/[:.]/g, '-')}`,
    })
  );
}

export async function startDeckRegeneration(
  workflowId: string,
  {
    selection,
    moduleCodes,
    before,
  }: { selection: DeckSelection; moduleCodes?: string[]; before?: Date }
): Promise<DeckRun> {
  const existing = runs.get(workflowId);
  if (existing?.running) return existing;

  const workflow: any = await CurriculumWorkflow.findById(workflowId).lean();
  const entries: any[] = (workflow?.step11?.modulePPTDecks || []).filter(
    (m: any) => !moduleCodes?.length || moduleCodes.includes(m.moduleCode)
  );
  if (!workflow || !entries.length) throw new Error('Workflow or Step 11 decks not found');

  const run: DeckRun = {
    workflowId,
    running: true,
    startedAt: new Date().toISOString(),
    selection,
    before: before?.toISOString(),
    modules: entries.map((m) => m.moduleCode),
    decksPlanned: 0,
    decksWritten: 0,
    decksKept: 0,
    decksFailed: 0,
    errors: [],
  };
  runs.set(workflowId, run);

  void (async () => {
    try {
      await rewriteModules();
    } catch (error) {
      run.errors.push(`run stopped: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      run.running = false;
      run.finishedAt = new Date().toISOString();
      loggingService.info('Step 11 deck regeneration finished', {
        ...run,
        errors: run.errors.slice(0, 20),
      });
    }
  })();
  return run;

  async function rewriteModules() {
    const plans = await loadModulePlans(workflowId);
    const { PPTGenerationService } = await import('./pptGenerationService');
    const ppt = new PPTGenerationService();
    for (const entry of entries) {
      try {
        const full = await hydrateModuleDecks(entry);
        // A failed read from S3 returns the stubs; writing those back would erase the module.
        const readable = (full.pptDecks || []).every((d: any) =>
          (d?.slides || []).every((sl: any) => sl?.content !== undefined)
        );
        if (!readable) {
          run.errors.push(`${entry.moduleCode}: slides could not be read from storage; skipped`);
          continue;
        }
        const plan: any = plans.find((p: any) => p.moduleId === entry.moduleId);
        const lessons = new Map((plan?.lessons || []).map((l: any) => [l.lessonId, l]));
        const decks: any[] = [...(full.pptDecks || [])];
        const targets = decks
          .map((d, i) => ({ d, i }))
          .filter(({ d }) => lessons.has(d.lessonId))
          .filter(({ d }) => chosenForRewrite(d, selection, before));
        run.decksPlanned += targets.length;
        if (!targets.length) continue;
        const written = run.decksWritten;

        const context = {
          programTitle: workflow.step1?.programTitle || 'Program',
          moduleCode: entry.moduleCode,
          moduleTitle: entry.moduleTitle,
          deliveryMode: workflow.step1?.delivery?.mode || 'online',
          glossaryEntries: workflow.step9?.terms || workflow.step9?.entries || [],
          sources: workflow.step5?.sources || [],
        };
        let next = 0;
        await Promise.all(
          Array.from({ length: Math.min(LESSONS_IN_FLIGHT, targets.length) }, async () => {
            while (next < targets.length) {
              const { d, i } = targets[next++];
              try {
                const fresh = await ppt.generateLessonPPT(
                  lessons.get(d.lessonId) as any,
                  context as any
                );
                if (replacesDeck(d, fresh)) {
                  decks[i] = fresh;
                  run.decksWritten++;
                } else {
                  run.decksKept++;
                  run.errors.push(
                    `${entry.moduleCode} L${d.lessonNumber}: kept the stored deck (new one: ${
                      deckProblems(fresh).join(', ') || 'no better'
                    })`
                  );
                }
              } catch (error) {
                run.decksFailed++;
                run.errors.push(
                  `${entry.moduleCode} L${d.lessonNumber}: ${error instanceof Error ? error.message : String(error)}`
                );
              }
            }
          })
        );

        if (run.decksWritten === written) continue;
        await backup(full.slidesS3Key);
        const stored = await offloadModuleDecks(workflowId, { ...full, pptDecks: decks });
        await CurriculumWorkflow.collection.updateOne(
          {
            _id: new mongoose.Types.ObjectId(workflowId),
            'step11.modulePPTDecks.moduleId': entry.moduleId,
          },
          { $set: { 'step11.modulePPTDecks.$': stored } }
        );
      } catch (error) {
        run.errors.push(
          `${entry.moduleCode}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }
}
