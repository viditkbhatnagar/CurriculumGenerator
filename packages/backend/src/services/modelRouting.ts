/**
 * Which model a request goes to when the generator runs on Azure OpenAI.
 *
 * Azure serves only the deployments its resource has (on 28 October 2026: gpt-5.4,
 * text-embedding-3-large and text-embedding-3-small), and the code asks for models by name:
 * gpt-4o for short calls, gpt-5 for Step 11, gpt-5-mini for reading textbooks. A request for a
 * deployment that exists goes to it; an embedding model goes to the embedding deployment; a
 * "mini" or "nano" request goes to a deployment of the same size if there is one, so cheap work
 * stays cheap; anything else goes to the chat deployment. Without Azure, names pass through.
 */
export interface AzureDeployments {
  /** The default chat deployment, e.g. "gpt-5.4". */
  chat: string;
  /** The embedding deployment, e.g. "text-embedding-3-large". */
  embedding: string;
  /** Every deployment the resource has, the two above included. */
  available: string[];
}

const sizeOf = (name: string) =>
  /nano/i.test(name) ? 'nano' : /mini/i.test(name) ? 'mini' : 'full';

export function deploymentFor(
  requested: string,
  azure: AzureDeployments | null | undefined
): string {
  if (!azure) return requested;
  if (azure.available.includes(requested)) return requested;
  if (/embedding/i.test(requested)) return azure.embedding;
  const size = sizeOf(requested);
  if (size !== 'full') {
    const same = azure.available.find((d) => !/embedding/i.test(d) && sizeOf(d) === size);
    if (same) return same;
  }
  return azure.chat;
}

/** "https://x.cognitiveservices.azure.com/" or ".../openai/v1/" -> ".../openai/v1". */
export function azureBaseURL(endpoint: string): string {
  const trimmed = endpoint.trim().replace(/\/+$/, '');
  return /\/openai\/v1$/.test(trimmed) ? trimmed : `${trimmed}/openai/v1`;
}

/**
 * Whether a model reasons before answering (GPT-5 and later, the o-series): such models take
 * max_completion_tokens and reasoning_effort, and refuse max_tokens. The check named only
 * "gpt-5", so a gpt-6-sol or gpt-6-luna request would have been sent max_tokens.
 */
export function isReasoningModel(name: string): boolean {
  return /^(gpt-([5-9]|\d{2})|o\d)/i.test(name);
}

/**
 * The model for a call made inside a step: the fast model when the step is one of the fast
 * ones and a fast model is configured, else the model the call asked for. Steps whose output
 * is reformatting or bulk (slide decks, glossary, readings, reading textbooks) can run on a
 * small model at a twentieth of the price; design steps stay on the main one.
 */
export function modelForStep(
  requested: string,
  step: number | string | undefined,
  fast: { model?: string; steps: string[] }
): string {
  if (!fast.model || step === undefined) return requested;
  return fast.steps.includes(String(step)) ? fast.model : requested;
}
