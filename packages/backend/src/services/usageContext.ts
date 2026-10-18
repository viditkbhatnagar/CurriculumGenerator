import { AsyncLocalStorage } from 'async_hooks';

/**
 * Which programme and step an AI call was made for, so the cost log can say what each step
 * costs. Without it the log held only a timestamp, and the cost of a step could be guessed
 * only from which run happened to be going at that hour.
 *
 * Set once where a step's work starts (the queue processors and background runners); every
 * AI call made anywhere beneath that point reads it, however deep, without being passed it.
 */
export interface UsageContext {
  workflowId?: string;
  /** A step number, or a name for work outside the 13 steps ("faculty-guide"). */
  step?: number | string;
}

const store = new AsyncLocalStorage<UsageContext>();

export function withUsageContext<T>(context: UsageContext, work: () => Promise<T>): Promise<T> {
  return store.run(context, work);
}

export function currentUsageContext(): UsageContext | undefined {
  return store.getStore();
}
