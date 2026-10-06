import { assignTopics, MAX_TOPICS_PER_SOURCE, topicText } from '../services/sourceRelevanceService';

jest.mock('../services/openaiService', () => ({ openaiService: {} }));
jest.mock('../services/loggingService', () => ({
  loggingService: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe('assignTopics', () => {
  it('links the topics at or above the floor, best first, up to the cap', () => {
    const source = {
      topicScores: { Planning: 0.62, Control: 0.41, Markets: 0.39, Ethics: 0.55, Budgets: 0.5 },
    } as { topicScores: Record<string, number>; linkedTopics?: string[] };
    assignTopics([source], 0.4);
    expect(source.linkedTopics).toEqual(['Planning', 'Ethics', 'Budgets']);
    expect(source.linkedTopics).toHaveLength(MAX_TOPICS_PER_SOURCE);
  });

  it('links nothing for a source with no scores, rather than guessing', () => {
    const source: { linkedTopics?: string[] } = {};
    assignTopics([source]);
    expect(source.linkedTopics).toEqual([]);
  });
});

describe('topicText', () => {
  it('adds the module title, which disambiguates a short topic', () => {
    expect(topicText('Budgets', 'Financial Accounting')).toBe('Budgets (Financial Accounting)');
  });
});
