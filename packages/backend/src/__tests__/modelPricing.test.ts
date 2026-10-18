import { costOf, priceKeyFor, usageFrom } from '../utils/modelPricing';

describe('usageFrom', () => {
  it('reads the input, cached, output and reasoning counts OpenAI reports', () => {
    const usage = usageFrom({
      prompt_tokens: 4000,
      completion_tokens: 8000,
      total_tokens: 12000,
      prompt_tokens_details: { cached_tokens: 1000 },
      completion_tokens_details: { reasoning_tokens: 2500 },
    });
    expect(usage).toEqual({
      promptTokens: 4000,
      cachedTokens: 1000,
      completionTokens: 8000,
      reasoningTokens: 2500,
      totalTokens: 12000,
    });
  });

  it('treats a missing usage object as zero rather than failing the call', () => {
    expect(usageFrom(undefined).totalTokens).toBe(0);
    expect(usageFrom({ prompt_tokens: 10, completion_tokens: 5 }).totalTokens).toBe(15);
  });
});

describe('costOf', () => {
  it('prices input and output at their own rates, not their average', () => {
    // 4,000 in at $1.25/M and 8,000 out at $10/M = $0.005 + $0.08
    const usage = usageFrom({ prompt_tokens: 4000, completion_tokens: 8000 });
    expect(costOf('gpt-5', usage).cost).toBeCloseTo(0.085, 6);
    // The old blended rate would have said 12,000 x $5.625/M = $0.0675
    expect(costOf('gpt-5', usage).cost).not.toBeCloseTo(0.0675, 4);
  });

  it('charges cached input at the cached rate', () => {
    const usage = usageFrom({
      prompt_tokens: 4000,
      completion_tokens: 0,
      prompt_tokens_details: { cached_tokens: 4000 },
    });
    expect(costOf('gpt-5', usage).cost).toBeCloseTo(0.0005, 6);
  });

  it('prices an embedding call on its input alone', () => {
    const usage = usageFrom({ prompt_tokens: 1_000_000, total_tokens: 1_000_000 });
    expect(costOf('text-embedding-3-large', usage).cost).toBeCloseTo(0.13, 6);
  });

  it('says so when it had to assume a price for an unknown model', () => {
    const usage = usageFrom({ prompt_tokens: 1000, completion_tokens: 1000 });
    expect(costOf('gpt-5', usage).priceAssumed).toBeUndefined();
    expect(costOf('some-new-model', usage).priceAssumed).toBe('gpt-5');
  });
});

describe('priceKeyFor', () => {
  it('prices a dated snapshot as its family', () => {
    expect(priceKeyFor('gpt-5-2025-08-07')).toBe('gpt-5');
    expect(priceKeyFor('gpt-5-mini-2025-08-07')).toBe('gpt-5-mini');
  });

  it('never prices a different version as a shorter name it happens to start with', () => {
    expect(priceKeyFor('gpt-5.4')).toBeUndefined();
    expect(priceKeyFor('gpt-5-pro')).toBeUndefined();
  });
});
