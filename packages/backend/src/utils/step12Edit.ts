/**
 * Chat edits to Step 12 assignment packs.
 *
 * The curriculum assistant was never shown Steps 11 and 12. Asked about Step 12, it told
 * Dr. Sherin Thomas that "there is no Step 12 in this curriculum" (found 2026-10-06). The
 * generic edit code cannot reach into a pack either: packs are found by `moduleId`, not
 * `id`, and each pack's `variants` is an object keyed by delivery mode, not an array.
 *
 * An edit names a module (by id or code), a variant (or "all"), one of the fields below, and
 * the new value. Pure, so it can be tested.
 */

export const STEP12_VARIANTS = ['in_person', 'self_study', 'hybrid'] as const;

/** The fields a chat edit may set, with the kind of value each holds. */
export const STEP12_EDITABLE_FIELDS: Record<string, 'text' | 'list'> = {
  'overview.title': 'text',
  'overview.assignmentType': 'text',
  'overview.submissionFormat': 'text',
  'overview.groupOrIndividual': 'text',
  'brief.studentFacingIntro': 'text',
  'brief.workplaceContext': 'text',
  'brief.stepByStepInstructions': 'list',
  'brief.deliverables': 'list',
  academicIntegrity: 'text',
  accessibilityOptions: 'text',
  rubric: 'list',
  evidenceRequirements: 'list',
};

export interface Step12Edit {
  match?: { moduleId?: string; moduleCode?: string; variant?: string };
  field?: string;
  value?: unknown;
}

interface Pack {
  moduleId?: string;
  moduleCode?: string;
  variants?: Record<string, Record<string, unknown> | undefined>;
}

const same = (a: unknown, b: unknown) =>
  typeof a === 'string' &&
  typeof b === 'string' &&
  a.trim().toLowerCase() === b.trim().toLowerCase();

/** The packs with the edit applied, or why it cannot be. The input is not changed. */
export function applyStep12Edit(
  packs: Pack[],
  edit: Step12Edit
): { packs: Pack[]; changed: number } | { problem: string } {
  const { match = {}, field = '', value } = edit;
  const kind = STEP12_EDITABLE_FIELDS[field];
  if (!kind) return { problem: `"${field}" is not an editable assignment-pack field` };
  if (kind === 'text' && typeof value !== 'string') return { problem: `${field} takes text` };
  if (kind === 'list' && !Array.isArray(value)) return { problem: `${field} takes a list` };
  if (!match.moduleId && !match.moduleCode) return { problem: 'name the module by id or code' };

  const variant = match.variant || 'all';
  if (variant !== 'all' && !(STEP12_VARIANTS as readonly string[]).includes(variant)) {
    return { problem: `unknown delivery variant "${variant}"` };
  }

  const target = packs.findIndex(
    (p) => same(p?.moduleId, match.moduleId) || same(p?.moduleCode, match.moduleCode)
  );
  if (target === -1) return { problem: 'no assignment pack for that module' };

  const pack = packs[target];
  const names = Object.keys(pack.variants || {}).filter(
    (name) => variant === 'all' || name === variant
  );
  if (!names.length) return { problem: `the module has no ${variant} variant` };

  const [section, key] = field.includes('.') ? field.split('.') : [field, undefined];
  const variants = { ...(pack.variants || {}) };
  for (const name of names) {
    const current = variants[name] || {};
    variants[name] = key
      ? {
          ...current,
          [section]: { ...((current[section] as Record<string, unknown>) || {}), [key]: value },
        }
      : { ...current, [section]: value };
  }
  const next = packs.slice();
  next[target] = { ...pack, variants };
  return { packs: next, changed: names.length };
}

/** A short index of the packs, so the assistant can find the one a request is about. */
export function step12Index(packs: Pack[]) {
  const clip = (text: unknown, n: number) => String(text || '').slice(0, n);
  return (packs || []).map((pack) => ({
    moduleId: pack.moduleId,
    moduleCode: pack.moduleCode,
    variants: Object.fromEntries(
      Object.entries(pack.variants || {}).map(([name, v]) => {
        const overview = (v?.overview || {}) as Record<string, unknown>;
        const brief = (v?.brief || {}) as Record<string, unknown>;
        return [
          name,
          {
            title: overview.title,
            assignmentType: overview.assignmentType,
            workplaceContext: clip(brief.workplaceContext, 150),
            rubricCriteria: ((v?.rubric as { criterionName?: string }[]) || []).map(
              (c) => c?.criterionName
            ),
          },
        ];
      })
    ),
  }));
}
