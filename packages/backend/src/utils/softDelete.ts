/**
 * Deleting a programme hides it instead of erasing it.
 *
 * DELETE /api/v3/workflow/:id used to hard-delete the workflow and its lesson plans with no
 * sign-in, no ownership check and no confirmation, while GET /api/v3/workflow lists every id:
 * one request could erase any client's programme for good (found 2026-10-01). A deleted
 * workflow now keeps its data with `deletedAt` set, and every find leaves it out unless the
 * query itself is about `deletedAt` (the admin list of deleted programmes, and restore).
 *
 * Pure, no imports, so it can be tested.
 */

/** Why a delete request is refused, or null when it may go ahead. */
export function deleteConfirmationProblem(
  programme: { projectName?: string | null; id: string },
  confirmName: unknown
): string | null {
  const given = typeof confirmName === 'string' ? comparable(confirmName) : '';
  if (!given) return 'Send the programme’s name as confirmName to delete it';
  // A programme with no name is confirmed by its id instead.
  const expected = comparable(programme.projectName || '') || programme.id.toLowerCase();
  return given === expected ? null : 'confirmName does not match the programme’s name';
}

/**
 * A name as both sides can agree on it. The app-wide input filter strips control characters
 * from the request but the stored name may still hold one, so both lose them, along with case
 * and differences in spacing.
 */
function comparable(name: string): string {
  const visible = Array.from(name.normalize('NFC'))
    .map((ch) => {
      const code = ch.charCodeAt(0);
      if (code === 0x09 || code === 0x0a || code === 0x0d) return ' ';
      return code < 0x20 || code === 0x7f ? '' : ch;
    })
    .join('');
  return visible.replace(/\s+/g, ' ').trim().toLowerCase();
}

interface FilterableQuery {
  getFilter(): Record<string, unknown>;
  where(filter: Record<string, unknown>): unknown;
}

/** Query middleware: leave soft-deleted programmes out unless the query names `deletedAt`. */
export function applySoftDeleteFilter(query: FilterableQuery): void {
  if (Object.prototype.hasOwnProperty.call(query.getFilter(), 'deletedAt')) return;
  query.where({ deletedAt: null });
}

/** Stages MongoDB requires to come first in a pipeline. */
const FIRST_STAGES = [
  '$search',
  '$searchMeta',
  '$vectorSearch',
  '$geoNear',
  '$collStats',
  '$indexStats',
];

/**
 * Aggregate middleware: leave soft-deleted programmes out of an aggregation unless it is about
 * `deletedAt` itself. Aggregations skip query middleware, so the admin dashboard's breakdowns
 * would otherwise count deleted programmes that its totals leave out.
 */
export function applySoftDeleteToPipeline(pipeline: Record<string, unknown>[]): void {
  if (JSON.stringify(pipeline).includes('"deletedAt"')) return;
  const first = pipeline[0] ? Object.keys(pipeline[0])[0] : undefined;
  const at = first && FIRST_STAGES.includes(first) ? 1 : 0;
  pipeline.splice(at, 0, { $match: { deletedAt: null } });
}
