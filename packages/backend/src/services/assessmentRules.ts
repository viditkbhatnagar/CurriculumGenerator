/**
 * The institution's assessment rules: pass requirements, moderation, resits, authenticity and
 * accessibility.
 *
 * The 21 September review (5.7, 6.4 and acceptance criterion 7) asked that these be defined
 * "before generating instruments": the Logistics package had assessment weightings but none of
 * the rules needed to run them. They are institutional policy, like entry requirements, so the
 * generator records what the institution states and never writes its own; a rule not stated is
 * reported as missing, in the Unresolved Issues list and the export. A rule that does not apply
 * is stated as such ("Not applicable: ...").
 *
 * Pure, so it can be tested.
 */

export const ASSESSMENT_RULES = [
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

export type AssessmentRuleKey = (typeof ASSESSMENT_RULES)[number]['key'];

export type AssessmentRules = Partial<Record<AssessmentRuleKey, string>> & {
  updatedAt?: string;
  updatedBy?: string;
};

/** Long enough for a policy paragraph or two; anything longer belongs in a linked document. */
export const MAX_RULE_LENGTH = 2000;

/**
 * The rules from a request body, trimmed. An empty string clears a rule. Returns an error for
 * anything that is not text, or is too long, so nothing partial is saved.
 */
export function cleanAssessmentRules(
  input: unknown
): { rules: Partial<Record<AssessmentRuleKey, string>> } | { error: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { error: 'Send the rules as an object' };
  }
  const body = input as Record<string, unknown>;
  const rules: Partial<Record<AssessmentRuleKey, string>> = {};
  for (const { key, label } of ASSESSMENT_RULES) {
    if (!(key in body) || body[key] === null) continue;
    if (typeof body[key] !== 'string') return { error: `${label} must be text` };
    const text = (body[key] as string).trim();
    if (text.length > MAX_RULE_LENGTH) {
      return { error: `${label} is longer than ${MAX_RULE_LENGTH} characters` };
    }
    rules[key] = text;
  }
  if (!Object.keys(rules).length) return { error: 'No assessment rule was given' };
  return { rules };
}

/** The labels of the rules the institution has not stated. */
export function missingAssessmentRules(rules: AssessmentRules | null | undefined): string[] {
  return ASSESSMENT_RULES.filter(({ key }) => !rules?.[key]?.trim()).map(({ label }) => label);
}

/**
 * The rules as the assessment prompts give them to the model. With none stated, the model is
 * told not to state any, so it cannot fill the gap with a pass mark or resit rule of its own.
 */
export function assessmentRulesForPrompt(rules: AssessmentRules | null | undefined): string {
  const stated = ASSESSMENT_RULES.filter(({ key }) => rules?.[key]?.trim());
  const lines = stated.map(({ key, label }) => `- ${label}: ${rules![key]!.trim()}`);
  return [
    "**Institution's assessment rules:**",
    ...(lines.length ? lines : ['- None stated.']),
    'Follow these where they apply. Do not state a pass mark, moderation, resit, integrity or adjustment rule that is not listed here.',
  ].join('\n');
}
