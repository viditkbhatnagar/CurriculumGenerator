/**
 * Every competency statement shows the evidence behind it, or that there is none, and
 * statements that may be the same competency are flagged (the 21 September review, 5.2).
 */
import {
  competencyItemsOf,
  cosine,
  DUPLICATE_SIMILARITY,
  EVIDENCE_FLOOR,
  evidenceLabel,
  evidenceSummary,
  selectEvidence,
  similarPairs,
} from '../services/competencyEvidence';
import { unresolvedIssues } from '../services/unresolvedIssues';

const passage = (score: number, chunkId = `c${score}`) => ({
  sourceTitle: 'SFIA 9',
  chunkId,
  excerpt: 'Analyses data',
  score,
});

describe('competencyItemsOf', () => {
  it('lists knowledge, skills and competencies, falling back to attitudeItems', () => {
    const items = competencyItemsOf({
      knowledgeItems: [{ id: 'K1', statement: 'Principles of costing' }],
      skillItems: [
        { id: 'S1', statement: 'Analyse costs' },
        { id: 'S2', statement: ' ' },
      ],
      attitudeItems: [{ id: 'C1', statement: 'Acts ethically' }],
    });
    expect(items.map((i) => i.id)).toEqual(['K1', 'S1', 'C1']);
  });
});

describe('selectEvidence', () => {
  it('keeps passages at or above the floor, best first, one per chunk, at most three', () => {
    const chosen = selectEvidence([
      passage(EVIDENCE_FLOOR - 0.01),
      passage(0.95, 'a'),
      passage(0.94, 'a'),
      passage(0.9, 'b'),
      passage(0.88, 'c'),
      passage(0.86, 'd'),
    ]);
    expect(chosen.map((p) => p.chunkId)).toEqual(['a', 'b', 'c']);
  });

  it('finds nothing when no passage reaches the floor', () => {
    expect(selectEvidence([passage(0.5)])).toEqual([]);
  });
});

describe('similarPairs', () => {
  const items = [
    { id: 'K1', type: 'knowledge', statement: 'a' },
    { id: 'K2', type: 'knowledge', statement: 'b' },
    { id: 'S1', type: 'skill', statement: 'c' },
  ];

  it('pairs statements of the same kind that mean nearly the same thing', () => {
    const vectors = [
      [1, 0],
      [1, 0.01],
      [1, 0],
    ];
    expect(similarPairs(items, vectors).map((p) => [p.first, p.second])).toEqual([['K1', 'K2']]);
  });

  it('does not pair different statements', () => {
    expect(
      similarPairs(items, [
        [1, 0],
        [0, 1],
        [1, 0],
      ])
    ).toEqual([]);
    expect(cosine([1, 0], [0, 1])).toBe(0);
  });
});

describe('evidence in the export and the issues list', () => {
  const checkedAt = '2026-10-06T08:00:00Z';
  const step2 = {
    knowledgeItems: [
      {
        id: 'K1',
        statement: 'Costing',
        evidence: { checkedAt, statement: 'Costing', candidates: [passage(0.91), passage(0.6)] },
      },
      {
        id: 'K2',
        statement: 'Budgets',
        evidence: { checkedAt, statement: 'Budgets', candidates: [passage(0.62)] },
      },
    ],
    skillItems: [{ id: 'S1', statement: 'Forecast' }],
    similarStatements: [
      { first: 'K1', second: 'K2', score: DUPLICATE_SIMILARITY + 0.01 },
      { first: 'K1', second: 'K3', score: DUPLICATE_SIMILARITY - 0.05 },
    ],
  };

  it('labels each statement with its evidence, none, or not checked', () => {
    expect(evidenceLabel(step2.knowledgeItems[0])).toBe('SFIA 9 (match 0.91)');
    expect(evidenceLabel(step2.knowledgeItems[1])).toBe(
      'No supporting passage found in the knowledge base'
    );
    expect(evidenceLabel(step2.skillItems[0])).toBe('Not checked');
  });

  it('counts checked and unsupported statements', () => {
    expect(evidenceSummary(step2)).toEqual({
      statements: 3,
      checked: 2,
      supported: 1,
      unsupported: ['K2'],
    });
  });

  it('lists unsupported statements and likely duplicates for expert review', () => {
    const issues = unresolvedIssues({ step2 }, 2026).filter((i) => i.step === 2);
    expect(issues.map((i) => i.issue)).toEqual([
      '1 of 2 competency statements have no supporting passage in the knowledge base: K2',
      'K1 and K2 may state the same competency: merge them, or make the difference explicit',
    ]);
    expect(issues.every((i) => i.kind === 'review')).toBe(true);
  });

  it('treats evidence and pairs found for earlier wording as not checked', () => {
    const reworded = {
      knowledgeItems: [
        {
          id: 'K1',
          statement: 'Costing methods',
          evidence: { checkedAt, statement: 'Costing', candidates: [passage(0.91)] },
        },
        { id: 'K2', statement: 'Budgets' },
      ],
      similarStatements: [
        {
          first: 'K1',
          second: 'K2',
          score: 0.99,
          texts: ['Costing', 'Budgets'] as [string, string],
        },
      ],
    };
    expect(evidenceLabel(reworded.knowledgeItems[0])).toBe('Not checked');
    const issues = unresolvedIssues({ step2: reworded }, 2026).filter((i) => i.step === 2);
    expect(issues.map((i) => i.kind)).toEqual(['not_checked']);
  });

  it('says the evidence was not checked when no statement has been', () => {
    const issues = unresolvedIssues(
      { step2: { knowledgeItems: [{ id: 'K1', statement: 'x' }] } },
      2026
    );
    expect(issues).toContainEqual(
      expect.objectContaining({
        step: 2,
        kind: 'not_checked',
        issue: 'The evidence behind the competency statements has not been checked',
      })
    );
  });
});
