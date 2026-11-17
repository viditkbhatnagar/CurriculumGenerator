/**
 * Where a Step 5 run has got to, as a percentage for the progress bar.
 *
 * Logan Pacey's email of 17 November 2026 reported that the Step 5 page promised "around 6
 * minutes" while runs took 11 to 18, and that the bar never moved. Step 5 reported no progress
 * at all, so the page could only show an indeterminate bar. The module requests run in
 * parallel and are most of the time, so each finished module moves the bar; the stages after
 * them (matching sources to outcomes, saving) take the last few points.
 */
export const STEP5_MODULES_START = 5;
export const STEP5_MODULES_SPAN = 85;
export const STEP5_MATCHING_AT = 90;
export const STEP5_SAVING_AT = 95;

export type Step5Stage = 'modules' | 'matching' | 'saving';

export function step5ProgressAt(stage: Step5Stage, done = 0, total = 0): number {
  if (stage === 'matching') return STEP5_MATCHING_AT;
  if (stage === 'saving') return STEP5_SAVING_AT;
  if (total <= 0) return STEP5_MODULES_START;
  const share = Math.min(Math.max(done / total, 0), 1);
  return Math.round(STEP5_MODULES_START + STEP5_MODULES_SPAN * share);
}
