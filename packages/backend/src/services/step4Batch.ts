/**
 * Matching a Step 4 detail batch's reply to the modules it was asked about.
 *
 * The reply was matched by exact code only. In the MAIB trial (20 Oct 2026) the first batch of
 * six modules came back but matched none of its codes, so all six were saved as empty shells:
 * no description, topics or outcomes. A reply is now read in whichever common shape it takes,
 * matched by code (normalised: "M1", "m01", "M-01" are M01), then by title, then by position,
 * and a module with no content is asked for again (workflowService) before a shell is kept.
 *
 * Pure, so it can be tested.
 */

/** The module list in a reply: { modules: [...] }, a bare array, or the first array inside. */
export function returnedModules(parsed: unknown): any[] {
  if (Array.isArray(parsed)) return parsed;
  if (!parsed || typeof parsed !== 'object') return [];
  const obj = parsed as Record<string, unknown>;
  if (Array.isArray(obj.modules)) return obj.modules;
  const firstArray = Object.values(obj).find(Array.isArray);
  return (firstArray as any[]) || [];
}

export function normaliseModuleCode(code: unknown): string {
  const text = String(code ?? '')
    .toUpperCase()
    .replace(/[\s_-]+/g, '');
  const m = /^([A-Z]+)(\d+)$/.exec(text);
  return m ? `${m[1]}${m[2].padStart(2, '0')}` : text;
}

const normTitle = (t: unknown) =>
  String(t ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Whether a reply entry holds the module's teaching content. */
export function hasContent(entry: any): boolean {
  return (
    !!entry &&
    ((Array.isArray(entry.topics) && entry.topics.length > 0) ||
      (Array.isArray(entry.mlos) && entry.mlos.length > 0))
  );
}

/** The reply entry for each asked module, by code, then title, then position. */
export function matchBatchContent(
  asked: { code: string; title: string }[],
  returned: any[]
): Map<string, any> {
  const out = new Map<string, any>();
  const used = new Set<number>();
  const take = (code: string, i: number) => {
    out.set(code, returned[i]);
    used.add(i);
  };
  for (const m of asked) {
    const i = returned.findIndex(
      (r, j) =>
        !used.has(j) &&
        normaliseModuleCode(r?.code ?? r?.moduleCode) === normaliseModuleCode(m.code)
    );
    if (i !== -1) take(m.code, i);
  }
  for (const m of asked) {
    if (out.has(m.code)) continue;
    const i = returned.findIndex(
      (r, j) => !used.has(j) && r?.title && normTitle(r.title) === normTitle(m.title)
    );
    if (i !== -1) take(m.code, i);
  }
  // Same number of entries as modules asked, in order: the remaining ones match by position.
  if (returned.length === asked.length) {
    asked.forEach((m, i) => {
      if (!out.has(m.code) && !used.has(i)) take(m.code, i);
    });
  }
  return out;
}
