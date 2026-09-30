/**
 * Runs one outline generation for a stored course draft.
 *
 * Sources first, then the model, then the checks. Readings come from OpenAlex, open access only,
 * inside the course's own subject fields; the model may only choose among them. The knowledge
 * base supplies design guidance when it has any. The result is validated on the stored shape,
 * and structural problems the model can fix (hours, weights, run sheets, outcome counts) get at
 * most two repair rounds, the limit the Phase One roadmap sets. Every stage is recorded on the
 * draft with its model, source counts and error, and a failure leaves the draft 'failed'.
 */
import config from '../../config';
import { openaiService } from '../../services/openaiService';
import { loggingService } from '../../services/loggingService';
import { ragEngine } from '../../services/ragEngine';
import {
  citationAuthors,
  deriveSubjectFields,
  gatherModuleSources,
} from '../../services/academicSourceService';
import { AGU_CATALOGUE_V1_4, catalogueCourse } from '../catalogue/catalogueV1_4';
import { CatalogueCourse } from '../catalogue/types';
import { Finding } from '../draft/types';
import { isReviewReady, validateDraft } from '../validation/validateDraft';
import {
  buildOutlinePrompt,
  draftFromOutline,
  OfferedSource,
  topicsFromDescription,
} from './outlinePrompt';
import { AguCourseDraft, IAguCourseDraft, StageRun } from '../model/AguCourseDraft';

export const OUTLINE_PROMPT_VERSION = 'agu-outline-1';
const MAX_REPAIR_ROUNDS = 2;
const REPAIRABLE = new Set([
  'OUTCOME_COUNT',
  'WEEK_COUNT',
  'LECTURE_UNNAMED',
  'RUN_SHEET_GAPS',
  'CONTACT_HOURS',
  'INDEPENDENT_HOURS',
  'CONTACT_UNEVIDENCED',
  'OUTCOME_NOT_TAUGHT',
  'OUTCOME_NOT_ASSESSED',
  'ASSESSMENT_WEIGHTS',
  'ASSESSMENT_SCHEME',
  'ASSESSMENT_AI_RULES',
  'OUTCOME_NOT_MEASURABLE',
]);

async function offeredSources(course: CatalogueCourse): Promise<OfferedSource[]> {
  const subjectFields = await deriveSubjectFields(course.title).catch(() => [] as string[]);
  const { sources } = await gatherModuleSources(
    course.title,
    topicsFromDescription(course.description),
    {
      target: 12,
      peerReviewedShare: 0.5,
      fromYear: 2016,
      requireFullText: true,
      subjectFields,
    }
  );
  return sources.map((s) => ({
    sourceId: s.doi ? `doi:${s.doi}` : s.url,
    citation:
      `${citationAuthors(s.authors)} (${s.year ?? 'n.d.'}). ${s.title}. ${s.venue || s.publisher || ''}${s.doi ? `. https://doi.org/${s.doi}` : ''}`.trim(),
    year: s.year,
    openAccess: !!s.pdfUrl || s.isOpenAccess,
    link: s.pdfUrl || s.url,
  }));
}

async function designGuidance(): Promise<string[]> {
  try {
    const results = await ragEngine.semanticSearch(
      'writing measurable course learning outcomes aligned to assessment in an online graduate course',
      { maxSources: 4, minSimilarity: 0.6, domains: ['curriculum-design'] } as any
    );
    return results
      .map((r: any) =>
        String(r.content || '')
          .replace(/\s+/g, ' ')
          .slice(0, 400)
      )
      .filter(Boolean);
  } catch (error) {
    loggingService.warn('AGU outline: no knowledge-base guidance', { error: String(error) });
    return [];
  }
}

async function askModel(system: string, user: string): Promise<any> {
  const raw = await openaiService.generateContent(user, system, {
    responseFormat: 'json_object',
    maxTokens: 16000,
  });
  return JSON.parse(raw);
}

function repairRequest(findings: Finding[], previous: unknown): string {
  return `Your course outline has these problems. Fix every one and return the complete corrected JSON in the same format, changing nothing else:\n${findings
    .map((f) => `- ${f.message}`)
    .join('\n')}\n\nYOUR PREVIOUS JSON:\n${JSON.stringify(previous)}`;
}

function record(doc: IAguCourseDraft, run: StageRun): void {
  doc.stageRuns = [...(doc.stageRuns || []), run];
}

/** Generate (or regenerate) the outline for a stored draft and save the outcome. */
export async function generateOutline(draftId: string): Promise<IAguCourseDraft> {
  const doc = await AguCourseDraft.findById(draftId);
  if (!doc) throw new Error(`AGU draft ${draftId} not found`);
  const course = catalogueCourse(doc.courseCode);
  if (!course) throw new Error(`${doc.courseCode} is not in the catalogue`);

  const started = new Date();
  doc.status = 'generating';
  await doc.save();

  try {
    const [sources, guidance] = await Promise.all([offeredSources(course), designGuidance()]);
    const { system, user } = buildOutlinePrompt(
      course,
      AGU_CATALOGUE_V1_4,
      doc.facultyInputs || {},
      sources,
      guidance
    );

    let answer = await askModel(system, user);
    let { draft, findings: parseFindings } = draftFromOutline(
      answer,
      course,
      AGU_CATALOGUE_V1_4,
      sources
    );
    let findings = validateDraft(draft, AGU_CATALOGUE_V1_4);
    record(doc, {
      stage: 'outline',
      status: 'succeeded',
      startedAt: started,
      finishedAt: new Date(),
      model: config.openai.chatModel,
      promptVersion: OUTLINE_PROMPT_VERSION,
      sourcesOffered: sources.length,
      guidancePassages: guidance.length,
      readingsDropped: parseFindings.filter((f) => f.code === 'READING_NOT_OFFERED').length,
      blockingFindings: findings.filter((f) => f.severity === 'blocking').length,
    });

    for (let round = 1; round <= MAX_REPAIR_ROUNDS; round++) {
      const fixable = findings.filter((f) => f.severity === 'blocking' && REPAIRABLE.has(f.code));
      if (fixable.length === 0) break;
      const repairStarted = new Date();
      answer = await askModel(system, `${user}\n\n${repairRequest(fixable, answer)}`);
      ({ draft, findings: parseFindings } = draftFromOutline(
        answer,
        course,
        AGU_CATALOGUE_V1_4,
        sources
      ));
      findings = validateDraft(draft, AGU_CATALOGUE_V1_4);
      record(doc, {
        stage: 'repair',
        status: 'succeeded',
        startedAt: repairStarted,
        finishedAt: new Date(),
        model: config.openai.chatModel,
        promptVersion: OUTLINE_PROMPT_VERSION,
        blockingFindings: findings.filter((f) => f.severity === 'blocking').length,
      });
    }

    doc.draft = draft;
    doc.findings = [...parseFindings, ...findings];
    doc.sourcesOffered = sources;
    if (sources.length === 0) {
      doc.findings.push({
        code: 'NO_VERIFIED_SOURCES',
        severity: 'blocking',
        message:
          'No open-access sources were found for this course, so no readings could be proposed. Add faculty-supplied or licensed readings.',
      });
    }
    doc.status = isReviewReady(doc.findings) ? 'ready_for_review' : 'needs_faculty';
    doc.markModified('draft');
    doc.markModified('findings');
    doc.markModified('sourcesOffered');
    await doc.save();
    return doc;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    loggingService.error('AGU outline generation failed', {
      draftId,
      courseCode: doc.courseCode,
      error: message,
    });
    record(doc, {
      stage: 'outline',
      status: 'failed',
      startedAt: started,
      finishedAt: new Date(),
      model: config.openai.chatModel,
      promptVersion: OUTLINE_PROMPT_VERSION,
      error: message,
    });
    doc.status = 'failed';
    await doc.save();
    return doc;
  }
}
