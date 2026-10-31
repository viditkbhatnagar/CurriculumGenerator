/**
 * Step 7's progress as the job percentage the page shows. Formatives are most of the work (one
 * call per assessment, module by module) and take 5-85%; the programme summative, the sample
 * questions and the LMS packages follow. Null for a report that should not move the bar.
 */
export function step7Percent(progress: {
  stage: string;
  completedSteps?: number;
  totalSteps?: number;
}): number | null {
  switch (progress.stage) {
    case 'formative': {
      const total = progress.totalSteps || 0;
      if (!total) return 5;
      const done = Math.min(progress.completedSteps || 0, total);
      return Math.round(5 + (80 * done) / total);
    }
    case 'summative':
      return 88;
    case 'samples':
      return 93;
    case 'lms':
      return 97;
    default:
      return null;
  }
}
