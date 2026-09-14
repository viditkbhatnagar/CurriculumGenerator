/**
 * Measuring generated teaching content against the standards a reviewer actually applies.
 *
 * The programme's subject-matter expert read all 46 modules of lesson plans and reported four
 * recurring faults: content pitched above the module's academic level, the same few activities
 * (dashboards, compliance registers, communication plans) appearing in every subject, a
 * professional body's material cited outside its discipline, and UK-specific law in modules
 * with no reason to carry it.
 *
 * She was right on every count, and the counts were larger than her prose suggested — 5,151
 * dashboard mentions across the programme, 2,610 advanced-technique mentions, 1,986 CIPD
 * references. Finding that took her a full read of 46 documents. It should not have.
 *
 * These rules exist so the system measures its own output against those standards. Nothing here
 * asks a model to judge: each rule is a stated list checked in code, so a green flag means a
 * check ran rather than that nothing was looked at.
 *
 * Pure functions, no imports, no I/O — so they are testable, and so the thresholds can be argued
 * with and changed without touching generation.
 */

/** Academic level of a module. UK framework: 4 is first year, 6 is final year. */
export type AcademicLevel = 4 | 5 | 6;

export interface DriftModule {
  moduleCode?: string;
  moduleTitle?: string;
  /** Free text describing where the module sits, e.g. "Year 1 – Level 4". */
  group?: string;
  topics?: string[];
}

export interface DriftFinding {
  rule: 'level' | 'discipline' | 'jurisdiction' | 'overlap' | 'dominance' | 'tail';
  moduleCode: string;
  /** What was found, in the reviewer's terms. */
  detail: string;
  /** How many times, so a passing mention is not treated like a dominant theme. */
  count: number;
  severity: 'high' | 'medium';
}

/**
 * The academic level a module is taught at, read from the Step 4 grouping.
 *
 * Step 4 records this as "Year 1 – Level 4" and similar. It is the only place the level exists,
 * and until now it was dropped before the generator ever saw it — which is why a first-year
 * mathematics module was written with t-tests, MIRR, EAA and bond pricing.
 */
export function levelOf(module: DriftModule): AcademicLevel | null {
  const text = String(module?.group || '');
  const level = text.match(/level\s*([456])/i);
  if (level) return Number(level[1]) as AcademicLevel;
  const year = text.match(/year\s*([123])/i);
  if (year) return (Number(year[1]) + 3) as AcademicLevel;
  return null;
}

/**
 * Techniques that need the grounding of a particular level before they can be taught.
 *
 * The floor is the EARLIEST level at which a technique is reasonable, so a Level 6 module may
 * teach anything and a Level 4 module is held to Level 4 material. The reviewer named most of
 * these directly: "t-tests, NPV/IRR, MIRR, EAA and bond pricing" in a foundation module, and
 * "DiD, Bayesian testing, CUPED, stepped-wedge" in a marketing one.
 */
export const TECHNIQUE_LEVEL_FLOOR: { pattern: RegExp; name: string; floor: AcademicLevel }[] = [
  { pattern: /\bMIRR\b/i, name: 'MIRR', floor: 6 },
  { pattern: /\bAPV\b|adjusted present value/i, name: 'adjusted present value', floor: 6 },
  { pattern: /\breal options?\b/i, name: 'real options', floor: 6 },
  { pattern: /\bEAA\b|equivalent annual annuity/i, name: 'equivalent annual annuity', floor: 6 },
  { pattern: /monte[- ]carlo/i, name: 'Monte Carlo simulation', floor: 6 },
  { pattern: /\bCUPED\b/i, name: 'CUPED', floor: 6 },
  {
    pattern: /difference[- ]in[- ]differences|\bDiD\b/i,
    name: 'difference-in-differences',
    floor: 6,
  },
  { pattern: /stepped[- ]wedge/i, name: 'stepped-wedge design', floor: 6 },
  { pattern: /bayesian/i, name: 'Bayesian methods', floor: 6 },
  { pattern: /propensity score/i, name: 'propensity score matching', floor: 6 },
  { pattern: /\bk-means\b|clustering algorithm/i, name: 'clustering algorithms', floor: 6 },
  { pattern: /\bRFM\b/i, name: 'RFM segmentation', floor: 5 },
  { pattern: /account[- ]based marketing|\bABM\b/i, name: 'account-based marketing', floor: 5 },
  { pattern: /\bt-test\b|hypothesis test/i, name: 'hypothesis testing', floor: 5 },
  { pattern: /\bIRR\b|internal rate of return/i, name: 'internal rate of return', floor: 5 },
  { pattern: /\bECL\b|expected credit loss/i, name: 'expected credit loss', floor: 5 },
  { pattern: /du ?pont/i, name: 'DuPont analysis', floor: 5 },
  { pattern: /\bSCOR\b/i, name: 'SCOR model', floor: 5 },
  { pattern: /bond pricing|yield to maturity/i, name: 'bond pricing', floor: 5 },
];

/**
 * Professional bodies, and the subjects their material belongs to.
 *
 * The reviewer's instruction: "CIPD remains mainly within HR, people, leadership and
 * change-related modules, while Economics, Marketing, Research Methods, Finance, Digital
 * Business and other specialist areas use more appropriate academic, professional or regulatory
 * sources."
 */
export const PROFESSIONAL_BODIES: { name: string; pattern: RegExp; disciplines: RegExp }[] = [
  {
    name: 'CIPD',
    pattern: /\bCIPD\b/i,
    disciplines:
      /human resource|people|talent|workforce|employee|leadership|change|transformation|organisation(al)? behaviour|reward|recruit/i,
  },
];

/**
 * Jurisdiction-specific law, which belongs only where the subject genuinely requires it.
 *
 * Same standard the reviewer applied to Steps 7 and 8: "jurisdiction-specific references such as
 * UK GDPR, UK Bribery Act or UK employment law should only be used where the lesson context
 * genuinely requires them." A module whose own topics name the statute is entitled to it.
 */
export const JURISDICTION_MARKERS: { name: string; pattern: RegExp }[] = [
  { name: 'UK GDPR', pattern: /\bUK GDPR\b/i },
  { name: 'Bribery Act', pattern: /\bBribery Act\b/i },
  { name: 'Equality Act 2010', pattern: /\bEquality Act 2010\b/i },
  { name: 'Companies Act 2006', pattern: /\bCompanies Act 2006\b/i },
  { name: 'the FCA', pattern: /\bFCA\b/i },
  { name: 'HMRC', pattern: /\bHMRC\b/i },
  { name: 'the ICO', pattern: /\bICO\b/i },
  { name: 'DPIA/ROPA/DSAR', pattern: /\b(DPIA|ROPA|DSAR)\b/i },
];

/**
 * Activities that belong to a subject rather than to every subject.
 *
 * A module whose own topics cover the thing is entitled to teach it; every other module is not.
 * This is what stopped 5,151 dashboard mentions being spread across a whole degree, including
 * 397 in Strategic Management and 368 in Digital Business.
 */
export const OWNED_ACTIVITIES: { name: string; pattern: RegExp; ownerTopics: RegExp }[] = [
  {
    name: 'dashboard and BI tooling',
    pattern: /\b(dashboard|power ?bi|tableau|looker)\b/i,
    ownerTopics: /business intelligence|data visuali[sz]ation|analytics|dashboard|reporting/i,
  },
  {
    name: 'data-protection operations',
    pattern: /\b(DPIA|ROPA|DSAR)\b/i,
    ownerTopics: /data protection|privacy|governance|compliance|ethics|legal/i,
  },
];

/** How many mentions before a passing reference counts as a theme. */
const THEME_THRESHOLD = 25;
/** Above this, the activity dominates the module rather than appearing in it. */
const DOMINANT_THRESHOLD = 120;

const countMatches = (text: string, pattern: RegExp): number =>
  (
    text.match(
      new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g')
    ) || []
  ).length;

/** The module's own subject matter, as one searchable string. */
function subjectOf(module: DriftModule): string {
  return [module?.moduleTitle, ...(module?.topics || [])].filter(Boolean).join(' ');
}

/**
 * Everything wrong with one module's teaching content, measured.
 *
 * `lessonText` is the module's lesson plans serialised — the same text a reader would see.
 */
export function auditModule(module: DriftModule, lessonText: string): DriftFinding[] {
  const findings: DriftFinding[] = [];
  const code = module?.moduleCode || 'unknown';
  const subject = subjectOf(module);
  const level = levelOf(module);

  if (level !== null) {
    for (const technique of TECHNIQUE_LEVEL_FLOOR) {
      if (technique.floor <= level) continue;
      const count = countMatches(lessonText, technique.pattern);
      if (count === 0) continue;
      // A module whose own topics name the technique is teaching it deliberately.
      if (technique.pattern.test(subject)) continue;
      findings.push({
        rule: 'level',
        moduleCode: code,
        detail: `${technique.name} needs Level ${technique.floor}; this module is Level ${level}`,
        count,
        severity: count >= THEME_THRESHOLD ? 'high' : 'medium',
      });
    }
  }

  for (const body of PROFESSIONAL_BODIES) {
    const count = countMatches(lessonText, body.pattern);
    if (count === 0 || body.disciplines.test(subject)) continue;
    findings.push({
      rule: 'discipline',
      moduleCode: code,
      detail: `${body.name} is cited outside its discipline`,
      count,
      severity: count >= THEME_THRESHOLD ? 'high' : 'medium',
    });
  }

  for (const marker of JURISDICTION_MARKERS) {
    const count = countMatches(lessonText, marker.pattern);
    if (count === 0 || marker.pattern.test(subject)) continue;
    findings.push({
      rule: 'jurisdiction',
      moduleCode: code,
      detail: `${marker.name} appears in a module whose topics do not call for it`,
      count,
      severity: count >= THEME_THRESHOLD ? 'high' : 'medium',
    });
  }

  for (const activity of OWNED_ACTIVITIES) {
    const count = countMatches(lessonText, activity.pattern);
    if (count < THEME_THRESHOLD || activity.ownerTopics.test(subject)) continue;
    findings.push({
      rule: 'overlap',
      moduleCode: code,
      detail: `${activity.name} is taught here but belongs to the modules that own it`,
      count,
      severity: count >= DOMINANT_THRESHOLD ? 'high' : 'medium',
    });
  }

  return findings;
}

/**
 * A theme the module is entitled to, but which has taken the module over.
 *
 * Two of the reviewer's complaints are about proportion rather than permission. Business Policy
 * genuinely lists the Bribery Act among its topics, and she still called it "too much UK Bribery
 * Act"; Consumer Behaviour is entitled to marketing analytics, and she still called it "too
 * statistically dominated". Presence was never the question — a module that lists a topic can
 * still be swallowed by it.
 */
const DOMINANCE_RATIO = 1.0;

/** Themes worth checking for dominance, beyond those a module has no claim to at all. */
const DOMINANCE_THEMES: { name: string; pattern: RegExp }[] = [
  {
    name: 'jurisdiction-specific law',
    pattern: /\b(UK GDPR|Bribery Act|Equality Act 2010|FCA|HMRC|ICO|DPIA|ROPA|DSAR)\b/i,
  },
  { name: 'dashboard and BI tooling', pattern: /\b(dashboard|power ?bi|tableau|looker)\b/i },
  {
    name: 'statistical technique',
    pattern:
      /\b(regression|t-test|p-value|confidence interval|Bayesian|clustering|significance)\b/i,
  },
  {
    name: 'stakeholder communication planning',
    pattern: /\b(communication plan|stakeholder map|stakeholder matrix|RACI)\b/i,
  },
];

/** How strongly the module's own subject vocabulary shows up in a stretch of text. */
function subjectDensity(subject: string, text: string): number {
  const words = subject
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length > 4);
  if (words.length === 0) return 0;
  const unique = [...new Set(words)];
  return unique.reduce((sum, w) => sum + countMatches(text, new RegExp(w, 'i')), 0);
}

/**
 * Whether a theme overwhelms the module's own subject, and whether it takes over the later
 * lessons in particular.
 *
 * The reviewer described this defect by position almost every time — "the second half contains
 * too much Power BI/dashboard work", "too many later lessons focus on stakeholder communication
 * rather than project control", "later dashboard-heavy lessons". So the tail is compared with
 * the opening on its own terms, rather than the module being judged as one average.
 */
export function auditProportion(module: DriftModule, lessons: unknown[]): DriftFinding[] {
  const findings: DriftFinding[] = [];
  const code = module?.moduleCode || 'unknown';
  const subject = subjectOf(module);
  if (!Array.isArray(lessons) || lessons.length < 4) return findings;

  const half = Math.floor(lessons.length / 2);
  const firstText = JSON.stringify(lessons.slice(0, half));
  const lastText = JSON.stringify(lessons.slice(half));
  const wholeText = JSON.stringify(lessons);

  const subjectWhole = subjectDensity(subject, wholeText);

  for (const theme of DOMINANCE_THEMES) {
    const whole = countMatches(wholeText, theme.pattern);
    if (whole < THEME_THRESHOLD) continue;

    // Taken the module over: the theme is spoken of more than the module's own subject is.
    if (subjectWhole > 0 && whole / subjectWhole >= DOMINANCE_RATIO) {
      findings.push({
        rule: 'dominance',
        moduleCode: code,
        detail: `${theme.name} is discussed more than the module's own subject`,
        count: whole,
        severity: 'high',
      });
      continue;
    }

    // Taken over the end of the module, which is where the reviewer kept finding it.
    const early = countMatches(firstText, theme.pattern);
    const late = countMatches(lastText, theme.pattern);
    if (late >= THEME_THRESHOLD && late >= early * 3) {
      findings.push({
        rule: 'tail',
        moduleCode: code,
        detail: `${theme.name} takes over the later lessons (${early} early, ${late} late)`,
        count: late,
        severity: 'high',
      });
    }
  }

  return findings;
}

/** Whether a module's content is fit to show a reviewer without a covering apology. */
export function moduleIsClean(findings: DriftFinding[]): boolean {
  return findings.every((f) => f.severity !== 'high');
}
