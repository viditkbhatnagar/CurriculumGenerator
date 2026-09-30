/**
 * The faculty inputs a request may store on a draft, cleaned the same way on every route.
 *
 * Creating a draft coerced each input with `String(inputs.x || '')`; regenerating merged the
 * request body straight into the stored document. A regenerate could therefore store keys the
 * engine never reads, objects that reach the prompt as "[object Object]", or megabytes of text
 * (the JSON body limit is 10 MB). One function now serves both routes, so they cannot drift.
 *
 * Pure, no I/O.
 */
import { FacultyInputs } from './outlinePrompt';

/**
 * The longest any one input may be. Emphasis, learners, tools and context are a line or two and
 * notes a few paragraphs, so 4,000 characters is far past real use and well inside the prompt.
 */
export const MAX_FACULTY_INPUT_LENGTH = 4000;

const own = (source: unknown, key: string): unknown =>
  typeof source === 'object' && source !== null && Object.prototype.hasOwnProperty.call(source, key)
    ? (source as Record<string, unknown>)[key]
    : undefined;

/**
 * The five inputs, each a trimmed string of at most MAX_FACULTY_INPUT_LENGTH characters.
 *
 * A key the request sends as a string replaces the stored value (an empty string clears it). A
 * key it omits, or sends as anything but a string, keeps the stored value, and an input that was
 * never stored is an empty string. Keys the engine does not read are dropped. `stored` is cleaned
 * by the same rules, so documents written before they existed come out clean too, and neither
 * argument is changed.
 */
export function facultyInputsFrom(request: unknown, stored: unknown = {}): Required<FacultyInputs> {
  const pick = (key: string): string => {
    const sent = own(request, key);
    const kept = own(stored, key);
    const value = typeof sent === 'string' ? sent : typeof kept === 'string' ? kept : '';
    return value.trim().slice(0, MAX_FACULTY_INPUT_LENGTH);
  };
  return {
    emphasis: pick('emphasis'),
    learners: pick('learners'),
    tools: pick('tools'),
    context: pick('context'),
    notes: pick('notes'),
  };
}
