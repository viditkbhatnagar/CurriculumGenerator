/**
 * An assessment's programme-outcome alignment, derived rather than asserted.
 *
 * The model was asked to name the PLOs each assessment serves, and it obliged — including
 * for programme outcomes the module is not mapped to. Measured across one 46-module
 * curriculum: 141 of 199 PLO citations (71%) named a PLO absent from the module's own
 * linkedPLOs, and ten assessments cited identifiers that do not exist in the programme at
 * all (forms like "BBA-PLO-EthicsGovernance"). The built-in validator reported
 * plosCovered: true throughout, because it only checked that citations existed.
 *
 * The curriculum already states the answer: Step 4 records which PLOs each module serves,
 * and each MLO records the PLOs it contributes to. An assessment serves exactly the PLOs of
 * the outcomes it assesses, so this is a lookup, not a judgement — and a lookup cannot
 * invent a mapping the curriculum does not contain.
 */

export interface AlignableAssessment {
  moduleId?: string;
  alignedMLOs?: string[];
  alignedPLOs?: string[];
}

export interface ModuleWithOutcomes {
  id?: string;
  linkedPLOs?: string[];
  mlos?: { id?: string; linkedPLOs?: string[]; alignedPLOs?: string[] }[];
}

/**
 * The PLOs an assessment genuinely serves: the union of those recorded against the module
 * outcomes it assesses, restricted to PLOs the module is mapped to and that exist in the
 * programme.
 *
 * Falls back to the module's own PLO list when its outcomes carry no mapping — that is
 * weaker but still true, whereas the model's guess was neither.
 */
export function derivePloAlignment(
  assessment: AlignableAssessment,
  module: ModuleWithOutcomes | undefined,
  programmePloIds: Set<string>
): string[] {
  if (!module) return [];

  const modulePlos = (module.linkedPLOs || []).filter((id) => programmePloIds.has(id));
  const targeted = new Set(assessment.alignedMLOs || []);

  const fromOutcomes = new Set<string>();
  for (const mlo of module.mlos || []) {
    if (!mlo?.id || !targeted.has(mlo.id)) continue;
    for (const plo of mlo.linkedPLOs || mlo.alignedPLOs || []) {
      if (programmePloIds.has(plo)) fromOutcomes.add(plo);
    }
  }

  const derived = [...fromOutcomes].filter(
    // A module's own PLO list is authoritative; an outcome claiming more than its module
    // does is itself a Step 4 inconsistency and should not be propagated here.
    (plo) => modulePlos.length === 0 || modulePlos.includes(plo)
  );

  return derived.length > 0 ? derived.sort() : modulePlos.slice().sort();
}
