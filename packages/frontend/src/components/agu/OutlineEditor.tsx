'use client';

import { useState } from 'react';
import { AguDraftContent } from '@/lib/aguApi';

/**
 * Faculty edits to a course outline: outcomes, week themes, lecture titles and topics,
 * assessments, readings and cases. The whole stored draft is edited as a copy and sent back, so
 * fields this editor does not show (run sheets, study hours, evidence) are kept as they are.
 * Every save is re-checked on the server; the status follows the new findings.
 *
 * An outcome faculty write or change is marked as theirs (origin "faculty"), so the package can
 * say which wording came from the engine and which from the course lead.
 */

const BLOOM = ['remember', 'understand', 'apply', 'analyse', 'evaluate', 'create'];

type Draft = AguDraftContent & Record<string, unknown>;

const input =
  'w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500';
const label = 'block text-xs font-medium text-slate-600 mb-1';

function OutcomePicker({
  all,
  chosen,
  onChange,
}: {
  all: string[];
  chosen: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {all.map((id) => (
        <label key={id} className="inline-flex items-center gap-1 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={chosen.includes(id)}
            onChange={(e) =>
              onChange(e.target.checked ? [...chosen, id] : chosen.filter((x) => x !== id))
            }
          />
          {id}
        </label>
      ))}
    </div>
  );
}

export default function OutlineEditor({
  initial,
  saving,
  onSave,
  onCancel,
}: {
  initial: AguDraftContent;
  saving: boolean;
  onSave: (draft: AguDraftContent) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => structuredClone(initial) as Draft);
  const outcomeIds = draft.outcomes.map((o) => o.id);

  const update = (change: (d: Draft) => void) =>
    setDraft((current) => {
      const next = structuredClone(current);
      change(next);
      return next;
    });

  const nextOutcomeId = () => {
    const used = new Set(outcomeIds);
    let n = draft.outcomes.length + 1;
    while (used.has(`CLO${n}`)) n++;
    return `CLO${n}`;
  };

  return (
    <form
      className="space-y-8 rounded-2xl border border-teal-200 bg-white p-5"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(draft);
      }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-lg font-semibold text-slate-900">Edit the outline</h3>
        <p className="text-xs text-slate-500">
          Saved changes are checked again at once. Run sheets and study hours are kept as drafted.
        </p>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-3 py-2 text-sm rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save and re-check'}
          </button>
        </div>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-slate-900">Course learning outcomes</legend>
        {draft.outcomes.map((o, i) => (
          <div key={o.id} className="grid gap-2 sm:grid-cols-[4rem_1fr_9rem_auto] items-start">
            <span className="font-mono text-xs text-teal-700 pt-2">{o.id}</span>
            <textarea
              aria-label={`${o.id} statement`}
              className={input}
              rows={2}
              value={o.statement}
              onChange={(e) =>
                update((d) => {
                  d.outcomes[i].statement = e.target.value;
                  d.outcomes[i].origin = 'faculty';
                })
              }
            />
            <select
              aria-label={`${o.id} Bloom level`}
              className={input}
              value={o.bloomLevel}
              onChange={(e) =>
                update((d) => {
                  d.outcomes[i].bloomLevel = e.target.value;
                  d.outcomes[i].origin = 'faculty';
                })
              }
            >
              {BLOOM.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() =>
                update((d) => {
                  // Drop the outcome everywhere it is referenced, so nothing points at it.
                  const id = d.outcomes[i].id;
                  d.outcomes.splice(i, 1);
                  const without = (ids: string[]) => ids.filter((x) => x !== id);
                  d.weeks.forEach((w) => (w.outcomeIds = without(w.outcomeIds)));
                  d.assessments.forEach((a) => (a.outcomeIds = without(a.outcomeIds)));
                  d.cases.forEach((c) => (c.outcomeIds = without(c.outcomeIds)));
                })
              }
              className="text-xs text-red-700 hover:underline pt-2"
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            update((d) =>
              d.outcomes.push({
                id: nextOutcomeId(),
                statement: '',
                bloomLevel: 'apply',
                origin: 'faculty',
              })
            )
          }
          className="text-sm text-teal-700 hover:underline"
        >
          + Add an outcome
        </button>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-slate-900">Weeks</legend>
        {draft.weeks.map((w, i) => (
          <div key={w.number} className="rounded-xl border border-slate-200 p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
              Week {w.number}
            </p>
            <div>
              <label className={label} htmlFor={`theme-${w.number}`}>
                Theme
              </label>
              <input
                id={`theme-${w.number}`}
                className={input}
                value={w.theme}
                onChange={(e) => update((d) => void (d.weeks[i].theme = e.target.value))}
              />
            </div>
            <div>
              <label className={label} htmlFor={`lecture-${w.number}`}>
                Live lecture title
              </label>
              <input
                id={`lecture-${w.number}`}
                className={input}
                value={w.liveLecture.title}
                onChange={(e) =>
                  update((d) => void (d.weeks[i].liveLecture.title = e.target.value))
                }
              />
            </div>
            <div>
              <label className={label} htmlFor={`topics-${w.number}`}>
                Lecture topics (one per line)
              </label>
              <textarea
                id={`topics-${w.number}`}
                className={input}
                rows={4}
                value={w.liveLecture.topics.join('\n')}
                onChange={(e) =>
                  update(
                    (d) =>
                      void (d.weeks[i].liveLecture.topics = e.target.value
                        .split('\n')
                        .map((t) => t.trim())
                        .filter(Boolean))
                  )
                }
              />
            </div>
            <div>
              <span className={label}>Outcomes taught this week</span>
              <OutcomePicker
                all={outcomeIds}
                chosen={w.outcomeIds}
                onChange={(next) => update((d) => void (d.weeks[i].outcomeIds = next))}
              />
            </div>
          </div>
        ))}
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-slate-900">Assessments</legend>
        {draft.assessments.map((a, i) => (
          <div key={a.id} className="rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-[1fr_6rem_6rem]">
              <div>
                <label className={label} htmlFor={`a-title-${a.id}`}>
                  Title ({a.component.replace(/_/g, ' ')})
                </label>
                <input
                  id={`a-title-${a.id}`}
                  className={input}
                  value={a.title}
                  onChange={(e) => update((d) => void (d.assessments[i].title = e.target.value))}
                />
              </div>
              <div>
                <label className={label} htmlFor={`a-weight-${a.id}`}>
                  Weight %
                </label>
                <input
                  id={`a-weight-${a.id}`}
                  type="number"
                  min={0}
                  max={100}
                  className={input}
                  value={a.weight}
                  onChange={(e) =>
                    update((d) => void (d.assessments[i].weight = Number(e.target.value)))
                  }
                />
              </div>
              <div>
                <label className={label} htmlFor={`a-week-${a.id}`}>
                  Week due
                </label>
                <select
                  id={`a-week-${a.id}`}
                  className={input}
                  value={a.weekDue}
                  onChange={(e) =>
                    update((d) => void (d.assessments[i].weekDue = Number(e.target.value)))
                  }
                >
                  {draft.weeks.map((w) => (
                    <option key={w.number} value={w.number}>
                      {w.number}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <span className={label}>Outcomes assessed</span>
              <OutcomePicker
                all={outcomeIds}
                chosen={a.outcomeIds}
                onChange={(next) => update((d) => void (d.assessments[i].outcomeIds = next))}
              />
            </div>
            <div>
              <label className={label} htmlFor={`a-ai-${a.id}`}>
                Permitted use of AI tools
              </label>
              <textarea
                id={`a-ai-${a.id}`}
                className={input}
                rows={2}
                value={a.aiUse}
                onChange={(e) => update((d) => void (d.assessments[i].aiUse = e.target.value))}
              />
            </div>
            {a.brief !== undefined && (
              <div>
                <label className={label} htmlFor={`a-brief-${a.id}`}>
                  Brief
                </label>
                <textarea
                  id={`a-brief-${a.id}`}
                  className={input}
                  rows={4}
                  value={a.brief}
                  onChange={(e) => update((d) => void (d.assessments[i].brief = e.target.value))}
                />
              </div>
            )}
          </div>
        ))}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-slate-900">Readings</legend>
        <p className="text-xs text-slate-500">
          Readings come from verified open-access sources; change their week or whether they are
          required, or remove one.
        </p>
        {draft.readings.map((r, i) => (
          <div key={r.id} className="grid gap-2 sm:grid-cols-[1fr_6rem_7rem_auto] items-center">
            <span className="text-sm text-slate-800">{r.citation}</span>
            <select
              aria-label={`Week for ${r.id}`}
              className={input}
              value={r.week}
              onChange={(e) => update((d) => void (d.readings[i].week = Number(e.target.value)))}
            >
              {draft.weeks.map((w) => (
                <option key={w.number} value={w.number}>
                  Week {w.number}
                </option>
              ))}
            </select>
            <label className="inline-flex items-center gap-1 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={r.required}
                onChange={(e) => update((d) => void (d.readings[i].required = e.target.checked))}
              />
              Required
            </label>
            <button
              type="button"
              onClick={() => update((d) => void d.readings.splice(i, 1))}
              className="text-xs text-red-700 hover:underline"
            >
              Remove
            </button>
          </div>
        ))}
      </fieldset>

      {draft.cases.length > 0 && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-slate-900">Teaching cases</legend>
          {draft.cases.map((c, i) => (
            <div key={c.id} className="grid gap-2 sm:grid-cols-[1fr_7rem] items-center">
              <input
                aria-label={`Title of ${c.id}`}
                className={input}
                value={c.title}
                onChange={(e) => update((d) => void (d.cases[i].title = e.target.value))}
              />
              <select
                aria-label={`Week for ${c.id}`}
                className={input}
                value={c.week}
                onChange={(e) => update((d) => void (d.cases[i].week = Number(e.target.value)))}
              >
                {draft.weeks.map((w) => (
                  <option key={w.number} value={w.number}>
                    Week {w.number}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </fieldset>
      )}
    </form>
  );
}
