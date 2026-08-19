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

/** Bloom levels in order, so "at least this demanding" is answerable. */
const BLOOM_ORDER = ['remember', 'understand', 'apply', 'analyse', 'evaluate', 'create'];

const normaliseBloom = (level: string | undefined): string => {
  const value = String(level || '')
    .toLowerCase()
    .trim();
  // British and American spellings both appear in stored outcomes.
  if (value === 'analyze') return 'analyse';
  return BLOOM_ORDER.includes(value) ? value : 'understand';
};

/**
 * Which formative formats can actually evidence a given Bloom level.
 *
 * A multiple-choice knowledge check cannot show that a learner can evaluate a client's
 * current-state process or create a work breakdown structure — it can only show they
 * recognise the right answer. An author who ticks every format still needs the format
 * chosen per module, because a Level 4 introduction and a Level 6 consulting module are
 * not assessed the same way.
 */
const FORMATS_BY_BLOOM: Record<string, string[]> = {
  remember: ['Short quizzes', 'MCQ knowledge checks', 'Worksheets / problem sets'],
  understand: [
    'Short quizzes',
    'MCQ knowledge checks',
    'Worksheets / problem sets',
    'Short written reflections',
    'Discussion prompts',
  ],
  apply: [
    'Scenario-based micro-tasks',
    'Worksheets / problem sets',
    'Practice simulations',
    'Coding / technical tasks',
    'Short quizzes',
  ],
  analyse: [
    'Mini-case exercises',
    'Scenario-based micro-tasks',
    'Practice simulations',
    'Coding / technical tasks',
    'Discussion prompts',
  ],
  evaluate: [
    'Mini-case exercises',
    'Practice simulations',
    'Short written reflections',
    'Discussion prompts',
    'Scenario-based micro-tasks',
  ],
  create: [
    'Mini-case exercises',
    'Practice simulations',
    'Coding / technical tasks',
    'Scenario-based micro-tasks',
  ],
};

/**
 * What a task must actually ask the learner to do, per Bloom level.
 *
 * Supplied by the programme's subject-matter expert, and it fixes something the format
 * names alone could not. Choosing "mini-case exercise" for a create-level outcome still
 * left the assessment asking questions about a plan rather than requiring the learner to
 * produce one: across the programme, 36 of 47 create-level outcomes name a concrete
 * artefact — a dashboard, report, proposal, roadmap — and no assessment collected it.
 *
 * Her wording is kept verbatim so the intent is not paraphrased away, including the point
 * that quizzes and multiple-choice are perfectly valid at understand level provided they
 * test comprehension rather than recall.
 */
const TASK_SHAPES_BY_BLOOM: Record<string, string> = {
  remember:
    'recall and recognition items, used sparingly and only as scaffolding towards a higher-level task',
  understand:
    'explaining a concept, interpreting information, classifying examples, comparing concepts, summarising meaning, or selecting the correct explanation in a scenario — quizzes and MCQs are valid here PROVIDED they assess comprehension, not simple memorisation',
  apply:
    'working a method or framework on a given case: calculations with interpretation, applying a model to a scenario, producing a worked output',
  analyse: 'case analysis, data or problem analysis, scenario diagnosis',
  evaluate: 'critical evaluation, comparison with justification, recommendations',
  create:
    'a project or design task, a strategy proposal, an implementation plan, or a presentation/report — the learner must PRODUCE the artefact, not answer questions about producing one',
};

/**
 * Artefacts a create-level outcome commonly names. Used to check that the assessment
 * actually collects what the outcome promises.
 */
const ARTEFACT_WORDS = [
  'dashboard',
  'report',
  'plan',
  'proposal',
  'presentation',
  'roadmap',
  'model',
  'brief',
  'strategy',
  'map',
  'portfolio',
  'framework',
  'pack',
  'budget',
  'forecast',
];

/** The artefacts this module's outcomes require the learner to produce, if any. */
export function requiredArtefacts(module: any): string[] {
  const wanted = new Set<string>();
  for (const mlo of module?.mlos || []) {
    const level = normaliseBloom(mlo?.bloomLevel);
    if (level !== 'create' && level !== 'evaluate') continue;
    const statement = String(mlo?.statement || '').toLowerCase();
    for (const word of ARTEFACT_WORDS) {
      if (statement.includes(word)) wanted.add(word);
    }
  }
  return [...wanted];
}

export interface FormatPlan {
  /** One format per assessment, chosen for the outcomes it has to evidence. */
  formats: string[];
  /** The most demanding Bloom level this module's outcomes ask for. */
  highestBloom: string;
  /** Set when the author's permitted formats cannot evidence that level. */
  warning: string | null;
}

/**
 * Choose the format for each of a module's assessments.
 *
 * Constrained to what the author permitted — their list is a decision, not a suggestion —
 * but ordered by what the module's outcomes actually require, so the demanding modules get
 * the case exercises and simulations rather than everything collapsing to the first two
 * entries on the list. Where the permitted list cannot evidence the module's highest Bloom
 * level, that is reported rather than silently accepted.
 */
export function planFormativeFormats(
  module: any,
  allowedTypes: string[],
  count: number
): FormatPlan {
  const allowed = (allowedTypes || []).filter((type) => type && type !== 'None');
  const blooms = (module?.mlos || []).map((mlo: any) => normaliseBloom(mlo?.bloomLevel));
  const highestBloom = blooms.length
    ? blooms.reduce((a: string, b: string) =>
        BLOOM_ORDER.indexOf(b) > BLOOM_ORDER.indexOf(a) ? b : a
      )
    : 'understand';

  if (allowed.length === 0) {
    return { formats: [], highestBloom, warning: null };
  }

  const suited = (FORMATS_BY_BLOOM[highestBloom] || []).filter((f) => allowed.includes(f));
  const rest = allowed.filter((f) => !suited.includes(f));

  // Rotate WITHIN the suited formats so modules sharing a Bloom level do not all receive an
  // identical pair — "blended mix" should mean something across the programme, not only
  // within a module. Rotating over the whole permitted list instead put quizzes and MCQ
  // checks back onto create-level consulting modules, which is the very complaint this
  // exists to answer, so the unsuited formats are only ever used to make up a shortfall.
  const rotation = Number(module?.sequenceOrder ?? 0) || 0;
  const formats: string[] = [];
  for (let i = 0; i < count; i += 1) {
    if (suited.length > 0) {
      formats.push(suited[(rotation + i) % suited.length]);
    } else if (rest.length > 0) {
      formats.push(rest[(rotation + i) % rest.length]);
    }
  }

  // A module needing more assessments than there are suitable formats reuses them rather
  // than dropping to an unsuitable one; only an empty suited list falls back.
  const ordered = [...suited, ...rest];
  while (formats.length < count && ordered.length > 0) {
    formats.push(ordered[formats.length % ordered.length]);
  }

  const warning =
    suited.length === 0
      ? `Module "${module?.title || module?.id}" has outcomes at Bloom level "${highestBloom}", which none of the permitted formative formats (${allowed.join(', ')}) can evidence. Consider allowing mini-case exercises or practice simulations.`
      : null;

  return { formats, highestBloom, warning };
}

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
    if (!market) return 'Use UK English spelling throughout.';
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
    const plan = planFormativeFormats(module, formativeTypes, formativePerModule);
    if (plan.warning) {
      loggingService.warn("Permitted formats cannot evidence this module's outcomes", {
        moduleId: module?.id,
        highestBloom: plan.highestBloom,
        warning: plan.warning,
      });
    }

    const systemPrompt = `You are an educational assessment designer specializing in formative assessments for vocational and professional education.

Formative assessments are low-stakes, frequent checks for understanding that:
- Provide immediate feedback to learners
- Identify knowledge gaps early
- Support progressive skill development
- Are NOT heavily weighted in final grades
- Encourage practice and experimentation

You design assessments that are:
- Aligned to specific learning outcomes
- Appropriate for the module's content and level
- Varied in format to maintain engagement
- Realistic and relevant to professional contexts

${this.spellingDirective(request)}`;

    const userPrompt = `Generate ${formativePerModule} formative assessment(s) for this module.
${this.marketContextBlock(request)}
=== PROGRAMME CONTEXT ===
Programme: ${request.programFoundation?.programTitle || 'Professional Development Programme'}
Level: ${request.programFoundation?.academicLevel || 'Certificate'}
Industry: ${request.programFoundation?.targetLearner?.industrySector || 'General'}

=== MODULE: ${module.id} - ${module.title} ===
Module Code: ${module.moduleCode || `MOD${moduleIndex + 1}`}
Total Hours: ${module.totalHours || 40}
Module Aim: ${module.aim || 'Develop core competencies in this subject area'}

**MODULE LEARNING OUTCOMES (MLOs):**
${(module.mlos || []).map((mlo: any) => `- ${mlo.id}: ${mlo.statement} [${mlo.bloomLevel}]`).join('\n')}

**MODULE TOPICS:**
${(module.topics || []).map((t: any) => `- ${t.title || t}`).join('\n')}

=== ASSESSMENT REQUIREMENTS ===

**User Preferences:**
- Assessment Balance: ${request.userPreferences.assessmentBalance}
- Formative Types Permitted: ${formativeTypes.filter((t) => t !== 'None').join(', ')}
- FORMAT FOR EACH ASSESSMENT (use exactly these, in this order, one per assessment):
${plan.formats.map((f, i) => `  ${i + 1}. ${f}`).join('\n')}
- Most demanding outcome level in this module: ${plan.highestBloom.toUpperCase()}

**WHAT THE TASK MUST ASK THE LEARNER TO DO, BY OUTCOME LEVEL**
${[...new Set((module.mlos || []).map((m: any) => normaliseBloom(m?.bloomLevel)))]
  .map((level) => `- ${String(level).toUpperCase()}: ${TASK_SHAPES_BY_BLOOM[String(level)] || ''}`)
  .join('\n')}
${
  requiredArtefacts(module).length
    ? `\n**ARTEFACTS THIS MODULE'S OUTCOMES REQUIRE THE LEARNER TO PRODUCE:** ${requiredArtefacts(
        module
      ).join(
        ', '
      )}\nAt least one assessment MUST collect the artefact itself as a deliverable. An outcome that says "create a dashboard" is not evidenced by questions about dashboards.`
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

Generate ${formativePerModule} formative assessment(s) that:
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
      "title": "Short Quiz: Core Concepts in [Topic]",
      "assessmentType": "<the format assigned to this assessment above>",
      "targetBloomLevels": ["the Bloom level of each MLO this assessment covers"],
      "description": "A 10-12 question quiz covering fundamental concepts from this module",
      "instructions": "Complete this quiz after reviewing the module materials. You have 20 minutes. Questions test your understanding of key definitions and principles.",
      "alignedPLOs": ["PLO1", "PLO2"],
      "alignedMLOs": ["${module.mlos?.[0]?.id || 'M1-LO1'}", "${module.mlos?.[1]?.id || 'M1-LO2'}"],
      "assessmentCriteria": [
        "Accurate recall of key terminology",
        "Correct application of concepts to simple scenarios",
        "Understanding of relationships between concepts"
      ],
      "maxMarks": 12,
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
      ],
      "questions": [
        {
          "questionNumber": 1,
          "questionText": "What is the primary purpose of [concept] in [context]?",
          "questionType": "mcq",
          "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
          "correctAnswer": "Option B text",
          "points": 1,
          "bloomLevel": "Remember",
          "difficulty": "Easy",
          "rationale": "Correct answer: 'Option B text'. Explanation of why this option is right and why each other option is wrong."
        },
        {
          "questionNumber": 2,
          "questionText": "In the following scenario: [scenario description]. Which approach would you take and why?",
          "questionType": "scenario",
          "correctAnswer": "Expected response covering key points...",
          "points": 2,
          "bloomLevel": "Apply",
          "difficulty": "Medium",
          "rationale": "This tests application of concepts to real scenarios"
        }
        // ... continue for 10-12 total questions
      ]
    }
  ]
}

CRITICAL REQUIREMENTS:
1. Generate COMPLETE actual questions - NOT just placeholders or descriptions
2. For quizzes: Include 10-12 detailed questions with all options and correct answers
3. For MCQs: Include 4 realistic options with clear rationales
4. For scenario/calculation questions: Provide complete problem statements and expected answers
5. Vary question types (MCQ, short answer, scenario) within each assessment
6. Ensure questions align to specific MLOs listed
7. Make questions practical and relevant to ${request.programFoundation?.targetLearner?.industrySector || 'professional'} contexts
8. All question text must be complete and ready to use - NO placeholders like "[insert]" or "[fill in]"
9. For MCQs, set "correctAnswer" to the FULL TEXT of the correct option, copied EXACTLY from the "options" array (never a number, letter, or paraphrase), and begin the "rationale" by quoting that same option — so the marked answer always matches the explanation
10. Rationales should explain WHY the correct answer is right and why each other option is wrong
11. studentBrief, markingGuide and rubric are REQUIRED and must be three distinct artefacts, not
    restatements of one another. The brief is what the learner reads and contains no answers; the
    marking guide is what the marker reads and contains the indicative content; the rubric is the
    banded criteria the mark is justified against.
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
16. BLOOM FLOOR — every question must work at or above the Bloom level of the MLO it assesses.
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
19. MCQ ANSWER DESIGN — distractors must be the same length and the same grammatical shape
    as the correct option, and plausible to someone who has not studied. Do NOT write a
    correct option that is longer, more detailed or more hedged than the distractors: across
    an earlier bank, 82% of correct answers were the longest option and 69% were option A,
    which let a candidate pass 645 questions without any subject knowledge.
11. Difficulty should progress from Easy → Medium → Hard within the assessment`;

    try {
      const response = await openaiService.generateContent(userPrompt, systemPrompt, {
        maxTokens: this.MAX_TOKENS_FORMATIVE,
        timeout: this.MODULE_TIMEOUT,
      });

      const parsed = this.parseJSON(response, `formative-${module.id}`);
      const formativeAssessments = parsed.formativeAssessments || [];
      // Reconcile MCQ correct-answer with its rationale (text ↔ index), then even out the
      // answer key. Left as generated, 69% of correct answers landed on option A — enough
      // for a candidate to pass the bank by always choosing A.
      for (const fa of formativeAssessments) {
        for (const q of fa?.questions || []) {
          if (q?.questionType === 'mcq') normalizeMcqAnswer(q);
        }
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

**Weightages:**
${Object.entries(request.userPreferences.weightages)
  .map(([key, value]) => `- ${key}: ${value}%`)
  .join('\n')}

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
