/**
 * Assessment Generator Service
 * Implements the Assessment Generator Contract with chunked generation to avoid timeouts
 *
 * Generation Strategy:
 * 1. Formative Assessments - Sequential per module (avoids OpenAI rate limits)
 * 2. Summative Assessments - Single call after formatives complete
 * 3. Sample Questions - Batched by type (MCQ, SJT, case, essay, practical)
 * 4. LMS Packages - Logical structures generation
 *
 * Timeout Mitigation:
 * - Sequential module processing (not parallel)
 * - Smaller token limits per call
 * - Delays between calls to avoid rate limits
 * - Retry logic with exponential backoff
 * - Progress tracking and resume capability
 */

import { ICurriculumWorkflow } from '../models/CurriculumWorkflow';
import { openaiService } from './openaiService';
import { loggingService } from './loggingService';
import {
  AssessmentGenerationRequest,
  AssessmentGenerationResponse,
  AssessmentUserPreferences,
  FormativeAssessment,
  SummativeAssessment,
  SampleQuestions,
  LMSPackages,
  AssessmentGenerationProgress,
  MCQSampleQuestion,
  SJTSampleQuestion,
  CaseSampleQuestion,
  EssaySamplePrompt,
  PracticalSampleTask,
} from '../types/assessmentGenerator';
import { balanceMcqPositions } from '../utils/mcqBalance';
import { scenarioProfileFor, scenarioDirective } from './scenarioContext';
import { derivePloAlignment } from '../utils/ploAlignment';
import {
  normaliseBloom,
  statedBloom,
  bloomIndex,
  questionPlanForBloom,
  requiredArtefacts,
  planFormativeFormats,
  deriveTargetBloomLevels,
  auditAssessmentBloom,
  normaliseQuestionType,
  TASK_SHAPES_BY_BLOOM,
  type FormatPlan,
} from './bloomTaxonomy';

/**
 * Reconcile an MCQ's correct-answer fields so the ticked answer always matches
 * the rationale. The model is asked to put the correct option's full TEXT in
 * `correctAnswer`; this derives a consistent 0-based `correctOptionIndex` and
 * canonicalises `correctAnswer` to the exact option text. It also repairs the
 * legacy shape where `correctAnswer` was a numeric index, and tolerates a bare
 * letter ("B" / "Option C"). When no option can be confidently matched it
 * leaves the question untouched (never guesses).
 */
export function normalizeMcqAnswer(q: any): void {
  if (!q || !Array.isArray(q.options) || q.options.length === 0) return;
  const opts = q.options.map((o: any) => String(o));
  const norm = (s: any) => String(s).trim().toLowerCase().replace(/\s+/g, ' ');
  let idx = -1;

  // 1) explicit 0-based index field (sample MCQs)
  if (
    Number.isInteger(q.correctOptionIndex) &&
    q.correctOptionIndex >= 0 &&
    q.correctOptionIndex < opts.length
  ) {
    idx = q.correctOptionIndex;
  }
  const ca = q.correctAnswer;
  // 2) legacy: correctAnswer stored as a 0-based numeric index
  if (idx < 0 && typeof ca === 'number' && Number.isInteger(ca) && ca >= 0 && ca < opts.length) {
    idx = ca;
  }
  // 3) correctAnswer as text → match it back to an option
  if (idx < 0 && typeof ca === 'string' && ca.trim()) {
    idx = opts.findIndex((o: string) => norm(o) === norm(ca));
    if (idx < 0) {
      const m = ca.trim().match(/^(?:option\s+)?([a-z])[).:]?\s*$/i); // "B", "B)", "Option C"
      if (m) {
        const li = m[1].toUpperCase().charCodeAt(0) - 65;
        if (li >= 0 && li < opts.length) idx = li;
      }
    }
    if (idx < 0) {
      idx = opts.findIndex((o: string) => norm(o).includes(norm(ca)) || norm(ca).includes(norm(o)));
    }
  }

  if (idx < 0 || idx >= opts.length) return; // undeterminable — leave as-is
  q.correctOptionIndex = idx;
  q.correctAnswer = opts[idx];
}

// The taxonomy rules live in ./bloomTaxonomy — pure decisions about Bloom's levels, with no
// dependency on the OpenAI client, the logger or the Mongoose models. Re-exported here so
// existing importers keep working.
export {
  BLOOM_ORDER,
  normaliseBloom,
  statedBloom,
  bloomIndex,
  questionPlanForBloom,
  requiredArtefacts,
  uncollectedArtefacts,
  isDescriptionOnly,
  assignMlosToSlots,
  planFormativeFormats,
  deriveTargetBloomLevels,
  auditAssessmentBloom,
  auditProgrammeBloom,
  formativeShortfalls,
  normaliseQuestionType,
  TASK_SHAPES_BY_BLOOM,
} from './bloomTaxonomy';
export type { AssessmentSlot, FormatPlan, BloomAudit, BloomReport } from './bloomTaxonomy';

export class AssessmentGeneratorService {
  /**
   * Modules whose assessments could not be generated, even after a retry.
   *
   * Exposed so the caller can persist it: a module missing from a step that reports success
   * is invisible until somebody reads the document and notices.
   */
  failedModules: { moduleId: string; moduleTitle?: string; message: string }[] = [];

  /**
   * Per-module budget for the formative call.
   *
   * Four minutes was enough when a module returned two assessments of questions. It is not
   * enough now that each one also carries a student brief, a marking guide and a banded
   * rubric, and that create-level modules must set out a task producing a real artefact:
   * six of the seven modules that failed a regeneration failed on exactly this timeout, at
   * 240000ms, having produced nothing. Twelve minutes leaves headroom without letting a
   * genuinely stuck call block the queue indefinitely.
   */
  private readonly MODULE_TIMEOUT = 720000;
  private readonly SUMMATIVE_TIMEOUT = 240000; // 4 minutes for summative
  private readonly SAMPLE_BATCH_TIMEOUT = 180000; // 3 minutes per sample type
  private readonly INTER_CALL_DELAY = 1000; // 1 second delay between API calls
  private readonly MAX_TOKENS_FORMATIVE = 32000; // Increased for complete question generation (10-12 questions per assessment)
  private readonly MAX_TOKENS_SUMMATIVE = 20000;
  private readonly MAX_TOKENS_SAMPLES = 16000;

  /**
   * Spelling/locale directive for system prompts. When a target market is set
   * (e.g. "India", "Indian fashion retail") the model localises spelling;
   * otherwise the previous default (UK English) is preserved.
   */
  private spellingDirective(request: AssessmentGenerationRequest): string {
    const market = request.userPreferences?.targetMarket?.trim();
    if (!market) {
      // This used to return "Use UK English spelling throughout." on its own, and that one
      // line is where the programme's UK bias came from: a model told "UK English" supplies
      // UK companies, UK cities, GBP and the FCA to match. Across this programme's Step 7 and
      // Step 8 that produced 7,328 UK markers and no reference to the UAE at all, on a Dubai
      // programme. Spelling is a house style; it is not a jurisdiction.
      return 'Use UK English spelling throughout ("organisation", "analyse", "programme"). This is a SPELLING convention only — it does not mean the scenario is set in the UK, and must not lead to UK companies, UK cities, GBP or UK regulators. The setting is specified separately below.';
    }
    return `Localise this assessment to the ${market} context: use the English spelling, examples, brand/organisation names, currency and regulatory references appropriate to ${market}. Do NOT use UK-specific brands, currency (£/GBP) or regulators unless ${market} explicitly is the UK.`;
  }

  /**
   * Market-context block injected into user prompts so generated examples,
   * scenarios and case material reflect the intended market. Empty when no
   * target market is set.
   */
  private marketContextBlock(request: AssessmentGenerationRequest): string {
    const market = request.userPreferences?.targetMarket?.trim();
    if (!market) return '';
    return `\n=== TARGET MARKET ===\nLocalise all examples, scenarios, brand/organisation names, currency and regulatory references to: ${market}.\n`;
  }

  /**
   * Generate complete assessment package with chunked strategy
   */
  /**
   * Assemble the generation request from a workflow. Extracted so a single module can be
   * regenerated on exactly the same inputs as a full run.
   */
  private buildRequest(
    workflow: ICurriculumWorkflow,
    userPreferences: AssessmentUserPreferences
  ): AssessmentGenerationRequest {
    return {
      programFoundation: workflow.step1,
      competencyFrameworks: workflow.step2,
      courseFramework: {
        courseId: workflow._id,
        courseTitle: workflow.step1?.programTitle,
        courseDescription: workflow.step1?.programDescription,
        programLearningOutcomes: workflow.step3?.outcomes || [],
      },
      modules: workflow.step4?.modules || [],
      topicSources: workflow.step5?.topicSources || [],
      readingLists: workflow.step6?.moduleReadingLists || [],
      userPreferences,
    } as AssessmentGenerationRequest;
  }

  /**
   * Generate formative assessments for named modules only.
   *
   * Needed for two reasons. A module whose outcomes are edited needs its assessments
   * rewritten without paying for the whole programme again — a full Step 7 run is around
   * an hour of sequential generation. And Step 7 is the one step that runs tied to a
   * browser connection, so runs are routinely cut short partway through; this fills in the
   * modules that were never reached.
   *
   * Failures are returned rather than swallowed, so a caller can report which modules
   * still have nothing.
   */
  async generateFormativesForModules(
    workflow: ICurriculumWorkflow,
    userPreferences: AssessmentUserPreferences,
    moduleIds: string[],
    /**
     * Called as each module completes, so the caller can persist progressively.
     *
     * Without it a caller can only save once every module has finished, so a restart or a
     * dropped connection discards the lot — the same fragility that cost this programme an
     * hour of Step 7 twice over.
     */
    onModuleComplete?: (moduleId: string, formatives: FormativeAssessment[]) => Promise<void>
  ): Promise<{
    formatives: FormativeAssessment[];
    failed: { moduleId: string; message: string }[];
  }> {
    this.failedModules = [];
    const request = this.buildRequest(workflow, userPreferences);
    const wanted = new Set(moduleIds);
    const modules = (request.modules || []).filter((m: any) => wanted.has(m.id));

    const formativePerModule = userPreferences.formativePerModule || 1;
    const formativeTypes = userPreferences.formativeTypesPerUnit;

    const formatives: FormativeAssessment[] = [];
    const failed: { moduleId: string; message: string }[] = [];

    for (const module of modules) {
      // The module's own index in the full list, so prompts that reference position
      // (progressive difficulty across the programme) stay correct.
      const moduleIndex = (request.modules || []).findIndex((m: any) => m.id === module.id);
      try {
        const generated = await this.generateModuleFormativeAssessments(
          module,
          moduleIndex,
          request,
          formativePerModule,
          formativeTypes
        );
        formatives.push(...generated);
        if (onModuleComplete) {
          await onModuleComplete(module.id, generated);
        }
      } catch (error) {
        failed.push({
          moduleId: module.id,
          message: error instanceof Error ? error.message : String(error),
        });
        loggingService.error('Per-module formative generation failed', {
          moduleId: module.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      await this.delay(this.INTER_CALL_DELAY);
    }

    return { formatives, failed };
  }

  async generateAssessments(
    workflow: ICurriculumWorkflow,
    userPreferences: AssessmentUserPreferences,
    progressCallback?: (progress: AssessmentGenerationProgress) => void
  ): Promise<AssessmentGenerationResponse> {
    loggingService.info('Starting Assessment Generation', {
      workflowId: workflow._id,
      structure: userPreferences.assessmentStructure,
    });

    this.failedModules = [];
    const request = this.buildRequest(workflow, userPreferences);

    const response: AssessmentGenerationResponse = {
      formativeAssessments: [],
      summativeAssessments: [],
      sampleQuestions: {
        mcq: [],
        sjt: [],
        caseQuestions: [],
        essayPrompts: [],
        practicalTasks: [],
      },
      lmsPackages: {},
    };

    try {
      // Stage 1: Generate Formative Assessments (if requested)
      if (
        userPreferences.assessmentStructure === 'formative_only' ||
        userPreferences.assessmentStructure === 'both_formative_and_summative'
      ) {
        response.formativeAssessments = await this.generateFormativeAssessments(
          request,
          progressCallback
        );
      }

      // Stage 2: Generate Summative Assessments (if requested)
      if (
        userPreferences.assessmentStructure === 'summative_only' ||
        userPreferences.assessmentStructure === 'both_formative_and_summative'
      ) {
        response.summativeAssessments = await this.generateSummativeAssessments(
          request,
          progressCallback
        );
      }

      // Stage 3: Generate Sample Questions (if requested)
      if (userPreferences.generateSampleQuestions) {
        response.sampleQuestions = await this.generateSampleQuestions(request, progressCallback);
      }

      // Stage 4: Generate LMS Packages (logical structures)
      response.lmsPackages = await this.generateLMSPackages(request, response, progressCallback);

      // Report completion
      if (progressCallback) {
        progressCallback({
          stage: 'complete',
          totalSteps: 4,
          completedSteps: 4,
        });
      }

      loggingService.info('Assessment Generation Complete', {
        workflowId: workflow._id,
        formativeCount: response.formativeAssessments.length,
        summativeCount: response.summativeAssessments.length,
        sampleQuestionsTotal:
          response.sampleQuestions.mcq.length +
          response.sampleQuestions.sjt.length +
          response.sampleQuestions.caseQuestions.length +
          response.sampleQuestions.essayPrompts.length +
          response.sampleQuestions.practicalTasks.length,
      });

      return response;
    } catch (error) {
      loggingService.error('Assessment Generation Failed', {
        workflowId: workflow._id,
        error: error instanceof Error ? error.message : String(error),
      });

      if (progressCallback) {
        progressCallback({
          stage: 'error',
          totalSteps: 4,
          completedSteps: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      throw error;
    }
  }

  /**
   * Generate Formative Assessments - Sequential per module
   */
  private async generateFormativeAssessments(
    request: AssessmentGenerationRequest,
    progressCallback?: (progress: AssessmentGenerationProgress) => void
  ): Promise<FormativeAssessment[]> {
    const modules = request.modules || [];
    const formativePerModule = request.userPreferences.formativePerModule || 1;
    const formativeTypes = request.userPreferences.formativeTypesPerUnit;
    const allFormatives: FormativeAssessment[] = [];

    loggingService.info('Generating Formative Assessments', {
      moduleCount: modules.length,
      formativePerModule,
      formativeTypes,
    });

    for (let i = 0; i < modules.length; i++) {
      const module = modules[i];

      if (progressCallback) {
        progressCallback({
          stage: 'formative',
          currentModule: module.title,
          totalSteps: modules.length,
          completedSteps: i,
          estimatedTimeRemaining: (modules.length - i) * 3 * 60, // 3 min per module
        });
      }

      try {
        const moduleFormatives = await this.generateModuleFormativeAssessments(
          module,
          i,
          request,
          formativePerModule,
          formativeTypes
        );

        allFormatives.push(...moduleFormatives);

        loggingService.info(`Module ${i + 1}/${modules.length} formatives complete`, {
          moduleId: module.id,
          count: moduleFormatives.length,
        });

        // Send data callback for streaming (after each module completes)
        if (progressCallback) {
          progressCallback({
            stage: 'formative',
            currentModule: module.title,
            totalSteps: modules.length,
            completedSteps: i + 1,
            data: {
              formatives: moduleFormatives,
            },
          });
        }

        // Delay between modules to avoid rate limits
        if (i < modules.length - 1) {
          await this.delay(this.INTER_CALL_DELAY);
        }
      } catch (firstError) {
        // Retry once. Most failures here are transient — a truncated JSON response or a
        // rate limit — and a single retry recovers them.
        loggingService.warn(`Retrying formatives for module ${module.id}`, {
          error: firstError instanceof Error ? firstError.message : String(firstError),
        });
        try {
          const retried = await this.generateModuleFormativeAssessments(
            module,
            i,
            request,
            formativePerModule,
            formativeTypes
          );
          allFormatives.push(...retried);
        } catch (retryError) {
          // Continuing silently is what lost eleven modules from a completed run: the step
          // reported success, and the author found out by reading the exported document and
          // listing the modules that were not in it.
          const message = retryError instanceof Error ? retryError.message : String(retryError);
          this.failedModules.push({ moduleId: module.id, moduleTitle: module.title, message });
          loggingService.error(`Gave up on formatives for module ${module.id}`, { message });
        }
      }
    }

    return allFormatives;
  }

  /**
   * Generate formative assessments for a single module
   */
  /**
   * Generate a module's formative assessments — one model call per assessment.
   *
   * Both assessments used to come back from a single call. Once each one also had to carry a
   * student brief, a marking guide, a banded rubric and 10-12 questions with options and
   * rationales, that response outgrew the 32k output budget: two modules came back with
   * "Unterminated string in JSON" — truncated mid-sentence — and four others took between 14
   * and 28 minutes. One assessment per call sits well inside the budget, returns faster, and
   * confines a failure to a single assessment instead of losing the module.
   */
  private async generateModuleFormativeAssessments(
    module: any,
    moduleIndex: number,
    request: AssessmentGenerationRequest,
    formativePerModule: number,
    formativeTypes: string[]
  ): Promise<FormativeAssessment[]> {
    // Decide the format for each assessment from what the module's outcomes require,
    // within what the author permitted. Left to the prompt alone, a list of permitted
    // types produced the first two entries for all 46 modules — every Level 6 consulting
    // module assessed by multiple-choice.
    const plan = planFormativeFormats(module, formativeTypes, formativePerModule, {
      includeSummative: request.userPreferences.assessmentStructure !== 'formative_only',
    });
    if (plan.warning) {
      loggingService.warn("Permitted formats cannot evidence this module's outcomes", {
        moduleId: module?.id,
        highestBloom: plan.highestBloom,
        warning: plan.warning,
      });
    }

    const produced: FormativeAssessment[] = [];
    const failures: string[] = [];
    for (let slot = 0; slot < plan.formats.length; slot += 1) {
      try {
        const one = await this.generateOneFormative(module, moduleIndex, request, plan, slot);
        produced.push(...one);
      } catch (error) {
        failures.push(
          `${plan.formats[slot]}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      if (slot < plan.formats.length - 1) await this.delay(this.INTER_CALL_DELAY);
    }

    // One usable assessment is worth keeping; none at all is a module failure.
    if (produced.length === 0) {
      throw new Error(`No assessment could be generated for ${module.id}: ${failures.join(' | ')}`);
    }

    // Losing the graded summative is a module failure even when a formative activity
    // survived. The caller replaces the module's stored assessments with whatever comes
    // back, so returning the ungraded half as a partial success would delete a module's
    // marks, rubric and marking guide and report the module as regenerated.
    const producedSummative = produced.some(
      (fa: any) => fa?.purpose === 'module_summative' || fa?.graded === true
    );
    const wantedSummative = plan.slots.some((slot) => slot.purpose === 'module_summative');
    if (wantedSummative && !producedSummative) {
      throw new Error(
        `Only ungraded activity was generated for ${module.id}; its summative failed: ${failures.join(' | ')}`
      );
    }
    if (failures.length > 0) {
      loggingService.warn('Some assessments failed for this module; keeping the rest', {
        moduleId: module.id,
        produced: produced.length,
        failures,
      });
    }
    return produced;
  }

  /** One assessment, in the format the plan assigned to this slot. */
  private async generateOneFormative(
    module: any,
    moduleIndex: number,
    request: AssessmentGenerationRequest,
    plan: FormatPlan,
    slot: number,
    repairNote?: string
  ): Promise<FormativeAssessment[]> {
    const assignedFormat = plan.formats[slot];
    const assignedSlot = plan.slots[slot];
    // The outcomes this assessment owns, and the level it therefore has to reach. Decided
    // here rather than left to the model, which previously chose its own coverage from the
    // full list and then reported back which levels it had hit.
    const slotMlos = (module.mlos || []).filter((mlo: any) =>
      (assignedSlot?.mloIds || []).includes(String(mlo?.id))
    );
    const slotBloom = assignedSlot?.bloom || plan.highestBloom;
    // The count is set by the outcome level, but it cannot sit below the number of outcomes
    // this assessment carries: rule 6 requires every outcome evidenced by at least one task,
    // and the module summative carries ALL of them — a create-level summative over four
    // outcomes told to produce "2-4 tasks, not negotiable upward" was being ordered to break
    // one rule or the other.
    const levelPlan = questionPlanForBloom(slotBloom);
    const outcomeFloor = (assignedSlot?.mloIds || []).length || 1;
    const questionPlan = {
      ...levelPlan,
      min: Math.max(levelPlan.min, outcomeFloor),
      max: Math.max(levelPlan.max, outcomeFloor),
    };
    const slotArtefacts = requiredArtefacts({ mlos: slotMlos });
    // Formative activity is ungraded by definition; the module's summative is what carries
    // the marks. Both used to be generated as graded artefacts and filed under "formative",
    // which is what the programme's author objected to.
    const isSummative = (assignedSlot?.purpose || 'module_summative') === 'module_summative';

    // The system prompt used to describe formatives as low-stakes and "NOT heavily weighted
    // in final grades", and the same call then demanded a mark total, a marking guide and a
    // four-band rubric. Every one of a programme's 92 "formative" assessments came back
    // graded because the prompt made grading non-optional. The two purposes are now written
    // separately, in the awarding body's own terms.
    const systemPrompt = isSummative
      ? `You are an educational assessment designer producing SUMMATIVE module assessments for vocational and professional education.

A summative assessment is used at the END of the learning process. It evaluates achievement
against the module's learning outcomes and assessment criteria, and it is GRADED. It carries
a mark total, a marking guide, a banded rubric and deliverables the learner submits.

You design assessments that are:
- Aligned to every learning outcome the module claims
- Appropriate for the module's content and level
- Realistic and relevant to professional contexts
- Markable by a second marker who was not present for the teaching

${this.spellingDirective(request)}`
      : `You are an educational designer producing FORMATIVE learning activities for vocational and professional education.

A formative activity is used DURING the learning process. It provides feedback on
learning-in-process. It is DIALOGUE-BASED and UNGRADED.

This means, without exception:
- NO marks, NO mark total, NO percentage weighting, NO grade, NO pass/fail decision
- NO banded rubric and NO marking guide — nobody is awarding anything
- Its purpose is to reveal what the learner has and has not yet grasped, early enough to act
- Its output is a conversation: what the tutor says back, what the learner checks themselves
  against, what the group discusses
- A wrong answer here is useful information, not a penalty

You design activities that are:
- Aligned to specific learning outcomes, so the feedback is about something that matters
- Pitched at the level the outcome is written at
- Short enough to sit inside a taught session
- Realistic and relevant to professional contexts

${this.spellingDirective(request)}`;

    const userPrompt = `Generate EXACTLY ONE ${
      isSummative
        ? 'SUMMATIVE module assessment (graded)'
        : 'FORMATIVE learning activity (ungraded)'
    } for this module, in the format "${assignedFormat}".
${repairNote ? `\n!! THIS IS A SECOND ATTEMPT. The previous one was rejected:\n${repairNote}\n` : ''}
${this.marketContextBlock(request)}
=== PROGRAMME CONTEXT ===
Programme: ${request.programFoundation?.programTitle || 'Professional Development Programme'}
Level: ${request.programFoundation?.academicLevel || 'Certificate'}
Industry: ${request.programFoundation?.targetLearner?.industrySector || 'General'}

=== MODULE: ${module.id} - ${module.title} ===
Module Code: ${module.moduleCode || `MOD${moduleIndex + 1}`}
Total Hours: ${module.totalHours || 40}
Module Aim: ${module.aim || module.description || 'Develop core competencies in this subject area'}

**THE OUTCOMES THIS ASSESSMENT MUST EVIDENCE** (assign every question to one of these)
${slotMlos
  .map(
    (mlo: any) => `- ${mlo.id}: ${mlo.statement} [${normaliseBloom(mlo.bloomLevel).toUpperCase()}]`
  )
  .join('\n')}

**The module's other outcomes** (covered by its other assessment — do not assess these here)
${
  (module.mlos || [])
    .filter((mlo: any) => !(assignedSlot?.mloIds || []).includes(String(mlo?.id)))
    .map((mlo: any) => `- ${mlo.id}: ${mlo.statement} [${normaliseBloom(mlo.bloomLevel)}]`)
    .join('\n') || '- (none)'
}

**MODULE TOPICS:**
${(module.topics || []).map((t: any) => `- ${t.title || t}`).join('\n')}

=== ASSESSMENT REQUIREMENTS ===

**User Preferences:**
- Assessment Balance: ${request.userPreferences.assessmentBalance}
- Formative Types Permitted: ${(request.userPreferences.formativeTypesPerUnit || [])
      .filter((t: string) => t !== 'None')
      .join(', ')}
- FORMAT FOR THIS ASSESSMENT: ${assignedFormat}
- (the module's other assessment(s) use: ${
      plan.formats.filter((_, i) => i !== slot).join(', ') || 'none'
    } — do not duplicate their coverage)
- THE LEVEL THIS ASSESSMENT MUST REACH: ${slotBloom.toUpperCase()}

${scenarioDirective(scenarioProfileFor(moduleIndex), module.title)}

**HOW MANY TASKS, AND OF WHAT KIND, AT ${slotBloom.toUpperCase()} LEVEL**
Produce ${questionPlan.min}-${questionPlan.max} questions/tasks — ${questionPlan.guidance}.
This count is set by the outcome level and is NOT negotiable upward: a demanding outcome is
evidenced by fewer, larger pieces of work, not by more short ones. Do not pad the set to ten
or twelve items because that is the usual shape of a quiz.

**WHAT THE TASK MUST ASK THE LEARNER TO DO, BY OUTCOME LEVEL**
${[...new Set(slotMlos.map((m: any) => normaliseBloom(m?.bloomLevel)))]
  .map((level) => `- ${String(level).toUpperCase()}: ${TASK_SHAPES_BY_BLOOM[String(level)] || ''}`)
  .join('\n')}
${
  isSummative && slotArtefacts.length
    ? `\n**ARTEFACTS THIS ASSESSMENT'S OUTCOMES REQUIRE THE LEARNER TO PRODUCE**
${slotArtefacts.map((a) => `  - a ${a}`).join('\n')}
EVERY ONE of these must appear in THIS assessment's studentBrief.deliverables, named as the
thing being handed in — "a one-page implementation roadmap", not "answers about roadmaps",
and not "a description of a roadmap". An outcome saying "create a dashboard" is not evidenced
by questions about dashboards, nor by a wireframe, sketch, outline or description of one: the
learner hands in the artefact itself. On an earlier run 11 of 43 create-level assessments
listed the artefact's name inside a deliverable that only described it, leaving those
outcomes unassessed while appearing to satisfy the requirement.`
    : ''
}${plan.warning ? `\n- NOTE: ${plan.warning}` : ''}
- Real-World Scenarios: ${request.userPreferences.useRealWorldScenarios ? 'Yes' : 'No'}
- Workplace Performance Alignment: ${request.userPreferences.alignToWorkplacePerformance ? 'Yes' : 'No'}

**Certification Style Influence:**
${
  request.userPreferences.certificationStyles.includes('None')
    ? '- No specific certification style'
    : `- Align with: ${request.userPreferences.certificationStyles.join(', ')} standards where applicable`
}

Generate EXACTLY ONE formative assessment, in the format "${assignedFormat}", that:
1. Each assesses 2-4 MLOs from this module
2. Uses different assessment types from the requested list
3. Includes clear instructions for learners
4. Provides assessment criteria (3-5 high-level criteria, not full rubric)
5. Is appropriate for formative (low-stakes) use

=== OUTPUT FORMAT ===

Return ONLY valid JSON with COMPLETE QUESTIONS:
{
  "formativeAssessments": [
    {
      "id": "form-${module.id}-001",
      "moduleId": "${module.id}",
      "title": "<${assignedFormat}: a title naming the work, not the topic>",
      "assessmentType": "${assignedFormat}",
      "description": "<what the learner does in this assessment, at ${slotBloom.toUpperCase()} level>",
      "instructions": "<what the learner is told before starting: the setting, what is supplied, what to hand in, and how long it should take>",
      "alignedPLOs": ["PLO1", "PLO2"],
      "alignedMLOs": ${JSON.stringify(assignedSlot?.mloIds || [])},
      "assessmentCriteria": [
        "<criterion describing what is being judged, at ${slotBloom.toUpperCase()} level>",
        "<second criterion>",
        "<third criterion>"
      ],
${
  isSummative
    ? `      "maxMarks": 12,
      "studentBrief": {
        "context": "One or two sentences setting the scenario the learner is working in.",
        "task": "What the learner must actually do, in plain imperative language.",
        "deliverables": ["What they submit, one entry per artefact"],
        "conditions": "Time allowed, open/closed book, individual or group, word or length limit.",
        "submissionFormat": "e.g. single PDF, 500 words, or completed online quiz"
      },
      "markingGuide": {
        "totalMarks": 12,
        "markAllocation": [
          { "component": "Section or question group", "marks": 6, "indicativeContent": "What a correct response contains, specific enough to mark against." }
        ],
        "markerNotes": "Guidance for the marker: common misconceptions, what to accept as equivalent, where to award partial credit."
      },
      "rubric": [
        {
          "criterion": "Name the criterion, drawn from assessmentCriteria",
          "maxMarks": 6,
          "levels": [
            { "band": "Distinction", "markRange": "5-6", "descriptor": "What performance at this band looks like for THIS criterion." },
            { "band": "Merit", "markRange": "4", "descriptor": "..." },
            { "band": "Pass", "markRange": "3", "descriptor": "..." },
            { "band": "Fail", "markRange": "0-2", "descriptor": "..." }
          ]
        }
      ],`
    : `      "feedbackGuidance": "<what the tutor says back: the misconceptions this activity is designed to surface, what a strong response shows, and what to do next with a learner who has not grasped it>",
      "discussionPrompts": [
        "<a question that opens the activity out to the group and cannot be answered yes or no>",
        "<a second prompt that pushes them to justify or compare>"
      ],
      "selfCheckCriteria": [
        "<something the learner can check their own work against, in their own words>",
        "<a second self-check>"
      ],`
}
      "questions": [
        {
          "questionNumber": 1,
          "questionText": "<the complete task, with any case, data or figures the learner needs included in full>",
          "questionType": "one of: mcq | short_answer | scenario | calculation | practical | file_upload",
          "options": ["<only for mcq — otherwise omit this field>"],
          "correctAnswer": "<for mcq, the full text of the correct option; otherwise the expected response or marking points>",
${isSummative ? '          "points": 2,' : ''}
          "alignedMLO": "<the id of the ONE outcome above that this task evidences>",
          "bloomLevel": "<the level this task genuinely operates at — at or above that outcome's level>",
          "difficulty": "Easy | Medium | Hard",
          "rationale": "<why the expected answer is correct; for mcq also why each distractor is wrong>"
        }
        // ... continue for ${questionPlan.min}-${questionPlan.max} tasks in total
      ]
    }
  ]
}

CRITICAL REQUIREMENTS:
1. Generate COMPLETE actual questions - NOT just placeholders or descriptions
2. Produce ${questionPlan.min}-${questionPlan.max} tasks — the count set above for ${slotBloom.toUpperCase()} level. Do not
   produce a 10-12 item quiz unless that is the count stated for this level.
3. For MCQs: Include 4 realistic options with clear rationales
4. For scenario/calculation questions: Provide complete problem statements and expected answers
5. Choose each question's type from what the task actually requires at ${slotBloom.toUpperCase()} level. Variety
   for its own sake is NOT a goal: an MCQ inserted into an evaluate-level assessment to vary
   the format evidences nothing. Use only these values: mcq, short_answer, scenario,
   calculation, practical, file_upload.
6. Every question must carry "alignedMLO" naming exactly one outcome id from the list above,
   and every outcome in that list must be evidenced by at least one question
7. Make questions practical and relevant to ${request.programFoundation?.targetLearner?.industrySector || 'professional'} contexts
8. All question text must be complete and ready to use - NO placeholders like "[insert]" or "[fill in]"
9. For MCQs, set "correctAnswer" to the FULL TEXT of the correct option, copied EXACTLY from the "options" array (never a number, letter, or paraphrase), and begin the "rationale" by quoting that same option — so the marked answer always matches the explanation
10. Rationales should explain WHY the correct answer is right and why each other option is wrong
11. ${
      isSummative
        ? `studentBrief, markingGuide and rubric are REQUIRED and must be three distinct artefacts, not
    restatements of one another. The brief is what the learner reads and contains no answers; the
    marking guide is what the marker reads and contains the indicative content; the rubric is the
    banded criteria the mark is justified against`
        : `UNGRADED. Do NOT emit maxMarks, points, weighting, a rubric, a marking guide, a grade,
    a pass/fail decision or any mark of any kind, anywhere in the response. Emit
    feedbackGuidance, discussionPrompts and selfCheckCriteria instead — those are what this
    activity produces. An activity that awards a mark is not formative`
    }.
12. markingGuide.markAllocation must sum EXACTLY to maxMarks, and the rubric's criteria maxMarks
    must also sum EXACTLY to maxMarks. One criterion per assessmentCriteria entry.
12a. The two must AGREE with each other, not merely each add up. Use the same components in
    the same order with the same marks in markAllocation and rubric — the guide says what a
    correct response contains, the rubric says how well it was done, and they must be two
    views of ONE mark split. In an earlier bank both summed correctly while splitting the
    marks differently in 35 of 92 assessments, so two markers using the two documents awarded
    different marks for identical work.
13. Rubric descriptors must be specific to this module's content — a descriptor that would read
    identically on any assessment ("shows good understanding") is not usable for marking.
14. Do NOT invent a percentage weighting; the programme's formative/summative split is applied
    afterwards from the author's own settings.
15. assessmentType MUST be the format assigned to that assessment in the list above. Do not
    substitute a quiz or MCQ check for a case exercise or simulation.
16. BLOOM FLOOR — every question must work at or above the Bloom level of the outcome named in
    its own "alignedMLO" field. This is checked in code after you reply, against that field
    and the outcome levels stated above, and an assessment that does not reach the level its
    outcomes demand is sent back for regeneration — so a question labelled at a level its
    text does not support will not pass.
    An outcome written at APPLY cannot be evidenced by a recall question, and one written at
    EVALUATE or CREATE cannot be evidenced by a question that only asks the learner to apply a
    formula. Lower-level questions may be included ONLY as scaffolding within an assessment
    whose main tasks meet the outcome's level, and the assessment as a whole must reach it.
17. Set each question's bloomLevel to the level that question genuinely operates at — do not
    label a recall question "apply" to satisfy rule 16.
18. TASK SHAPE — every task must take the shape listed above for the outcome level it
    assesses. At understand level a quiz is correct, but the items must ask the learner to
    explain, interpret, classify, compare, summarise or pick the right explanation for a
    situation — not to recall a definition. At analyse level give them a case, a dataset or
    a scenario to diagnose. At evaluate level require a judgement WITH justification, or a
    comparison leading to a recommendation. At create level the deliverable is the evidence.
19. MCQ ANSWER DESIGN — every option in an item must be within 20% of the others in
    character count, and share the same grammatical shape. Count the characters before you
    finalise an item. Do NOT write a correct option that is longer, more qualified or more
    detailed than its distractors: measured on an earlier bank the correct option was the
    longest in 82% of items and, at the median, 36% longer than the average distractor, so a
    candidate scoring by length alone passed without studying. A distractor must be wrong on
    the subject, never wrong because it is terser or vaguer than the answer.
20. Difficulty may rise from Easy to Hard across a set of short items, but never by opening a
    demanding assessment with recall: at analyse level and above, the first task already sits
    at the outcome's level. "Easy" there means a smaller case, not a lower cognitive demand.`;

    try {
      const response = await openaiService.generateContent(userPrompt, systemPrompt, {
        maxTokens: this.MAX_TOKENS_FORMATIVE,
        timeout: this.MODULE_TIMEOUT,
      });

      const parsed = this.parseJSON(response, `formative-${module.id}`);
      const formativeAssessments = parsed.formativeAssessments || [];
      // Valid JSON containing no assessment is a failed slot, not an empty success — the
      // caller must be able to retry it rather than persist the absence.
      if (formativeAssessments.length === 0) {
        throw new Error(`Model returned no assessment for ${module.id} (${assignedFormat})`);
      }
      // Reconcile MCQ correct-answer with its rationale (text ↔ index), then even out the
      // answer key. Left as generated, 69% of correct answers landed on option A — enough
      // for a candidate to pass the bank by always choosing A.
      // PLO alignment is derived from the curriculum, never taken from the model: asked to
      // name them, it cited PLOs the module is not mapped to in 71% of cases and invented
      // identifiers that do not exist at all.
      const programmePloIds = new Set<string>(
        ((request.courseFramework?.programLearningOutcomes as any[]) || [])
          .map((plo: any) => plo?.code || plo?.id)
          .filter(Boolean)
      );
      for (const fa of formativeAssessments) {
        fa.alignedPLOs = derivePloAlignment(fa, module, programmePloIds);

        // The format and the outcome coverage were decided here before the call; take them
        // back rather than accepting whatever came home. Rule 15 asked the model not to
        // substitute a quiz for a simulation, and nothing checked that it had not.
        fa.assessmentType = assignedFormat;
        fa.moduleId = module.id;
        fa.alignedMLOs = [...(assignedSlot?.mloIds || fa.alignedMLOs || [])];
        fa.purpose = assignedSlot?.purpose || 'module_summative';
        fa.graded = isSummative;

        // Enforced here, not merely asked for. Told not to award marks, a model still
        // reaches for a mark total and a rubric because that is the shape of almost every
        // assessment it has seen — and an ungraded activity carrying a mark is the exact
        // thing the programme's author objected to.
        if (!isSummative) {
          delete fa.maxMarks;
          delete fa.weighting;
          delete fa.rubric;
          delete fa.markingGuide;
          delete fa.studentBrief;
          for (const q of fa?.questions || []) delete q.points;
        }

        const validMloIds = new Set((assignedSlot?.mloIds || []).map(String));
        // Pinned to the most demanding outcome this assessment carries, not whichever the
        // curriculum happens to list first: the fallback sets the floor the question is then
        // judged against, so the lenient choice would quietly excuse it.
        const levelOfMlo = new Map<string, string>(
          (module.mlos || []).map((m: any) => [String(m?.id), normaliseBloom(m?.bloomLevel)])
        );
        const fallbackMlo =
          [...(assignedSlot?.mloIds || [])].sort(
            (a, b) =>
              bloomIndex(levelOfMlo.get(String(b)) || '') -
              bloomIndex(levelOfMlo.get(String(a)) || '')
          )[0] || null;
        for (const q of fa?.questions || []) {
          q.questionType = normaliseQuestionType(q?.questionType);
          q.bloomLevel = normaliseBloom(q?.bloomLevel);
          // A question naming an outcome this assessment does not own cannot be checked
          // against anything, so it is pinned to the assessment's most demanding outcome
          // rather than left to float free of the taxonomy.
          if (!q.alignedMLO || !validMloIds.has(String(q.alignedMLO))) {
            q.alignedMLO = fallbackMlo;
          }
          if (q?.questionType === 'mcq') normalizeMcqAnswer(q);
        }

        // Derived, never taken from the model: the outcomes already carry their levels, and
        // asked for them directly the model returned levels no aligned outcome held.
        fa.targetBloomLevels = deriveTargetBloomLevels(fa, module);
        const { balanced, skipped } = balanceMcqPositions(fa?.questions || []);
        if (skipped > 0) {
          loggingService.warn('MCQ items left unbalanced because the answer key was ambiguous', {
            moduleId: module.id,
            assessment: fa?.id,
            skipped,
            balanced,
          });
        }
      }

      // Check what came back against the level its own outcomes demand. Without this the
      // Bloom floor was an instruction and nothing more, and every validation flag on the
      // step was green while 79% of the questions in the create-level modules of the Bachelor
      // in Business Administration sat below create.
      if (!repairNote) {
        const failing = formativeAssessments
          .map((fa: any) => ({ fa, audit: auditAssessmentBloom(fa, module) }))
          .filter(({ audit }) => !audit.meetsFloor || audit.belowFloor.length > 0);

        if (failing.length > 0) {
          const { audit } = failing[0];
          const note = [
            !audit.meetsFloor
              ? `No task reached ${String(audit.required).toUpperCase()} level — the highest was ${String(audit.reached || 'none').toUpperCase()}. The outcomes this assessment carries are written at ${String(audit.required).toUpperCase()}, so at least one task must operate there: ${TASK_SHAPES_BY_BLOOM[String(audit.required)] || ''}.`
              : null,
            audit.belowFloor.length > 0
              ? `${audit.belowFloor.length} question(s) sat below the level of the outcome they were mapped to: ${audit.belowFloor
                  .slice(0, 6)
                  .map(
                    (b) =>
                      `Q${b.questionNumber} was ${b.level} but ${b.mlo} is written at ${b.required}`
                  )
                  .join(
                    '; '
                  )}. Rewrite those tasks to work at the outcome's level, or map them to an outcome they genuinely evidence.`
              : null,
          ]
            .filter(Boolean)
            .join('\n');

          loggingService.warn('Assessment did not meet its Bloom floor; regenerating once', {
            moduleId: module.id,
            format: assignedFormat,
            required: audit.required,
            reached: audit.reached,
            belowFloor: audit.belowFloor.length,
          });

          // The repair is a second model call and can fail in every way the first can. A
          // throw here used to take the usable first attempt down with it, and an empty
          // array scored zero — better than any real assessment — so a parse that returned
          // nothing replaced a working assessment with none at all. Both were ways of
          // losing content while reporting success, which is the failure this whole run has
          // been about.
          let repaired: FormativeAssessment[] = [];
          try {
            repaired = await this.generateOneFormative(
              module,
              moduleIndex,
              request,
              plan,
              slot,
              note
            );
          } catch (repairError) {
            loggingService.warn('Bloom repair attempt failed; keeping the first attempt', {
              moduleId: module.id,
              format: assignedFormat,
              error: repairError instanceof Error ? repairError.message : String(repairError),
            });
            return formativeAssessments;
          }

          // Keep the better of the two rather than assuming the retry improved things.
          const scoreOf = (list: any[]) =>
            list.reduce((worst: number, fa: any) => {
              const a = auditAssessmentBloom(fa, module);
              return worst + (a.meetsFloor ? 0 : 100) + a.belowFloor.length;
            }, 0);
          if (repaired.length > 0 && scoreOf(repaired) <= scoreOf(formativeAssessments)) {
            return repaired;
          }
        }
      }

      return formativeAssessments;
    } catch (error) {
      loggingService.error(`Error generating formative for module ${module.id}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Generate Summative Assessments
   */
  private async generateSummativeAssessments(
    request: AssessmentGenerationRequest,
    progressCallback?: (progress: AssessmentGenerationProgress) => void
  ): Promise<SummativeAssessment[]> {
    if (progressCallback) {
      progressCallback({
        stage: 'summative',
        currentType: 'comprehensive',
        totalSteps: 1,
        completedSteps: 0,
        estimatedTimeRemaining: 4 * 60, // 4 minutes
      });
    }

    loggingService.info('Generating Summative Assessments', {
      format: request.userPreferences.summativeFormat,
    });

    const systemPrompt = `You are a senior assessment designer specializing in summative assessments for vocational and professional certification programmes.

Summative assessments are high-stakes, comprehensive evaluations that:
- Assess achievement of programme/module learning outcomes
- Determine final grades and certification eligibility
- Integrate knowledge across multiple topics/modules
- Simulate real-world professional scenarios
- Have clear marking criteria or rubrics

You design assessments that:
- Are aligned to PLOs (Programme Learning Outcomes)
- Use appropriate assessment methods for the learning outcomes
- Include detailed marking models (criteria or rubrics)
- Are fair, valid, and reliable
- Meet professional/certification body standards where applicable

${this.spellingDirective(request)}`;

    const modules = request.modules || [];
    const plos = request.courseFramework.programLearningOutcomes || [];

    const userPrompt = `Generate a comprehensive summative assessment for this programme.
${this.marketContextBlock(request)}
=== PROGRAMME CONTEXT ===
Programme: ${request.programFoundation?.programTitle || 'Professional Development Programme'}
Level: ${request.programFoundation?.academicLevel || 'Certificate'}
Industry: ${request.programFoundation?.targetLearner?.industrySector || 'General'}
Total Modules: ${modules.length}

**PROGRAMME LEARNING OUTCOMES (PLOs):**
${plos.map((plo: any) => `- ${plo.id || plo.code}: ${plo.statement} [${plo.bloomLevel}]`).join('\n')}

=== MODULES COVERED ===
${modules
  .map(
    (mod: any, idx: number) => `
**Module ${idx + 1}: ${mod.id} - ${mod.title}**
MLOs: ${(mod.mlos || []).map((mlo: any) => mlo.id).join(', ')}
Topics: ${(mod.topics || [])
      .slice(0, 3)
      .map((t: any) => t.title || t)
      .join(', ')}
`
  )
  .join('\n')}

=== ASSESSMENT REQUIREMENTS ===

**User Preferences:**
- Format: ${request.userPreferences.summativeFormat}
${request.userPreferences.summativeFormat === 'user_defined' ? `- Custom Description: ${request.userPreferences.userDefinedSummativeDescription}` : ''}
- Assessment Balance: ${request.userPreferences.assessmentBalance}
- Integrated Real-World: ${request.userPreferences.integratedRealWorldSummative ? 'Yes' : 'No'}
- Higher-Order PLO Policy: ${request.userPreferences.higherOrderPloPolicy}
${request.userPreferences.higherOrderPloRules ? `- Higher-Order Rules: ${request.userPreferences.higherOrderPloRules}` : ''}

**Grading model:**
- Each module is graded independently by its own summative assessment.
- This programme-level assessment applies only where the university requires an overall
  assessment IN ADDITION to the module grades.
- Do NOT state or imply that it carries a fixed percentage of the programme grade, and do NOT
  describe the module assessments as a percentage pool. The stored formative/summative
  numbers are legacy preference keys, not a programme split, and the programme's reviewer
  rejected that reading explicitly.

**Certification Style Influence:**
${
  request.userPreferences.certificationStyles.includes('None')
    ? '- No specific certification style'
    : `- Align with: ${request.userPreferences.certificationStyles.join(', ')} assessment patterns`
}

**Academic Types (if applicable):**
${request.userPreferences.academicTypes.filter((t) => t !== 'None').join(', ') || 'None specified'}

Generate 1 course-level summative assessment with:
1. Multiple components (sections) that together assess all PLOs
2. Clear alignment table showing which PLOs are assessed by which components
3. Component weightings that sum to 100%
4. Appropriate marking model (criteria-based or full rubric)
5. Integration across modules where appropriate

=== OUTPUT FORMAT ===

Return ONLY valid JSON. NO markdown. NO additional text. JUST the JSON object below:

{
  "summativeAssessments": [
    {
      "id": "summ-course-001",
      "scope": "course_level",
      "title": "Final Comprehensive Assessment",
      "format": "${request.userPreferences.summativeFormat}",
      "overview": "A comprehensive assessment integrating knowledge and skills from all modules",
      "alignmentTable": [
        {"ploId": "PLO1", "componentIds": ["comp-001", "comp-002"]}
      ],
      "components": [
        {
          "id": "comp-001",
          "name": "Section A: Multiple Choice Examination",
          "componentType": "mcq_section",
          "weight": 40,
          "description": "60 MCQ questions testing knowledge integration across all modules"
        }
      ],
      "markingModel": {
        "type": "criteria_only",
        "criteria": [
          {"name": "Knowledge and Understanding", "description": "Demonstrates comprehensive understanding", "weight": 30}
        ]
      }
    }
  ]
}

JSON FORMATTING RULES - CRITICAL:
1. ALL string values must use double quotes, not single quotes
2. NO trailing commas after last array/object items
3. ALL property names must be in double quotes
4. NO comments in the JSON
5. Ensure ALL PLOs are mapped to at least one component
6. Component weights must sum to 100%
7. Keep descriptions concise (under 200 chars each)
8. Return VALID JSON ONLY - test your JSON before responding`;

    let summatives: any[] = [];
    let attempt = 0;
    const maxAttempts = 2;

    while (attempt < maxAttempts) {
      try {
        attempt++;
        loggingService.info(`Generating summative assessments (attempt ${attempt}/${maxAttempts})`);

        const response = await openaiService.generateContent(userPrompt, systemPrompt, {
          maxTokens: this.MAX_TOKENS_SUMMATIVE,
          timeout: this.SUMMATIVE_TIMEOUT,
        });

        const parsed = this.parseJSON(response, 'summative-assessments');
        summatives = parsed.summativeAssessments || [];

        if (progressCallback) {
          progressCallback({
            stage: 'summative',
            totalSteps: 1,
            completedSteps: 1,
            data: {
              summatives,
            },
          });
        }

        loggingService.info(`Summative assessments generated successfully on attempt ${attempt}`);
        return summatives;
      } catch (error) {
        loggingService.error(`Summative generation attempt ${attempt} failed`, {
          error: error instanceof Error ? error.message : String(error),
        });

        if (attempt >= maxAttempts) {
          // All attempts failed - return empty array to allow generation to continue
          loggingService.warn(
            'All summative generation attempts failed, continuing with empty summatives'
          );

          if (progressCallback) {
            progressCallback({
              stage: 'summative',
              totalSteps: 1,
              completedSteps: 0,
              error: `Summative generation failed after ${maxAttempts} attempts: ${error instanceof Error ? error.message : String(error)}`,
            });
          }

          // Don't throw - return empty array so samples can still generate
          return [];
        }

        // Wait before retry
        await this.delay(2000);
      }
    }

    return summatives;
  }

  /**
   * Generate Sample Questions - Batched by type
   */
  private async generateSampleQuestions(
    request: AssessmentGenerationRequest,
    progressCallback?: (progress: AssessmentGenerationProgress) => void
  ): Promise<SampleQuestions> {
    loggingService.info('Generating Sample Questions');

    const sampleQuestions: SampleQuestions = {
      mcq: [],
      sjt: [],
      caseQuestions: [],
      essayPrompts: [],
      practicalTasks: [],
    };

    const questionTypes: Array<{ type: keyof SampleQuestions; count: number }> = [
      { type: 'mcq', count: 30 }, // 30 MCQ samples
      { type: 'sjt', count: 10 }, // 10 SJT scenarios
      { type: 'caseQuestions', count: 5 }, // 5 case studies
      { type: 'essayPrompts', count: 5 }, // 5 essay prompts
      { type: 'practicalTasks', count: 5 }, // 5 practical tasks
    ];

    let completedTypes = 0;

    for (const { type, count } of questionTypes) {
      if (progressCallback) {
        progressCallback({
          stage: 'samples',
          currentType: type,
          totalSteps: questionTypes.length,
          completedSteps: completedTypes,
          estimatedTimeRemaining: (questionTypes.length - completedTypes) * 3 * 60,
        });
      }

      try {
        const samples = await this.generateSampleQuestionsByType(request, type, count);
        sampleQuestions[type] = samples as any; // Type assertion needed due to union type

        loggingService.info(`Generated ${type} samples`, { count: samples.length });

        // Send data callback for streaming (after each sample type completes)
        if (progressCallback) {
          progressCallback({
            stage: 'samples',
            currentType: type,
            totalSteps: questionTypes.length,
            completedSteps: completedTypes + 1,
            data: {
              sampleType: type,
              samples,
            },
          });
        }

        // Delay between types
        if (completedTypes < questionTypes.length - 1) {
          await this.delay(this.INTER_CALL_DELAY);
        }
      } catch (error) {
        loggingService.error(`Failed to generate ${type} samples`, {
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue with next type
      }

      completedTypes++;
    }

    return sampleQuestions;
  }

  /**
   * Generate sample questions by specific type
   */
  private async generateSampleQuestionsByType(
    request: AssessmentGenerationRequest,
    type: keyof SampleQuestions,
    count: number
  ): Promise<any[]> {
    const plos = request.courseFramework.programLearningOutcomes || [];
    const modules = request.modules || [];

    // Build type-specific prompt
    const typePrompts: Record<string, { system: string; user: string }> = {
      mcq: {
        system: `You are an MCQ design expert creating high-quality multiple-choice questions for professional assessment.`,
        user: `Generate ${count} MCQ sample questions covering the programme learning outcomes.

**PLOs:** ${plos.map((plo: any) => `${plo.id}: ${plo.statement}`).join('; ')}

Return JSON:
{
  "samples": [
    {
      "stem": "Question text here",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Option B",
      "rationale": "Correct answer: 'Option B'. Explanation of why it is right and the others are wrong.",
      "alignedPLOs": ["PLO1", "PLO2"]
    }
  ]
}

For each question set "correctAnswer" to the FULL TEXT of the correct option, copied EXACTLY from "options" (never a number or letter), and begin "rationale" by quoting that same option so the marked answer always matches the explanation.`,
      },
      sjt: {
        system: `You are an SJT (Situational Judgment Test) design expert creating workplace scenario questions.`,
        user: `Generate ${count} SJT sample questions for professional workplace scenarios.

**Industry:** ${request.programFoundation?.targetLearner?.industrySector}

Return JSON:
{
  "samples": [
    {
      "scenario": "Workplace situation description",
      "options": [
        {"text": "Action 1", "effectivenessRank": 1, "isPreferred": true},
        {"text": "Action 2", "effectivenessRank": 2}
      ],
      "guidance": "Explanation of why certain responses are better",
      "alignedPLOs": ["PLO1"]
    }
  ]
}`,
      },
      caseQuestions: {
        system: `You are a case study designer creating realistic business/professional case scenarios.`,
        user: `Generate ${count} case study samples with prompts.

Return JSON:
{
  "samples": [
    {
      "caseText": "400-600 word case scenario",
      "prompts": ["Analyze...", "Evaluate...", "Recommend..."],
      "alignedPLOs": ["PLO1", "PLO2"]
    }
  ]
}`,
      },
      essayPrompts: {
        system: `You are an academic writing prompt designer.`,
        user: `Generate ${count} essay prompt samples.

Return JSON:
{
  "samples": [
    {
      "promptText": "Essay question or prompt",
      "expectedFocus": "What the answer should cover",
      "alignedPLOs": ["PLO1"]
    }
  ]
}`,
      },
      practicalTasks: {
        system: `You are a practical assessment designer for vocational/professional education.`,
        user: `Generate ${count} practical task samples.

Return JSON:
{
  "samples": [
    {
      "taskDescription": "Practical task to complete",
      "evidenceRequired": "What evidence/output is needed",
      "assessmentCriteria": ["Criterion 1", "Criterion 2"],
      "alignedPLOs": ["PLO1"]
    }
  ]
}`,
      },
    };

    const prompts = typePrompts[type];
    if (!prompts) {
      throw new Error(`Unknown sample question type: ${type}`);
    }

    try {
      const response = await openaiService.generateContent(
        prompts.user + this.marketContextBlock(request),
        prompts.system,
        {
          maxTokens: this.MAX_TOKENS_SAMPLES,
          timeout: this.SAMPLE_BATCH_TIMEOUT,
        }
      );

      const parsed = this.parseJSON(response, `samples-${type}`);
      const samples = parsed.samples || [];
      // Reconcile MCQ correct-answer with its rationale (text ↔ index).
      if (type === 'mcq') {
        for (const s of samples) normalizeMcqAnswer(s);
      }
      return samples;
    } catch (error) {
      loggingService.error(`Error generating ${type} samples`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Generate LMS Packages (logical structures)
   */
  private async generateLMSPackages(
    request: AssessmentGenerationRequest,
    response: AssessmentGenerationResponse,
    progressCallback?: (progress: AssessmentGenerationProgress) => void
  ): Promise<LMSPackages> {
    if (progressCallback) {
      progressCallback({
        stage: 'lms',
        totalSteps: 1,
        completedSteps: 0,
        estimatedTimeRemaining: 30, // 30 seconds
      });
    }

    loggingService.info('Generating LMS Packages (logical structures)');

    // For now, create simple logical structures
    // In a full implementation, this would generate IMSCC, Moodle XML, etc.
    const lmsPackages: LMSPackages = {
      canvas: {
        courseId: request.courseFramework.courseId,
        assessments: [
          ...response.formativeAssessments.map((fa) => ({
            type: 'formative',
            id: fa.id,
            title: fa.title,
            moduleId: fa.moduleId,
          })),
          ...response.summativeAssessments.map((sa) => ({
            type: 'summative',
            id: sa.id,
            title: sa.title,
            scope: sa.scope,
          })),
        ],
      },
      moodle: {
        courseId: request.courseFramework.courseId,
        assessments: [
          ...response.formativeAssessments.map((fa) => ({
            type: 'formative',
            id: fa.id,
            title: fa.title,
            moduleId: fa.moduleId,
          })),
          ...response.summativeAssessments.map((sa) => ({
            type: 'summative',
            id: sa.id,
            title: sa.title,
            scope: sa.scope,
          })),
        ],
      },
      blackboard: {
        courseId: request.courseFramework.courseId,
        assessments: [
          ...response.formativeAssessments.map((fa) => ({
            type: 'formative',
            id: fa.id,
            title: fa.title,
            moduleId: fa.moduleId,
          })),
          ...response.summativeAssessments.map((sa) => ({
            type: 'summative',
            id: sa.id,
            title: sa.title,
            scope: sa.scope,
          })),
        ],
      },
    };

    if (progressCallback) {
      progressCallback({
        stage: 'lms',
        totalSteps: 1,
        completedSteps: 1,
        data: {
          lmsPackages,
        },
      });
    }

    return lmsPackages;
  }

  /**
   * Parse JSON with error handling
   */
  private parseJSON(content: string, context: string): any {
    try {
      // Remove markdown code blocks if present
      let cleaned = content.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.substring(7);
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.substring(3);
      }
      if (cleaned.endsWith('```')) {
        cleaned = cleaned.substring(0, cleaned.length - 3);
      }
      cleaned = cleaned.trim();

      // Try standard parse first
      try {
        return JSON.parse(cleaned);
      } catch (firstError) {
        // Try common fixes for JSON errors
        loggingService.warn(`JSON parse failed, attempting repairs for ${context}`, {
          error: firstError instanceof Error ? firstError.message : String(firstError),
        });

        // Fix 1: Remove trailing commas
        let repaired = cleaned.replace(/,(\s*[}\]])/g, '$1');

        // Fix 2: Replace single quotes with double quotes (but not in strings)
        // This is risky but can help with some LLM outputs

        // Fix 3: Try to find and extract just the JSON object
        const jsonMatch = repaired.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          repaired = jsonMatch[0];
        }

        // Try parsing the repaired version
        try {
          loggingService.info(`JSON repair succeeded for ${context}`);
          return JSON.parse(repaired);
        } catch (secondError) {
          // If repair failed, throw original error
          throw firstError;
        }
      }
    } catch (error) {
      loggingService.error(`JSON parse error in ${context}`, {
        error: error instanceof Error ? error.message : String(error),
        contentPreview: content.substring(0, 500),
      });
      throw new Error(
        `Failed to parse JSON response for ${context}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const assessmentGeneratorService = new AssessmentGeneratorService();
