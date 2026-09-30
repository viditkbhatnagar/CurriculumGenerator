import { createHash } from 'crypto';
import { CourseDraft } from './types';

/**
 * A short fingerprint of the parts of an outline that artefacts are drafted from.
 *
 * Quiz items, the exam and the rubric are written against specific outcomes, weeks and
 * assessments. If faculty change any of those afterwards the artefacts describe a course that
 * no longer exists, so they record this hash and are reported stale when it stops matching.
 */
export function outlineHash(
  draft: Pick<CourseDraft, 'outcomes' | 'weeks' | 'assessments' | 'readings' | 'cases'>
): string {
  const { outcomes, weeks, assessments, readings, cases } = draft;
  return createHash('sha256')
    .update(JSON.stringify({ outcomes, weeks, assessments, readings, cases }))
    .digest('hex')
    .slice(0, 16);
}
