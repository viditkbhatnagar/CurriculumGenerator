import { currentOutline } from '../agu/validation/currentFindings';
import { AGU_CATALOGUE_V1_4 } from '../agu/catalogue/catalogueV1_4';
import { Finding } from '../agu/draft/types';
import { validDraft } from './fixtures/aguDraftFixture';

const stale: Finding = {
  code: 'OUTCOME_VERB',
  severity: 'warning',
  message: 'CLO2 starts with "clean", which is not a measurable verb',
  path: 'outcomes[1]',
} as Finding;
const parsed: Finding = {
  code: 'READING_NOT_OFFERED',
  severity: 'warning',
  message: 'A reading the model proposed was not among the verified sources and was dropped',
  path: 'readings',
} as Finding;

describe('currentOutline', () => {
  it('re-checks the outline as it stands, keeping what only parsing could find', () => {
    const doc = { draft: validDraft(), findings: [stale, parsed], status: 'ready_for_review' };
    const now = currentOutline(doc, AGU_CATALOGUE_V1_4);
    expect(now.findings).toContainEqual(parsed);
    expect(now.findings).not.toContainEqual(stale);
    expect(now.recheck).toBeUndefined();
  });

  it('derives a review status from the current findings', () => {
    const draft = validDraft();
    draft.weeks = draft.weeks.slice(0, 3); // fewer weeks than the catalogue requires: blocking
    const now = currentOutline(
      { draft, findings: [], status: 'ready_for_review' },
      AGU_CATALOGUE_V1_4
    );
    expect(now.status).toBe('needs_faculty');
  });

  it('keeps an accepted draft’s findings as recorded, with today’s re-check beside them', () => {
    const doc = { draft: validDraft(), findings: [stale], status: 'faculty_accepted' };
    const now = currentOutline(doc, AGU_CATALOGUE_V1_4);
    expect(now.status).toBe('faculty_accepted');
    expect(now.findings).toEqual([stale]);
    expect(Array.isArray(now.recheck)).toBe(true);
    expect(now.recheck).not.toContainEqual(stale);
  });

  it('leaves states that are not a review verdict alone', () => {
    for (const status of ['generating', 'failed']) {
      expect(
        currentOutline({ draft: validDraft(), findings: [], status }, AGU_CATALOGUE_V1_4).status
      ).toBe(status);
    }
  });

  it('returns the stored findings when there is no draft yet', () => {
    expect(
      currentOutline({ findings: [parsed], status: 'failed' }, AGU_CATALOGUE_V1_4).findings
    ).toEqual([parsed]);
  });
});
