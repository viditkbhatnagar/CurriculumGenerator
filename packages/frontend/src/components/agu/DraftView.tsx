'use client';

import { AguDraft, AguFinding } from '@/lib/aguApi';

const STATUS_LABEL: Record<AguDraft['status'], { text: string; tone: string }> = {
  created: { text: 'Created', tone: 'bg-slate-100 text-slate-700' },
  generating: { text: 'Generating…', tone: 'bg-sky-100 text-sky-800' },
  failed: { text: 'Generation failed', tone: 'bg-red-100 text-red-800' },
  needs_faculty: { text: 'Needs faculty: blocking findings', tone: 'bg-amber-100 text-amber-900' },
  ready_for_review: { text: 'Ready for faculty review', tone: 'bg-emerald-100 text-emerald-800' },
  faculty_accepted: { text: 'Faculty accepted', tone: 'bg-emerald-600 text-white' },
};

function Findings({ findings }: { findings: AguFinding[] }) {
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

const hours = (xs: { hours: number }[]) => xs.reduce((n, x) => n + (x.hours || 0), 0);

export default function DraftView({
  draft,
  onRegenerate,
  onAccept,
  busy,
}: {
  draft: AguDraft;
  onRegenerate: () => void;
  onAccept: () => void;
  busy: boolean;
}) {
  const status = STATUS_LABEL[draft.status];
  const content = draft.draft;
  const blocking = draft.findings.filter((f) => f.severity === 'blocking').length;
  const lastRun = draft.stageRuns[draft.stageRuns.length - 1];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${status.tone}`}>
          {status.text}
        </span>
        <span className="text-sm text-slate-500">Version {draft.version}</span>
        <div className="ml-auto flex gap-2">
          <button
            onClick={onRegenerate}
            disabled={busy || draft.status === 'generating' || draft.status === 'faculty_accepted'}
            className="px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Regenerate outline
          </button>
          <button
            onClick={onAccept}
            disabled={busy || blocking > 0 || !content || draft.status === 'faculty_accepted'}
            title={
              blocking > 0 ? 'Resolve the blocking findings first' : 'Record faculty acceptance'
            }
            className="px-3 py-2 text-sm rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
          >
            Accept as faculty
          </button>
        </div>
      </div>

      {draft.status === 'failed' && lastRun?.error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
          Generation failed: {lastRun.error}
        </p>
      )}

      <section aria-labelledby="findings">
        <h3 id="findings" className="text-lg font-semibold text-slate-900 mb-2">
          Checks
        </h3>
        <Findings findings={draft.findings} />
      </section>

      {content && (
        <>
          <section aria-labelledby="outcomes">
            <h3 id="outcomes" className="text-lg font-semibold text-slate-900 mb-2">
              Course learning outcomes (proposed)
            </h3>
            <ol className="space-y-1">
              {content.outcomes.map((o) => (
                <li key={o.id} className="text-sm text-slate-800">
                  <span className="font-mono text-xs text-teal-700 mr-2">{o.id}</span>
                  {o.statement} <span className="text-xs text-slate-500">({o.bloomLevel})</span>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="weeks">
            <h3 id="weeks" className="text-lg font-semibold text-slate-900 mb-2">
              Four-week structure
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              {content.weeks.map((w) => (
                <article key={w.number} className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide">
                    Week {w.number}
                  </p>
                  <h4 className="font-medium text-slate-900">{w.theme}</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Outcomes: {w.outcomeIds.join(', ') || 'none'}
                  </p>
                  <p className="text-sm text-slate-800 mt-2">
                    <span className="font-medium">Live lecture ({w.liveLecture.hours}h):</span>{' '}
                    {w.liveLecture.title}
                  </p>
                  <ul className="list-disc ml-5 text-sm text-slate-700">
                    {w.liveLecture.topics.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                  <p className="text-xs text-slate-500 mt-2">
                    Monitored study {hours(w.monitoredStudy)}h · Independent study{' '}
                    {hours(w.independentStudy)}h · Run sheet {w.liveLecture.runSheet.length}{' '}
                    segments
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section aria-labelledby="assessment">
            <h3 id="assessment" className="text-lg font-semibold text-slate-900 mb-2">
              Assessment
            </h3>
            <table className="w-full text-sm border border-slate-200 bg-white rounded-lg overflow-hidden">
              <thead className="bg-slate-100 text-left">
                <tr>
                  <th className="p-2">Component</th>
                  <th className="p-2">Weight</th>
                  <th className="p-2">Week</th>
                  <th className="p-2">Outcomes</th>
                  <th className="p-2">AI use</th>
                </tr>
              </thead>
              <tbody>
                {content.assessments.map((a) => (
                  <tr key={a.id} className="border-t border-slate-100 align-top">
                    <td className="p-2">
                      {a.title}
                      {a.proctored && (
                        <span className="ml-1 text-xs text-slate-500">(proctored)</span>
                      )}
                    </td>
                    <td className="p-2">{a.weight}%</td>
                    <td className="p-2">{a.weekDue}</td>
                    <td className="p-2">{a.outcomeIds.join(', ')}</td>
                    <td className="p-2 text-slate-600">{a.aiUse}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section aria-labelledby="readings">
            <h3 id="readings" className="text-lg font-semibold text-slate-900 mb-2">
              Readings (verified open-access sources only)
            </h3>
            {content.readings.length === 0 ? (
              <p className="text-sm text-amber-700">
                No verified sources were available; faculty must supply readings.
              </p>
            ) : (
              <ul className="space-y-1">
                {content.readings.map((r) => (
                  <li key={r.id} className="text-sm text-slate-800">
                    <span className="text-xs text-slate-500 mr-2">Week {r.week}</span>
                    {r.link ? (
                      <a
                        href={r.link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-teal-700 underline"
                      >
                        {r.citation}
                      </a>
                    ) : (
                      r.citation
                    )}
                    <span className="ml-2 text-xs text-slate-500">{r.access}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {content.cases.length > 0 && (
            <section aria-labelledby="cases">
              <h3 id="cases" className="text-lg font-semibold text-slate-900 mb-2">
                Teaching cases
              </h3>
              <ul className="space-y-1">
                {content.cases.map((c) => (
                  <li key={c.id} className="text-sm text-slate-800">
                    Week {c.week}: {c.title}{' '}
                    <span className="text-xs text-slate-500">
                      ({c.source} scenario, not a real company event)
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <section aria-labelledby="history">
        <h3
          id="history"
          className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2"
        >
          Stage history
        </h3>
        <ul className="space-y-1 text-xs text-slate-600">
          {draft.stageRuns.map((r, i) => (
            <li key={i}>
              {r.stage} · {r.status} · {new Date(r.startedAt).toLocaleString()}
              {r.model ? ` · ${r.model}` : ''}
              {r.sourcesOffered !== undefined ? ` · ${r.sourcesOffered} sources offered` : ''}
              {r.readingsDropped ? ` · ${r.readingsDropped} unverified readings dropped` : ''}
              {r.blockingFindings !== undefined ? ` · ${r.blockingFindings} blocking` : ''}
              {r.error ? ` · ${r.error}` : ''}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
