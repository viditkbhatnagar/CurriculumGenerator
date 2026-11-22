/**
 * The per-module "Compliant" badge on the Step 5 page.
 *
 * Logan Pacey (21 November 2026) saw "Compliant" directly under the fast-moving flag on M03.
 * The badge only tested the peer-reviewed share and the academic/applied mix and never looked
 * at recency, so it could read Compliant on a fast-moving module whose sources broke the
 * stricter five-year rule. It now includes the same recency rules the programme-level checks
 * use, and says when the stricter rule is what it was held to. (On the Logistics pilot M03 does
 * meet it: all 11 sources are from 2021 or later, so it stays Compliant, now with the wording.)
 */
import {
  RecencyModule,
  RecencySource,
  isFastMovingModule,
  moduleRecencyProblems,
  sourceCurrency,
} from './sourceRecency';

export interface ModuleVerdict {
  agiCompliant: boolean;
  /** True on a fast-moving module that was held to the five-year rule and met it. */
  fastMovingRuleMet: boolean;
  /** Why the module does not read Compliant on recency grounds. */
  recencyIssues: string[];
}

export function moduleVerdict(input: {
  module: RecencyModule;
  sources: RecencySource[];
  currentYear: number;
  /** The peer-reviewed share and academic/applied mix the badge already tested. */
  mixOk: boolean;
}): ModuleVerdict {
  const { module, sources, currentYear, mixOk } = input;
  const fastMoving = isFastMovingModule(module);
  const recencyIssues: string[] = [];

  const outdated = sources.filter((s) => !sourceCurrency(s, currentYear, { fastMoving }).current);
  if (outdated.length > 0) {
    recencyIssues.push(
      fastMoving
        ? `${outdated.length} source(s) are older than five years; fast-moving topics allow no exception`
        : `${outdated.length} source(s) are outdated without a justification`
    );
  }
  for (const p of moduleRecencyProblems(sources, [module], currentYear)) {
    recencyIssues.push(p.message);
  }

  return {
    agiCompliant: mixOk && recencyIssues.length === 0,
    fastMovingRuleMet: fastMoving && sources.length > 0 && recencyIssues.length === 0,
    recencyIssues,
  };
}
