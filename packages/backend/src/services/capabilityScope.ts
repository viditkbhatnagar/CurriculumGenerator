/**
 * What the generator has been shown to do, stated before generation begins.
 *
 * The 21 September review (5.1, 4.9; acceptance criteria 1 and 2): the platform "does not tell
 * users which subjects, industries, qualification levels or jurisdictions it can support" and
 * "may accept almost any curriculum request and produce a confident-looking result". This is
 * that statement, built from where output has actually been generated and reviewed. It does
 * not refuse other requests outright; it makes the author acknowledge that the result is
 * outside the reviewed scope and needs an expert's review, and the export says so.
 *
 * Pure, so it can be tested. The lists are a product decision for AGU to confirm.
 */

export interface SubjectArea {
  id: string;
  label: string;
}

/** Subject families in which generated programmes have been produced and reviewed. */
export const SUBJECT_AREAS: SubjectArea[] = [
  { id: 'business_management', label: 'Business administration and management' },
  { id: 'hr', label: 'Human resource management' },
  { id: 'marketing', label: 'Marketing and digital marketing' },
  { id: 'finance', label: 'Finance and accounting' },
  { id: 'operations_supply_chain', label: 'Operations, logistics and supply chain' },
  { id: 'analytics', label: 'Business analytics and data-driven management' },
  { id: 'project_management', label: 'Project management' },
  { id: 'leadership_change', label: 'Leadership, strategy and change' },
  { id: 'service_industries', label: 'Hospitality, tourism, aviation and customer service' },
  { id: 'fashion_retail', label: 'Fashion business and retail' },
];

export const OTHER_SUBJECT = 'other';

export const CAPABILITY_STATEMENT = {
  summary:
    'The generator drafts curricula in business and management subjects, for certificate to master’s level. Everything it produces is a draft for review by a subject expert and approval by the institution.',
  subjects: SUBJECT_AREAS.map((s) => s.label),
  levels: ['Micro-credential', 'Certificate', 'Diploma', 'Bachelor’s degree', 'Master’s degree'],
  jurisdictions: [
    'Malta and the EU (EQF/MQF levels)',
    'United Kingdom (RQF; OTHM-style units)',
    'United States (semester credits; the AGU catalogue)',
  ],
  limits: [
    'Subjects outside the list above (medicine, law, engineering, the sciences and so on) are not supported: it may produce confident text without the knowledge to back it.',
    'It does not set entry requirements, credit transfer or institutional policy. Where it drafts them, they are marked as proposals for the institution to approve.',
    'Academic sources come from an open index (OpenAlex) and are checked to exist; textbooks and licensed material must be added by faculty.',
    'Automated checks test structure, mapping and completeness. They are not academic approval.',
  ],
};

/** Why Step 1 cannot go ahead with this subject choice, or null. */
export function scopeProblem(subjectArea: unknown, acknowledged: unknown): string | null {
  if (subjectArea === OTHER_SUBJECT && acknowledged !== true) {
    return 'This subject is outside the generator’s reviewed scope. Confirm that a subject expert will review everything it drafts before continuing.';
  }
  if (
    subjectArea !== undefined &&
    subjectArea !== OTHER_SUBJECT &&
    !SUBJECT_AREAS.some((s) => s.id === subjectArea)
  ) {
    return 'Unknown subject area';
  }
  return null;
}

/** What the export's unresolved-issues list says about the programme's scope, if anything. */
export function scopeIssue(step1: { subjectArea?: string } | undefined): {
  kind: 'review' | 'not_checked';
  issue: string;
} | null {
  if (!step1) return null;
  if (!step1.subjectArea) {
    return {
      kind: 'not_checked',
      issue: 'The subject area was not declared, so it was not checked against the reviewed scope',
    };
  }
  if (step1.subjectArea === OTHER_SUBJECT) {
    return {
      kind: 'review',
      issue:
        'The subject is outside the generator’s reviewed scope: a subject expert must review everything it drafted',
    };
  }
  return null;
}
