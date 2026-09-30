'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import DraftView from '@/components/agu/DraftView';
import {
  AguCourse,
  AguDraft,
  AguFacultyInputs,
  acceptAguDraft,
  createAguDraft,
  getAguCourse,
  getAguDraft,
  regenerateAguDraft,
} from '@/lib/aguApi';

const POLL_MS = 5000;

const FIELDS: { key: keyof AguFacultyInputs; label: string; hint: string }[] = [
  {
    key: 'emphasis',
    label: 'Emphasis',
    hint: 'e.g. applied and business-facing, no-code tools, no hands-on machine learning',
  },
  { key: 'learners', label: 'Learners', hint: 'Who takes the course and what they bring' },
  {
    key: 'tools',
    label: 'Tools',
    hint: 'Software or platforms students use (must need no installation)',
  },
  {
    key: 'context',
    label: 'Professional contexts',
    hint: 'Industries or roles to draw examples from',
  },
  {
    key: 'notes',
    label: 'Anything else',
    hint: 'Constraints, must-cover topics, institution materials',
  },
];

export default function AguCoursePage() {
  const { code } = useParams<{ code: string }>();
  const [course, setCourse] = useState<AguCourse | null>(null);
  const [drafts, setDrafts] = useState<{ _id: string; version: number; status: string }[]>([]);
  const [draft, setDraft] = useState<AguDraft | null>(null);
  const [inputs, setInputs] = useState<AguFacultyInputs>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadDraft = useCallback(async (id: string) => {
    const d = await getAguDraft(id);
    setDraft(d);
    return d;
  }, []);

  const loadCourse = useCallback(async () => {
    const data = await getAguCourse(code);
    setCourse(data.course);
    setDrafts(data.drafts);
    if (data.drafts[0]) await loadDraft(data.drafts[0]._id);
  }, [code, loadDraft]);

  useEffect(() => {
    loadCourse().catch((e) =>
      setError(e instanceof Error ? e.message : 'Could not load the course')
    );
  }, [loadCourse]);

  // Poll only while the stored status says a generation is running.
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (draft?.status === 'generating' || draft?.status === 'created') {
      pollRef.current = setInterval(() => {
        loadDraft(draft._id).catch(() => undefined);
      }, POLL_MS);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [draft?._id, draft?.status, loadDraft]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const startDraft = () =>
    run(async () => {
      const { draftId } = await createAguDraft(code, inputs);
      await loadDraft(draftId);
      const data = await getAguCourse(code);
      setDrafts(data.drafts);
    });

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <Link href="/modules" className="text-sm text-teal-700 hover:underline">
          ← All AGU courses
        </Link>
        {error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
            {error}
          </p>
        )}
        {!course && !error && <p className="text-slate-500">Loading…</p>}

        {course && (
          <section
            aria-labelledby="course-title"
            className="rounded-2xl bg-white border border-slate-200 p-6"
          >
            <p className="font-mono text-sm font-semibold text-teal-700">{course.code}</p>
            <h1 id="course-title" className="text-2xl font-semibold text-slate-900">
              {course.title}
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              {course.roleLabel} · {course.semesterCredits} SCH · {course.hours.total} h (
              {course.hours.contact} contact, {course.hours.independent} independent) ·{' '}
              {course.deliveryWindow}
              {course.mbaGateway ? ` · MBA gateway ${course.mbaGateway}` : ''}
            </p>
            <p className="text-sm text-slate-800 mt-3 max-w-4xl">
              {course.description ||
                'The catalogue gives this course no topical description; its scope is set by faculty.'}
            </p>
            <p className="text-xs text-slate-500 mt-2">
              Locked catalogue facts ({course.source}). Catalogue faculty: {course.catalogueFaculty}
              .
            </p>
          </section>
        )}

        {course && (
          <section
            aria-labelledby="new-draft"
            className="rounded-2xl bg-white border border-slate-200 p-6"
          >
            <h2 id="new-draft" className="text-lg font-semibold text-slate-900">
              Draft the module package
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              The engine proposes outcomes, four weeks, assessments and readings from verified
              open-access sources. Everything it proposes is a draft for faculty review.
            </p>
            <div className="grid gap-3 md:grid-cols-2 mt-4">
              {FIELDS.map((f) => (
                <label key={f.key} className="text-sm text-slate-700">
                  {f.label}
                  <textarea
                    value={inputs[f.key] || ''}
                    onChange={(e) => setInputs({ ...inputs, [f.key]: e.target.value })}
                    placeholder={f.hint}
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </label>
              ))}
            </div>
            <button
              onClick={startDraft}
              disabled={busy}
              className="mt-4 px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
            >
              {busy ? 'Starting…' : drafts.length ? 'Start a new version' : 'Generate the outline'}
            </button>
          </section>
        )}

        {drafts.length > 1 && (
          <nav aria-label="Draft versions" className="flex flex-wrap gap-2">
            {drafts.map((d) => (
              <button
                key={d._id}
                onClick={() => loadDraft(d._id)}
                className={`px-3 py-1 rounded-full text-xs border ${
                  draft?._id === d._id
                    ? 'bg-teal-600 text-white border-teal-600'
                    : 'border-slate-300 text-slate-700'
                }`}
              >
                v{d.version} · {d.status.replace(/_/g, ' ')}
              </button>
            ))}
          </nav>
        )}

        {draft && (
          <DraftView
            draft={draft}
            busy={busy}
            onRegenerate={() =>
              run(async () => {
                await regenerateAguDraft(draft._id);
                await loadDraft(draft._id);
              })
            }
            onAccept={() =>
              run(async () => {
                setDraft(await acceptAguDraft(draft._id));
              })
            }
          />
        )}
      </div>
    </main>
  );
}
