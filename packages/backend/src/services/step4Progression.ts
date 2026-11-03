/**
 * Whether a programme's modules rise in level and in Bloom demand, computed from the modules.
 *
 * Logan Pacey's re-test of 2 November 2026 (a four-module certificate) found Step 4 saying two
 * things at once. `progressionValid` passed, because it only checked that prerequisites point to
 * earlier modules; and a separate legacy check, `validateProgressiveComplexity`, flagged the
 * early modules "invalid" because fewer than 60% of their outcomes used remember, understand or
 * apply verbs, a quota the prompts themselves tell the model is wrong. No module had a level,
 * and the final module was tagged "middle".
 *
 * Progression is now four computed checks, each true, false, or null when there is nothing to
 * compare: levels are assigned; levels never fall along the sequence; the final module sits at
 * the programme's highest level; and the mean Bloom level of the outcomes rises without a
 * sharp drop. Each failure comes with a sentence saying which modules. Pure, so it can be tested.
 */
import { BLOOM_LEVEL_ORDER, normaliseBloomLevel } from '../utils/bloomLevels';
import type { ModuleLevel } from './moduleLevels';

interface ModuleLike {
  id?: string;
  code?: string;
  sequence?: number;
  sequenceOrder?: number;
  isElective?: boolean;
  group?: string;
  mlos?: { bloomLevel?: unknown; [field: string]: unknown }[];
}

export interface ProgressionChecks {
  levelsAssigned: boolean | null;
  levelsNonDecreasing: boolean | null;
  capstoneAtTopLevel: boolean | null;
  bloomRising: boolean | null;
}

export interface ProgressionAudit {
  checks: ProgressionChecks;
  /** One sentence for each failed check, naming the modules. */
  problems: string[];
}

/** The largest fall in mean Bloom rank between neighbouring modules that is let through. */
export const MAX_BLOOM_DROP = 1.0;

/** From this EQF level up, a programme is not expected to start with low-level outcomes. */
const ADVANCED_EQF = 6;

const nameOf = (m: ModuleLike, i: number) => String(m.code || m.id || `module ${i + 1}`);
const sequenceOf = (m: ModuleLike, i: number) => m.sequence ?? m.sequenceOrder ?? i + 1;

/** The mean Bloom rank (remember 0 … create 5) of a module's outcomes, and its highest. */
function bloomOf(m: ModuleLike): { mean: number; max: number } | null {
  const ranks = (m.mlos || [])
    .map((o) => normaliseBloomLevel(String(o?.bloomLevel ?? '')))
    .filter((l): l is string => !!l)
    .map((l) => (BLOOM_LEVEL_ORDER as readonly string[]).indexOf(l));
  if (!ranks.length) return null;
  return { mean: ranks.reduce((a, b) => a + b, 0) / ranks.length, max: Math.max(...ranks) };
}

const label = (rank: number) => BLOOM_LEVEL_ORDER[Math.round(rank)] ?? String(rank);
const fixed = (n: number) => n.toFixed(1);

/**
 * `levels` runs parallel to `modules`. `programmeEqf` is the programme's EQF level, or null.
 */
export function progressionAudit(
  modules: ModuleLike[],
  levels: Pick<ModuleLevel, 'level' | 'year' | 'position'>[],
  programmeEqf: number | null
): ProgressionAudit {
  const list = modules || [];
  const problems: string[] = [];
  const none: ProgressionChecks = {
    levelsAssigned: null,
    levelsNonDecreasing: null,
    capstoneAtTopLevel: null,
    bloomRising: null,
  };
  if (!list.length) return { checks: none, problems };

  const ordered = list
    .map((m, i) => ({ m, i, seq: sequenceOf(m, i), lv: levels[i] }))
    .sort((a, b) => a.seq - b.seq || a.i - b.i);

  const unassigned = ordered.filter((x) => !x.lv || !Number.isFinite(x.lv.level));
  const levelsAssigned = unassigned.length === 0;
  if (!levelsAssigned) {
    problems.push(
      `No academic level is set for ${unassigned.map((x) => nameOf(x.m, x.i)).join(', ')}.`
    );
  }
  if (!levelsAssigned) {
    return { checks: { ...none, levelsAssigned }, problems };
  }

  // Core modules form one chain; each elective track is its own, since tracks are alternatives.
  const chains = new Map<string, typeof ordered>();
  for (const x of ordered) {
    const key = x.m.isElective ? `track:${x.m.group || ''}` : 'core';
    chains.set(key, [...(chains.get(key) || []), x]);
  }
  const falls: string[] = [];
  for (const chain of chains.values()) {
    chain.slice(1).forEach((x, k) => {
      const before = chain[k];
      if (x.lv.level < before.lv.level) {
        falls.push(
          `${nameOf(x.m, x.i)} (level ${x.lv.level}) comes after ${nameOf(before.m, before.i)} (level ${before.lv.level})`
        );
      }
    });
  }
  const levelsNonDecreasing = falls.length === 0;
  if (!levelsNonDecreasing) {
    problems.push(`Module levels fall along the sequence: ${falls.join('; ')}.`);
  }

  const core = ordered.filter((x) => !x.m.isElective);
  const capstone = (core.length ? core : ordered)[(core.length ? core : ordered).length - 1];
  const top = Math.max(...ordered.map((x) => x.lv.level));
  const capstoneAtTopLevel = capstone.lv.level >= top;
  if (!capstoneAtTopLevel) {
    problems.push(
      `The final module, ${nameOf(capstone.m, capstone.i)}, is at level ${capstone.lv.level}, below the programme's highest level, ${top}.`
    );
  }

  const withBloom = ordered
    .map((x) => ({ ...x, bloom: bloomOf(x.m) }))
    .filter((x) => x.bloom && !x.m.isElective);
  let bloomRising: boolean | null = null;
  if (withBloom.length >= 2) {
    const issues: string[] = [];
    const first = withBloom[0];
    const last = withBloom[withBloom.length - 1];
    const advanced = programmeEqf != null && programmeEqf >= ADVANCED_EQF;
    if (!advanced && (last.bloom as any).mean < (first.bloom as any).mean) {
      issues.push(
        `the final module's outcomes (mean ${fixed((last.bloom as any).mean)}) sit below the first module's (${fixed((first.bloom as any).mean)})`
      );
    }
    withBloom.slice(1).forEach((x, k) => {
      const before = withBloom[k];
      const drop = (before.bloom as any).mean - (x.bloom as any).mean;
      if (drop > MAX_BLOOM_DROP) {
        issues.push(
          `${nameOf(x.m, x.i)} drops ${fixed(drop)} Bloom levels from ${nameOf(before.m, before.i)}`
        );
      }
    });
    const programmeMax = Math.max(...withBloom.map((x) => (x.bloom as any).max));
    const lateLow = withBloom.filter(
      (x) => x.lv.position === 'late' && (x.bloom as any).max < programmeMax
    );
    for (const x of lateLow) {
      issues.push(
        `${nameOf(x.m, x.i)} never reaches ${label(programmeMax)}, which an earlier module does`
      );
    }
    bloomRising = issues.length === 0;
    if (!bloomRising) problems.push(`Outcomes do not rise in Bloom level: ${issues.join('; ')}.`);
  }

  return {
    checks: { levelsAssigned, levelsNonDecreasing, capstoneAtTopLevel, bloomRising },
    problems,
  };
}
