'use client';

import { AguArtefactStatus, AguArtefacts, AguDraft } from '@/lib/aguApi';
import Findings from './Findings';

/**
 * T07-T11 for a course draft: the marking rubric, quiz and practice bank, final exam,
 * discussion prompts and AI tutor pack. Drafted from the outline in a second stage with its own
 * status, and accepted separately once the outline itself is accepted, since every artefact is
 * checked against it.
 */

const STATUS: Record<AguArtefactStatus, { text: string; tone: string }> = {
  not_started: { text: 'Not drafted', tone: 'bg-slate-100 text-slate-700' },
  generating: { text: 'Drafting…', tone: 'bg-sky-100 text-sky-800' },
  failed: { text: 'Drafting failed', tone: 'bg-red-100 text-red-800' },
  needs_faculty: { text: 'Needs faculty: blocking findings', tone: 'bg-amber-100 text-amber-900' },
  ready_for_review: { text: 'Ready for faculty review', tone: 'bg-emerald-100 text-emerald-800' },
  faculty_accepted: { text: 'Faculty accepted', tone: 'bg-emerald-600 text-white' },
};

/** The exam blueprint, counted from the paper as the export counts it. */
function blueprint(exam: NonNullable<AguArtefacts['finalExam']>) {
  const total = exam.paper.reduce((n, q) => n + q.marks, 0);
  const rows = new Map<string, { items: number; marks: number; types: Set<string> }>();
  for (const q of exam.paper) {
    const row = rows.get(q.outcomeId) || { items: 0, marks: 0, types: new Set<string>() };
    row.items += 1;
    row.marks += q.marks;
    row.types.add(q.type.replace(/_/g, ' '));
    rows.set(q.outcomeId, row);
  }
  return Array.from(rows, ([outcomeId, r]) => ({
    outcomeId,
    items: r.items,
    marks: r.marks,
    types: Array.from(r.types).join(', '),
    percent: total ? Math.round((r.marks / total) * 1000) / 10 : 0,
  })).sort((a, b) => a.outcomeId.localeCompare(b.outcomeId, undefined, { numeric: true }));
}

const th = 'p-2 text-left font-medium text-slate-600';
const td = 'p-2 align-top';

function Summary({ artefacts, draft }: { artefacts: AguArtefacts; draft: AguDraft }) {
  const title = (id: string) => draft.draft?.assessments.find((a) => a.id === id)?.title || id;
  const { plan, items, practice } = artefacts.quizBank;
  const exam = artefacts.finalExam;
  const pack = artefacts.tutorPack;
  return (
    <div className="space-y-6">
      {artefacts.rubrics.map((r) => (
        <div key={r.assessmentId}>
          <h4 className="text-sm font-semibold text-slate-900">
            T07 · Marking rubric: {title(r.assessmentId)}
          </h4>
          <table className="mt-2 w-full text-sm border border-slate-200 bg-white">
            <thead className="bg-slate-100">
              <tr>
                <th className={th}>Criterion</th>
                <th className={th}>CLO</th>
                <th className={th}>Weight</th>
              </tr>
            </thead>
            <tbody>
              {r.rows.map((row, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className={td}>{row.criterion}</td>
                  <td className={`${td} font-mono text-xs`}>{row.outcomeId}</td>
                  <td className={td}>{row.weight}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <div>
        <h4 className="text-sm font-semibold text-slate-900">T08 · Weekly quizzes and practice</h4>
        <table className="mt-2 w-full text-sm border border-slate-200 bg-white">
          <thead className="bg-slate-100">
            <tr>
              <th className={th}>Week</th>
              <th className={th}>Graded items</th>
              <th className={th}>Time limit</th>
              <th className={th}>Attempts</th>
              <th className={th}>Weight</th>
              <th className={th}>Practice items</th>
            </tr>
          </thead>
          <tbody>
            {plan.map((q) => (
              <tr key={q.week} className="border-t border-slate-100">
                <td className={td}>{q.week}</td>
                <td className={td}>
                  {items.filter((i) => i.week === q.week).length} of {q.items}
                </td>
                <td className={td}>{q.timeLimitMinutes} min</td>
                <td className={td}>{q.attempts}</td>
                <td className={td}>{q.weight}%</td>
                <td className={td}>{practice.filter((p) => p.week === q.week).length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {exam && (
        <div>
          <h4 className="text-sm font-semibold text-slate-900">
            T09 · Proctored final exam: {exam.durationMinutes} minutes, {exam.totalMarks} marks,{' '}
            {exam.paper.length} questions
          </h4>
          <table className="mt-2 w-full text-sm border border-slate-200 bg-white">
            <thead className="bg-slate-100">
              <tr>
                <th className={th}>CLO</th>
                <th className={th}>Question types</th>
                <th className={th}>Questions</th>
                <th className={th}>Marks</th>
                <th className={th}>Share</th>
              </tr>
            </thead>
            <tbody>
              {blueprint(exam).map((row) => (
                <tr key={row.outcomeId} className="border-t border-slate-100">
                  <td className={`${td} font-mono text-xs`}>{row.outcomeId}</td>
                  <td className={td}>{row.types}</td>
                  <td className={td}>{row.items}</td>
                  <td className={td}>{row.marks}</td>
                  <td className={td}>{row.percent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-xs text-slate-500">
            Blueprint counted from the paper. The paper and marking guide are in the Word package.
          </p>
        </div>
      )}

      <div>
        <h4 className="text-sm font-semibold text-slate-900">T10 · Discussion prompts</h4>
        <ul className="mt-2 space-y-2">
          {artefacts.discussions.map((d) => (
            <li key={d.week} className="text-sm text-slate-800">
              <span className="text-xs font-semibold text-teal-700 mr-2">Week {d.week}</span>
              {d.prompt}
              <span className="ml-2 text-xs text-slate-500">
                {d.graded ? `graded, ${d.weight}%` : 'ungraded'} · {d.contactHours} contact h
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-slate-900">T11 · AI tutor knowledge pack</h4>
        <p className="mt-1 text-sm text-slate-700">
          {pack.glossary.length} glossary terms · {pack.faqs.length} FAQs ·{' '}
          {pack.workedExamples.length} worked examples · {pack.misconceptions.length} misconceptions
        </p>
        <ul className="mt-2 space-y-1">
          {pack.guardrails.map((g, i) => (
            <li key={i} className="text-sm text-slate-800">
              <span className="font-medium">Declines:</span> {g.doNot}{' '}
              <span className="text-slate-500">Instead: {g.instead}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function ArtefactsPanel({
  draft,
  busy,
  onDraft,
  onAccept,
}: {
  draft: AguDraft;
  busy: boolean;
  onDraft: () => void;
  onAccept: () => void;
}) {
  const status = STATUS[draft.artefactStatus || 'not_started'];
  const artefacts = draft.artefacts;
  const findings = draft.artefactFindings || [];
  const outlineBlocking = draft.findings.some((f) => f.severity === 'blocking');
  const outlineBusy = draft.status === 'generating' || draft.status === 'created';
  const running = draft.artefactStatus === 'generating';
  const accepted = draft.artefactStatus === 'faculty_accepted';
  const lastRun = [...draft.stageRuns].reverse().find((r) => r.stage === 'artefacts');

  const draftBlockedBy = !draft.draft
    ? 'Draft the outline first'
    : outlineBusy
      ? 'The outline is being generated'
      : outlineBlocking
        ? "Resolve the outline's blocking findings first"
        : running
          ? 'Already drafting'
          : accepted
            ? 'Accepted; start a new version to redraft'
            : null;
  const acceptBlockedBy =
    draft.status !== 'faculty_accepted'
      ? 'Accept the outline first: the assessments are checked against it'
      : draft.artefactStatus !== 'ready_for_review'
        ? 'Resolve the blocking findings first'
        : null;

  return (
    <section
      aria-labelledby="artefacts"
      className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 space-y-5"
    >
      <div className="flex flex-wrap items-center gap-3">
        <h3 id="artefacts" className="text-lg font-semibold text-slate-900">
          Assessments and tutor pack (T07–T11)
        </h3>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${status.tone}`}>
          {status.text}
        </span>
        <div className="ml-auto flex gap-2">
          <button
            onClick={onDraft}
            disabled={busy || !!draftBlockedBy}
            title={draftBlockedBy || 'Draft the rubric, quizzes, exam, discussions and tutor pack'}
            className="px-3 py-2 text-sm rounded-lg border border-teal-300 text-teal-700 hover:bg-teal-50 disabled:opacity-50"
          >
            {artefacts ? 'Redraft assessments' : 'Draft assessments & tutor pack'}
          </button>
          {artefacts && (
            <button
              onClick={onAccept}
              disabled={busy || accepted || !!acceptBlockedBy}
              title={acceptBlockedBy || 'Record faculty acceptance of the assessments'}
              className="px-3 py-2 text-sm rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
            >
              Accept assessments as faculty
            </button>
          )}
        </div>
      </div>

      {!artefacts && !running && (
        <p className="text-sm text-slate-600">
          Drafted from the outline above: a marking rubric for the applied assignment, a graded quiz
          and practice set for each week, the proctored final exam with its blueprint, a moderated
          discussion per week, and the AI tutor&apos;s knowledge pack and guardrails. Takes several
          minutes.
        </p>
      )}
      {running && (
        <p className="text-sm text-sky-800">
          Drafting the rubric, weekly quizzes, final exam, discussions and tutor pack. This takes
          several minutes; the page updates when it finishes.
        </p>
      )}
      {draft.artefactStatus === 'failed' && lastRun?.error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
          Drafting failed: {lastRun.error}
        </p>
      )}

      {artefacts && (
        <>
          <Findings findings={findings} />
          <Summary artefacts={artefacts} draft={draft} />
        </>
      )}
    </section>
  );
}
