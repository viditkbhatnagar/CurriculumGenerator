/**
 * One-time migration: archive existing Step 11 PowerPoint slide content to S3.
 *
 * The whole curriculum is a single MongoDB document (16MB cap). Large programmes
 * stored hundreds of decks (thousands of slides) inline, pushing documents past
 * the limit so every save failed and generation looped. New generations now
 * archive slide content to S3 automatically (see pptDeckStore + workflowService);
 * this script heals EXISTING documents — including idle ones that will never run
 * generation again — by moving their inline slide content to S3 and leaving only
 * lightweight stubs inline.
 *
 * Usage:
 *   npx tsx src/scripts/offloadStep11Decks.ts            # all workflows
 *   npx tsx src/scripts/offloadStep11Decks.ts <id>       # a single workflow
 *
 * Safe to re-run: already-archived modules are skipped. Each workflow is
 * persisted with updateOne($set) on the (now small) decks array, which succeeds
 * even when the original document is at the 16MB ceiling.
 */
import mongoose from 'mongoose';
import config from '../config';
import { CurriculumWorkflow } from '../models/CurriculumWorkflow';
import { offloadModuleDecks } from '../services/pptDeckStore';
import { isS3Configured } from '../services/s3Service';

function hasHeavySlides(mod: any): boolean {
  return (mod?.pptDecks || []).some((d: any) =>
    (d?.slides || []).some(
      (s: any) => s && (s.content !== undefined || s.speakerNotes !== undefined)
    )
  );
}

async function main(): Promise<void> {
  if (!isS3Configured()) {
    console.error(
      'S3 is not configured — set S3_BUCKET / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY.'
    );
    process.exit(1);
  }

  await mongoose.connect(config.database.mongoUri);
  console.log('Connected. Scanning for workflows with inline Step 11 decks…');

  const filter: any = process.argv[2]
    ? { _id: new mongoose.Types.ObjectId(process.argv[2]) }
    : { 'step11.modulePPTDecks.0': { $exists: true } };

  const cursor = CurriculumWorkflow.find(filter).cursor();
  let scanned = 0;
  let healed = 0;

  for (let wf: any = await cursor.next(); wf; wf = await cursor.next()) {
    scanned += 1;
    const modules: any[] = wf.step11?.modulePPTDecks || [];
    if (!modules.some(hasHeavySlides)) continue;

    const offloaded = await Promise.all(modules.map((m) => offloadModuleDecks(String(wf._id), m)));

    await CurriculumWorkflow.updateOne(
      { _id: wf._id },
      { $set: { 'step11.modulePPTDecks': offloaded } }
    );
    healed += 1;
    const slideTotal = modules.reduce(
      (s, m) =>
        s + (m.pptDecks || []).reduce((n: number, d: any) => n + (d.slides?.length || 0), 0),
      0
    );
    console.log(
      `  healed ${String(wf._id)} — ${offloaded.length} module(s), ~${slideTotal} slides archived to S3`
    );
  }

  console.log(`Done. Scanned ${scanned}, healed ${healed}.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
