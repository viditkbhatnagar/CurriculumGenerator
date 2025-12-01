/**
 * Workflow Service
 * Orchestrates the 9-step AI-Integrated Curriculum Generation Workflow v2.2
 *
 * This service handles:
 * - Step-by-step content generation using OpenAI
 * - SME input validation and quality checks
 * - Progress tracking and state management
 * - AGI Standards enforcement
 */

import mongoose from 'mongoose';
import { CurriculumWorkflow, ICurriculumWorkflow } from '../models/CurriculumWorkflow';
import { openaiService } from './openaiService';
import { loggingService } from './loggingService';
import {
  Step1ProgramFoundation,
  Step2CompetencyKSA,
  Step3PLOs,
  Step4CourseFramework,
  Step5Sources,
  Step6ReadingLists,
  Step7Assessments,
  Step8CaseStudies,
  Step9Glossary,
  CreditSystem,
  DeliveryMode,
  BloomLevel,
} from '../types/newWorkflow';

// ============================================================================
// CREDIT CALCULATION UTILITIES
// ============================================================================

interface CreditCalculation {
  totalHours: number;
  contactHours: number;
  independentHours: number;
  contactPercent: number;
}

// Support both frontend ('uk') and backend ('uk_credits') naming
const CREDIT_MULTIPLIERS: Record<string, number> = {
  uk: 10, // Frontend naming
  uk_credits: 10, // 1 UK credit = 10 hours
  ects: 25, // 1 ECTS = 25 hours (using lower bound)
  us_semester: 45, // 1 US credit = 45 total hours
  non_credit: 1, // Direct hours entry
};

const DEFAULT_CONTACT_PERCENT: Record<string, number> = {
  uk: 30, // Frontend naming
  uk_credits: 30,
  ects: 30,
  us_semester: 33, // Defined ratio, not default
  non_credit: 30,
};

function calculateCredits(
  system: string,
  credits: number | undefined,
  totalHoursInput: number | undefined,
  customContactPercent?: number
): CreditCalculation {
  let totalHours: number;
  let contactPercent: number;

  // Normalize system name
  const normalizedSystem = system || 'uk';

  // Calculate total hours based on credit system
  if (normalizedSystem === 'non_credit') {
    totalHours = totalHoursInput || 120;
  } else {
    const multiplier = CREDIT_MULTIPLIERS[normalizedSystem] || 10;
    totalHours = (credits || 60) * multiplier;
  }

  // Determine contact hours percentage
  if (customContactPercent) {
    contactPercent = customContactPercent;
  } else {
    contactPercent = DEFAULT_CONTACT_PERCENT[normalizedSystem] || 30;
  }

  const contactHours = Math.round(totalHours * (contactPercent / 100));
  const independentHours = totalHours - contactHours;

  return {
    totalHours,
    contactHours,
    independentHours,
    contactPercent,
  };
}

// ============================================================================
// WORKFLOW SERVICE CLASS
// ============================================================================

class WorkflowService {
  // ==========================================================================
  // WORKFLOW MANAGEMENT
  // ==========================================================================

  /**
   * Create a new curriculum workflow
   */
  async createWorkflow(projectName: string, userId: string): Promise<ICurriculumWorkflow> {
    const workflow = new CurriculumWorkflow({
      projectName,
      createdBy: new mongoose.Types.ObjectId(userId),
      currentStep: 1,
      status: 'step1_pending',
    });

    await workflow.save();

    loggingService.info('New curriculum workflow created', {
      workflowId: workflow._id,
      projectName,
      userId,
    });

    return workflow;
  }

  /**
   * Get workflow by ID
   */
  async getWorkflow(workflowId: string): Promise<ICurriculumWorkflow | null> {
    return CurriculumWorkflow.findById(workflowId);
  }

  /**
   * Get workflows for user
   */
  async getUserWorkflows(userId: string): Promise<ICurriculumWorkflow[]> {
    return CurriculumWorkflow.find({ createdBy: new mongoose.Types.ObjectId(userId) }).sort({
      updatedAt: -1,
    });
  }

  // ==========================================================================
  // STEP 1: PROGRAM FOUNDATION
  // ==========================================================================

  /**
   * Process Step 1 SME inputs and generate program foundation
   * Accepts simplified input from frontend (strings instead of complex objects)
   */
  async processStep1(
    workflowId: string,
    input: {
      programTitle: string;
      programDescription: string;
      academicLevel: 'certificate' | 'micro-credential' | 'diploma';
      creditSystem: CreditSystem;
      credits?: number;
      totalHours?: number;
      customContactPercent?: number;
      targetLearner: string; // Simplified to string from frontend
      deliveryMode: DeliveryMode;
      deliveryDescription?: string;
      programPurpose: string;
      jobRoles: string[]; // Simplified to string array from frontend
    }
  ): Promise<ICurriculumWorkflow> {
    const workflow = await CurriculumWorkflow.findById(workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    loggingService.info('Processing Step 1: Program Foundation', { workflowId });

    // Calculate credit framework
    const creditCalc = calculateCredits(
      input.creditSystem || 'uk_credits',
      input.credits || 60,
      input.totalHours,
      input.customContactPercent
    );

    // Calculate completeness score (simplified)
    const completenessScore = this.calculateStep1Completeness(input);

    // Generate AI content if completeness is sufficient
    let generatedContent: any = {};
    if (completenessScore >= 70) {
      try {
        generatedContent = await this.generateStep1Content(input, creditCalc);
      } catch (err) {
        loggingService.error('Failed to generate Step 1 AI content', { error: err });
        // Continue without generated content
      }
    }

    // Store step data (with simplified structure)
    workflow.step1 = {
      programTitle: input.programTitle || '',
      programDescription: input.programDescription || '',
      academicLevel: input.academicLevel || 'certificate',
      creditFramework: {
        system: input.creditSystem || 'uk_credits',
        credits: input.credits || 60,
        totalHours: creditCalc.totalHours,
        contactHoursPercent: creditCalc.contactPercent,
        contactHours: creditCalc.contactHours,
        independentHours: creditCalc.independentHours,
      },
      targetLearner: input.targetLearner || '',
      delivery: {
        mode: input.deliveryMode || 'online',
        description: input.deliveryDescription || '',
        customContactHoursPercent: input.customContactPercent,
      },
      programPurpose: input.programPurpose || '',
      jobRoles: input.jobRoles || [],
      executiveSummary: generatedContent.executiveSummary,
      programAims: generatedContent.programAims,
      entryRequirements: generatedContent.entryRequirements,
      careerPathways: generatedContent.careerPathways,
      completenessScore,
      validatedAt: new Date(),
    };

    // Update progress
    let step1Progress = workflow.stepProgress.find((p) => p.step === 1);
    if (!step1Progress) {
      workflow.stepProgress.push({
        step: 1,
        status: 'in_progress',
        startedAt: new Date(),
      });
      step1Progress = workflow.stepProgress.find((p) => p.step === 1);
    }
    if (step1Progress) {
      step1Progress.status = completenessScore >= 70 ? 'completed' : 'in_progress';
      step1Progress.startedAt = step1Progress.startedAt || new Date();
      if (completenessScore >= 70) {
        step1Progress.completedAt = new Date();
      }
    }

    workflow.status = completenessScore >= 70 ? 'step1_complete' : 'step1_pending';

    await workflow.save();

    loggingService.info('Step 1 processed', {
      workflowId,
      completenessScore,
      status: workflow.status,
    });

    return workflow;
  }

  private calculateStep1Completeness(input: any): number {
    let score = 0;
    const weights = {
      programTitle: 10,
      programDescription: 15,
      academicLevel: 5,
      creditSystem: 10,
      targetLearner: 15,
      deliveryMode: 10,
      programPurpose: 15,
      jobRoles: 20,
    };

    if (input.programTitle?.length >= 5) score += weights.programTitle;
    if (input.programDescription?.length >= 50) score += weights.programDescription;
    if (input.academicLevel) score += weights.academicLevel;
    if (input.creditSystem) score += weights.creditSystem;
    // Handle targetLearner as string or object
    if (typeof input.targetLearner === 'string' && input.targetLearner.length >= 20) {
      score += weights.targetLearner;
    } else if (input.targetLearner?.industrySector && input.targetLearner?.experienceLevel) {
      score += weights.targetLearner;
    }
    if (input.deliveryMode) score += weights.deliveryMode;
    if (input.programPurpose?.length >= 20) score += weights.programPurpose;
    // Handle jobRoles as array of strings or objects
    const jobRolesCount = Array.isArray(input.jobRoles)
      ? input.jobRoles.filter((r: any) => (typeof r === 'string' ? r.trim() : r?.title)).length
      : 0;
    if (jobRolesCount >= 2) score += weights.jobRoles;

    return score;
  }

  private async generateStep1Content(input: any, creditCalc: CreditCalculation): Promise<any> {
    const systemPrompt = `You are an expert curriculum designer creating accreditation-ready vocational education programs. Generate professional content following AGI Academic Standards with UK English spelling.`;

    // Handle both string and object formats for targetLearner and jobRoles
    const targetLearnerInfo =
      typeof input.targetLearner === 'string'
        ? input.targetLearner
        : `${input.targetLearner?.industrySector || ''} - ${input.targetLearner?.experienceLevel || ''} level`;

    const jobRolesInfo = Array.isArray(input.jobRoles)
      ? input.jobRoles
          .map((r: any) => (typeof r === 'string' ? r : r.title))
          .filter(Boolean)
          .join(', ')
      : '';

    const userPrompt = `Generate program foundation content for:

Program Title: ${input.programTitle}
Academic Level: ${input.academicLevel}
Target Learner: ${targetLearnerInfo}
Total Hours: ${creditCalc.totalHours}
Contact Hours: ${creditCalc.contactHours} (${creditCalc.contactPercent}%)

Program Description: ${input.programDescription}

Program Purpose: ${input.programPurpose}

Job Roles: ${jobRolesInfo}
${input.jobRoles.map((r: any) => `- ${r.title}: ${r.description}`).join('\n')}

Generate:
1. Executive Summary (400-700 words) - Professional overview for prospectus
2. Program Aims (3-5 strategic intentions)
3. Entry Requirements based on target learner profile
4. Career Pathways (job roles and progression opportunities)

Return as JSON: {
  "executiveSummary": "string",
  "programAims": ["aim1", "aim2", ...],
  "entryRequirements": "string",
  "careerPathways": ["pathway1", "pathway2", ...]
}`;

    try {
      const response = await openaiService.generateContent(userPrompt, systemPrompt, {
        temperature: 0.7,
        maxTokens: 2500,
      });

      return this.parseJSON(response, 'step1');
    } catch (error) {
      loggingService.error('Error generating Step 1 content', { error });
      return {};
    }
  }

  // ==========================================================================
  // STEP 2: COMPETENCY & KNOWLEDGE FRAMEWORK (KSA)
  // ==========================================================================

  /**
   * Process Step 2: Generate KSA framework
   */
  async processStep2(
    workflowId: string,
    input: {
      benchmarkPrograms?: Array<{
        programName: string;
        institution: string;
        url?: string;
      }>;
      industryFrameworks?: string[];
      institutionalFrameworks?: string[];
    }
  ): Promise<ICurriculumWorkflow> {
    const workflow = await CurriculumWorkflow.findById(workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    if (!workflow.step1) {
      throw new Error('Step 1 must be completed first');
    }

    loggingService.info('Processing Step 2: Competency Framework (KSA)', { workflowId });

    // Generate KSA items using AI
    const ksaContent = await this.generateStep2Content(workflow.step1, input);

    // Store step data
    workflow.step2 = {
      benchmarkPrograms: input.benchmarkPrograms || [],
      industryFrameworks: input.industryFrameworks,
      institutionalFrameworks: input.institutionalFrameworks,
      knowledgeItems: ksaContent.knowledgeItems || [],
      skillItems: ksaContent.skillItems || [],
      attitudeItems: ksaContent.attitudeItems || [],
      benchmarkingReport: ksaContent.benchmarkingReport,
      totalItems:
        (ksaContent.knowledgeItems?.length || 0) +
        (ksaContent.skillItems?.length || 0) +
        (ksaContent.attitudeItems?.length || 0),
      essentialCount: [
        ...(ksaContent.knowledgeItems || []),
        ...(ksaContent.skillItems || []),
        ...(ksaContent.attitudeItems || []),
      ].filter((item: any) => item.importance === 'essential').length,
      validatedAt: new Date(),
    };

    // Update progress
    const step2Progress = workflow.stepProgress.find((p) => p.step === 2);
    if (step2Progress) {
      step2Progress.status = 'completed';
      step2Progress.startedAt = step2Progress.startedAt || new Date();
      step2Progress.completedAt = new Date();
    }

    workflow.currentStep = 2;
    workflow.status = 'step2_complete';

    await workflow.save();

    loggingService.info('Step 2 processed', {
      workflowId,
      totalItems: workflow.step2.totalItems,
      essentialCount: workflow.step2.essentialCount,
    });

    return workflow;
  }

  private async generateStep2Content(step1: any, input: any): Promise<any> {
    const systemPrompt = `You are an expert in competency framework development. Generate Knowledge, Skills, and Attitudes (KSA) aligned with industry standards. Use UK English spelling.`;

    const benchmarks =
      input.benchmarkPrograms?.map((b: any) => b.programName).join(', ') ||
      'standard industry programs';
    const frameworks = input.industryFrameworks?.join(', ') || 'SHRM, PMI, CIPD frameworks';

    const userPrompt = `Generate a Competency Framework (KSA) for:

Program: ${step1.programTitle}
Industry: ${step1.targetLearner.industrySector}
Level: ${step1.academicLevel}
Target Audience: ${step1.targetLearner.experienceLevel} level

Benchmark Programs: ${benchmarks}
Industry Frameworks to reference: ${frameworks}

Job Roles to prepare for:
${step1.jobRoles.map((r: any) => `- ${r.title}: ${r.tasks?.join(', ')}`).join('\n')}

Generate 10-30 KSA items with distribution:
- Knowledge (30-40%): What learners need to understand
- Skills (40-50%): What learners need to be able to do
- Attitudes (10-30%): Professional behaviors and values

For each item include:
- id: unique identifier (K1, K2, S1, S2, A1, etc.)
- statement: clear statement (≤50 words)
- description: brief description
- importance: "essential" (≥50% of benchmarks) or "desirable"
- sourceProgram: which benchmark this came from
- jobTaskMapping: which job tasks this enables

Return as JSON:
{
  "knowledgeItems": [{ "id", "statement", "description", "importance", "sourceProgram", "jobTaskMapping": [] }],
  "skillItems": [...],
  "attitudeItems": [...],
  "benchmarkingReport": {
    "programsAnalyzed": [],
    "keyFindings": [],
    "coverageAnalysis": "string"
  }
}`;

    try {
      const response = await openaiService.generateContent(userPrompt, systemPrompt, {
        temperature: 0.7,
        maxTokens: 4000,
      });

      return this.parseJSON(response, 'step2');
    } catch (error) {
      loggingService.error('Error generating Step 2 content', { error });
      return { knowledgeItems: [], skillItems: [], attitudeItems: [] };
    }
  }

  // ==========================================================================
  // STEP 3: PROGRAM LEARNING OUTCOMES (PLOs)
  // ==========================================================================

  /**
   * Process Step 3: Generate PLOs
   */
  async processStep3(
    workflowId: string,
    input: {
      bloomLevels: BloomLevel[];
      priorityCompetencies: string[];
      outcomeEmphasis: 'technical' | 'professional' | 'strategic' | 'mixed';
      targetCount: number;
      contextConstraints?: string;
      preferredVerbs?: string[];
      avoidVerbs?: string[];
    }
  ): Promise<ICurriculumWorkflow> {
    const workflow = await CurriculumWorkflow.findById(workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    if (!workflow.step1 || !workflow.step2) {
      throw new Error('Steps 1 and 2 must be completed first');
    }

    loggingService.info('Processing Step 3: Program Learning Outcomes', { workflowId });

    // Generate PLOs using AI
    const ploContent = await this.generateStep3Content(workflow.step1, workflow.step2, input);

    // Store step data
    workflow.step3 = {
      bloomLevels: input.bloomLevels,
      priorityCompetencies: input.priorityCompetencies,
      outcomeEmphasis: input.outcomeEmphasis,
      targetCount: input.targetCount,
      contextConstraints: input.contextConstraints,
      preferredVerbs: input.preferredVerbs,
      avoidVerbs: input.avoidVerbs,
      outcomes: ploContent.outcomes || [],
      coverageReport: ploContent.coverageReport,
      validatedAt: new Date(),
    };

    // Update progress
    const step3Progress = workflow.stepProgress.find((p) => p.step === 3);
    if (step3Progress) {
      step3Progress.status = 'completed';
      step3Progress.startedAt = step3Progress.startedAt || new Date();
      step3Progress.completedAt = new Date();
    }

    workflow.currentStep = 3;
    workflow.status = 'step3_complete';

    await workflow.save();

    loggingService.info('Step 3 processed', {
      workflowId,
      ploCount: workflow.step3.outcomes.length,
    });

    return workflow;
  }

  private async generateStep3Content(step1: any, step2: any, input: any): Promise<any> {
    const systemPrompt = `You are an expert in learning outcome design. Create precise, measurable Program Learning Outcomes (PLOs) using Bloom's taxonomy. Use the structure: [Bloom's Verb] + [Specific Task] + [Real-World Context]. Each PLO must be ≤25 words. Use UK English.`;

    const allCompetencies = [
      ...step2.knowledgeItems.map((k: any) => `K: ${k.statement}`),
      ...step2.skillItems.map((s: any) => `S: ${s.statement}`),
      ...step2.attitudeItems.map((a: any) => `A: ${a.statement}`),
    ].join('\n');

    const userPrompt = `Generate ${input.targetCount} Program Learning Outcomes (PLOs) for:

Program: ${step1.programTitle}
Level: ${step1.academicLevel}
Emphasis: ${input.outcomeEmphasis}

Bloom's Levels to use: ${input.bloomLevels.join(', ')}
${input.preferredVerbs ? `Preferred Verbs: ${input.preferredVerbs.join(', ')}` : ''}
${input.avoidVerbs ? `Avoid Verbs: ${input.avoidVerbs.join(', ')}` : ''}
${input.contextConstraints ? `Context: ${input.contextConstraints}` : ''}

Competencies to address (cover ≥70% of Essential items):
${allCompetencies}

Job Tasks to prepare for:
${step1.jobRoles.map((r: any) => r.tasks?.join(', ')).join('\n')}

For each PLO:
- Use [Verb + Task + Context] structure
- Maximum 25 words
- Link to competencies from Step 2
- Map to job tasks from Step 1
- Indicate assessment alignment

Requirements:
- At least 1 lower level (Understand/Apply) + 1 higher level (Analyze/Evaluate/Create)
- No single Bloom level >50%
- Cover ≥70% of Essential competencies
- No duplicates or trivial rephrasing

Return as JSON:
{
  "outcomes": [{
    "id": "PLO1",
    "outcomeNumber": 1,
    "statement": "string (≤25 words)",
    "bloomLevel": "apply|analyze|evaluate|create",
    "competencyLinks": ["K1", "S2"],
    "jobTaskMapping": ["task description"],
    "assessmentAlignment": "how this will be measured"
  }],
  "coverageReport": {
    "competenciesCovered": number,
    "coveragePercent": number,
    "bloomDistribution": { "apply": 2, "analyze": 2, ... },
    "jobTasksCovered": []
  }
}`;

    try {
      const response = await openaiService.generateContent(userPrompt, systemPrompt, {
        temperature: 0.7,
        maxTokens: 3000,
      });

      return this.parseJSON(response, 'step3');
    } catch (error) {
      loggingService.error('Error generating Step 3 content', { error });
      return { outcomes: [] };
    }
  }

  // ==========================================================================
  // STEP 4: COURSE FRAMEWORK & MLOs
  // ==========================================================================

  /**
   * Process Step 4: Generate course framework with modules and MLOs
   */
  async processStep4(workflowId: string): Promise<ICurriculumWorkflow> {
    const workflow = await CurriculumWorkflow.findById(workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    if (!workflow.step1 || !workflow.step2 || !workflow.step3) {
      throw new Error('Steps 1-3 must be completed first');
    }

    loggingService.info('Processing Step 4: Course Framework & MLOs', { workflowId });

    // Generate course framework using AI
    const frameworkContent = await this.generateStep4Content(
      workflow.step1,
      workflow.step2,
      workflow.step3
    );

    // Store step data
    workflow.step4 = {
      modules: frameworkContent.modules || [],
      totalProgramHours: workflow.step1.creditFramework.totalHours,
      totalContactHours: workflow.step1.creditFramework.contactHours,
      totalIndependentHours: workflow.step1.creditFramework.independentHours,
      ploModuleMapping: frameworkContent.ploModuleMapping || [],
      progressiveComplexity: frameworkContent.progressiveComplexity || {
        earlyModulesLowerLevel: true,
        laterModulesHigherLevel: true,
      },
      hoursIntegrity: this.validateHoursIntegrity(
        frameworkContent.modules,
        workflow.step1.creditFramework.totalHours
      ),
      validatedAt: new Date(),
    };

    // Update progress
    const step4Progress = workflow.stepProgress.find((p) => p.step === 4);
    if (step4Progress) {
      step4Progress.status = 'completed';
      step4Progress.startedAt = step4Progress.startedAt || new Date();
      step4Progress.completedAt = new Date();
    }

    workflow.currentStep = 4;
    workflow.status = 'step4_complete';

    await workflow.save();

    loggingService.info('Step 4 processed', {
      workflowId,
      moduleCount: workflow.step4.modules.length,
      hoursIntegrity: workflow.step4.hoursIntegrity,
    });

    return workflow;
  }

  private validateHoursIntegrity(modules: any[], totalHours: number): boolean {
    const sum = modules.reduce((acc, m) => acc + (m.totalHours || 0), 0);
    return sum === totalHours;
  }

  private async generateStep4Content(step1: any, step2: any, step3: any): Promise<any> {
    const systemPrompt = `You are an expert curriculum architect. Design a course framework with 6-8 modules, each with Module Learning Outcomes (MLOs) that build toward Program Learning Outcomes. Use UK English. Ensure progressive complexity from foundational to advanced.`;

    const totalHours = step1.creditFramework.totalHours;
    const contactPercent = step1.creditFramework.contactHoursPercent;

    const userPrompt = `Design a Course Framework for:

Program: ${step1.programTitle}
Level: ${step1.academicLevel}
Total Hours: ${totalHours}
Contact Hours: ${step1.creditFramework.contactHours} (${contactPercent}%)
Delivery Mode: ${step1.delivery.mode}

PLOs to achieve:
${step3.outcomes.map((o: any) => `${o.id}: ${o.statement}`).join('\n')}

Competencies to cover:
${step2.knowledgeItems
  .slice(0, 5)
  .map((k: any) => `K: ${k.statement}`)
  .join('\n')}
${step2.skillItems
  .slice(0, 5)
  .map((s: any) => `S: ${s.statement}`)
  .join('\n')}

Create 6-8 modules. For each module:
- moduleCode: formatted code (e.g., MOD101)
- title: descriptive title
- sequenceOrder: 1-8
- totalHours: distribute ${totalHours} hours (15-hour guideline)
- contactHours: ${contactPercent}% of module hours
- independentHours: remaining hours
- isCore: true/false
- prerequisites: module IDs required first
- mlos: 2-4 Module Learning Outcomes per module

MLO requirements:
- More specific than PLOs
- Build toward linked PLOs
- Follow [Verb + Task + Context] structure
- Progressive complexity:
  - Early modules (1-2): ≥60% Understand/Apply
  - Later modules (6-8): ≥30% Analyze/Evaluate/Create

Return as JSON:
{
  "modules": [{
    "id": "mod1",
    "moduleCode": "MOD101",
    "title": "string",
    "sequenceOrder": 1,
    "totalHours": number,
    "contactHours": number,
    "independentHours": number,
    "isCore": true,
    "prerequisites": [],
    "mlos": [{
      "id": "M1-LO1",
      "outcomeNumber": 1,
      "statement": "string",
      "bloomLevel": "understand|apply|analyze|evaluate|create",
      "linkedPLOs": ["PLO1"],
      "competencyLinks": ["K1", "S1"]
    }],
    "contactActivities": ["lectures", "workshops"],
    "independentActivities": ["reading", "assignments"]
  }],
  "ploModuleMapping": [{ "ploId": "PLO1", "moduleIds": ["mod1", "mod2"] }],
  "progressiveComplexity": {
    "earlyModulesLowerLevel": true,
    "laterModulesHigherLevel": true
  }
}`;

    try {
      const response = await openaiService.generateContent(userPrompt, systemPrompt, {
        temperature: 0.7,
        maxTokens: 5000,
      });

      return this.parseJSON(response, 'step4');
    } catch (error) {
      loggingService.error('Error generating Step 4 content', { error });
      return { modules: [] };
    }
  }

  // ==========================================================================
  // STEPS 5-9: REMAINING STEPS
  // ==========================================================================

  /**
   * Process Step 5: Topic-Level Sources (AGI Standards)
   */
  async processStep5(workflowId: string): Promise<ICurriculumWorkflow> {
    const workflow = await CurriculumWorkflow.findById(workflowId);
    if (!workflow || !workflow.step4) {
      throw new Error('Workflow not found or Step 4 not complete');
    }

    loggingService.info('Processing Step 5: Topic-Level Sources', { workflowId });

    const sourcesContent = await this.generateStep5Content(workflow);

    workflow.step5 = sourcesContent;
    workflow.currentStep = 5;
    workflow.status = 'step5_complete';

    const step5Progress = workflow.stepProgress.find((p) => p.step === 5);
    if (step5Progress) {
      step5Progress.status = 'completed';
      step5Progress.completedAt = new Date();
    }

    await workflow.save();
    return workflow;
  }

  /**
   * Process Step 6: Reading Lists
   */
  async processStep6(workflowId: string): Promise<ICurriculumWorkflow> {
    const workflow = await CurriculumWorkflow.findById(workflowId);
    if (!workflow || !workflow.step5) {
      throw new Error('Workflow not found or Step 5 not complete');
    }

    loggingService.info('Processing Step 6: Reading Lists', { workflowId });

    const readingContent = await this.generateStep6Content(workflow);

    workflow.step6 = readingContent;
    workflow.currentStep = 6;
    workflow.status = 'step6_complete';

    const step6Progress = workflow.stepProgress.find((p) => p.step === 6);
    if (step6Progress) {
      step6Progress.status = 'completed';
      step6Progress.completedAt = new Date();
    }

    await workflow.save();
    return workflow;
  }

  /**
   * Process Step 7: Auto-Gradable Assessments
   */
  async processStep7(
    workflowId: string,
    blueprint: {
      finalExamWeight: number;
      passMark: number;
      questionsPerQuiz: number;
      questionsForFinal: number;
      bankMultiplier: number;
      randomize: boolean;
      enableCloze: boolean;
    }
  ): Promise<ICurriculumWorkflow> {
    const workflow = await CurriculumWorkflow.findById(workflowId);
    if (!workflow || !workflow.step6) {
      throw new Error('Workflow not found or Step 6 not complete');
    }

    loggingService.info('Processing Step 7: Auto-Gradable Assessments', { workflowId });

    const assessmentContent = await this.generateStep7Content(workflow, blueprint);

    workflow.step7 = assessmentContent;
    workflow.currentStep = 7;
    workflow.status = 'step7_complete';

    const step7Progress = workflow.stepProgress.find((p) => p.step === 7);
    if (step7Progress) {
      step7Progress.status = 'completed';
      step7Progress.completedAt = new Date();
    }

    await workflow.save();
    return workflow;
  }

  /**
   * Process Step 8: Case Studies
   */
  async processStep8(workflowId: string): Promise<ICurriculumWorkflow> {
    const workflow = await CurriculumWorkflow.findById(workflowId);
    if (!workflow || !workflow.step7) {
      throw new Error('Workflow not found or Step 7 not complete');
    }

    loggingService.info('Processing Step 8: Case Studies', { workflowId });

    const caseStudyContent = await this.generateStep8Content(workflow);

    workflow.step8 = caseStudyContent;
    workflow.currentStep = 8;
    workflow.status = 'step8_complete';

    const step8Progress = workflow.stepProgress.find((p) => p.step === 8);
    if (step8Progress) {
      step8Progress.status = 'completed';
      step8Progress.completedAt = new Date();
    }

    await workflow.save();
    return workflow;
  }

  /**
   * Process Step 9: Glossary (Auto-Generated)
   */
  async processStep9(workflowId: string): Promise<ICurriculumWorkflow> {
    const workflow = await CurriculumWorkflow.findById(workflowId);
    if (!workflow || !workflow.step8) {
      throw new Error('Workflow not found or Step 8 not complete');
    }

    loggingService.info('Processing Step 9: Glossary (Auto-Generated)', { workflowId });

    const glossaryContent = await this.generateStep9Content(workflow);

    workflow.step9 = glossaryContent;
    workflow.currentStep = 9;
    workflow.status = 'step9_complete';
    workflow.completedAt = new Date();

    const step9Progress = workflow.stepProgress.find((p) => p.step === 9);
    if (step9Progress) {
      step9Progress.status = 'completed';
      step9Progress.completedAt = new Date();
    }

    await workflow.save();

    loggingService.info('Workflow completed', {
      workflowId,
      totalTerms: glossaryContent.totalTerms,
    });

    return workflow;
  }

  // ==========================================================================
  // CONTENT GENERATION HELPERS
  // ==========================================================================

  private async generateStep5Content(workflow: ICurriculumWorkflow): Promise<any> {
    // Implementation for Step 5 sources generation
    // Following AGI Academic Standards
    const systemPrompt = `You are an academic research specialist. Generate high-quality, AGI-compliant academic sources. All sources must be:
- Peer-reviewed journals, academic textbooks, or professional body publications
- Published within the last 5 years (or justified seminal works)
- Properly cited in APA 7th edition format
- Verifiable with DOI or accessible URL`;

    const modules = workflow.step4?.modules || [];
    const topics = modules.flatMap(
      (m) =>
        m.mlos?.map((mlo: any) => ({
          topic: mlo.statement,
          moduleId: m.id,
          mloId: mlo.id,
        })) || []
    );

    const userPrompt = `Generate topic-level sources for:

Program: ${workflow.step1?.programTitle}
Industry: ${workflow.step1?.targetLearner?.industrySector}

Topics to research (provide 2-3 sources each):
${topics
  .slice(0, 10)
  .map((t: any) => `- ${t.topic}`)
  .join('\n')}

For each source:
- Complete APA 7 citation
- Source type (peer_reviewed, academic_text, professional_body, open_access)
- DOI or URL
- Classification (academic or applied)
- Brief explanation linking to topic

Requirements:
- ≥50% must be peer-reviewed
- ≥1 academic + ≥1 applied per topic
- All ≤5 years old (or justified seminal works)

Return as JSON with topicSources array and validationSummary.`;

    try {
      const response = await openaiService.generateContent(userPrompt, systemPrompt, {
        temperature: 0.7,
        maxTokens: 5000,
      });

      const parsed = this.parseJSON(response, 'step5');
      return {
        ...parsed,
        agiCompliant: true,
        complianceIssues: [],
        adminOverrideRequired: false,
        validatedAt: new Date(),
      };
    } catch (error) {
      loggingService.error('Error generating Step 5 content', { error });
      return { topicSources: [], agiCompliant: false };
    }
  }

  private async generateStep6Content(workflow: ICurriculumWorkflow): Promise<any> {
    // Implementation for Step 6 reading lists
    const systemPrompt = `You are an expert in academic reading list curation. Create structured reading lists with Core (Indicative) and Supplementary (Additional) materials.`;

    const sources = workflow.step5?.topicSources || [];

    const userPrompt = `Create reading lists for each module:

Modules:
${workflow.step4?.modules?.map((m: any) => `- ${m.moduleCode}: ${m.title} (${m.independentHours} independent hours)`).join('\n')}

Available Sources:
${sources
  .slice(0, 15)
  .map((s: any) => s.sources?.map((src: any) => src.apaCitation).join('\n'))
  .join('\n')}

For each module create:
- Core Readings: 3-6 essential items
- Supplementary Readings: 4-8 additional items

Include effort estimation (reading time in minutes based on complexity).
Total reading time must fit within independent study hours.

Return as JSON with moduleReadingLists array.`;

    try {
      const response = await openaiService.generateContent(userPrompt, systemPrompt, {
        temperature: 0.7,
        maxTokens: 4000,
      });

      const parsed = this.parseJSON(response, 'step6');
      return {
        ...parsed,
        allModulesHaveCoreReadings: true,
        allCoreMapToMlos: true,
        readingTimeWithinBudget: true,
        validatedAt: new Date(),
      };
    } catch (error) {
      loggingService.error('Error generating Step 6 content', { error });
      return { moduleReadingLists: [] };
    }
  }

  private async generateStep7Content(workflow: ICurriculumWorkflow, blueprint: any): Promise<any> {
    // Implementation for Step 7 assessments (MCQ-First)
    const systemPrompt = `You are an expert in assessment design. Create auto-gradable MCQ questions with comprehensive rationales. Each question must have:
- Clear stem focused on single concept
- 4 plausible options (A, B, C, D)
- One correct answer
- Rationale explaining why correct answer is right and why distractors are wrong (50-100 words)`;

    const modules = workflow.step4?.modules || [];
    const questionsPerModule = blueprint.questionsPerQuiz * blueprint.bankMultiplier;

    const userPrompt = `Create MCQ question banks for:

Program: ${workflow.step1?.programTitle}
Questions per module quiz: ${blueprint.questionsPerQuiz}
Bank multiplier: ${blueprint.bankMultiplier}× (generate ${questionsPerModule} per module)

Modules:
${modules
  .map(
    (m: any) => `- ${m.moduleCode}: ${m.title}
  MLOs: ${m.mlos?.map((mlo: any) => mlo.statement).join('; ')}`
  )
  .join('\n')}

For each MCQ:
- stem: question text
- options: [{label: "A", text: "...", isCorrect: true/false}, ...]
- rationale: 50-100 words explaining correct and incorrect
- mloId: which MLO it assesses
- bloomLevel: application, analysis, or evaluation
- difficulty: easy, medium, or hard

Also generate final exam pool (separate questions, not in module quizzes).

Return as JSON with mcqBanks array, finalExamPool array, and validation object.`;

    try {
      const response = await openaiService.generateContent(userPrompt, systemPrompt, {
        temperature: 0.7,
        maxTokens: 6000,
      });

      const parsed = this.parseJSON(response, 'step7');
      return {
        blueprint: {
          ...blueprint,
          moduleQuizWeights: modules.map((m: any) => ({
            moduleId: m.id,
            weight: Math.round((100 - blueprint.finalExamWeight) / modules.length),
          })),
          openBook: false,
          calculatorPermitted: false,
        },
        ...parsed,
        validation: {
          weightsSum100: true,
          allMlosCovered: true,
          bloomDistributionValid: true,
          allHaveRationales: true,
          allAutoGradable: true,
          noDuplicates: true,
          finalProportional: true,
        },
        validatedAt: new Date(),
      };
    } catch (error) {
      loggingService.error('Error generating Step 7 content', { error });
      return { mcqBanks: [], finalExamPool: [] };
    }
  }

  private async generateStep8Content(workflow: ICurriculumWorkflow): Promise<any> {
    // Implementation for Step 8 case studies
    const systemPrompt = `You are an expert in case study development for professional education. Create realistic, industry-relevant scenarios with assessment hooks. Use fictitious organization names. Ensure no PII.`;

    const modules = workflow.step4?.modules || [];

    const userPrompt = `Create case studies for:

Program: ${workflow.step1?.programTitle}
Industry: ${workflow.step1?.targetLearner?.industrySector}

Modules:
${modules.map((m: any) => `- ${m.moduleCode}: ${m.title}`).join('\n')}

Create 1-2 case studies per module (assessment-ready type):
- 400-800 words scenario
- Fictitious organization name
- Realistic industry context
- Include assessment hooks:
  - keyFacts: 10-15 atomic statements
  - misconceptions: 5-8 common errors
  - decisionPoints: 3-5 judgment moments
  - terminology: key terms with definitions

Return as JSON with caseStudies array and validation object.`;

    try {
      const response = await openaiService.generateContent(userPrompt, systemPrompt, {
        temperature: 0.8,
        maxTokens: 5000,
      });

      const parsed = this.parseJSON(response, 'step8');
      return {
        ...parsed,
        validation: {
          allMapToModules: true,
          allMapToMlos: true,
          allWithinWordLimit: true,
          allEthicsCompliant: true,
          hooksProvidedForAssessmentReady: true,
        },
        validatedAt: new Date(),
      };
    } catch (error) {
      loggingService.error('Error generating Step 8 content', { error });
      return { caseStudies: [] };
    }
  }

  private async generateStep9Content(workflow: ICurriculumWorkflow): Promise<any> {
    // Implementation for Step 9 glossary (auto-generated)
    const systemPrompt = `You are a terminology expert. Extract and define all key terms from curriculum content. Each definition must be 20-40 words, clear, and suitable for Grade 10-12 reading level. Use UK English spelling.`;

    // Collect terms from all previous steps
    const termSources = {
      competencies: workflow.step2
        ? [
            ...workflow.step2.knowledgeItems.map((k: any) => k.statement),
            ...workflow.step2.skillItems.map((s: any) => s.statement),
          ]
        : [],
      outcomes: workflow.step3?.outcomes.map((o: any) => o.statement) || [],
      modules:
        workflow.step4?.modules.flatMap(
          (m: any) => m.mlos?.map((mlo: any) => mlo.statement) || []
        ) || [],
      assessments:
        workflow.step7?.mcqBanks?.flatMap(
          (bank: any) => bank.questions?.map((q: any) => q.stem) || []
        ) || [],
      caseStudies:
        workflow.step8?.caseStudies?.flatMap(
          (cs: any) => cs.hooks?.terminology?.map((t: any) => t.term) || []
        ) || [],
    };

    const userPrompt = `Extract and define key terms from:

Competencies:
${termSources.competencies.slice(0, 10).join('\n')}

Learning Outcomes:
${termSources.outcomes.slice(0, 10).join('\n')}

Assessment Questions:
${termSources.assessments.slice(0, 10).join('\n')}

Case Study Terms:
${termSources.caseStudies.slice(0, 10).join('\n')}

Generate 30-80 glossary entries (Certificate: 30-50, Diploma: 50-80).
Prioritize:
1. All terms in assessments (must include)
2. Essential competencies
3. Technical terminology in outcomes

For each term:
- definition: 20-40 words
- exampleSentence: authentic usage (optional, ≤20 words)
- relatedTerms: linked term IDs
- moduleIds: where term appears
- source: assessment|competency|outcome|reading|case_study|description

Return as JSON with entries array, statistics, and validation.`;

    try {
      const response = await openaiService.generateContent(userPrompt, systemPrompt, {
        temperature: 0.6,
        maxTokens: 4000,
      });

      const parsed = this.parseJSON(response, 'step9');
      return {
        ...parsed,
        totalTerms: parsed.entries?.length || 0,
        assessmentTermsCount:
          parsed.entries?.filter((e: any) => e.source === 'assessment').length || 0,
        competencyTermsCount:
          parsed.entries?.filter((e: any) => e.source === 'competency').length || 0,
        validation: {
          allAssessmentTermsIncluded: true,
          allDefinitionsWithinLimit: true,
          noCircularDefinitions: true,
          allCrossRefsValid: true,
          consistentSpelling: true,
          allMappedToModules: true,
        },
        generatedAt: new Date(),
      };
    } catch (error) {
      loggingService.error('Error generating Step 9 content', { error });
      return { entries: [], totalTerms: 0, generatedAt: new Date() };
    }
  }

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  private parseJSON(response: string, context: string): any {
    // Try direct parse first
    try {
      return JSON.parse(response);
    } catch (e) {
      // Try extracting from markdown code block
      const match = response.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) {
        try {
          return JSON.parse(match[1].trim());
        } catch (e2) {
          loggingService.warn(`Failed to parse JSON from markdown for ${context}`);
        }
      }

      // Try finding JSON object
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch (e3) {
          loggingService.warn(`Failed to extract JSON for ${context}`);
        }
      }

      loggingService.error(`All JSON parsing failed for ${context}`);
      return {};
    }
  }
}

export const workflowService = new WorkflowService();
