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

/**
 * Makes the links in rendered document HTML safe to click. The in-app Word preview
 * (docx-preview) copies every hyperlink's target into an href as it is, so a "javascript:" link
 * inside an uploaded .docx ran script in this origin when clicked. Links within the document
 * ("#...", such as a table of contents) are kept; web links open in a new tab without access to
 * this window; anything else loses its link and stays as text.
 */
export function neutraliseLinks(container: ParentNode): void {
  container.querySelectorAll('a[href], area[href]').forEach((link) => {
    const href = link.getAttribute('href') || '';
    if (href.startsWith('#')) return;
    const target = safeHref(href);
    if (!target) {
      link.removeAttribute('href');
      return;
    }
    link.setAttribute('href', target);
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener noreferrer');
  });
}
