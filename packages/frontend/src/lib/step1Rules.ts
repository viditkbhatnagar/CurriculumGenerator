/**
 * What Step 1 needs before it is generated: the minimums its form states. The same rules as
 * the backend's services/step1Rules, which refuses a request that misses them; checking here
 * too tells the author before anything is sent.
 *
 * The form asked for a 50-word description, a 50-300 word purpose and 100-word job
 * descriptions, and checked none of them before generating. Logan's test run (28 October
 * 2026) generated from job descriptions of 41 and 36 words, so the occupational evidence and
 * the job tasks that Steps 2 and 3 build on were thin from the start.
 */
export const STEP1_MINIMUMS = {
  descriptionWords: 50,
  purposeWords: 50,
  purposeMaxWords: 300,
  roles: 2,
  roleDescriptionWords: 100,
};

export const wordCount = (text: unknown): number =>
  typeof text === 'string' ? text.trim().split(/\s+/).filter(Boolean).length : 0;

/** Each thing that falls short, as a sentence the author can act on. Empty when all is met. */
export function step1InputProblems(input: {
  programDescription?: unknown;
  programPurpose?: unknown;
  jobRoles?: unknown[];
}): string[] {
  const m = STEP1_MINIMUMS;
  const problems: string[] = [];
  const description = wordCount(input.programDescription);
  if (description < m.descriptionWords) {
    problems.push(
      `The programme description has ${description} words; it needs at least ${m.descriptionWords}.`
    );
  }
  const purpose = wordCount(input.programPurpose);
  if (purpose < m.purposeWords || purpose > m.purposeMaxWords) {
    problems.push(
      `The programme purpose has ${purpose} words; it needs ${m.purposeWords} to ${m.purposeMaxWords}.`
    );
  }
  const roles = (input.jobRoles || []).filter((r: any) =>
    typeof r === 'string' ? r.trim() : r?.title?.trim()
  );
  if (roles.length < m.roles) {
    problems.push(`At least ${m.roles} job roles are needed; ${roles.length} given.`);
  }
  for (const role of roles as any[]) {
    const title = typeof role === 'string' ? role.trim() : role.title.trim();
    const words = typeof role === 'string' ? 0 : wordCount(role.description);
    if (words < m.roleDescriptionWords) {
      problems.push(
        `"${title}": the job description has ${words} words; it needs at least ${m.roleDescriptionWords}.`
      );
    }
  }
  return problems;
}
