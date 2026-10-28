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
