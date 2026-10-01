/**
 * A validation report's rows. Each check is true (passed), false (failed), or null/undefined
 * (not checked). The panels this replaces showed anything that was not true as a failure, and
 * anything truthy as a pass, so a check that had not run looked like either.
 */
export type CheckValue = boolean | null | undefined;

export function ValidationChecks({
  checks,
  columns = 'grid-cols-2 md:grid-cols-4',
}: {
  checks: [label: string, value: CheckValue][];
  columns?: string;
}) {
  return (
    <div className={`grid ${columns} gap-2 text-xs`}>
      {checks.map(([label, value]) => {
        const unchecked = value === null || value === undefined;
        const style = unchecked ? 'text-slate-400' : value ? 'text-emerald-400' : 'text-red-400';
        return (
          <span key={label} className={style}>
            {unchecked ? '—' : value ? '✓' : '✗'} {label}
            {unchecked ? ' (not checked)' : ''}
          </span>
        );
      })}
    </div>
  );
}
