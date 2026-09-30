/**
 * Running a document's model reflows several at a time.
 *
 * The Word export asks a model to reflow long passages into paragraphs or a list
 * (`wordExportService.formatTextIntelligently`), and each section awaited those calls one after
 * another. The BBA's whole-programme document made 225 of them in a row and took over 19 minutes
 * to download on production (2026-09-30).
 *
 * A section is therefore built in two passes. The first records the passages it will reflow and
 * renders them as written; if it recorded none, that build is the result, so a section with
 * nothing to reflow (Step 10's lessons, for one) is built once. Otherwise the passages are
 * reflowed together and the section is built again from the answers. At most
 * MAX_REFLOWS_IN_FLIGHT calls run at once across the whole process, so sections built side by
 * side and concurrent exports cannot flood the API.
 */
import { AsyncLocalStorage } from 'async_hooks';

export interface Reflowed {
  paragraphs: string[];
  bullets: string[];
}

interface Scope {
  recording: boolean;
  wanted: Map<string, { text: string; context: string }>;
  ready: Map<string, Promise<Reflowed>>;
}

const scopes = new AsyncLocalStorage<Scope>();

export const MAX_REFLOWS_IN_FLIGHT = 8;
let inFlight = 0;
const waiting: (() => void)[] = [];

/** Runs `call` once a slot is free. A released slot passes straight to the next caller waiting. */
export async function inReflowSlot<T>(call: () => Promise<T>): Promise<T> {
  if (inFlight < MAX_REFLOWS_IN_FLIGHT) inFlight++;
  else await new Promise<void>((resolve) => waiting.push(resolve));
  try {
    return await call();
  } finally {
    const next = waiting.shift();
    if (next) next();
    else inFlight--;
  }
}

const keyOf = (text: string, context: string) => `${context}\u0000${text}`;

/**
 * What the current pass does with a passage: the first pass records it and renders it as
 * written, the second returns the answer already fetched. Undefined outside a two-pass build, or
 * for a passage the first pass did not see; the caller then reflows it itself.
 */
export function reflowFromScope(
  text: string,
  context: string
): Reflowed | Promise<Reflowed> | undefined {
  const scope = scopes.getStore();
  if (!scope) return undefined;
  const key = keyOf(text, context);
  if (scope.recording) {
    scope.wanted.set(key, { text, context });
    return { paragraphs: [text], bullets: [] };
  }
  return scope.ready.get(key);
}

/**
 * `build`, with every passage it reflows fetched together first (see the module comment).
 * `reflow` is the model call itself; it should not throw, as a failed reflow falls back to the
 * text as written.
 */
export async function buildWithReflows<T>(
  build: () => Promise<T>,
  reflow: (text: string, context: string) => Promise<Reflowed>
): Promise<T> {
  // Already inside a build: its passages belong to that build's passes.
  if (scopes.getStore()) return build();
  const scope: Scope = { recording: true, wanted: new Map(), ready: new Map() };
  return scopes.run(scope, async () => {
    const first = await build();
    if (!scope.wanted.size) return first;
    scope.recording = false;
    for (const [key, { text, context }] of scope.wanted) {
      scope.ready.set(
        key,
        inReflowSlot(() => reflow(text, context))
      );
    }
    await Promise.all(scope.ready.values());
    return build();
  });
}
