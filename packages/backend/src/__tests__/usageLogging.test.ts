jest.mock('../models/AnalyticsMetric', () => ({ AnalyticsMetric: { create: jest.fn() } }));

import { AnalyticsMetric } from '../models/AnalyticsMetric';
import { analyticsStorageService } from '../services/analyticsStorageService';
import { currentUsageContext, withUsageContext } from '../services/usageContext';

describe('usage context', () => {
  it('is visible to work started beneath it, however deep, and gone afterwards', async () => {
    const seen: unknown[] = [];
    const deep = async () => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      seen.push(currentUsageContext());
    };
    await withUsageContext({ workflowId: 'w1', step: 10 }, async () => {
      await Promise.all([deep(), deep()]);
    });
    expect(seen).toEqual([
      { workflowId: 'w1', step: 10 },
      { workflowId: 'w1', step: 10 },
    ]);
    expect(currentUsageContext()).toBeUndefined();
  });

  it('keeps two runs going at once apart', async () => {
    const seen: Record<string, unknown> = {};
    const run = (id: string, ms: number) =>
      withUsageContext({ workflowId: id, step: 12 }, async () => {
        await new Promise((resolve) => setTimeout(resolve, ms));
        seen[id] = currentUsageContext()?.workflowId;
      });
    await Promise.all([run('a', 5), run('b', 1)]);
    expect(seen).toEqual({ a: 'a', b: 'b' });
  });
});

describe('analytics storage', () => {
  it('writes the model to the field the schema keeps', async () => {
    await analyticsStorageService.recordTokenUsage({
      tokensUsed: 12000,
      provider: 'openai',
      model: 'gpt-5',
      cost: 0.085,
      metadata: { promptTokens: 4000, completionTokens: 8000, step: 10 },
    });
    const written = (AnalyticsMetric.create as jest.Mock).mock.calls[0][0];
    expect(written.modelName).toBe('gpt-5');
    expect(written).not.toHaveProperty('model');
    expect(written.metadata).toEqual({ promptTokens: 4000, completionTokens: 8000, step: 10 });
  });
});
