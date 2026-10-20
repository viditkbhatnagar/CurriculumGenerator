/**
 * Assignment Pack Generation Service
 * Generates complete assignment packs per module with 3 delivery variants
 * (in-person, self-study, hybrid)
 *
 * Each assignment pack includes:
 * - Assignment Overview
 * - Learning Outcomes Assessed (exact MLO/PLO text)
 * - Assignment Brief (student-facing)
 * - Assessment Criteria & Rubric (Fail/Pass/Merit/Distinction)
 * - Evidence Requirements
 * - Academic Integrity & Authenticity
 * - Accessibility & Adjustment Options
 */

import { openaiService } from './openaiService';
import { loggingService } from './loggingService';
import { resolveOutcomeLabel, isUsableGeneratedPack } from './deliverableValidation';
import { scenarioProfileFor, scenarioDirective } from './scenarioContext';
import {
  ICurriculumWorkflow,
  AssignmentDeliveryVariant,
  AssignmentPack,
  ModuleAssignmentPacks,
} from '../models/CurriculumWorkflow';
import { AssessmentRules, assessmentRulesForPrompt } from './assessmentRules';

interface ModuleContext {
  moduleId: string;
  moduleCode: string;
  moduleTitle: string;
  mlos: Array<{
    id: string;
    statement: string;
    bloomLevel: string;
    linkedPLOs: string[];
  }>;
  totalHours: number;
  contactHours: number;
  independentHours: number;
  /**
   * The module's position in the programme's module list.
   *
   * The same index Steps 7 and 8 use, so a pack is set in the same place, with the same
   * organisation, as the assessment it converts. Deriving it from the module CODE instead
   * put them in different countries: "M31" gives 31, but that module sits at index 30.
   */
  moduleIndex?: number;
  /** The module summative approved in Step 7 — the pack is its learner-facing form. */
  approvedSummative?: {
    title?: string;
    assessmentType?: string;
    description?: string;
    maxMarks?: number;
    alignedMLOs?: string[];
    studentBrief?: any;
    markingGuide?: any;
    rubric?: any;
  };
}

interface WorkflowContext {
  programTitle: string;
  programDescription: string;
  academicLevel: string;
  deliveryMode: string;
  creditFramework: any;
  targetLearner: any;
  plos: Array<{ id: string; statement: string; bloomLevel: string }>;
  assessmentStrategy: any;
  caseStudies: any[];
  glossaryEntries: any[];
  /** The institution's stated assessment rules (services/assessmentRules). */
  assessmentRules?: AssessmentRules;
}

export class AssignmentPackService {
  /**
   * Per-variant budget. GPT-5 counts its reasoning against max_completion_tokens, and at the
   * production reasoning effort ("high") 8,000 tokens were spent before any JSON was written:
   * on 16 Oct 2026 110 of the BBA's 138 variants came back empty and were stored as
   * placeholders. A pack is about 4,000 output tokens, so the budget leaves room for both.
   */
  private readonly VARIANT_TIMEOUT = 600000; // 10 minutes per attempt
  private readonly MAX_TOKENS = 32000;
  /** The retry asks for less reasoning, so a reply that ran out of budget once gets through. */
  private readonly RETRY_REASONING_EFFORT = 'medium' as const;

  /**
   * Generate assignment packs for a single module.
   *
   * `options.variants` limits generation to the variants still missing, so a module whose
   * earlier run produced two of three keeps them and only the third is generated again. The
   * variants run in parallel; each gets one retry. A variant that fails both attempts is
   * returned as a placeholder (`-placeholder` id) and the caller decides what that means
   * (see `missingPackVariants`): it is never counted as generated.
   */
  async generateModuleAssignmentPacks(
    module: ModuleContext,
    context: WorkflowContext,
    onProgress?: (completedVariants: number, currentVariant: string | null) => Promise<void>,
    options: { variants?: AssignmentDeliveryVariant[] } = {}
  ): Promise<ModuleAssignmentPacks> {
    // Guard: a missing moduleCode used to silently produce assignmentId="undefined-<variant>"
    // and propagate to downstream consumers (e.g. India Learns LMS import).
    // Fail loud at the boundary so the bug surfaces instead of poisoning data.
    if (!module.moduleCode || typeof module.moduleCode !== 'string') {
      throw new Error(
        `assignmentPackService: module.moduleCode is required (got ${JSON.stringify(
          module.moduleCode
        )} for moduleId=${module.moduleId}). ` +
          `Caller must populate moduleCode before generating assignment packs.`
      );
    }

    const variants: AssignmentDeliveryVariant[] = options.variants?.length
      ? options.variants
      : ['in_person', 'self_study', 'hybrid'];

    loggingService.info('Generating assignment packs for module', {
      moduleId: module.moduleId,
      moduleCode: module.moduleCode,
      variants,
    });

    const variantLabels: Record<string, string> = {
      in_person: 'In-Person',
      self_study: 'Self-Study',
      hybrid: 'Hybrid',
    };
    let finished = 0;
    const result: Partial<Record<AssignmentDeliveryVariant, AssignmentPack>> = {};

    await Promise.all(
      variants.map(async (variant) => {
        result[variant] =
          (await this.generateVariant(module, context, variant)) ||
          this.createPlaceholderPack(module, variant);
        finished += 1;
        if (onProgress) {
          const pending = variants.find((v) => !result[v]);
          try {
            await onProgress(finished, pending ? variantLabels[pending] : null);
          } catch (_e) {
            // Non-critical
          }
        }
      })
    );

    return {
      moduleId: module.moduleId,
      moduleCode: module.moduleCode,
      moduleTitle: module.moduleTitle,
      variants: result as ModuleAssignmentPacks['variants'],
    };
  }

  /** One variant, with one retry. Returns null when neither attempt gave a usable pack. */
  private async generateVariant(
    module: ModuleContext,
    context: WorkflowContext,
    variant: AssignmentDeliveryVariant
  ): Promise<AssignmentPack | null> {
    const prompt = this.buildAssignmentPrompt(module, context, variant);
    const systemPrompt = this.buildSystemPrompt();

    for (const attempt of [1, 2]) {
      const startTime = Date.now();
      try {
        const response = await openaiService.generateContent(prompt, systemPrompt, {
          responseFormat: 'json_object',
          maxTokens: this.MAX_TOKENS,
          timeout: this.VARIANT_TIMEOUT,
          // This method retries once itself; letting the client also retry a 10-minute
          // timeout five times would outlast the queue's job timeout.
          maxRetries: 2,
          ...(attempt === 2 ? { reasoningEffort: this.RETRY_REASONING_EFFORT } : {}),
        });

        const parsed = JSON.parse(response);
        if (!isUsableGeneratedPack(parsed)) {
          throw new Error('reply had no rubric or no instructions');
        }
        // A positional "MLO 2" is still resolved to the stored id, for a model that numbers
        // the outcomes anyway.
        const outcomeIds = module.mlos.map((mlo) => mlo.id);
        const toId = (label: string) => resolveOutcomeLabel(label, outcomeIds);
        const pack: AssignmentPack = {
          assignmentId: `${module.moduleCode}-${variant}`,
          deliveryVariant: variant,
          overview: parsed.overview || {},
          assessedOutcomes: (parsed.assessedOutcomes || []).map((o: any) => ({
            ...o,
            mloId: o?.mloId ? toId(o.mloId) : o?.mloId,
          })),
          brief: parsed.brief || {},
          rubric: (parsed.rubric || []).map((c: any) => ({
            ...c,
            linkedMLOs: Array.isArray(c?.linkedMLOs) ? c.linkedMLOs.map(toId) : c?.linkedMLOs,
          })),
          evidenceRequirements: parsed.evidenceRequirements || [],
          academicIntegrity: parsed.academicIntegrity || '',
          accessibilityOptions: parsed.accessibilityOptions || '',
        };

        loggingService.info(`${variant} variant generated`, {
          moduleCode: module.moduleCode,
          variant,
          attempt,
          durationMs: Date.now() - startTime,
          rubricCriteria: pack.rubric.length,
        });
        return pack;
      } catch (err) {
        loggingService.error(`Failed to generate ${variant} variant`, {
          moduleCode: module.moduleCode,
          variant,
          attempt,
          durationMs: Date.now() - startTime,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return null;
  }

  private buildSystemPrompt(): string {
    return `You are an academic course production engine. Your task is to generate a COMPLETE ASSIGNMENT PACK for the module provided in context.

The program already includes Program Learning Outcomes (PLOs), Module Learning Outcomes (MLOs), Skills, Knowledge, and Competency mappings, contact and independent study hours, and assessment strategy and weighting.

DO NOT invent new learning outcomes. DO NOT change credit, level, or assessment balance. DO NOT introduce new topics.

Your role is to CONVERT the existing curriculum into student-facing assessment artefacts.

Style: Professional, clear, accreditation-ready. Student-facing language. Plain English. UK academic conventions. No emojis. No marketing language.

Return ONLY valid JSON, no markdown formatting.`;
  }

  private buildAssignmentPrompt(
    module: ModuleContext,
    context: WorkflowContext,
    variant: AssignmentDeliveryVariant
  ): string {
    const variantLabel =
      variant === 'in_person' ? 'In-Person' : variant === 'self_study' ? 'Self-Study' : 'Hybrid';

    const variantGuidance = this.getVariantGuidance(variant);

    // Each outcome is listed under its stored id. Numbering them "MLO 1, MLO 2" and then asking
    // for the "exact MLO ID" left the model nothing to copy but the number, so every pack named
    // its outcomes by position and none matched the ids its coverage is checked against.
    const mlosList = module.mlos
      .map(
        (mlo) =>
          `${mlo.id} [${mlo.bloomLevel}]: ${mlo.statement} (Linked PLOs: ${mlo.linkedPLOs.join(', ') || 'None'})`
      )
      .join('\n');

    const plosList = context.plos
      .map((plo) => `${plo.id}: ${plo.statement} [${plo.bloomLevel}]`)
      .join('\n');

    // The pack converts the assessment approved in Step 7 rather than inventing a new one:
    // the three variants are delivery formats of the SAME assessment, so a learner assessed
    // in person and a learner assessed remotely are doing the same work to the same rubric.
    const approvedBlock = module.approvedSummative
      ? `
**THE APPROVED MODULE ASSESSMENT (Step 7) — convert THIS, do not invent a new one:**
Title: ${module.approvedSummative.title || 'untitled'}
Type: ${module.approvedSummative.assessmentType || 'not stated'}
Max marks: ${module.approvedSummative.maxMarks ?? 'not stated'}
Assessed outcomes: ${(module.approvedSummative.alignedMLOs || []).join(', ') || 'not stated'}
${module.approvedSummative.description ? `Description: ${module.approvedSummative.description}` : ''}
${module.approvedSummative.studentBrief ? `Student brief: ${JSON.stringify(module.approvedSummative.studentBrief)}` : ''}
${module.approvedSummative.markingGuide ? `Marking guide: ${JSON.stringify(module.approvedSummative.markingGuide)}` : ''}
${module.approvedSummative.rubric ? `Rubric: ${JSON.stringify(module.approvedSummative.rubric)}` : ''}

This assignment pack is the learner-facing form of the assessment above, adapted for
${variantLabel} delivery. Adapt only what the delivery mode requires (setting, submission
logistics, supervision, timing). Do NOT change what is being assessed or how it is marked.

Binding constraints, which override the general guidance below:
- "assessedOutcomes" MUST be exactly these outcome ids, no more and no fewer: ${(module.approvedSummative.alignedMLOs || []).join(', ') || 'as listed in the module outcomes above'}
- "overview.weighting" MUST be 100 — this is the module's sole summative assessment and
  carries the whole module grade. Do not invent a percentage.
- "overview.assignmentType" MUST describe the approved assessment's own type${module.approvedSummative.assessmentType ? ` (${module.approvedSummative.assessmentType})` : ''}, not a different one.
- The rubric criteria MUST correspond to the approved rubric's criteria, in the same
  proportions. You may reword a descriptor for the delivery mode; you may not add, drop or
  re-weight a criterion.
`
      : '';

    // The reviewer asked for the setting rules "preferably upstream so the same issue does not
    // continue into the later assignment packs" — so the same per-module profile Steps 7 and 8
    // use is applied here, keyed on the module's own sequence so a pack is set in the same
    // place as the assessment it converts.
    const packProfile = scenarioProfileFor(module.moduleIndex ?? 0);

    return `Generate a COMPLETE ASSIGNMENT PACK for the following module, tailored for ${variantLabel} delivery.
${scenarioDirective(packProfile, module.moduleTitle)}
${approvedBlock}
**PROGRAM CONTEXT:**
Program: ${context.programTitle}
Level: ${context.academicLevel}
Credit Framework: ${JSON.stringify(context.creditFramework)}
Target Learner: ${typeof context.targetLearner === 'string' ? context.targetLearner : JSON.stringify(context.targetLearner)}

**MODULE:**
Code: ${module.moduleCode}
Title: ${module.moduleTitle}
Total Hours: ${module.totalHours} (Contact: ${module.contactHours}h, Independent: ${module.independentHours}h)

**MODULE LEARNING OUTCOMES (use EXACT wording, do NOT paraphrase):**
${mlosList}

**PROGRAM LEARNING OUTCOMES:**
${plosList}

**DELIVERY VARIANT: ${variantLabel}**
${variantGuidance}

**OUTPUT REQUIREMENTS (JSON):**
{
  "overview": {
    "title": "Assignment title",
    "moduleCode": "${module.moduleCode}",
    "moduleTitle": "${module.moduleTitle}",
    "assignmentType": "e.g. practical task, case analysis, simulation, portfolio component",
    "weighting": number (percentage),
    "groupOrIndividual": "individual" | "group" | "either",
    "submissionFormat": "e.g. PDF via LMS, recorded presentation, physical portfolio",
    "deliveryVariant": "${variant}"
  },
  "assessedOutcomes": [
    {
      "mloId": "exact MLO ID",
      "mloStatement": "exact MLO text — do NOT paraphrase",
      "linkedPLOs": ["PLO IDs"]
    }
  ],
  "brief": {
    "studentFacingIntro": "Clear introduction written for learners",
    "workplaceContext": "Realistic workplace scenario",
    "stepByStepInstructions": ["Step 1...", "Step 2..."],
    "deliverables": ["Deliverable 1...", "Deliverable 2..."]
  },
  "rubric": [
    {
      "criterionName": "Criterion name",
      "linkedMLOs": ["MLO IDs"],
      "fail": "Observable descriptor for Fail",
      "pass": "Observable descriptor for Pass",
      "merit": "Observable descriptor for Merit",
      "distinction": "Observable descriptor for Distinction",
      "weight": number (percentage)
    }
  ],
  "evidenceRequirements": [
    {
      "artefactType": "What must be submitted",
      "wordCountOrDuration": "e.g. 2000 words, 10-minute recording",
      "fileType": "e.g. PDF, DOCX, MP4",
      "additionalNotes": "Any templates or tools referenced"
    }
  ],
  "academicIntegrity": "Permitted support, prohibited conduct, declaration of authenticity",
  "accessibilityOptions": "Reasonable adjustments, alternative formats (without lowering standards)"
}

Ensure rubric criteria are mapped directly to MLOs with observable, measurable descriptors aligned with Bloom levels. Performance levels must be Fail / Pass / Merit / Distinction.

${assessmentRulesForPrompt(context.assessmentRules)}
For academicIntegrity and accessibilityOptions, state the institution's rules above where given; where none is given, describe what this assessment permits and requires, and say that the institution's own policy applies.

Return ONLY valid JSON.`;
  }

  private getVariantGuidance(variant: AssignmentDeliveryVariant): string {
    switch (variant) {
      case 'in_person':
        return `This assignment is for IN-PERSON delivery:
- May include group work, presentations, lab practicals, workshops
- Physical submissions (printed portfolios, in-class presentations) are acceptable
- Can reference classroom-based resources and face-to-face interactions
- Peer assessment and group discussion components are encouraged
- Invigilated components may be included`;

      case 'self_study':
        return `This assignment is for SELF-STUDY (asynchronous online) delivery:
- Must be completable independently without instructor presence
- All submissions must be digital (PDF, DOCX, MP4, online portfolio)
- Use automated or rubric-based marking where possible
- Include clear self-check opportunities before submission
- Reference only digitally accessible resources
- Recorded presentations replace live presentations
- No group work requiring synchronous collaboration`;

      case 'hybrid':
        return `This assignment is for HYBRID (blended) delivery:
- Flexible format supporting both in-person and online learners
- Offer both physical and digital submission options where possible
- Include some collaborative elements but with asynchronous alternatives
- Balance instructor-facilitated and self-directed components
- Provide options for live or recorded presentations`;
    }
  }

  private createPlaceholderPack(
    module: ModuleContext,
    variant: AssignmentDeliveryVariant
  ): AssignmentPack {
    return {
      assignmentId: `${module.moduleCode}-${variant}-placeholder`,
      deliveryVariant: variant,
      overview: {
        title: `${module.moduleTitle} Assignment (${variant})`,
        moduleCode: module.moduleCode,
        moduleTitle: module.moduleTitle,
        assignmentType: 'To be determined',
        weighting: 100,
        groupOrIndividual: 'individual',
        submissionFormat: 'PDF',
        deliveryVariant: variant,
      },
      assessedOutcomes: module.mlos.map((mlo) => ({
        mloId: mlo.id,
        mloStatement: mlo.statement,
        linkedPLOs: mlo.linkedPLOs,
      })),
      brief: {
        studentFacingIntro: 'Generation failed — please retry.',
        workplaceContext: '',
        stepByStepInstructions: [],
        deliverables: [],
      },
      rubric: [],
      evidenceRequirements: [],
      academicIntegrity: '',
      accessibilityOptions: '',
    };
  }
}

export const assignmentPackService = new AssignmentPackService();
