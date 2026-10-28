/**
 * What each AI call costs, from the token split OpenAI reports.
 *
 * The cost log used to multiply total tokens by the average of the input and output rates.
 * GPT-5 output costs eight times its input, and lesson generation is output-heavy, so that
 * average misstated every figure and could not say what a different model would cost. Each
 * call is now priced from its own input, cached-input and output counts. Reasoning tokens
 * are billed as output and are already inside `completion_tokens`; they are kept separately
 * only so the log shows how much of the output was the model thinking.
 *
 * Prices are USD per million tokens at the standard (not batch or priority) tier. gpt-5 and
 * gpt-5.5 were checked against https://developers.openai.com/api/docs/pricing on 2026-10-18,
 * gpt-5.4 and gpt-5.4-mini on 2026-10-28 (short-context rate, under 272K tokens; the
 * generator's Azure deployment); the others are the prices published when each model launched.
 */

export interface ModelPrice {
  input: number;
  cachedInput: number;
  output: number;
}

export const MODEL_PRICES: Record<string, ModelPrice> = {
  'gpt-5': { input: 1.25, cachedInput: 0.125, output: 10 },
  'gpt-5-mini': { input: 0.25, cachedInput: 0.025, output: 2 },
  'gpt-5-nano': { input: 0.05, cachedInput: 0.005, output: 0.4 },
  'gpt-5.2': { input: 1.75, cachedInput: 0.175, output: 14 },
  'gpt-5.4': { input: 2.5, cachedInput: 0.25, output: 15 },
  'gpt-5.4-mini': { input: 0.75, cachedInput: 0.075, output: 4.5 },
  'gpt-5.5': { input: 5, cachedInput: 0.5, output: 30 },
  'gpt-4o': { input: 2.5, cachedInput: 1.25, output: 10 },
  'gpt-4o-mini': { input: 0.15, cachedInput: 0.075, output: 0.6 },
  'text-embedding-3-large': { input: 0.13, cachedInput: 0.13, output: 0 },
  'text-embedding-3-small': { input: 0.02, cachedInput: 0.02, output: 0 },
};

/** Used for a model missing from the table, and recorded as an assumption when it is. */
export const FALLBACK_PRICE_MODEL = 'gpt-5';

export interface TokenUsage {
  promptTokens: number;
  cachedTokens: number;
  completionTokens: number;
  reasoningTokens: number;
  totalTokens: number;
}

/** OpenAI's `usage` object, read defensively: any field can be missing. */
export function usageFrom(usage: any): TokenUsage {
  const promptTokens = Number(usage?.prompt_tokens) || 0;
  const completionTokens = Number(usage?.completion_tokens) || 0;
  return {
    promptTokens,
    cachedTokens: Number(usage?.prompt_tokens_details?.cached_tokens) || 0,
    completionTokens,
    reasoningTokens: Number(usage?.completion_tokens_details?.reasoning_tokens) || 0,
    totalTokens: Number(usage?.total_tokens) || promptTokens + completionTokens,
  };
}

/**
 * The table entry for a model name. A dated snapshot ("gpt-5-2025-08-07") is priced as its
 * family; any other unknown name gets no entry, so "gpt-5.3" is never priced as "gpt-5".
 */
export function priceKeyFor(model: string): string | undefined {
  if (MODEL_PRICES[model]) return model;
  const snapshot = /^(.+)-\d{4}-\d{2}-\d{2}$/.exec(model);
  return snapshot && MODEL_PRICES[snapshot[1]] ? snapshot[1] : undefined;
}

export interface PricedCall {
  cost: number;
  /** Set when the model was not in the table and was priced as FALLBACK_PRICE_MODEL. */
  priceAssumed?: string;
}

export function costOf(model: string, usage: TokenUsage): PricedCall {
  const key = priceKeyFor(model);
  const price = MODEL_PRICES[key ?? FALLBACK_PRICE_MODEL];
  const cached = Math.min(usage.cachedTokens, usage.promptTokens);
  const cost =
    ((usage.promptTokens - cached) * price.input +
      cached * price.cachedInput +
      usage.completionTokens * price.output) /
    1_000_000;
  return key ? { cost } : { cost, priceAssumed: FALLBACK_PRICE_MODEL };
}
