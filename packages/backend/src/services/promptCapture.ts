import { AsyncLocalStorage } from 'async_hooks';

/**
 * Capture the exact prompts a step sends, without sending them.
 *
 * Rejin's audit (17 October 2026) asked, at every step, to see the prompt as the model receives
 * it: the knowledge-base passages, occupations, competencies and settings expanded, not the
 * template's variable names. Those expansions need the production knowledge base and its search,
 * so the capture runs there: inside `capturePrompts`, an AI call records its prompts and throws
 * instead of calling the model, and the two places a step's preparation writes to the programme
 * (the knowledge-base evidence record and the occupation match) skip their writes. Nothing is
 * generated, nothing is saved, and only embeddings for the searches are spent.
 */
export interface CapturedPrompt {
  label: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  options: Record<string, unknown>;
  characters: number;
  /** About four characters a token; the exact count is the model's tokeniser's. */
  approxTokens: number;
}

export class PromptCaptured extends Error {
  constructor() {
    super('Prompt captured; the model was not called');
    this.name = 'PromptCaptured';
  }
}

interface CaptureState {
  prompts: CapturedPrompt[];
  max: number;
}

const store = new AsyncLocalStorage<CaptureState>();

export function inPromptCapture(): boolean {
  return !!store.getStore();
}

/** Record one prompt (up to the run's limit) and stop the call that was about to send it. */
export function captureAndStop(entry: {
  label: string;
  model: string;
  systemPrompt?: string;
  userPrompt: string;
  options?: Record<string, unknown>;
}): never {
  const state = store.getStore();
  if (state && state.prompts.length < state.max) {
    const characters = (entry.systemPrompt || '').length + entry.userPrompt.length;
    state.prompts.push({
      label: entry.label,
      model: entry.model,
      systemPrompt: entry.systemPrompt || '',
      userPrompt: entry.userPrompt,
      options: entry.options || {},
      characters,
      approxTokens: Math.round(characters / 4),
    });
  }
  throw new PromptCaptured();
}

/**
 * Run `work` in capture mode and return the prompts it tried to send. An error other than the
 * capture's own stop is reported alongside, since it may mean the step never reached its call.
 */
export async function capturePrompts(
  work: () => Promise<unknown>,
  max = 6
): Promise<{ prompts: CapturedPrompt[]; error?: string }> {
  const state: CaptureState = { prompts: [], max };
  try {
    await store.run(state, work);
  } catch (error) {
    if (!(error instanceof PromptCaptured)) {
      return {
        prompts: state.prompts,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
  return { prompts: state.prompts };
}
