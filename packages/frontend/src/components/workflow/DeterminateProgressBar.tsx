/**
 * A progress bar for a step that reports a real percentage. Step 5 reported none until
 * 17 November 2026, so its bar could only wait; now it shows how many modules are done.
 * Same markup as the Step 7 bar (role=progressbar, a scaleX fill).
 */
export default function DeterminateProgressBar({
  percent,
  label,
}: {
  percent: number;
  label: string;
}) {
  const value = Math.min(100, Math.max(0, percent));
  return (
    <div className="space-y-1">
      <div
        className="h-3 overflow-hidden rounded-full bg-amber-100"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value)}
      >
        <div
          className="h-full origin-left bg-gradient-to-r from-amber-500 to-orange-500 transition-transform"
          style={{ transform: `scaleX(${value / 100})` }}
        />
      </div>
      <p className="text-right text-xs text-teal-600">{Math.round(value)}%</p>
    </div>
  );
}
