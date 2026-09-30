/**
 * Text that Word and PowerPoint files can hold.
 *
 * Office documents are XML, and XML 1.0 forbids most control characters (U+0000-U+0008,
 * U+000B, U+000C, U+000E-U+001F), U+FFFE/U+FFFF and unpaired surrogates. The docx and pptx
 * libraries write whatever they are given, so one such character in a lesson makes the whole
 * file invalid, and Word reports it as corrupt. The model does produce them: on 2026-09-30 one
 * BBA lesson held U+0014 where a dash was meant (in an Excel formula), which broke that
 * module's lesson-plan and faculty-guide downloads, and a Maths slide deck held 26 strings with
 * U+001E/U+001F where symbols were meant.
 *
 * Two layers use this: exports clean what they render, so a file is always valid whatever is
 * stored, and model output is cleaned as it arrives, so new content does not store them.
 *
 * Pure, no imports, so it can be tested.
 */

// Tab, line feed and carriage return are allowed; everything else below U+0020 is not.
// Matching control characters is the whole purpose of this pattern.
/* eslint-disable no-control-regex */
const INVALID_XML =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;
/* eslint-enable no-control-regex */

/** The text without characters XML 1.0 forbids. Returns the same string when there are none. */
export function stripXmlInvalid(text: string): string {
  INVALID_XML.lastIndex = 0;
  return INVALID_XML.test(text) ? text.replace(INVALID_XML, '') : text;
}

/**
 * JSON text without escape sequences that decode to forbidden control characters:
 * `\u0000`-`\u001F` except tab, line feed and carriage return, plus `\b` and `\f`. An escaped
 * backslash is left alone, so `\\u0014` (a literal backslash followed by "u0014") survives.
 * For JSON responses only: in plain text, `\f` may be part of a path.
 */
export function stripEscapedControls(json: string): string {
  return json.replace(
    /(?<!\\)((?:\\\\)*)\\(?:u00(?:0[0-8bcefBCEF]|1[0-9a-fA-F])|[bf])/g,
    (_match, backslashes: string) => backslashes
  );
}

/** Model output as it should be stored: forbidden characters removed, raw and, for JSON, escaped. */
export function cleanModelOutput(text: string, isJson: boolean): string {
  const raw = stripXmlInvalid(text);
  return isJson ? stripEscapedControls(raw) : raw;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> => {
  if (!v || typeof v !== 'object') return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
};

/**
 * A copy of `value` with every string made safe for XML, copying only what changes: a structure
 * with nothing to clean is returned as it is, so a large programme is not duplicated in memory
 * to export it. Mongoose documents are read through `toObject()`; dates, ids, buffers and other
 * class instances are left untouched.
 */
export function xmlSafeDeep<T>(value: T): T {
  const seen = new WeakMap<object, unknown>();
  const clean = (v: unknown): unknown => {
    if (typeof v === 'string') return stripXmlInvalid(v);
    if (!v || typeof v !== 'object') return v;
    if (seen.has(v)) return seen.get(v);
    const withToObject = v as { toObject?: () => unknown };
    if (typeof withToObject.toObject === 'function' && !isPlainObject(v)) {
      return clean(withToObject.toObject());
    }
    if (Array.isArray(v)) {
      seen.set(v, v);
      let copy: unknown[] | null = null;
      v.forEach((item, i) => {
        const next = clean(item);
        if (next !== item) {
          copy = copy || v.slice();
          copy[i] = next;
        }
      });
      const result = copy || v;
      seen.set(v, result);
      return result;
    }
    if (!isPlainObject(v)) return v;
    seen.set(v, v);
    let copy: Record<string, unknown> | null = null;
    for (const [key, item] of Object.entries(v)) {
      const next = clean(item);
      if (next !== item) {
        copy = copy || { ...v };
        copy[key] = next;
      }
    }
    const result = copy || v;
    seen.set(v, result);
    return result;
  };
  return clean(value) as T;
}
