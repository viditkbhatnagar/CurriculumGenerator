import type { AssignmentDeliveryVariant, ModuleAssignmentPacks } from '@/types/workflow';

/**
 * Step 12 completeness, mirroring the backend's services/deliverableValidation.ts.
 *
 * A variant whose generation failed is stored as a placeholder (assignmentId ends in
 * "-placeholder") with an empty brief and rubric. The page used to count any stored pack as
 * "3 variants generated", so on the BBA 45 of 46 modules showed as complete while 110 of 138
 * variants were placeholders, and "View Packs" opened nothing to read.
 */
export const PACK_VARIANTS: AssignmentDeliveryVariant[] = ['in_person', 'self_study', 'hybrid'];

export function isPlaceholderVariant(variant: { assignmentId?: string } | undefined): boolean {
  return /-placeholder$/.test(String(variant?.assignmentId || ''));
}

export function missingPackVariants(
  pack: ModuleAssignmentPacks | undefined
): AssignmentDeliveryVariant[] {
  return PACK_VARIANTS.filter((name) => {
    const variant = pack?.variants?.[name];
    return !variant || isPlaceholderVariant(variant);
  });
}

export function isModulePackComplete(pack: ModuleAssignmentPacks | undefined): boolean {
  return !!pack && missingPackVariants(pack).length === 0;
}
