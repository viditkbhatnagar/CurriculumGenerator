/**
 * The frame and heading of a validation panel, from its worst check. The Step 10, 11 and 13
 * panels were green whatever their rows said, so a report full of failures still looked like a
 * pass at a glance. A check is true (passed), false (failed) or null/undefined (not checked).
 */
export interface ValidationFrame {
  frame: string;
  heading: string;
  title: string;
}

export function validationFrame(checks: (boolean | null | undefined)[]): ValidationFrame {
  const failed = checks.filter((c) => c === false).length;
  if (failed > 0) {
    return {
      frame: 'bg-red-500/10 border-red-500/30',
      heading: 'text-red-500',
      title: `Validation Report: ${failed} ${failed === 1 ? 'check fails' : 'checks fail'}`,
    };
  }
  // No checks is not a pass: an empty list must never come out green.
  if (!checks.length || checks.some((c) => c === null || c === undefined)) {
    return {
      frame: 'bg-slate-500/10 border-slate-500/30',
      heading: 'text-slate-500',
      title: checks.length
        ? 'Validation Report: some checks not run'
        : 'Validation Report: no checks were run',
    };
  }
  return {
    frame: 'bg-emerald-500/10 border-emerald-500/30',
    heading: 'text-emerald-400',
    title: 'Validation Report: all checks pass',
  };
}
