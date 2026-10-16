/**
 * The content audit's findings (services/curriculumDrift), as unresolved issues a reviewer reads.
 *
 * curriculumDrift measures the faults Dr Sherin found by reading all 46 BBA modules: content
 * above the module's level, a professional body cited outside its discipline, jurisdiction-specific
 * law where the topics do not call for it, and one subject's activities spreading through others.
 * It ran only in the automated tests (Logan's review, 16 October 2026). The audit now runs on
 * stored lessons (contentAuditRunner) and its findings are listed here, one line per kind of
 * fault, naming the modules.
 *
 * Pure, so it can be tested.
 */
import type { DriftFinding } from './curriculumDrift';

export interface ModuleAudit {
  moduleCode: string;
  findings: DriftFinding[];
  checkedAt: string | Date;
  /** Lessons held, and of those, lessons written without any source to teach from. */
  lessons?: number;
  ungroundedLessons?: number;
}

export interface ContentAudit {
  /** Keyed by module id. */
  modules?: Record<string, ModuleAudit>;
  checkedAt?: string | Date;
}

const RULE_HEADINGS: { rules: DriftFinding['rule'][]; heading: string }[] = [
  { rules: ['level'], heading: "Lesson content is pitched above the module's level" },
  { rules: ['discipline'], heading: 'A professional body is cited outside its discipline' },
  {
    rules: ['jurisdiction'],
    heading: "Jurisdiction-specific law appears where the module's topics do not call for it",
  },
  { rules: ['overlap'], heading: "Another subject's activities recur in the lessons" },
  { rules: ['dominance', 'tail'], heading: 'One theme takes over the module or its later lessons' },
];

const MODULES_NAMED = 8;

/**
 * One line per kind of fault, naming each affected module and what was found in it. A programme
 * with lessons that were never audited gets a single "not checked" line instead.
 */
export function contentAuditIssues(
  audit: ContentAudit | undefined,
  hasLessons: boolean
): { kind: 'review' | 'not_checked'; issue: string }[] {
  const modules = Object.values(audit?.modules || {});
  if (!modules.length) {
    return hasLessons
      ? [
          {
            kind: 'not_checked',
            issue:
              'The lesson content has not been checked for level, discipline, jurisdiction and repeated activities',
          },
        ]
      : [];
  }
  const issues: { kind: 'review'; issue: string }[] = [];
  // Lessons written from the model's memory rather than the programme's readings (lessonSources).
  const ungrounded = modules
    .filter((m) => (m.ungroundedLessons || 0) > 0)
    .sort((a, b) => a.moduleCode.localeCompare(b.moduleCode, undefined, { numeric: true }));
  if (ungrounded.length) {
    const total = ungrounded.reduce((n, m) => n + (m.ungroundedLessons || 0), 0);
    const named = ungrounded
      .slice(0, MODULES_NAMED)
      .map((m) => `${m.moduleCode} (${m.ungroundedLessons} of ${m.lessons})`)
      .join(', ');
    issues.push({
      kind: 'review',
      issue: `${total} lessons in ${ungrounded.length} module${ungrounded.length === 1 ? '' : 's'} were written without a programme reading to teach from: ${named}${
        ungrounded.length > MODULES_NAMED ? '…' : ''
      }`,
    });
  }
  for (const { rules, heading } of RULE_HEADINGS) {
    const affected = modules
      .map((m) => ({
        code: m.moduleCode,
        found: (m.findings || []).filter((f) => rules.includes(f.rule)),
      }))
      .filter((m) => m.found.length)
      .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
    if (!affected.length) continue;
    const named = affected
      .slice(0, MODULES_NAMED)
      .map(
        (m) =>
          `${m.code} (${m.found
            .slice(0, 2)
            .map((f) => `${f.detail}, ${f.count}×`)
            .join('; ')})`
      )
      .join(', ');
    issues.push({
      kind: 'review',
      issue: `${heading} in ${affected.length} module${affected.length === 1 ? '' : 's'}: ${named}${
        affected.length > MODULES_NAMED ? '…' : ''
      }`,
    });
  }
  return issues;
}
