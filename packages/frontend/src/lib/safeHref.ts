/**
 * A stored address as a link target, only when it is a web address.
 *
 * Source, reading and resource URLs can be written through the API, and an href of
 * "javascript:..." runs script in this origin when clicked. The app-wide input filter catches
 * the plain spelling but not "java\tscript:", which browsers read the same way. Anything that is
 * not a clean http(s) address yields no link (the element still renders, just not as a link).
 */
export function safeHref(url: unknown): string | undefined {
  if (typeof url !== 'string') return undefined;
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return undefined;
  // Whitespace or control characters inside an address are never legitimate.
  for (const ch of trimmed) {
    const code = ch.charCodeAt(0);
    if (code <= 0x20 || code === 0x7f) return undefined;
  }
  try {
    const { protocol } = new URL(trimmed);
    return protocol === 'http:' || protocol === 'https:' ? trimmed : undefined;
  } catch {
    return undefined;
  }
}
