/**
 * What kind of programme this is, at what level, and under which credit system: told to
 * the model the same way at every step.
 *
 * Rejin's audit of 17 October 2026 found every prompt calling the programme a "vocational
 * education program", several calling it "accredited", and the level reaching the model as a
 * bare label. The label was worse than he could see from the prompts: the setup form offers
 * only "certificate", "micro-credential" and "diploma", so the 180-ECTS BBA and both MBAs
 * reached every step as "ACADEMIC LEVEL: diploma … vocational education program".
 *
 * The type and level now come from, in order: fields the institution states (qualificationType,
 * frameworkLevel, governingFramework); the programme title ("Master of …", "Bachelor in …",
 * "PG Diploma …", "Level 6"); and only then the form's level field. Where the level comes from
 * is stated in the prompt, and the level descriptor is the EQF reference text rather than the
 * model's memory of what a level means. No programme is described as accredited or approved.
 *
 * Pure, so it can be tested.
 */

export type QualificationType =
  | 'micro-credential'
  | 'certificate'
  | 'diploma'
  | 'higher-diploma'
  | 'bachelor'
  | 'postgraduate-certificate'
  | 'postgraduate-diploma'
  | 'master'
  | 'doctorate';

export type FramingBasis = 'stated by the institution' | 'programme title' | 'setup form';

export interface ProgrammeFraming {
  type: QualificationType;
  /** "bachelor's degree", "postgraduate diploma" */
  typeLabel: string;
  /** Article and noun for a sentence: "a bachelor's degree programme". */
  phrase: string;
  /** EQF-referenced level 1–8, or null when nothing states one. */
  level: number | null;
  basis: FramingBasis;
  levelBasis: FramingBasis | null;
  creditSystem: string;
  /** The governing qualifications framework, when the institution has recorded one. */
  governingFramework: string | null;
}

const TYPE_LABELS: Record<QualificationType, string> = {
  'micro-credential': 'micro-credential',
  certificate: 'certificate',
  diploma: 'diploma',
  'higher-diploma': 'higher diploma',
  bachelor: "bachelor's degree",
  'postgraduate-certificate': 'postgraduate certificate',
  'postgraduate-diploma': 'postgraduate diploma',
  master: "master's degree",
  doctorate: 'doctorate',
};

/** The level a qualification type sits at when its name alone settles it. */
const TYPE_LEVELS: Partial<Record<QualificationType, number>> = {
  'higher-diploma': 5,
  bachelor: 6,
  'postgraduate-certificate': 7,
  'postgraduate-diploma': 7,
  master: 7,
  doctorate: 8,
};

/** Most specific first: "Postgraduate Diploma" must not be read as "Diploma". */
const TITLE_TYPES: Array<[RegExp, QualificationType]> = [
  [/\b(doctor of|doctorate|ph\.?d|d\.?b\.?a)\b/, 'doctorate'],
  [/\b(master of|master's|masters (in|of)|mba|m\.?sc|m\.?res|ll\.?m)\b/, 'master'],
  [/\b(post\s*-?\s*graduate|pg)\s+diploma\b/, 'postgraduate-diploma'],
  [/\b(post\s*-?\s*graduate|pg)\s+cert(ificate)?\b/, 'postgraduate-certificate'],
  [/\b(bachelor|bba|b\.?sc|b\.?a\.? \(hons\)|honours degree|undergraduate degree)\b/, 'bachelor'],
  [/\b(higher national|hnd|foundation degree|advanced diploma)\b/, 'higher-diploma'],
];

const FORM_TYPES: Record<string, QualificationType> = {
  'micro-credential': 'micro-credential',
  certificate: 'certificate',
  diploma: 'diploma',
};

const CREDIT_SYSTEMS: Record<string, string> = {
  ects: 'ECTS',
  uk_credits: 'UK credits',
  us_semester: 'US semester credit hours',
  non_credit: 'not credit-rated',
};

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function isQualificationType(value: unknown): value is QualificationType {
  return typeof value === 'string' && value in TYPE_LABELS;
}

function levelFrom(value: unknown): number | null {
  const match = /\b(?:level\s*|eqf\s*|rqf\s*|mqf\s*)?([1-8])\b/i.exec(String(value ?? ''));
  return match ? Number(match[1]) : null;
}

export function programmeFraming(step1: unknown): ProgrammeFraming {
  const s = (step1 && typeof step1 === 'object' ? step1 : {}) as Record<string, any>;
  const title = text(s.programTitle).toLowerCase().replace(/\s+/g, ' ');
  const credit = s.creditFramework || {};
  const creditKey = text(credit.system || credit.creditSystem || s.creditSystem);

  let type: QualificationType;
  let basis: FramingBasis;
  const titleType = TITLE_TYPES.find(([pattern]) => pattern.test(title))?.[1];
  if (isQualificationType(s.qualificationType)) {
    type = s.qualificationType;
    basis = 'stated by the institution';
  } else if (titleType) {
    type = titleType;
    basis = 'programme title';
  } else {
    type = FORM_TYPES[text(s.academicLevel)] || 'certificate';
    basis = 'setup form';
  }

  let level: number | null = null;
  let levelBasis: FramingBasis | null = null;
  const statedLevel = s.frameworkLevel != null ? levelFrom(s.frameworkLevel) : null;
  const titleLevel = /\blevel\s*[1-8]\b/.test(title) ? levelFrom(title) : null;
  if (statedLevel) {
    level = statedLevel;
    levelBasis = 'stated by the institution';
  } else if (titleLevel) {
    level = titleLevel;
    levelBasis = 'programme title';
  } else if (TYPE_LEVELS[type]) {
    level = TYPE_LEVELS[type] as number;
    levelBasis = basis;
  }

  const typeLabel = TYPE_LABELS[type];
  return {
    type,
    typeLabel,
    phrase: `${/^[aeiou]/.test(typeLabel) ? 'an' : 'a'} ${typeLabel} programme`,
    level,
    basis,
    levelBasis,
    creditSystem: CREDIT_SYSTEMS[creditKey] || 'not recorded',
    governingFramework: text(s.governingFramework) || null,
  };
}

/**
 * The EQF level descriptors, verbatim: Council Recommendation of 22 May 2017 on the European
 * Qualifications Framework for lifelong learning (2017/C 189/03), Annex II. They are a
 * reference, used because no programme records its own framework's descriptors yet.
 */
export const EQF_DESCRIPTORS: Record<
  number,
  { knowledge: string; skills: string; responsibility: string }
> = {
  1: {
    knowledge: 'Basic general knowledge',
    skills: 'Basic skills required to carry out simple tasks',
    responsibility: 'Work or study under direct supervision in a structured context',
  },
  2: {
    knowledge: 'Basic factual knowledge of a field of work or study',
    skills:
      'Basic cognitive and practical skills required to use relevant information in order to carry out tasks and to solve routine problems using simple rules and tools',
    responsibility: 'Work or study under supervision with some autonomy',
  },
  3: {
    knowledge:
      'Knowledge of facts, principles, processes and general concepts, in a field of work or study',
    skills:
      'A range of cognitive and practical skills required to accomplish tasks and solve problems by selecting and applying basic methods, tools, materials and information',
    responsibility:
      'Take responsibility for completion of tasks in work or study; adapt own behaviour to circumstances in solving problems',
  },
  4: {
    knowledge:
      'Factual and theoretical knowledge in broad contexts within a field of work or study',
    skills:
      'A range of cognitive and practical skills required to generate solutions to specific problems in a field of work or study',
    responsibility:
      'Exercise self-management within the guidelines of work or study contexts that are usually predictable, but are subject to change; supervise the routine work of others, taking some responsibility for the evaluation and improvement of work or study activities',
  },
  5: {
    knowledge:
      'Comprehensive, specialised, factual and theoretical knowledge within a field of work or study and an awareness of the boundaries of that knowledge',
    skills:
      'A comprehensive range of cognitive and practical skills required to develop creative solutions to abstract problems',
    responsibility:
      'Exercise management and supervision in contexts of work or study activities where there is unpredictable change; review and develop performance of self and others',
  },
  6: {
    knowledge:
      'Advanced knowledge of a field of work or study, involving a critical understanding of theories and principles',
    skills:
      'Advanced skills, demonstrating mastery and innovation, required to solve complex and unpredictable problems in a specialised field of work or study',
    responsibility:
      'Manage complex technical or professional activities or projects, taking responsibility for decision-making in unpredictable work or study contexts; take responsibility for managing professional development of individuals and groups',
  },
  7: {
    knowledge:
      'Highly specialised knowledge, some of which is at the forefront of knowledge in a field of work or study, as the basis for original thinking and/or research; critical awareness of knowledge issues in a field and at the interface between different fields',
    skills:
      'Specialised problem-solving skills required in research and/or innovation in order to develop new knowledge and procedures and to integrate knowledge from different fields',
    responsibility:
      'Manage and transform work or study contexts that are complex, unpredictable and require new strategic approaches; take responsibility for contributing to professional knowledge and practice and/or for reviewing the strategic performance of teams',
  },
  8: {
    knowledge:
      'Knowledge at the most advanced frontier of a field of work or study and at the interface between fields',
    skills:
      'The most advanced and specialised skills and techniques, including synthesis and evaluation, required to solve critical problems in research and/or innovation and to extend and redefine existing knowledge or professional practice',
    responsibility:
      'Demonstrate substantial authority, innovation, autonomy, scholarly and professional integrity and sustained commitment to the development of new ideas or processes at the forefront of work or study contexts including research',
  },
};

/** The status every prompt states, so no step can describe the programme as accredited. */
export const PROGRAMME_STATUS =
  'This programme is being designed for institutional and regulatory approval. It is not accredited, approved or recognised by any body. Do not describe it as accredited, approved, recognised or endorsed, and do not name accrediting or awarding bodies, partners or endorsements: none have been supplied.';

/**
 * The block each step's prompt carries in place of "ACADEMIC LEVEL: diploma … vocational
 * education program": type, level and where each came from, the level descriptor, and status.
 */
export function programmeContextBlock(framing: ProgrammeFraming): string {
  const lines = [
    '=== PROGRAMME TYPE AND LEVEL ===',
    `Qualification type: ${framing.typeLabel} (from the ${framing.basis})`,
    `Credit system: ${framing.creditSystem}`,
    `Governing qualifications framework: ${framing.governingFramework || 'not recorded by the institution'}`,
  ];
  const descriptor = framing.level ? EQF_DESCRIPTORS[framing.level] : undefined;
  if (framing.level && descriptor) {
    lines.push(
      `Level: EQF level ${framing.level} (from the ${framing.levelBasis})`,
      '',
      `Level descriptor (EQF level ${framing.level}, Council Recommendation 2017/C 189/03, Annex II; a reference descriptor, used because the institution has not supplied its own framework's):`,
      `- Knowledge: ${descriptor.knowledge}`,
      `- Skills: ${descriptor.skills}`,
      `- Responsibility and autonomy: ${descriptor.responsibility}`,
      'Pitch the depth of knowledge, the complexity and uncertainty of problems, and the autonomy and responsibility expected of learners to this descriptor.'
    );
  } else {
    lines.push(
      'Level: not recorded. No level descriptor can be supplied. Do not state a level, and pitch the content to the qualification type and credit volume above.'
    );
  }
  lines.push('', `Status: ${PROGRAMME_STATUS}`);
  return lines.join('\n');
}
