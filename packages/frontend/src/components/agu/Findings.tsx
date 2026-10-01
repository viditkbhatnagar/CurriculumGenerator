import { AguFinding } from '@/lib/aguApi';

/** Where a finding is in the draft and the rule it comes from, so faculty can find and judge it. */
function FindingOrigin({ finding }: { finding: AguFinding }) {
  const parts = [
    finding.path && `at ${finding.path}`,
    finding.source && `rule: ${finding.source}`,
  ].filter(Boolean);
  if (!parts.length) return null;
  return <span className="block text-xs text-slate-500">{parts.join(' · ')}</span>;
}

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
                <FindingOrigin finding={f} />
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
                <FindingOrigin finding={f} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
