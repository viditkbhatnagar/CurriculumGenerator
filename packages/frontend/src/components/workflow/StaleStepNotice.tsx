'use client';

/**
 * Warns that a step's content was generated before one of the steps it is built
 * from was last changed.
 *
 * Editing Step 1 or Step 2 does not regenerate anything downstream, so a
 * curriculum can sit there showing outcomes and modules derived from inputs the
 * author has since rewritten — which reads as "my edits were ignored". Nothing
 * else surfaces that, so say it where the stale content is displayed.
 */

interface UpstreamStep {
  label: string;
  changedAt?: string | Date | null;
}

interface StaleStepNoticeProps {
  /** When this step's content was generated. */
  generatedAt?: string | Date | null;
  /** The steps this one is derived from. */
  upstream: UpstreamStep[];
  /** What the reader should do about it, e.g. "Regenerate Step 3". */
  action?: string;
}

const toTime = (value?: string | Date | null): number | null => {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
};

const formatWhen = (value: string | Date) =>
  new Date(value).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

export default function StaleStepNotice({ generatedAt, upstream, action }: StaleStepNoticeProps) {
  const generated = toTime(generatedAt);
  if (generated === null) return null;

  const outdatedBy = upstream.filter((step) => {
    const changed = toTime(step.changedAt);
    return changed !== null && changed > generated;
  });

  if (outdatedBy.length === 0) return null;

  const names = outdatedBy.map((step) => step.label);
  const changedList =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

  return (
    <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4" role="status">
      <div className="flex gap-3">
        <svg
          className="mt-0.5 h-5 w-5 shrink-0 text-amber-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v3m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
          />
        </svg>
        <div className="text-sm">
          <p className="font-semibold text-amber-900">
            This was generated before {changedList} {names.length === 1 ? 'was' : 'were'} last
            edited
          </p>
          <p className="mt-1 text-amber-800">
            What you see below still reflects the earlier version, so recent edits will not appear
            here yet.
            {action ? ` ${action} to rebuild it from the current content.` : ''}
          </p>
          <ul className="mt-2 space-y-0.5 text-xs text-amber-700">
            <li>Generated {formatWhen(generatedAt as string | Date)}</li>
            {outdatedBy.map((step) => (
              <li key={step.label}>
                {step.label} edited {formatWhen(step.changedAt as string | Date)}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/**
 * Turn a raw generation error into something a curriculum author can act on.
 *
 * These surface verbatim from the AI provider — "402 Insufficient credits",
 * "429 rate limit" — and read as though the curriculum is at fault when the
 * problem is an account or a transient service issue.
 */
export function explainStepFailure(message?: string): string {
  const raw = String(message || '').toLowerCase();

  if (/402|insufficient credit|insufficient_quota|exceeded your current quota|billing/.test(raw)) {
    return 'The AI service has run out of credit, so nothing could be generated. This is an account billing issue, not a problem with your curriculum — it needs topping up before any step will generate.';
  }
  if (/429|rate limit|too many requests/.test(raw)) {
    return 'The AI service was rate-limited. Wait a few minutes and try again.';
  }
  if (/timeout|timed out|etimedout|stalled/.test(raw)) {
    return 'Generation took longer than allowed and was stopped. Trying again usually works — larger programmes are generated in batches, so progress is kept.';
  }
  if (/json|parse|unexpected token/.test(raw)) {
    return 'The AI returned a response that could not be read. Trying again usually works.';
  }
  if (/api key|401|unauthorized|authentication/.test(raw)) {
    return 'The AI service rejected the credentials. This needs a configuration fix, not a retry.';
  }
  return 'Something went wrong while generating. Trying again usually works; if it keeps failing, send this message on.';
}
