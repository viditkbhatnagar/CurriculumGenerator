/**
 * Turns an extracted course into the two things the workflow already understands.
 *
 * Athira Hari at India Learns asked on 19 November 2026 to develop courses drafted in ChatGPT
 * here. The author confirms what was extracted, then it becomes (a) values for the Step 1
 * form, which the author still reviews and submits, and (b) a Step 4 module blueprint in the
 * shape moduleBlueprintService uses. Only what the document stated is carried over; a field
 * it did not state is absent, never filled with a default.
 */
import type { ExtractedCourse, ExtractedModule } from './courseDocumentParser';
import { statedLevel } from './courseDocumentParser';
import type { BlueprintModule } from './moduleBlueprintService';

export type AcademicLevel =
  | 'certificate'
  | 'micro-credential'
  | 'diploma'
  | 'bachelor'
  | 'postgraduate-diploma'
  | 'master';

/** The Step 1 form fields the document can fill. Absent keys are left as the form has them. */
export interface Step1Prefill {
  programTitle?: string;
  programDescription?: string;
  programPurpose?: string;
  academicLevel?: AcademicLevel;
  programmeLevel?: number;
  programmeLevelOrigin?: 'stated';
  credits?: number;
  totalHours?: number;
  targetLearnerEducationalBackground?: string;
  jobRoles?: Array<{ title: string; description: string; tasks: string[] }>;
}

export interface BlueprintModuleWithOutline extends BlueprintModule {
  /** Topics and outcomes the author's document listed, offered to Step 4 as a starting point. */
  sourceTopics: string[];
  sourceOutcomes: string[];
}

/** Credential wording to the form's options, most specific first; a doctorate has no option. */
export function academicLevelFrom(...texts: string[]): AcademicLevel | null {
  const joined = texts.join(' ').toLowerCase();
  if (/micro[-\s]?credential/.test(joined)) return 'micro-credential';
  if (/\b(phd|doctorate|doctor of)\b/.test(joined)) return null;
  if (/\b(master|mba|m\.?sc)\b/.test(joined)) return 'master';
  if (/\b(post\s*-?\s*graduate|pg|executive)\s+(diploma|cert(ificate)?)\b/.test(joined)) {
    return 'postgraduate-diploma';
  }
  if (/\b(bachelor|bba|undergraduate degree|honours degree)\b/.test(joined)) return 'bachelor';
  if (/\bdegree\b/.test(joined)) return null;
  if (/diploma/.test(joined)) return 'diploma';
  if (/certificate/.test(joined)) return 'certificate';
  return null;
}

export function toStep1Prefill(course: ExtractedCourse): Step1Prefill {
  const p = course.programme;
  const out: Step1Prefill = {};
  if (p.title) out.programTitle = p.title;
  if (p.description) out.programDescription = p.description;
  if (p.purpose) out.programPurpose = p.purpose;

  const academic = academicLevelFrom(p.credentialText, p.levelText) ?? academicLevelFrom(p.title);
  if (academic) out.academicLevel = academic;
  const level = statedLevel(p.levelText);
  if (level) {
    out.programmeLevel = level;
    out.programmeLevelOrigin = 'stated';
  }
  if (p.credits) out.credits = p.credits;
  if (p.totalHours) out.totalHours = p.totalHours;
  if (p.targetLearners) out.targetLearnerEducationalBackground = p.targetLearners;
  if (p.jobRoles.length) {
    out.jobRoles = p.jobRoles.map((r) => ({
      title: r.title,
      description: r.description,
      tasks: [''],
    }));
  }
  return out;
}

/**
 * The author's own topics and outcomes for modules, as a prompt block. Empty when the
 * blueprint came from a spreadsheet and carries none.
 */
export function outlineBlock(
  modules: Array<{ code?: string; sourceTopics?: string[]; sourceOutcomes?: string[] }>
): string {
  const lines = modules
    .filter((m) => m.sourceTopics?.length || m.sourceOutcomes?.length)
    .map((m) => {
      const topics = m.sourceTopics?.length ? ` topics: ${m.sourceTopics.join('; ')}.` : '';
      const outcomes = m.sourceOutcomes?.length ? ` outcomes: ${m.sourceOutcomes.join('; ')}.` : '';
      return `${m.code}:${topics}${outcomes}`;
    });
  if (!lines.length) return '';
  return `\nTHE AUTHOR'S OWN OUTLINE for these modules, from the course they supplied. Treat it as the starting point: keep these topics and outcomes (reworded to fit the format below where needed) and add to them only where the module needs more:\n${lines.join('\n')}\n`;
}

const orNull = (n: number | null | undefined): number | null =>
  typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null;

export function toBlueprint(modules: ExtractedModule[]): BlueprintModuleWithOutline[] {
  return modules
    .filter((m) => m.title.trim())
    .map((m, i) => {
      const contact = orNull(m.contactHours);
      const independent = orNull(m.independentHours);
      const total =
        orNull(m.totalHours) ??
        (contact !== null && independent !== null ? contact + independent : null);
      return {
        sequenceOrder: i + 1,
        code: m.code.trim() || `M${String(i + 1).padStart(2, '0')}`,
        title: m.title.trim(),
        credits: orNull(m.credits),
        contactHours: contact,
        independentHours: independent,
        totalHours: total,
        group: m.group.trim(),
        isElective: !!m.isElective,
        sourceTopics: m.topics.map((t) => t.trim()).filter(Boolean),
        sourceOutcomes: m.outcomes.map((t) => t.trim()).filter(Boolean),
      };
    });
}
