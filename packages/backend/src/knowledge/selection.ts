/**
 * Choosing which concepts fit a prompt's budget.
 *
 * The body of knowledge for a programme can run to thousands of concepts and a prompt holds a
 * few hundred. Sorting by area and cutting at the limit (the first version) kept the first
 * areas in the alphabet and dropped the rest. Concepts are taken in turn from each area, best
 * first (importance, then how many books teach them), so every area is represented and the
 * most important concepts of each come first.
 *
 * Pure, so it can be tested.
 */
const RANK: Record<string, number> = { core: 0, supporting: 1, advanced: 2, optional: 3 };

export interface Selectable {
  area: string;
  importance: string;
  bookCount?: number;
  name: string;
}

export function pickAcrossAreas<T extends Selectable>(concepts: T[], limit: number): T[] {
  const byArea = new Map<string, T[]>();
  for (const c of concepts) {
    if (!byArea.has(c.area)) byArea.set(c.area, []);
    byArea.get(c.area)!.push(c);
  }
  for (const list of byArea.values()) {
    list.sort(
      (a, b) =>
        (RANK[a.importance] ?? 4) - (RANK[b.importance] ?? 4) ||
        (b.bookCount || 0) - (a.bookCount || 0) ||
        a.name.localeCompare(b.name)
    );
  }
  const areas = Array.from(byArea.keys()).sort();
  const picked: T[] = [];
  for (let round = 0; picked.length < limit; round++) {
    let took = false;
    for (const area of areas) {
      const c = byArea.get(area)![round];
      if (!c) continue;
      picked.push(c);
      took = true;
      if (picked.length >= limit) break;
    }
    if (!took) break;
  }
  // Grouped by area for reading, best first within each.
  return picked.sort(
    (a, b) =>
      a.area.localeCompare(b.area) ||
      (RANK[a.importance] ?? 4) - (RANK[b.importance] ?? 4) ||
      (b.bookCount || 0) - (a.bookCount || 0)
  );
}
