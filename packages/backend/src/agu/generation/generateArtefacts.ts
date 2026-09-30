/**
 * Drafts T07-T11 for a stored course draft whose outline has no blocking finding.
 *
 * Four phases, each one or more model calls: the rubric, discussion prompts and quiz plan; the
 * quiz and practice items, one call per week run side by side; the final exam, told which quiz
 * and practice questions exist; the tutor pack, told the exam's questions. The result is
 * validated on the stored shape, and parts with problems the model can fix get at most two
 * repair rounds, as the outline does. Every call records a heartbeat and every phase a stage
 * run. A part whose answer cannot be read becomes a blocking finding and the rest is kept, so
 * one cut-off answer does not discard six good ones; only a run in which nothing could be
 * drafted is 'failed'. The outline's status is never touched.
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
import { partOf } from './artefactRepair';

const MAX_REPAIR_ROUNDS = 2;
/**
 * Room for GPT-5's reasoning as well as its answer: reasoning tokens count against the same
 * limit. At 16,000 the first CR08 run's answer was cut off mid-string and failed the run.
 */
const MAX_TOKENS = 32000;
/** Used for a week the plan left out, so its items can still be written and checked. */
const DEFAULT_QUIZ_PLAN = { items: 8, timeLimitMinutes: 20, attempts: 2, weight: 0 };

type Prompt = { system: string; user: string };

async function askModel(prompt: Prompt, part: string): Promise<any> {
  const ask = (p: Prompt) =>
    openaiService.generateContent(p.user, p.system, {
      responseFormat: 'json_object',
      maxTokens: MAX_TOKENS,
    });
  try {
    return JSON.parse(await ask(prompt));
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
  }
  // An answer that is not JSON was almost always cut off at the limit; ask once more, shorter.
  const retry = {
    system: prompt.system,
    user: `${prompt.user}\n\nYour previous answer was cut off before it finished. Answer again, complete, keeping every text field brief.`,
  };
  try {
    return JSON.parse(await ask(retry));
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    throw new Error(`the answer for the ${part} was cut off or was not JSON, twice`);
  }
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

  // A part that cannot be drafted is recorded, by part, and the run carries on with the others.
  // A later repair that drafts it clears the record.
  const failures = new Map<string, Finding>();
  let partsTried = 0;
  const attempt = async <T>(
    key: string,
    label: string,
    run: () => Promise<T>,
    fallback: T
  ): Promise<T> => {
    partsTried++;
    try {
      const value = await run();
      failures.delete(key);
      return value;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      loggingService.warn('AGU artefacts: a part could not be drafted', { draftId, label, reason });
      failures.set(key, {
        code: 'ARTEFACT_PART_FAILED',
        severity: 'blocking',
        message: `The ${label} could not be drafted (${reason}). Redraft the assessments to try again.`,
        path: key,
      });
      return fallback;
    }
  };

  try {
    const hasExam = draft.assessments.some((a) => a.component === 'final_exam');
    const planPrompt = buildPlanPrompt(course, draft, inputs);
    const parts: Parts = {
      planAnswer: await attempt(
        'plan',
        'rubric, discussions and quiz plan',
        () => askModel(planPrompt, 'rubric, discussions and quiz plan'),
        {}
      ),
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
        const label = `week ${w.number} quiz and practice items`;
        weekAnswers.set(
          w.number,
          await attempt(`week${w.number}`, label, () => askModel(weekPrompt(w.number), label), {})
        );
        await heartbeat(draftId);
      })
    );

    const askedQuestions = () =>
      Array.from(weekAnswers.values()).flatMap((a) => [
        ...(a?.items || []).map((i: any) => String(i?.question || '')),
        ...(a?.practice || []).map((p: any) => String(p?.question || '')),
      ]);
    const examPrompt = () => buildExamPrompt(course, draft, inputs, askedQuestions());
    parts.examAnswer = hasExam
      ? await attempt('exam', 'final exam', () => askModel(examPrompt(), 'final exam'), null)
      : null;
    await heartbeat(draftId);

    const examQuestions = () =>
      ((parts.examAnswer?.questions || []) as any[]).map((q) => String(q?.question || ''));
    const tutorPrompt = () => buildTutorPackPrompt(course, draft, inputs, examQuestions());
    parts.tutorAnswer = await attempt(
      'tutor',
      'tutor pack',
      () => askModel(tutorPrompt(), 'tutor pack'),
      {}
    );
    // Nothing drafted at all is a failed run, not a draft of blocking findings.
    if (failures.size === partsTried) {
      throw new Error(Array.from(failures.values())[0].message);
    }
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
        parts.planAnswer = await attempt(
          'plan',
          'rubric, discussions and quiz plan',
          () => askModel(withRepair(planPrompt, byPart.get('plan')!, parts.planAnswer), 'plan'),
          parts.planAnswer
        );
        await heartbeat(draftId);
      }
      await Promise.all(
        draft.weeks
          .filter((w) => byPart.has(`week${w.number}`))
          .map(async (w) => {
            const previous = weekAnswers.get(w.number);
            const label = `week ${w.number} quiz and practice items`;
            const repaired = await attempt(
              `week${w.number}`,
              label,
              () =>
                askModel(
                  withRepair(weekPrompt(w.number), byPart.get(`week${w.number}`)!, previous),
                  label
                ),
              previous
            );
            weekAnswers.set(w.number, repaired);
            await heartbeat(draftId);
          })
      );
      const examChanged = hasExam && byPart.has('exam');
      if (examChanged) {
        parts.examAnswer = await attempt(
          'exam',
          'final exam',
          () =>
            askModel(withRepair(examPrompt(), byPart.get('exam')!, parts.examAnswer), 'final exam'),
          parts.examAnswer
        );
        await heartbeat(draftId);
      }
      // The tutor pack is told the exam's questions, so a new exam means a new pack.
      if (byPart.has('tutor') || examChanged) {
        const tutorRequest = byPart.has('tutor')
          ? withRepair(tutorPrompt(), byPart.get('tutor')!, parts.tutorAnswer)
          : tutorPrompt();
        parts.tutorAnswer = await attempt(
          'tutor',
          'tutor pack',
          () => askModel(tutorRequest, 'tutor pack'),
          parts.tutorAnswer
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

    const allFindings = [...failures.values(), ...parseFindings, ...findings];
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
