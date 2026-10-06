'use client';

/**
 * The institution's assessment rules: pass requirements, moderation, resits, authenticity and
 * accessibility (backend services/assessmentRules). The 21 September review (5.7) asked for these
 * to be defined before assessments are generated. They are institutional policy, so the author
 * records what the institution states; the generator never writes them, and a rule left empty
 * is listed under Unresolved Issues in the export.
 */
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { AssessmentRules } from '@/types/workflow';

const RULES = [
  {
    key: 'passRequirements',
    label: 'Pass requirements',
    hint: 'The pass mark, and whether each component must be passed separately',
  },
  {
    key: 'moderation',
    label: 'Moderation',
    hint: 'How marking is checked: second marking, sampling, external examiner',
  },
  {
    key: 'resits',
    label: 'Resits',
    hint: 'How many attempts are allowed, and whether a resit mark is capped',
  },
  {
    key: 'authenticity',
    label: 'Authenticity',
    hint: 'Academic integrity rules, including the use of AI tools',
  },
  {
    key: 'accessibility',
    label: 'Accessibility',
    hint: 'Reasonable adjustments, extra time and alternative formats',
  },
] as const;

type RuleKey = (typeof RULES)[number]['key'];

export default function AssessmentRulesPanel({
  workflowId,
  rules,
}: {
  workflowId: string;
  rules?: AssessmentRules;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Record<RuleKey, string>>(
    () =>
      Object.fromEntries(RULES.map(({ key }) => [key, rules?.[key] || ''])) as Record<
        RuleKey,
        string
      >
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const missing = RULES.filter(({ key }) => !(rules?.[key] || '').trim());
  const changed = RULES.some(({ key }) => (rules?.[key] || '') !== draft[key]);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await api.put(`/api/v3/workflow/${workflowId}/assessment-rules`, draft);
      await queryClient.invalidateQueries({ queryKey: ['workflow', workflowId] });
      setMessage({ ok: true, text: 'Saved.' });
    } catch (error: any) {
      setMessage({
        ok: false,
        text: error?.response?.data?.error || 'The rules could not be saved. Try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mb-6 rounded-xl border border-teal-200 bg-white p-5 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-teal-800">Assessment rules</h2>
        <p className="text-sm text-teal-700 mt-1">
          Your institution&apos;s rules, as it states them. The generator does not write these:
          enter each one, or write &quot;Not applicable&quot; with the reason. Assessments are
          generated to follow them, and any left empty are listed as unresolved in the export.
        </p>
        <p className={`text-sm mt-2 ${missing.length ? 'text-amber-700' : 'text-green-700'}`}>
          {missing.length
            ? `Not stated yet: ${missing.map((r) => r.label).join(', ')}`
            : 'All five rules are stated.'}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {RULES.map(({ key, label, hint }) => (
          <div key={key}>
            <label htmlFor={`rule-${key}`} className="block text-sm font-medium text-teal-800">
              {label}
            </label>
            <p className="text-xs text-teal-600 mb-1">{hint}</p>
            <textarea
              id={`rule-${key}`}
              rows={3}
              maxLength={2000}
              value={draft[key]}
              onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
              className="w-full rounded-lg border border-teal-200 p-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
            />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving || !changed}
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save rules'}
        </button>
        {message && (
          <span
            role="status"
            className={`text-sm ${message.ok ? 'text-green-700' : 'text-red-700'}`}
          >
            {message.text}
          </span>
        )}
      </div>
    </section>
  );
}
