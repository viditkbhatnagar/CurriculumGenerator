'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { CurriculumWorkflow, Step14SyllabusInputs } from '@/types/workflow';
import { toast } from '@/stores/toastStore';

interface Props {
  workflow: CurriculumWorkflow;
  onComplete: () => void;
  onRefresh: () => void;
}

const EMPTY_INPUTS: Step14SyllabusInputs = {
  instructor: {
    name: '',
    email: '',
    title: '',
    preferredCommunication: 'Email',
    expectedResponseTime: 'Within 48 hours on weekdays',
    officeHours: '',
    officeLocation: '',
  },
  taInfo: undefined,
  courseNumber: '',
  semester: '',
  meetingPattern: '',
  meetingLocation: '',
  startDate: '',
  numWeeks: 12,
  sessionsPerWeek: 2,
  examSchedule: [],
  policies: {},
};

export default function Step14View({ workflow, onComplete, onRefresh }: Props) {
  const existing = workflow.step14;
  const [inputs, setInputs] = useState<Step14SyllabusInputs>(existing?.inputs || EMPTY_INPUTS);
  const [includeTa, setIncludeTa] = useState(!!existing?.inputs?.taInfo);
  const [savingInputs, setSavingInputs] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (existing?.inputs) setInputs(existing.inputs);
    setIncludeTa(!!existing?.inputs?.taInfo);
  }, [existing?.inputs]);

  const generated = existing?.generatedSections;
  const isApproved = !!existing?.approvedAt;
  const canApprove = !!generated && !isApproved;

  const update = <K extends keyof Step14SyllabusInputs>(key: K, value: Step14SyllabusInputs[K]) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  const updateInstructor = (key: keyof Step14SyllabusInputs['instructor'], value: string) => {
    setInputs((prev) => ({ ...prev, instructor: { ...prev.instructor, [key]: value } }));
  };

  const updatePolicies = (key: string, value: string) => {
    setInputs((prev) => ({ ...prev, policies: { ...(prev.policies || {}), [key]: value } }));
  };

  const addExam = () => {
    setInputs((prev) => ({
      ...prev,
      examSchedule: [
        ...(prev.examSchedule || []),
        { name: '', date: '', weight: 0, description: '' },
      ],
    }));
  };

  const updateExam = (i: number, key: string, value: string | number) => {
    setInputs((prev) => {
      const next = [...(prev.examSchedule || [])];
      next[i] = { ...next[i], [key]: value };
      return { ...prev, examSchedule: next };
    });
  };

  const removeExam = (i: number) => {
    setInputs((prev) => ({
      ...prev,
      examSchedule: (prev.examSchedule || []).filter((_, idx) => idx !== i),
    }));
  };

  const handleSave = async () => {
    // Instructor/semester specifics can be filled in later — the backend defaults
    // anything left blank (e.g. semester -> "To be scheduled"), so don't block here.
    setError(null);
    setSavingInputs(true);
    try {
      const payload = { ...inputs, taInfo: includeTa ? inputs.taInfo : undefined };
      const resp = await api.put(`/api/v3/workflow/${workflow._id}/step14`, payload);
      if (!resp.data?.success) throw new Error(resp.data?.error || 'Save failed');
      toast.success('Inputs saved', 'Click Generate Syllabus to produce the document.');
      await onRefresh();
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Failed to save inputs');
    } finally {
      setSavingInputs(false);
    }
  };

  const handleGenerate = async () => {
    setError(null);
    setGenerating(true);
    try {
      // Save first if dirty (avoids the "save then generate" two-click flow)
      const payload = { ...inputs, taInfo: includeTa ? inputs.taInfo : undefined };
      await api.put(`/api/v3/workflow/${workflow._id}/step14`, payload);
      const resp = await api.post(`/api/v3/workflow/${workflow._id}/step14/generate`);
      if (!resp.data?.success) throw new Error(resp.data?.error || 'Generation failed');
      toast.success('Syllabus generated', 'Review below and click Approve when ready.');
      await onRefresh();
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Failed to generate syllabus');
    } finally {
      setGenerating(false);
    }
  };

  const handleApprove = async () => {
    setError(null);
    setApproving(true);
    try {
      const resp = await api.post(`/api/v3/workflow/${workflow._id}/step14/approve`);
      if (!resp.data?.success) throw new Error(resp.data?.error || 'Approval failed');
      toast.success('Syllabus approved', 'Workflow complete.');
      onComplete();
      await onRefresh();
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Failed to approve syllabus');
    } finally {
      setApproving(false);
    }
  };

  const handleDownload = () => {
    // The api client adds an Authorization header from localStorage; for the
    // export endpoint we let the browser handle the download via a normal
    // anchor click. Adjust origin via NEXT_PUBLIC_API_URL.
    const base = process.env.NEXT_PUBLIC_API_URL || '';
    window.open(`${base}/api/v3/workflow/${workflow._id}/step14/export.docx`, '_blank');
  };

  const handleDownloadModule = (moduleId: string) => {
    const base = process.env.NEXT_PUBLIC_API_URL || '';
    window.open(
      `${base}/api/v3/workflow/${workflow._id}/step14/module/${moduleId}/export.docx`,
      '_blank'
    );
  };

  const handleDownloadAll = () => {
    const base = process.env.NEXT_PUBLIC_API_URL || '';
    window.open(`${base}/api/v3/workflow/${workflow._id}/step14/export-all.zip`, '_blank');
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <header className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-teal-500/30 rounded-xl p-5">
        <h2 className="text-2xl font-bold text-teal-800 mb-2">Step 14: Course Syllabus</h2>
        <p className="text-sm text-teal-700">
          Provide instructor and schedule information; the rest of the syllabus is auto-built from
          steps 1–13. Generation takes ~10–30 seconds.
        </p>
      </header>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* Instructor */}
      <Section title="Instructor">
        <Grid2>
          <Field label="Name *">
            <Input
              value={inputs.instructor.name}
              onChange={(v) => updateInstructor('name', v)}
              disabled={isApproved}
            />
          </Field>
          <Field label="Email *">
            <Input
              type="email"
              value={inputs.instructor.email}
              onChange={(v) => updateInstructor('email', v)}
              disabled={isApproved}
            />
          </Field>
          <Field label="Title (e.g. Assistant Professor)">
            <Input
              value={inputs.instructor.title || ''}
              onChange={(v) => updateInstructor('title', v)}
              disabled={isApproved}
            />
          </Field>
          <Field label="Office Location">
            <Input
              value={inputs.instructor.officeLocation || ''}
              onChange={(v) => updateInstructor('officeLocation', v)}
              disabled={isApproved}
            />
          </Field>
          <Field label="Office Hours">
            <Input
              value={inputs.instructor.officeHours || ''}
              onChange={(v) => updateInstructor('officeHours', v)}
              disabled={isApproved}
              placeholder="e.g. Tue 10–11am"
            />
          </Field>
          <Field label="Preferred Communication">
            <Input
              value={inputs.instructor.preferredCommunication || ''}
              onChange={(v) => updateInstructor('preferredCommunication', v)}
              disabled={isApproved}
            />
          </Field>
          <Field label="Expected Response Time">
            <Input
              value={inputs.instructor.expectedResponseTime || ''}
              onChange={(v) => updateInstructor('expectedResponseTime', v)}
              disabled={isApproved}
            />
          </Field>
        </Grid2>

        <label className="flex items-center gap-2 mt-4 text-sm text-teal-700">
          <input
            type="checkbox"
            checked={includeTa}
            onChange={(e) => setIncludeTa(e.target.checked)}
            disabled={isApproved}
          />
          Include TA / grader information
        </label>
        {includeTa && (
          <Grid2>
            <Field label="TA Name">
              <Input
                value={inputs.taInfo?.name || ''}
                onChange={(v) =>
                  setInputs((p) => ({
                    ...p,
                    taInfo: { ...(p.taInfo || { name: '', email: '' }), name: v },
                  }))
                }
                disabled={isApproved}
              />
            </Field>
            <Field label="TA Email">
              <Input
                value={inputs.taInfo?.email || ''}
                onChange={(v) =>
                  setInputs((p) => ({
                    ...p,
                    taInfo: { ...(p.taInfo || { name: '', email: '' }), email: v },
                  }))
                }
                disabled={isApproved}
              />
            </Field>
            <Field label="TA Role">
              <Input
                value={inputs.taInfo?.role || ''}
                onChange={(v) =>
                  setInputs((p) => ({
                    ...p,
                    taInfo: { ...(p.taInfo || { name: '', email: '' }), role: v },
                  }))
                }
                disabled={isApproved}
                placeholder="Grader, lab assistant, etc."
              />
            </Field>
          </Grid2>
        )}
      </Section>

      {/* Course basics + schedule */}
      <Section title="Course Schedule">
        <Grid2>
          <Field label="Course Number">
            <Input
              value={inputs.courseNumber || ''}
              onChange={(v) => update('courseNumber', v)}
              disabled={isApproved}
              placeholder="e.g. MGMT 401"
            />
          </Field>
          <Field label="Semester *">
            <Input
              value={inputs.semester}
              onChange={(v) => update('semester', v)}
              disabled={isApproved}
              placeholder="e.g. Fall 2026"
            />
          </Field>
          <Field label="Meeting Pattern">
            <Input
              value={inputs.meetingPattern || ''}
              onChange={(v) => update('meetingPattern', v)}
              disabled={isApproved}
              placeholder="e.g. Tue/Thu 2:00–3:30 PM"
            />
          </Field>
          <Field label="Meeting Location">
            <Input
              value={inputs.meetingLocation || ''}
              onChange={(v) => update('meetingLocation', v)}
              disabled={isApproved}
              placeholder="e.g. Room A101"
            />
          </Field>
          <Field label="Start Date (gives every week a date; leave blank for Week 1, Week 2 only)">
            <Input
              type="date"
              value={inputs.startDate || ''}
              onChange={(v) => update('startDate', v)}
              disabled={isApproved}
            />
          </Field>
          <Field label="Number of Weeks">
            <Input
              type="number"
              value={String(inputs.numWeeks ?? 12)}
              onChange={(v) => update('numWeeks', parseInt(v) || 12)}
              disabled={isApproved}
            />
          </Field>
          <Field label="Sessions per Week">
            <Input
              type="number"
              value={String(inputs.sessionsPerWeek ?? 2)}
              onChange={(v) => update('sessionsPerWeek', parseInt(v) || 2)}
              disabled={isApproved}
            />
          </Field>
        </Grid2>
      </Section>

      {/* Exam / additional assessments */}
      <Section title="Additional Assessments (Exams, Projects)">
        <p className="text-xs text-teal-600 mb-3">
          Module assignments and the summative exam are added automatically. Use this list for
          midterms, final projects, or other instructor-defined assessments.
        </p>
        {(inputs.examSchedule || []).map((exam, i) => (
          <div key={i} className="grid grid-cols-1 md:grid-cols-12 gap-2 mb-2 items-start">
            <div className="md:col-span-3">
              <Input
                value={exam.name}
                onChange={(v) => updateExam(i, 'name', v)}
                disabled={isApproved}
                placeholder="Name (e.g. Midterm)"
              />
            </div>
            <div className="md:col-span-3">
              <Input
                type="date"
                value={exam.date}
                onChange={(v) => updateExam(i, 'date', v)}
                disabled={isApproved}
              />
            </div>
            <div className="md:col-span-2">
              <Input
                type="number"
                value={String(exam.weight)}
                onChange={(v) => updateExam(i, 'weight', parseFloat(v) || 0)}
                disabled={isApproved}
                placeholder="Weight %"
              />
            </div>
            <div className="md:col-span-3">
              <Input
                value={exam.description || ''}
                onChange={(v) => updateExam(i, 'description', v)}
                disabled={isApproved}
                placeholder="Short description"
              />
            </div>
            <button
              type="button"
              onClick={() => removeExam(i)}
              disabled={isApproved}
              className="md:col-span-1 text-red-500 hover:text-red-700 text-sm"
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addExam}
          disabled={isApproved}
          className="px-3 py-1.5 bg-teal-100 hover:bg-teal-200 text-teal-700 rounded-lg text-sm border border-teal-300 disabled:opacity-50"
        >
          + Add Assessment
        </button>
      </Section>

      {/* Rules the institution sets */}
      <Section title="Rules students are told about">
        <p className="text-xs text-teal-600 mb-3">
          Enter only what your institution has stated. Nothing is written for you: a rule left blank
          is shown to students as &ldquo;Your programme handbook sets this&rdquo; and is listed in
          Unresolved Issues. The pass mark and resit rules are read from the assessment rules
          entered for the programme.
        </p>
        {[
          ['gradingScale', 'Grading scale'],
          ['lateWork', 'Late work'],
          ['attendance', 'Attendance'],
          ['technologyUse', 'Technology use (optional)'],
          ['communicationNorms', 'Contacting your tutor (optional)'],
        ].map(([key, label]) => (
          <Field key={key} label={label}>
            <textarea
              className="w-full px-3 py-2 bg-teal-50/50 border border-teal-300 rounded text-teal-800 text-sm min-h-[80px]"
              value={(inputs.policies as any)?.[key] || ''}
              onChange={(e) => updatePolicies(key, e.target.value)}
              disabled={isApproved}
              placeholder="As stated by the institution"
            />
          </Field>
        ))}
      </Section>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 sticky bottom-2 bg-white/80 backdrop-blur-sm p-3 rounded-lg border border-teal-200">
        <button
          onClick={handleSave}
          disabled={savingInputs || generating || isApproved}
          className="px-4 py-2 bg-white hover:bg-teal-50 border border-teal-400 text-teal-700 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {savingInputs ? 'Saving…' : 'Save Inputs'}
        </button>
        <button
          onClick={handleGenerate}
          disabled={generating || isApproved}
          className="px-4 py-2 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
        >
          {generating ? 'Generating…' : generated ? 'Regenerate Syllabus' : 'Generate Syllabus'}
        </button>
        {generated && generated.moduleSyllabi && generated.moduleSyllabi.length > 0 && (
          <button
            onClick={handleDownloadAll}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-semibold"
            title={`Zip with ${generated.moduleSyllabi.length} per-module syllabus documents`}
          >
            Download All ({generated.moduleSyllabi.length} modules .zip)
          </button>
        )}
        {generated && (
          <button
            onClick={handleDownload}
            className="px-4 py-2 bg-white hover:bg-amber-50 border border-amber-400 text-amber-700 rounded-lg text-sm font-medium"
            title="Programme overview followed by every course syllabus"
          >
            Overview + all courses .docx
          </button>
        )}
        {canApprove && (
          <button
            onClick={handleApprove}
            disabled={approving}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
          >
            {approving ? 'Approving…' : 'Approve & Complete'}
          </button>
        )}
        {isApproved && (
          <span className="px-3 py-2 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-semibold border border-emerald-300">
            ✓ Approved
          </span>
        )}
      </div>

      {/* Programme overview preview */}
      {generated && (
        <Section title="Programme Overview">
          <div className="space-y-4 text-sm text-teal-800">
            <p className="whitespace-pre-wrap">{generated.courseDescription}</p>
            <div>
              <h4 className="font-semibold mb-1">
                What the whole programme prepares you to do ({generated.learningOutcomes.length})
              </h4>
              <ol className="list-decimal pl-5 space-y-1">
                {generated.learningOutcomes.map((o, i) => (
                  <li key={i}>{o}</li>
                ))}
              </ol>
            </div>
            {generated.missingRules && generated.missingRules.length > 0 && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900">
                <p className="font-semibold">Institution rules not entered</p>
                <p className="text-xs mt-1">
                  Students are told to check the programme handbook for:{' '}
                  {generated.missingRules.join(', ').toLowerCase()}.
                </p>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* One course syllabus per module, with its completeness check */}
      {generated && generated.moduleSyllabi && generated.moduleSyllabi.length > 0 && (
        <Section title={`Course Syllabi (${generated.moduleSyllabi.length})`}>
          <p className="text-xs text-teal-600 mb-4">
            One syllabus per module. Each answers: what will I learn, how should I prepare, what
            work must I complete, and how will I be assessed. The checks below are computed from the
            steps; the download is rebuilt from them each time.
          </p>
          <div className="space-y-3">
            {generated.moduleSyllabi.map((mod) => {
              const checks = mod.completeness?.checks || [];
              const failed = checks.filter((c) => !c.ok);
              return (
                <details
                  key={mod.moduleId}
                  className="bg-white rounded-lg border border-teal-200 group"
                >
                  <summary className="cursor-pointer flex items-center justify-between p-3 list-none">
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-teal-800">
                        {mod.moduleCode}: {mod.moduleTitle}
                      </div>
                      <div
                        className={`text-xs mt-0.5 ${failed.length ? 'text-amber-700' : 'text-emerald-700'}`}
                      >
                        {!mod.completeness
                          ? 'Not checked: regenerate the syllabus'
                          : failed.length
                            ? `${failed.length} of ${checks.length} checks not met`
                            : `All ${checks.length} checks met`}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDownloadModule(mod.moduleId);
                      }}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs rounded font-semibold flex-shrink-0 ml-3"
                    >
                      Download .docx
                    </button>
                  </summary>
                  <ul className="px-3 pb-3 text-xs text-teal-800 space-y-1 border-t border-teal-100 pt-3">
                    {checks.map((c) => (
                      <li key={c.key} className={c.ok ? '' : 'text-amber-800'}>
                        <span className="font-semibold">{c.ok ? 'Met' : 'Not met'}</span>: {c.label}
                        {c.detail ? ` (${c.detail})` : ''}
                      </li>
                    ))}
                  </ul>
                </details>
              );
            })}
          </div>
        </Section>
      )}
    </div>
  );
}

// ----- small layout helpers -----

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white/60 border border-teal-200 rounded-xl p-5">
      <h3 className="text-lg font-semibold text-teal-800 mb-4">{title}</h3>
      {children}
    </section>
  );
}

function Grid2({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-teal-700">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}

function Input({
  value,
  onChange,
  type = 'text',
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="px-3 py-2 bg-teal-50/50 border border-teal-300 rounded text-teal-800 text-sm disabled:opacity-60"
    />
  );
}
