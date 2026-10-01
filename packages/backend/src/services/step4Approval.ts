/**
 * What stops Step 4 being approved: a module with an unnamed topic, or with hours not set.
 *
 * The approve route checked only the stored hoursIntegrity flag and the module count, and a
 * curriculum re-import sets that flag to true without re-checking. A module could be approved
 * with "Untitled topic" entries and "Independent: undefinedh", which is what the Logistics
 * review found on 2026-09-21. Pure, so it can be tested.
 */
import { topicTitle } from '../utils/topicShape';
import { moduleLabelOf } from '../utils/moduleIdentity';

interface Step4ModuleLike {
  id?: string;
  code?: string;
  moduleCode?: string;
  title?: string;
  moduleTitle?: string;
  topics?: unknown[];
  contactHours?: unknown;
  selfStudyHours?: unknown;
  independentHours?: unknown;
  totalHours?: unknown;
}

const isHours = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0;

/** One line per problem, naming the module; empty when Step 4 may be approved. */
export function step4ApprovalProblems(modules: Step4ModuleLike[]): string[] {
  const problems: string[] = [];
  for (const m of modules || []) {
    const label = moduleLabelOf(m);
    (m.topics || []).forEach((topic, i) => {
      if (!topicTitle(topic)) problems.push(`${label}: topic ${i + 1} has no name`);
    });
    if (!isHours(m.contactHours)) problems.push(`${label}: contact hours are not set`);
    // Real Step 4 data says selfStudyHours; the model interface says independentHours.
    if (!isHours(m.selfStudyHours ?? m.independentHours)) {
      problems.push(`${label}: independent hours are not set`);
    }
    if (!isHours(m.totalHours)) problems.push(`${label}: total hours are not set`);
  }
  return problems;
}
