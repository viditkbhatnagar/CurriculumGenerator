/**
 * Rejin's audit, 16 October 2026: "What happens when the search query does not return a match?"
 * The answer was "the step is written from the model's own knowledge, and only the server log
 * says so". These checks put that on the programme's list of unresolved issues.
 */
import { kbEvidenceGaps, kbEvidencePath } from '../services/kbEvidence';
import { unresolvedIssues } from '../services/unresolvedIssues';

const at = '2026-10-16T10:00:00Z';

describe('knowledge-base evidence', () => {
  it('names the steps and Step 5 modules written without any passage', () => {
    const gaps = kbEvidenceGaps(
      {
        step1: { passages: 12, books: 0, at },
        step2: { passages: 0, books: 0, at },
        step5: {
          'mod-m01': { passages: 3, books: 0, at },
          'mod-m02': { passages: 0, books: 0, at },
        },
      },
      (id) => id.replace('mod-m', 'M')
    );
    expect(gaps.map((g) => g.step)).toEqual([2, 5]);
    expect(gaps[1].issue).toBe(
      '1 of 2 modules had no knowledge-base passage when their sources were chosen: M02'
    );
  });

  it('says nothing for a programme written before searches were recorded', () => {
    expect(kbEvidenceGaps(undefined)).toEqual([]);
  });

  it('records Step 5 per module, under keys Mongo accepts', () => {
    expect(kbEvidencePath('step5', 'mod.m01')).toBe('step5.mod_m01');
    expect(kbEvidencePath('step3')).toBe('step3');
  });

  it('lists the gap among the unresolved issues, as something to review', () => {
    const workflow = {
      step1: { programTitle: 'BBA' },
      step2: {},
      step4: { modules: [{ id: 'mod-m02', code: 'M02' }] },
      step5: { sources: [] },
      kbEvidence: {
        step2: { passages: 0, books: 0, at },
        step5: { 'mod-m02': { passages: 0, books: 0, at } },
      },
    };
    const issues = unresolvedIssues(workflow, 2026).filter((i) => /knowledge.base/.test(i.issue));
    expect(issues.map((i) => [i.step, i.kind])).toEqual([
      [2, 'review'],
      [5, 'review'],
    ]);
    expect(issues[1].issue).toContain('M02');
  });
});
