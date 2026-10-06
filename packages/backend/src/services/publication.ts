/**
 * Who may submit, publish or return a curriculum, and when.
 *
 * AGU (Logan Pacey, 3 October 2026): one faculty member builds a curriculum end to end in the
 * generator, and the super admin must approve it before it is published to students. The
 * workflow had `review_pending` and `published` statuses but nothing that published: "Complete
 * & Review" set review_pending and stopped there. Pure, so it can be tested.
 */
import { isStepDone } from './stepGating';

export type PublicationAction = 'submit' | 'publish' | 'return';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Workflowish = any;

/** Why the action is refused, or null when it may go ahead. */
export function publicationProblem(
  workflow: Workflowish,
  action: PublicationAction,
  role: string | undefined
): string | null {
  const status = workflow?.status;
  if (action === 'submit') {
    if (status === 'published') return 'This curriculum is already published';
    const complete =
      isStepDone(workflow, 12) &&
      (workflow?.step12?.moduleAssignmentPacks || []).length > 0 &&
      !!workflow?.step13;
    return complete
      ? null
      : 'All 13 steps must be completed first, including assignment packs and summative exam';
  }
  if (role !== 'administrator') return 'Only the super admin can publish or return a curriculum';
  if (status !== 'review_pending') return 'The curriculum has not been submitted for approval';
  return null;
}

/** Issues that should stop a publication unless the approver acknowledges them. */
export const BLOCKING_KINDS = new Set(['fail', 'missing']);
