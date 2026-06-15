// Module-by-module step arrays (step10 lesson plans, step11 PPT decks, step12
// assignment packs) are stored in GENERATION order. A module generated later —
// e.g. a re-generated MOD103 — therefore lands last and would render after
// MOD108. These helpers present such arrays in Step 4 module order instead.
// Ordering is display-only: selection/downloads key off moduleId, so reordering
// the view can never misroute them.

interface ModuleLike {
  id?: string;
  code?: string;
}

interface PlanLike {
  moduleId?: string;
  moduleCode?: string;
}

/**
 * Return a new array ordered by each entry's position in Step 4. Matches by
 * moduleId first, then module code; entries that match no Step 4 module keep
 * their relative order at the end.
 */
export function orderByStep4<T extends PlanLike>(
  items: T[] | undefined,
  modules: ModuleLike[] | undefined
): T[] {
  const list = items || [];
  if (list.length < 2 || !modules?.length) return [...list];

  const order = new Map<string, number>();
  modules.forEach((m, i) => {
    if (m?.id) order.set(`id:${m.id}`, i);
    if (m?.code) order.set(`code:${m.code}`, i);
  });

  const rank = (p: PlanLike): number => {
    const byId = p?.moduleId != null ? order.get(`id:${p.moduleId}`) : undefined;
    if (byId !== undefined) return byId;
    const byCode = p?.moduleCode != null ? order.get(`code:${p.moduleCode}`) : undefined;
    return byCode !== undefined ? byCode : Number.MAX_SAFE_INTEGER;
  };

  return [...list]
    .map((p, i) => ({ p, r: rank(p), i }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.p);
}
