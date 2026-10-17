/**
 * The occupation codes in the database, and matching a programme's job roles to them.
 *
 * - syncOccupations: loads the bundled data (data/occupations), embeds the occupations that are
 *   new or whose text changed, and removes those no longer published. Idempotent, so a run cut
 *   short is finished by running it again.
 * - The index (every occupation's vector) is held in memory once loaded; a sync clears it.
 * - matchProgrammeOccupations: matches each Step 1 job role to its closest occupations in each
 *   country and records them on the programme (occupationEvidence).
 * - occupationPromptBlock: the matched occupations' official tasks, for the Step 2 and Step 4
 *   writers, as evidence of what the work involves (Logan's next steps, Phase 3).
 */
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import mongoose from 'mongoose';
import config from '../../config';
import { Occupation } from '../../models/Occupation';
import { CurriculumWorkflow } from '../../models/CurriculumWorkflow';
import { openaiService } from '../openaiService';
import { loggingService } from '../loggingService';
import type { OccupationRecord } from './occupationParsers';
import {
  COUNTRIES,
  IndexEntry,
  MATCH_FLOOR,
  OccupationEvidence,
  occupationText,
  roleText,
  shorten,
  textHash,
  topMatches,
} from './occupationIndex';

const DATA_DIR = path.join(__dirname, '../../../data/occupations');
const FILES = ['in-nco2015', 'us-onet', 'uk-soc2020', 'sg-ssoc2024'];
const EMBED_BATCH = 100;

export function bundledOccupations(): OccupationRecord[] {
  return FILES.flatMap((f) =>
    JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(DATA_DIR, `${f}.json.gz`))).toString())
  );
}

// ---------------------------------------------------------------------------------------------
// Sync

export interface SyncRun {
  running: boolean;
  startedAt: string;
  finishedAt?: string;
  bundled: number;
  embedded: number;
  unchanged: number;
  removed: number;
  error?: string;
}

let lastSync: SyncRun | null = null;
export const syncStatus = () => lastSync;

async function embed(texts: string[]): Promise<number[][]> {
  return (await openaiService.generateEmbeddingsBatch(texts)).map((v) => shorten(v));
}

/** Starts a sync in the background and returns its status at once. */
export function startOccupationSync(): SyncRun {
  if (lastSync?.running) return lastSync;
  const run: SyncRun = {
    running: true,
    startedAt: new Date().toISOString(),
    bundled: 0,
    embedded: 0,
    unchanged: 0,
    removed: 0,
  };
  lastSync = run;
  void (async () => {
    try {
      const model = config.openai.embeddingModel;
      const records = bundledOccupations();
      run.bundled = records.length;
      const stored = new Map(
        (await Occupation.find({}, { system: 1, code: 1, textHash: 1 }).lean()).map((o: any) => [
          `${o.system}|${o.code}`,
          o.textHash,
        ])
      );
      const todo = records
        .map((r) => ({ r, text: occupationText(r) }))
        .map((x) => ({ ...x, hash: textHash(x.text, model) }));
      const changed = todo.filter((x) => stored.get(`${x.r.system}|${x.r.code}`) !== x.hash);
      run.unchanged = todo.length - changed.length;
      for (let i = 0; i < changed.length; i += EMBED_BATCH) {
        const batch = changed.slice(i, i + EMBED_BATCH);
        const vectors = await embed(batch.map((x) => x.text));
        await Occupation.bulkWrite(
          batch.map((x, j) => ({
            updateOne: {
              filter: { system: x.r.system, code: x.r.code },
              update: { $set: { ...x.r, embedding: vectors[j], textHash: x.hash } },
              upsert: true,
            },
          }))
        );
        run.embedded += batch.length;
      }
      const keep = new Set(records.map((r) => `${r.system}|${r.code}`));
      const gone = [...stored.keys()].filter((k) => !keep.has(k));
      for (const key of gone) {
        const [system, code] = key.split('|');
        await Occupation.deleteOne({ system, code });
      }
      run.removed = gone.length;
      cachedIndex = null;
    } catch (error) {
      run.error = error instanceof Error ? error.message : String(error);
      loggingService.error('Occupation sync failed', { error: run.error });
    } finally {
      run.running = false;
      run.finishedAt = new Date().toISOString();
      loggingService.info('Occupation sync finished', { ...run });
    }
  })();
  return run;
}

// ---------------------------------------------------------------------------------------------
// Index and search

let cachedIndex: Promise<IndexEntry[]> | null = null;

/** Every occupation's vector, loaded once and held in memory. */
export function occupationIndex(): Promise<IndexEntry[]> {
  if (!cachedIndex) {
    cachedIndex = (async () => {
      const docs: any[] = await Occupation.find(
        {},
        { system: 1, country: 1, code: 1, title: 1, embedding: 1 }
      ).lean();
      return docs
        .filter((d) => Array.isArray(d.embedding) && d.embedding.length)
        .map((d) => ({
          country: d.country,
          system: d.system,
          code: d.code,
          title: d.title,
          vector: Float32Array.from(d.embedding),
        }));
    })().catch((error) => {
      cachedIndex = null;
      throw error;
    });
  }
  return cachedIndex;
}

/** Occupations closest to a piece of text, per country (for the search screen and calibration). */
export async function searchOccupations(text: string, floor = 0, perCountry = 5) {
  const index = await occupationIndex();
  if (!index.length) throw new Error('Occupation codes have not been loaded (run the sync)');
  const [vector] = await embed([text]);
  return topMatches(vector, index, { floor, perCountry });
}

// ---------------------------------------------------------------------------------------------
// Programmes

/** Matches each Step 1 job role to occupations in each country and records it. */
export async function matchProgrammeOccupations(workflowId: string): Promise<OccupationEvidence> {
  const wf: any = await CurriculumWorkflow.findById(workflowId, { 'step1.jobRoles': 1 }).lean();
  if (!wf) throw new Error('Workflow not found');
  const roles: any[] = (wf.step1?.jobRoles || []).filter((r: any) => r && (r.title || r.name));
  const index = await occupationIndex();
  if (!index.length) throw new Error('Occupation codes have not been loaded (run the sync)');
  const vectors = roles.length
    ? await embed(roles.map((r) => roleText({ ...r, title: r.title || r.name })))
    : [];
  const evidence: OccupationEvidence = {
    matchedAt: new Date(),
    floor: MATCH_FLOOR,
    roles: roles.map((r, i) => ({
      role: String(r.title || r.name),
      matches: topMatches(vectors[i], index),
    })),
  };
  await CurriculumWorkflow.collection.updateOne(
    { _id: new mongoose.Types.ObjectId(workflowId) },
    { $set: { occupationEvidence: evidence } }
  );
  return evidence;
}

const TASKS_PER_OCCUPATION = 5;

/**
 * The matched occupations' official descriptions and tasks, for a step's writer. Matches the
 * programme first if it never was. Never throws: a step is still written without it.
 */
export async function occupationPromptBlock(workflowId: string): Promise<string> {
  try {
    const wf: any = await CurriculumWorkflow.findById(workflowId, {
      occupationEvidence: 1,
      'step1.jobRoles': 1,
    }).lean();
    if (!wf?.step1?.jobRoles?.length) return '';
    // Matched afresh if never matched, or if the job roles changed since.
    const current = wf.step1.jobRoles.map((r: any) => String(r?.title || r?.name || '')).join('|');
    const stored = (wf.occupationEvidence?.roles || []).map((r: any) => r.role).join('|');
    const evidence: OccupationEvidence =
      stored && stored === current
        ? wf.occupationEvidence
        : await matchProgrammeOccupations(workflowId);
    // The best match per role and country.
    const wanted = evidence.roles.flatMap((r) =>
      COUNTRIES.map(({ country }) => r.matches.find((m) => m.country === country)).filter(Boolean)
    ) as OccupationEvidence['roles'][number]['matches'];
    if (!wanted.length) return '';
    const docs: any[] = await Occupation.find({
      $or: wanted.map((m) => ({ system: m.system, code: m.code })),
    }).lean();
    const byKey = new Map(docs.map((d) => [`${d.system}|${d.code}`, d]));
    const lines: string[] = [
      '\nOCCUPATIONAL STANDARDS (official national classifications, matched to the job roles):',
    ];
    for (const r of evidence.roles) {
      const matched = COUNTRIES.map(({ country }) => r.matches.find((m) => m.country === country))
        .filter(Boolean)
        .map((m) => byKey.get(`${m!.system}|${m!.code}`))
        .filter(Boolean);
      if (!matched.length) continue;
      lines.push(`Job role: ${r.role}`);
      for (const d of matched) {
        const tasks = (d.tasks || []).slice(0, TASKS_PER_OCCUPATION);
        lines.push(
          `- ${d.system} ${d.code} ${d.title}: ${String(d.description || '').slice(0, 300)}${
            tasks.length ? `\n  Tasks: ${tasks.join('; ')}` : ''
          }`
        );
      }
    }
    lines.push(
      'Use these occupations as evidence of what the work involves: the competencies and modules should prepare learners for these tasks. Cite an occupation by its code where it supports a statement.'
    );
    return lines.join('\n') + '\n';
  } catch (error) {
    loggingService.warn('Occupational standards could not be added to the prompt', {
      workflowId,
      error: error instanceof Error ? error.message : String(error),
    });
    return '';
  }
}
