/**
 * Model fallback for course documents that are prose rather than structure.
 *
 * Athira Hari at India Learns asked on 19 November 2026 to develop ChatGPT-drafted courses
 * here. When a document has no table, headings or list the parser can read, the model is
 * asked to lift out only what the text says, as JSON, and the answer is normalised through
 * the same checks as parsed data. The author reviews everything it returns before use.
 */
import { openaiService } from './openaiService';
import { loggingService } from './loggingService';
import { withUsageContext } from './usageContext';
import { flagsFor } from './courseDocumentParser';
import type { ExtractedCourse, ExtractedModule } from './courseDocumentParser';

/** Enough for a long course outline; beyond it the document is cut and the author told. */
export const MODEL_INPUT_LIMIT = 40000;

const SYSTEM = `You extract the structure of a course document. Return only what the text states.
Never invent, infer or complete anything: if a field is not in the text, use "" for text, null for numbers and [] for lists.
Return JSON: {
 "title": string, "description": string, "purpose": string,
 "level": string (the level wording as written), "credentialType": string (certificate, diploma etc. as written),
 "credits": number|null, "totalHours": number|null, "targetLearners": string,
 "jobRoles": [{"title": string, "description": string}],
 "modules": [{"title": string, "credits": number|null, "contactHours": number|null, "independentHours": number|null, "totalHours": number|null, "topics": [string], "outcomes": [string]}]
}
Keep modules in the order of the text.`;

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
const list = (v: unknown): string[] => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);

/** The model's JSON as an ExtractedCourse, dropping anything of the wrong type. */
export function normaliseModelCourse(raw: unknown): ExtractedCourse {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const modules: ExtractedModule[] = (Array.isArray(r.modules) ? r.modules : [])
    .map(
      (m): Record<string, unknown> =>
        m && typeof m === 'object' ? (m as Record<string, unknown>) : {}
    )
    .filter((m) => str(m.title))
    .map((m, i) => ({
      sequenceOrder: i + 1,
      code: `M${String(i + 1).padStart(2, '0')}`,
      title: str(m.title),
      credits: num(m.credits),
      contactHours: num(m.contactHours),
      independentHours: num(m.independentHours),
      totalHours: num(m.totalHours),
      topics: list(m.topics),
      outcomes: list(m.outcomes),
      group: '',
      isElective: false,
    }));
  const programme = {
    title: str(r.title),
    description: str(r.description),
    purpose: str(r.purpose),
    levelText: str(r.level),
    credentialText: str(r.credentialType),
    credits: num(r.credits),
    totalHours: num(r.totalHours),
    targetLearners: str(r.targetLearners),
    jobRoles: (Array.isArray(r.jobRoles) ? r.jobRoles : [])
      .map(
        (j): Record<string, unknown> =>
          j && typeof j === 'object' ? (j as Record<string, unknown>) : {}
      )
      .filter((j) => str(j.title))
      .map((j) => ({ title: str(j.title), description: str(j.description) })),
  };
  return { programme, modules, flags: flagsFor(programme, modules), method: 'model' };
}

export async function extractWithModel(
  text: string,
  workflowId?: string
): Promise<ExtractedCourse> {
  const truncated = text.length > MODEL_INPUT_LIMIT;
  const body = truncated ? text.slice(0, MODEL_INPUT_LIMIT) : text;
  const reply = await withUsageContext({ workflowId, step: 'import-course' }, () =>
    openaiService.generateContent(`DOCUMENT:\n\n${body}`, SYSTEM, {
      responseFormat: 'json_object',
      maxTokens: 12000,
    })
  );
  let parsed: unknown;
  try {
    parsed = JSON.parse(reply);
  } catch (error) {
    loggingService.warn('Course document model reply was not JSON', { error });
    throw new Error(
      'The model did not return a readable structure. Try a document with headings or a table.'
    );
  }
  const course = normaliseModelCourse(parsed);
  if (truncated) {
    course.flags.unshift(
      `The document was longer than ${MODEL_INPUT_LIMIT} characters; only the start was read.`
    );
  }
  course.flags.unshift('This was read by the model from unstructured text. Check every field.');
  return course;
}
