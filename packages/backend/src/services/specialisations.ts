/**
 * A programme's specialisations (elective tracks), and its export cut down to one of them.
 *
 * The BBA holds five 24-ECTS specialisations as elective modules M27-M46, each group headed
 * "Year 3 – Level 6 › Specialization : <name>" (Dr Sherin Thomas's structure). A student takes
 * every core module and one specialisation, so each pathway is a complete curriculum of its own.
 * Logan Pacey and Dr Sherin asked (24 November 2026) how to produce those without duplicating the
 * core five times: the export now takes one specialisation and leaves the other tracks' modules
 * out of every step, from the same programme.
 *
 * Pure, so it can be tested.
 */

export interface Specialisation {
  /** Stable, URL-safe id from the group heading. */
  id: string;
  /** "Finance and FinTech". */
  name: string;
  /** The heading as the programme structure gave it. */
  group: string;
  moduleIds: string[];
  moduleCodes: string[];
  credits: number;
}

interface ModuleLike {
  id?: string;
  code?: string;
  moduleCode?: string;
  group?: string;
  isElective?: boolean;
  credits?: number;
  totalHours?: number;
  contactHours?: number;
  independentHours?: number;
  selfStudyHours?: number;
}

/** "Year 3 – Level 6 › Specialization : Finance and FinTech" → "Finance and FinTech". */
export function specialisationName(group: string): string {
  const last = group.split('›').pop() || group;
  return last
    .replace(/^\s*(speciali[sz]ation|pathway|track|elective|option)s?\s*[:\-–]\s*/i, '')
    .trim();
}

export function slug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, ' ')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .slice(0, 60);
}

const modulesOf = (step4: any): ModuleLike[] =>
  Array.isArray(step4?.modules) ? (step4.modules as ModuleLike[]) : [];

/** Every elective track, in the order its first module appears. */
export function specialisationsOf(step4: any): Specialisation[] {
  const byGroup = new Map<string, Specialisation>();
  for (const m of modulesOf(step4)) {
    if (!m.isElective || !m.group || !m.id) continue;
    let s = byGroup.get(m.group);
    if (!s) {
      const name = specialisationName(m.group);
      s = { id: slug(name), name, group: m.group, moduleIds: [], moduleCodes: [], credits: 0 };
      byGroup.set(m.group, s);
    }
    s.moduleIds.push(m.id);
    const code = m.code || m.moduleCode;
    if (code) s.moduleCodes.push(code);
    s.credits += Number(m.credits) || 0;
  }
  return [...byGroup.values()];
}

export function findSpecialisation(step4: any, id: unknown): Specialisation | null {
  if (typeof id !== 'string' || !id) return null;
  return specialisationsOf(step4).find((s) => s.id === id) || null;
}

/** Drops whatever belongs to the excluded modules, at any depth. */
function without(value: any, ids: Set<string>, codes: Set<string>): any {
  if (Array.isArray(value)) {
    return value
      .filter((item) => {
        if (typeof item === 'string') return !ids.has(item);
        if (!item || typeof item !== 'object') return true;
        const owner = item.moduleId ?? item.module_id ?? item.id;
        if (typeof owner === 'string' && ids.has(owner)) return false;
        const code = item.moduleCode ?? (item.title !== undefined ? item.code : undefined);
        return !(typeof code === 'string' && codes.has(code));
      })
      .map((item) => without(item, ids, codes));
  }
  if (!value || typeof value !== 'object' || value instanceof Date) return value;
  const plain = typeof value.toObject === 'function' ? value.toObject() : value;
  const out: Record<string, any> = {};
  for (const [key, v] of Object.entries(plain)) {
    // Maps keyed by module id or code (step5.sourcesByModule).
    if (ids.has(key) || codes.has(key)) continue;
    out[key] = without(v, ids, codes);
  }
  return out;
}

const sum = (modules: ModuleLike[], key: keyof ModuleLike) =>
  modules.reduce((n, m) => n + (Number(m[key]) || 0), 0);

const MODULE_STEPS = [
  'step4',
  'step5',
  'step6',
  'step7',
  'step8',
  'step9',
  'step10',
  'step11',
  'step12',
  'step13',
  'step14',
  'kbEvidence',
] as const;

/**
 * The export data for one pathway: the core modules and this specialisation's modules, with the
 * other tracks' modules removed from every step. Programme-level content (Steps 1-3, the
 * glossary, the summative exam's own text) is unchanged.
 */
export function forSpecialisation<T extends Record<string, any>>(
  data: T,
  spec: Specialisation
): T & { specialisation: { name: string; group: string; credits: number; coreCredits: number } } {
  const all = modulesOf(data.step4);
  const keep = new Set(spec.moduleIds);
  const excluded = all.filter((m) => m.isElective && m.id && !keep.has(m.id));
  const ids = new Set(excluded.map((m) => m.id as string));
  const codes = new Set(
    excluded.map((m) => m.code || m.moduleCode).filter((c): c is string => !!c)
  );

  const out: Record<string, any> = { ...data };
  for (const key of MODULE_STEPS) {
    if (out[key]) out[key] = without(out[key], ids, codes);
  }

  // Step 4's totals are recomputed for the modules this student takes.
  const modules = modulesOf(out.step4);
  if (out.step4) {
    out.step4 = {
      ...out.step4,
      moduleCount: modules.length,
      totalProgramHours: sum(modules, 'totalHours'),
      totalContactHours: sum(modules, 'contactHours'),
      totalIndependentHours: sum(modules, 'independentHours') || sum(modules, 'selfStudyHours'),
    };
  }
  const coreCredits = sum(
    modules.filter((m) => !m.isElective),
    'credits'
  );
  return {
    ...(out as T),
    projectName: `${data.projectName || 'Programme'} – ${spec.name}`,
    specialisation: { name: spec.name, group: spec.group, credits: spec.credits, coreCredits },
  };
}
