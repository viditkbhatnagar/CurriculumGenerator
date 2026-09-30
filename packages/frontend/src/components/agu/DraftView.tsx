'use client';

import { useEffect, useState } from 'react';
import { AguDraft } from '@/lib/aguApi';
import Findings from './Findings';
import ArtefactsPanel from './ArtefactsPanel';
import { downloadFile } from '@/lib/download';

/**
 * A reading is linked only when its address is a web address. The draft can be edited through
 * the API, so a stored link can be anything, and a `javascript:` href would run in this page's
 * origin when someone clicked the citation. Anything else is shown as plain text.
 */
const WEB_LINK = /^https?:\/\//i;

const STATUS_LABEL: Record<AguDraft['status'], { text: string; tone: string }> = {
  created: { text: 'Created', tone: 'bg-slate-100 text-slate-700' },
  generating: { text: 'Generating…', tone: 'bg-sky-100 text-sky-800' },
  failed: { text: 'Generation failed', tone: 'bg-red-100 text-red-800' },
  needs_faculty: { text: 'Needs faculty: blocking findings', tone: 'bg-amber-100 text-amber-900' },
  ready_for_review: { text: 'Ready for faculty review', tone: 'bg-emerald-100 text-emerald-800' },
  faculty_accepted: { text: 'Faculty accepted', tone: 'bg-emerald-600 text-white' },
};

const hours = (xs: { hours: number }[]) => xs.reduce((n, x) => n + (x.hours || 0), 0);

export default function DraftView({
  draft,
  onRegenerate,
  onAccept,
  onDraftArtefacts,
  onAcceptArtefacts,
  busy,
}: {
  draft: AguDraft;
  onRegenerate: () => void;
  onAccept: () => void;
  onDraftArtefacts: () => void;
  onAcceptArtefacts: () => void;
  busy: boolean;
}) {
  const status = STATUS_LABEL[draft.status];
  const content = draft.draft;
  const blocking = draft.findings.filter((f) => f.severity === 'blocking').length;
  const lastRun = draft.stageRuns[draft.stageRuns.length - 1];
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // An error belongs to the version it happened on.
  useEffect(() => setDownloadError(null), [draft._id]);

  const download = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      await downloadFile(
        `/api/agu/drafts/${draft._id}/export`,
        `${draft.courseCode}-Course-Package-v${draft.version}.docx`
      );
    } catch (e) {
      const reason = e instanceof Error ? `: ${e.message}` : '';
      setDownloadError(`Could not download the course package${reason}`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${status.tone}`}>
          {status.text}
        </span>
        <span className="text-sm text-slate-500">Version {draft.version}</span>
        <div className="ml-auto flex gap-2">
          {content && (
            <button
              onClick={download}
              disabled={downloading}
              className="px-3 py-2 text-sm rounded-lg border border-teal-300 text-teal-700 hover:bg-teal-50 disabled:opacity-50"
            >
              {downloading ? 'Preparing download…' : 'Download course package (Word)'}
            </button>
          )}
          <button
            onClick={onRegenerate}
            disabled={
              busy ||
              draft.status === 'generating' ||
              draft.status === 'faculty_accepted' ||
              draft.artefactStatus === 'generating'
            }
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

      {downloadError && (
        <p
          role="alert"
          className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3"
        >
          {downloadError}
        </p>
      )}

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
                    {r.link && WEB_LINK.test(r.link) ? (
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

      {content && (
        <ArtefactsPanel
          draft={draft}
          busy={busy}
          onDraft={onDraftArtefacts}
          onAccept={onAcceptArtefacts}
        />
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
