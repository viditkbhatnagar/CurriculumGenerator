/**
 * One place to work out what a module is called.
 *
 * Step 4 is stored as free-form data and the field that holds a module's code depends on
 * where the module came from: the frontend writes `code`, the model interface declares
 * `moduleCode`, and imported modules have neither. Measured across every stored
 * curriculum: 374 of 382 modules have `code`, 54 have `moduleCode`, 8 have neither.
 *
 * Reading only `moduleCode` therefore fails for the overwhelming majority, and it fails
 * silently into a string — which is how per-module PowerPoint downloads came to be named
 * "undefined_Foundations.pptx", how every deck's embedded title read "undefined - <title>",
 * how the SCORM manifest handed the LMS "undefined: <title>" for every module, and how the
 * Step 10 approval gate — whose entire job is to name the modules missing lessons —
 * produced the message "Some modules have no lessons generated: , , , , , , , ,".
 */

export interface ModuleLike {
  id?: string;
  code?: string;
  moduleCode?: string;
  title?: string;
  moduleTitle?: string;
  moduleId?: string;
}

/** The module's code, checking both field names. Empty string when it genuinely has none. */
export function moduleCodeOf(module: ModuleLike | null | undefined): string {
  if (!module) return '';
  return String(module.code || module.moduleCode || '').trim();
}

/** The module's title, checking both field names. */
export function moduleTitleOf(module: ModuleLike | null | undefined): string {
  if (!module) return '';
  return String(module.title || module.moduleTitle || '').trim();
}

/**
 * A label a person recognises: "M35: Strategic Human Resource Management".
 *
 * Joins only the parts that exist, so a module with no code does not render a dangling
 * separator and a module with no title does not render a bare colon. Falls back to the
 * document id, which is at least unambiguous, and never to a positional index — a
 * manufactured "M1" collides with the real code namespace and is worse than no code at all.
 */
export function moduleLabelOf(module: ModuleLike | null | undefined): string {
  const code = moduleCodeOf(module);
  const title = moduleTitleOf(module);
  const label = [code, title].filter(Boolean).join(': ');
  return label || String(module?.id || module?.moduleId || 'Unidentified module');
}

/** Filename-safe form of {@link moduleLabelOf}, for downloads. */
export function moduleFileSlugOf(module: ModuleLike | null | undefined): string {
  const slug = moduleLabelOf(module)
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return slug || 'module';
}
