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
import {
  ICurriculumWorkflow,
  AssignmentDeliveryVariant,
  AssignmentPack,
  ModuleAssignmentPacks,
} from '../models/CurriculumWorkflow';

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
}

export class AssignmentPackService {
  private readonly VARIANT_TIMEOUT = 180000; // 3 minutes per variant
  private readonly MAX_TOKENS = 8000;

  /**
   * Generate assignment packs for a single module (all 3 delivery variants)
   */
  async generateModuleAssignmentPacks(
    module: ModuleContext,
    context: WorkflowContext
  ): Promise<ModuleAssignmentPacks> {
    loggingService.info('Generating assignment packs for module', {
      moduleId: module.moduleId,
      moduleCode: module.moduleCode,
    });

    const variants: AssignmentDeliveryVariant[] = ['in_person', 'self_study', 'hybrid'];
    const result: Record<string, AssignmentPack> = {};

    for (const variant of variants) {
      loggingService.info(`Generating ${variant} variant`, {
        moduleCode: module.moduleCode,
        variant,
      });

      const startTime = Date.now();

      try {
        const prompt = this.buildAssignmentPrompt(module, context, variant);
        const systemPrompt = this.buildSystemPrompt();

        const response = await openaiService.generateContent(prompt, systemPrompt, {
          responseFormat: 'json_object',
          maxTokens: this.MAX_TOKENS,
          timeout: this.VARIANT_TIMEOUT,
        });

        const parsed = JSON.parse(response);
        result[variant] = {
          assignmentId: `${module.moduleCode}-${variant}`,
          deliveryVariant: variant,
          overview: parsed.overview || {},
          assessedOutcomes: parsed.assessedOutcomes || [],
          brief: parsed.brief || {},
          rubric: parsed.rubric || [],
          evidenceRequirements: parsed.evidenceRequirements || [],
          academicIntegrity: parsed.academicIntegrity || '',
          accessibilityOptions: parsed.accessibilityOptions || '',
        };

        const duration = Date.now() - startTime;
        loggingService.info(`${variant} variant generated`, {
          moduleCode: module.moduleCode,
          variant,
          durationMs: duration,
          rubricCriteria: result[variant].rubric.length,
        });
      } catch (err) {
        loggingService.error(`Failed to generate ${variant} variant`, {
          moduleCode: module.moduleCode,
          variant,
          error: err instanceof Error ? err.message : String(err),
        });
        // Create a minimal placeholder so we don't block other variants
        result[variant] = this.createPlaceholderPack(module, variant);
      }

      // Brief delay between variants to avoid rate limits
      if (variant !== 'hybrid') {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return {
      moduleId: module.moduleId,
      moduleCode: module.moduleCode,
      moduleTitle: module.moduleTitle,
      variants: {
        in_person: result.in_person,
        self_study: result.self_study,
        hybrid: result.hybrid,
      },
    };
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

    const mlosList = module.mlos
      .map(
        (mlo, idx) =>
          `MLO ${idx + 1} [${mlo.bloomLevel}]: ${mlo.statement} (Linked PLOs: ${mlo.linkedPLOs.join(', ') || 'None'})`
      )
      .join('\n');

    const plosList = context.plos
      .map((plo) => `${plo.id}: ${plo.statement} [${plo.bloomLevel}]`)
      .join('\n');

    return `Generate a COMPLETE ASSIGNMENT PACK for the following module, tailored for ${variantLabel} delivery.

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
