/**
 * The workflow document's stand-in for a module's Step 12 packs, whose content lives in
 * `moduleassignmentpacks` (models/ModuleAssignmentPack).
 *
 * A stub keeps each variant's assignmentId — a failed variant's ends in "-placeholder", which
 * is all the completeness rule (deliverableValidation) reads — plus its title and type for
 * lists. Everything a reader or the LMS needs beyond that comes from `hydratePackEntries`.
 *
 * Pure, so it can be tested; storage is in services/step12Store.
 */

const VARIANT_NAMES = ['in_person', 'self_study', 'hybrid'] as const;

export interface PackStub {
  moduleId: string;
  moduleCode: string;
  moduleTitle: string;
  offloaded: true;
  variants: Record<
    string,
    {
      assignmentId: string;
      deliveryVariant: string;
      overview: { title?: string; assignmentType?: string };
    }
  >;
}

export function isPackStub(entry: any): entry is PackStub {
  return !!entry && entry.offloaded === true;
}

export function packStub(pack: any): PackStub {
  const variants: PackStub['variants'] = {};
  for (const name of VARIANT_NAMES) {
    const v = pack?.variants?.[name];
    if (!v) continue;
    variants[name] = {
      assignmentId: String(v.assignmentId || ''),
      deliveryVariant: String(v.deliveryVariant || name),
      overview: { title: v.overview?.title, assignmentType: v.overview?.assignmentType },
    };
  }
  return {
    moduleId: String(pack?.moduleId || ''),
    moduleCode: String(pack?.moduleCode || ''),
    moduleTitle: String(pack?.moduleTitle || ''),
    offloaded: true,
    variants,
  };
}

/**
 * The document's entries with each stub replaced by its stored pack, in the document's
 * order. An entry that was never offloaded is returned as it is. A stub whose stored pack is
 * missing comes back with no variants, so the module reads as needing generation instead of
 * vouching for content that is gone.
 */
export function hydratePackEntries(entries: any[], rows: any[]): any[] {
  const byModule = new Map((rows || []).map((r) => [String(r.moduleId), r]));
  return (entries || []).map((entry) => {
    if (!isPackStub(entry)) return entry;
    const row = byModule.get(String(entry.moduleId));
    if (!row) {
      return {
        moduleId: entry.moduleId,
        moduleCode: entry.moduleCode,
        moduleTitle: entry.moduleTitle,
        variants: {},
      };
    }
    return {
      moduleId: row.moduleId,
      moduleCode: row.moduleCode,
      moduleTitle: row.moduleTitle,
      variants: row.variants || {},
    };
  });
}
