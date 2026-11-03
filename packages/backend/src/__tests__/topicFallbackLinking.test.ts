jest.mock('../services/openaiService', () => ({ openaiService: {} }));

import { assignTopicsWithFallback } from '../services/sourceRelevanceService';
import { sourcesPerTopic, topicsCoveredWeakly } from '../services/step5Validation';

const TOPICS = ['Broad topic', 'KPI selection', 'Forecasting'];

const src = (id: string, scores: Record<string, number>) => ({
  id,
  moduleId: 'm1',
  topicScores: scores,
  linkedTopics: [] as string[],
  weakTopicLinks: [] as string[],
});

describe('assignTopicsWithFallback', () => {
  const build = () => [
    src('a', { 'Broad topic': 0.6, 'KPI selection': 0.3, Forecasting: 0.1 }),
    src('b', { 'Broad topic': 0.55, 'KPI selection': 0.32, Forecasting: 0.2 }),
    src('c', { 'Broad topic': 0.5, 'KPI selection': 0.25, Forecasting: 0.28 }),
    src('d', { 'Broad topic': 0.1, 'KPI selection': 0.2, Forecasting: 0.3 }),
  ];

  it('gives a topic below the floor its best-scoring sources up to the minimum', () => {
    const sources = build();
    assignTopicsWithFallback(sources, TOPICS);
    const kpi = sources.filter((s) => s.linkedTopics.includes('KPI selection')).map((s) => s.id);
    expect(kpi.sort()).toEqual(['a', 'b']); // 0.30 and 0.32 beat 0.25 and 0.20
    const forecasting = sources.filter((s) => s.linkedTopics.includes('Forecasting'));
    expect(forecasting).toHaveLength(2);
  });

  it('marks fallback links as weak and leaves floor links strong', () => {
    const sources = build();
    assignTopicsWithFallback(sources, TOPICS);
    expect(sources[0].linkedTopics).toContain('Broad topic');
    expect(sources[0].weakTopicLinks).not.toContain('Broad topic');
    expect(sources[1].weakTopicLinks).toContain('KPI selection');
  });

  it('links an orphan source to its best topic', () => {
    const sources = [
      src('a', { 'Broad topic': 0.6, 'KPI selection': 0.6, Forecasting: 0.6 }),
      src('b', { 'Broad topic': 0.6, 'KPI selection': 0.6, Forecasting: 0.6 }),
      src('orphan', { 'Broad topic': 0.1, 'KPI selection': 0.2, Forecasting: 0.15 }),
    ];
    assignTopicsWithFallback(sources, TOPICS);
    expect(sources[2].linkedTopics).toEqual(['KPI selection']);
    expect(sources[2].weakTopicLinks).toEqual(['KPI selection']);
  });

  it('does not invent coverage for a source with no scores', () => {
    const sources = [{ moduleId: 'm1', linkedTopics: [] as string[] }];
    assignTopicsWithFallback(sources, TOPICS);
    expect(sources[0].linkedTopics).toEqual([]);
  });

  it('leaves a topic short only when the module has too few sources', () => {
    const sources = [src('a', { 'Broad topic': 0.6, 'KPI selection': 0.3, Forecasting: 0.1 })];
    assignTopicsWithFallback(sources, TOPICS);
    const counts = sourcesPerTopic(sources, [{ id: 'm1', topics: TOPICS }]);
    expect(counts.every((t) => t.count <= 1)).toBe(true);
  });

  it('is repeatable from stored scores', () => {
    const sources = build();
    assignTopicsWithFallback(sources, TOPICS);
    const first = JSON.stringify(sources.map((s) => [s.linkedTopics, s.weakTopicLinks]));
    assignTopicsWithFallback(sources, TOPICS);
    expect(JSON.stringify(sources.map((s) => [s.linkedTopics, s.weakTopicLinks]))).toBe(first);
  });
});

describe('topicsCoveredWeakly', () => {
  it('lists topics that reach the minimum only through weak links', () => {
    const sources = build();
    assignTopicsWithFallback(sources, TOPICS);
    const weak = topicsCoveredWeakly(sources, [{ id: 'm1', topics: TOPICS }]);
    expect(weak.map((t) => t.topic).sort()).toEqual(['Forecasting', 'KPI selection']);
    expect(weak.every((t) => t.count >= 2 && t.strongCount < 2)).toBe(true);
  });

  function build() {
    return [
      src('a', { 'Broad topic': 0.6, 'KPI selection': 0.3, Forecasting: 0.1 }),
      src('b', { 'Broad topic': 0.55, 'KPI selection': 0.32, Forecasting: 0.2 }),
      src('c', { 'Broad topic': 0.5, 'KPI selection': 0.25, Forecasting: 0.28 }),
      src('d', { 'Broad topic': 0.1, 'KPI selection': 0.2, Forecasting: 0.3 }),
    ];
  }
});
