import { AguFinding } from '@/lib/aguApi';

/** Blocking findings first, then warnings for faculty to judge; "no findings" only when empty. */
export default function Findings({ findings }: { findings: AguFinding[] }) {
  const blocking = findings.filter((f) => f.severity === 'blocking');
  const warnings = findings.filter((f) => f.severity === 'warning');
  if (!findings.length) {
    return (
      <p className="text-sm text-emerald-700">
        No findings: every check passed on the stored draft.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {blocking.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-red-700">Blocking ({blocking.length})</h4>
          <ul className="mt-1 space-y-1">
            {blocking.map((f, i) => (
              <li key={`b${i}`} className="text-sm text-red-800">
                <span className="font-mono text-xs mr-2">{f.code}</span>
                {f.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      {warnings.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-amber-700">
            For faculty to judge ({warnings.length})
          </h4>
          <ul className="mt-1 space-y-1">
            {warnings.map((f, i) => (
              <li key={`w${i}`} className="text-sm text-amber-900">
                <span className="font-mono text-xs mr-2">{f.code}</span>
                {f.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
