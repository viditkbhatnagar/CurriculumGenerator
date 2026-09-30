/**
 * Drafts T07-T11 for a stored course draft whose outline has no blocking finding.
 *
 * Four phases, each one or more model calls: the rubric, discussion prompts and quiz plan; the
 * quiz and practice items, one call per week run side by side; the final exam, told which quiz
 * and practice questions exist; the tutor pack, told the exam's questions. The result is
 * validated on the stored shape, and parts with problems the model can fix get at most two
 * repair rounds, as the outline does. Every call records a heartbeat, every phase a stage run,
 * and a failure leaves the artefacts 'failed' without touching the outline's status.
 *
 * Results are written with atomic updates rather than a save of the loaded document, so a
 * status sweep or read of the same draft while this runs cannot collide with it.
 */
import config from '../../config';
import { openaiService } from '../../services/openaiService';
import { loggingService } from '../../services/loggingService';
import { catalogueCourse } from '../catalogue/catalogueV1_4';
import { CourseDraft, Finding } from '../draft/types';
import { CourseArtefacts, QuizPlan } from '../draft/artefactTypes';
import { outlineHash } from '../draft/outlineHash';
import { validateArtefacts } from '../validation/validateArtefacts';
import { isReviewReady } from '../validation/validateDraft';
import { AguCourseDraft, StageRun } from '../model/AguCourseDraft';
import {
  ARTEFACT_PROMPT_VERSION,
  buildExamPrompt,
  buildPlanPrompt,
  buildQuizWeekPrompt,
  buildTutorPackPrompt,
  discussionsFromAnswer,
  examFromAnswer,
  quizPlanFromAnswer,
  quizWeekFromAnswer,
  rubricsFromAnswer,
  tutorPackFromAnswer,
} from './artefactPrompts';
import { FacultyInputs } from './outlinePrompt';

const MAX_REPAIR_ROUNDS = 2;
/** Used for a week the plan left out, so its items can still be written and checked. */
const DEFAULT_QUIZ_PLAN = { items: 8, timeLimitMinutes: 20, attempts: 2, weight: 0 };

type Prompt = { system: string; user: string };

async function askModel(prompt: Prompt): Promise<any> {
  const raw = await openaiService.generateContent(prompt.user, prompt.system, {
    responseFormat: 'json_object',
    maxTokens: 16000,
  });
  return JSON.parse(raw);
}

function withRepair(prompt: Prompt, findings: Finding[], previous: unknown): Prompt {
  return {
    system: prompt.system,
    user: `${prompt.user}\n\nYour previous answer has these problems. Fix every one and return the complete corrected JSON in the same format:\n${findings
      .map((f) => `- ${f.message}`)
      .join('\n')}\n\nYOUR PREVIOUS JSON:\n${JSON.stringify(previous)}`,
  };
}

async function heartbeat(draftId: string): Promise<void> {
  try {
    await AguCourseDraft.updateOne({ _id: draftId }, { $set: { artefactHeartbeatAt: new Date() } });
  } catch (error) {
    loggingService.warn('AGU artefacts: could not record a heartbeat', {
      draftId,
      error: String(error),
    });
  }
}

async function recordRun(draftId: string, run: StageRun): Promise<void> {
  await AguCourseDraft.updateOne({ _id: draftId }, { $push: { stageRuns: run } });
}

/** Which part of the artefacts a finding is about, so a repair re-asks only for that part. */
export function partOf(finding: Finding, artefacts?: CourseArtefacts): string | null {
  const path = finding.path || '';
  const week = /week(\d+)|\bW(\d+)-[QP]/.exec(path);
  if (/^(RUBRIC_|DISCUSSION_|WEEKLY_WEIGHTS|QUIZ_PLAN_WEEKS)/.test(finding.code)) return 'plan';
  if (/^(QUIZ_ITEM_COUNT|QUIZ_ITEM_INVALID|PRACTICE_WEEK_EMPTY)$/.test(finding.code) && week) {
    return `week${week[1] || week[2]}`;
  }
  if (finding.code.startsWith('EXAM_')) return 'exam';
  if (finding.code === 'TUTOR_GUARDRAILS') return 'tutor';
  if (finding.code === 'ARTEFACT_CLAIM') {
    if (/^(rubrics|discussions)/.test(path)) return 'plan';
    if (path.startsWith('quizBank')) {
      // A claim in a quiz or practice item is repaired with that item's week.
      const at = /quizBank\.(items|practice)\[(\d+)\]/.exec(path);
      const list = at ? artefacts?.quizBank[at[1] as 'items' | 'practice'] : undefined;
      const item = at && list ? list[Number(at[2])] : undefined;
      return item ? `week${item.week}` : 'plan';
    }
    if (path.startsWith('finalExam')) return 'exam';
    if (path.startsWith('tutorPack')) return 'tutor';
  }
  return null;
}

interface Parts {
  planAnswer: any;
  weekAnswers: Map<number, any>;
  examAnswer: any | null;
  tutorAnswer: any;
}

function assemble(
  draft: CourseDraft,
  parts: Parts
): { artefacts: CourseArtefacts; parseFindings: Finding[] } {
  const parseFindings: Finding[] = [];
  const rubrics = rubricsFromAnswer(parts.planAnswer, draft);
  const discussions = discussionsFromAnswer(parts.planAnswer, draft);
  parseFindings.push(...rubrics.findings, ...discussions.findings);
  const plan = quizPlanFromAnswer(parts.planAnswer, draft);
  const items = [];
  const practice = [];
  for (const week of draft.weeks) {
    const parsed = quizWeekFromAnswer(parts.weekAnswers.get(week.number), week, draft);
    items.push(...parsed.value.items);
    practice.push(...parsed.value.practice);
    parseFindings.push(...parsed.findings);
  }
  let finalExam = null;
  if (parts.examAnswer) {
    const exam = examFromAnswer(parts.examAnswer, draft);
    finalExam = exam.value;
    parseFindings.push(...exam.findings);
  }
  return {
    artefacts: {
      rubrics: rubrics.value,
      quizBank: { plan, items, practice },
      finalExam,
      discussions: discussions.value,
      tutorPack: tutorPackFromAnswer(parts.tutorAnswer, draft),
      outlineHash: outlineHash(draft),
      promptVersion: ARTEFACT_PROMPT_VERSION,
      generatedAt: new Date().toISOString(),
    },
    parseFindings,
  };
}

/** Draft (or redraft) the artefacts for a stored draft and save the outcome. */
export async function generateArtefacts(draftId: string): Promise<void> {
  const doc = await AguCourseDraft.findById(draftId).lean();
  if (!doc) throw new Error(`AGU draft ${draftId} not found`);
  const course = catalogueCourse(doc.courseCode);
  const draft = doc.draft as CourseDraft | undefined;
  if (!course || !draft) throw new Error(`${doc.courseCode} has no outline to draft from`);
  const inputs: FacultyInputs = doc.facultyInputs || {};
  const started = new Date();

  await AguCourseDraft.updateOne(
    { _id: draftId },
    { $set: { artefactStatus: 'generating', artefactHeartbeatAt: started } }
  );

  try {
    const hasExam = draft.assessments.some((a) => a.component === 'final_exam');
    const planPrompt = buildPlanPrompt(course, draft, inputs);
    const parts: Parts = {
      planAnswer: await askModel(planPrompt),
      weekAnswers: new Map<number, any>(),
      examAnswer: null,
      tutorAnswer: null,
    };
    await heartbeat(draftId);

    // Read from the current plan answer, so a repaired plan's item counts reach the weeks.
    const planFor = (week: number): QuizPlan =>
      quizPlanFromAnswer(parts.planAnswer, draft).find((p) => p.week === week) || {
        week,
        ...DEFAULT_QUIZ_PLAN,
      };
    const weekPrompt = (week: number) =>
      buildQuizWeekPrompt(
        course,
        draft,
        inputs,
        draft.weeks.find((w) => w.number === week)!,
        planFor(week)
      );
    const weekAnswers = parts.weekAnswers;
    await Promise.all(
      draft.weeks.map(async (w) => {
        weekAnswers.set(w.number, await askModel(weekPrompt(w.number)));
        await heartbeat(draftId);
      })
    );

    const askedQuestions = () =>
      Array.from(weekAnswers.values()).flatMap((a) => [
        ...(a?.items || []).map((i: any) => String(i?.question || '')),
        ...(a?.practice || []).map((p: any) => String(p?.question || '')),
      ]);
    const examPrompt = () => buildExamPrompt(course, draft, inputs, askedQuestions());
    parts.examAnswer = hasExam ? await askModel(examPrompt()) : null;
    await heartbeat(draftId);

    const examQuestions = () =>
      ((parts.examAnswer?.questions || []) as any[]).map((q) => String(q?.question || ''));
    const tutorPrompt = () => buildTutorPackPrompt(course, draft, inputs, examQuestions());
    parts.tutorAnswer = await askModel(tutorPrompt());
    await heartbeat(draftId);

    let { artefacts, parseFindings } = assemble(draft, parts);
    let findings = validateArtefacts(artefacts, draft);
    await recordRun(draftId, {
      stage: 'artefacts',
      status: 'succeeded',
      startedAt: started,
      finishedAt: new Date(),
      model: config.openai.chatModel,
      promptVersion: ARTEFACT_PROMPT_VERSION,
      blockingFindings: findings.filter((f) => f.severity === 'blocking').length,
    });

    for (let round = 1; round <= MAX_REPAIR_ROUNDS; round++) {
      const byPart = new Map<string, Finding[]>();
      for (const f of findings.filter((x) => x.severity === 'blocking')) {
        const part = partOf(f, artefacts);
        if (part) byPart.set(part, [...(byPart.get(part) || []), f]);
      }
      if (byPart.size === 0) break;
      const repairStarted = new Date();
      if (byPart.has('plan')) {
        parts.planAnswer = await askModel(
          withRepair(planPrompt, byPart.get('plan')!, parts.planAnswer)
        );
        await heartbeat(draftId);
      }
      await Promise.all(
        draft.weeks
          .filter((w) => byPart.has(`week${w.number}`))
          .map(async (w) => {
            const previous = weekAnswers.get(w.number);
            const repaired = await askModel(
              withRepair(weekPrompt(w.number), byPart.get(`week${w.number}`)!, previous)
            );
            weekAnswers.set(w.number, repaired);
            await heartbeat(draftId);
          })
      );
      const examChanged = hasExam && byPart.has('exam');
      if (examChanged) {
        parts.examAnswer = await askModel(
          withRepair(examPrompt(), byPart.get('exam')!, parts.examAnswer)
        );
        await heartbeat(draftId);
      }
      // The tutor pack is told the exam's questions, so a new exam means a new pack.
      if (byPart.has('tutor') || examChanged) {
        parts.tutorAnswer = await askModel(
          byPart.has('tutor')
            ? withRepair(tutorPrompt(), byPart.get('tutor')!, parts.tutorAnswer)
            : tutorPrompt()
        );
        await heartbeat(draftId);
      }
      ({ artefacts, parseFindings } = assemble(draft, parts));
      findings = validateArtefacts(artefacts, draft);
      await recordRun(draftId, {
        stage: 'artefact_repair',
        status: 'succeeded',
        startedAt: repairStarted,
        finishedAt: new Date(),
        model: config.openai.chatModel,
        promptVersion: ARTEFACT_PROMPT_VERSION,
        blockingFindings: findings.filter((f) => f.severity === 'blocking').length,
      });
    }

    const allFindings = [...parseFindings, ...findings];
    await AguCourseDraft.updateOne(
      { _id: draftId },
      {
        $set: {
          artefacts,
          artefactFindings: allFindings,
          artefactStatus: isReviewReady(allFindings) ? 'ready_for_review' : 'needs_faculty',
          artefactHeartbeatAt: new Date(),
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    loggingService.error('AGU artefact generation failed', {
      draftId,
      courseCode: doc.courseCode,
      error: message,
    });
    await AguCourseDraft.updateOne(
      { _id: draftId },
      {
        $set: { artefactStatus: 'failed' },
        $push: {
          stageRuns: {
            stage: 'artefacts',
            status: 'failed',
            startedAt: started,
            finishedAt: new Date(),
            model: config.openai.chatModel,
            promptVersion: ARTEFACT_PROMPT_VERSION,
            error: message,
          },
        },
      }
    );
  }
}
