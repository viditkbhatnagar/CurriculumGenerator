/**
 * Summative Exam Generation Service
 * Generates a formal summative exam package for the program
 *
 * Structure:
 * - Section A: MCQs / short answer (all delivery modes)
 * - Section B: Scenario-Based Analysis (hybrid/in-person ONLY, NOT self-study)
 * - Section C: Applied Task or Simulation
 * - Marking Scheme with model answers
 * - Integrity, Security & Validity
 * - Accessibility & Reasonable Adjustments
 */

import { openaiService } from './openaiService';
import { loggingService } from './loggingService';
import {
  ICurriculumWorkflow,
  Step13SummativeExam,
  SectionAQuestion,
  SectionBScenario,
  SectionCTask,
  ExamMarkingScheme,
  ExamOverview,
} from '../models/CurriculumWorkflow';

interface ExamContext {
  programTitle: string;
  programDescription: string;
  academicLevel: string;
  deliveryMode: string;
  creditFramework: any;
  plos: Array<{ id: string; statement: string; bloomLevel: string }>;
  modules: Array<{
    id: string;
    moduleCode: string;
    title: string;
    mlos: Array<{ id: string; statement: string; bloomLevel: string; linkedPLOs: string[] }>;
  }>;
  assessmentStrategy: any;
  caseStudies: any[];
}

export class SummativeExamService {
  private readonly SECTION_TIMEOUT = 240000; // 4 minutes per section
  private readonly MAX_TOKENS_SECTION_A = 16000;
  private readonly MAX_TOKENS_SECTION_B = 12000;
  private readonly MAX_TOKENS_SECTION_C = 10000;
  private readonly MAX_TOKENS_MARKING = 16000;
  private readonly INTER_CALL_DELAY = 1500;

  /**
   * Generate the complete summative exam package
   */
  async generateSummativeExam(workflow: ICurriculumWorkflow): Promise<Step13SummativeExam> {
    const context = this.buildExamContext(workflow);
    const includeSectionB = this.shouldIncludeSectionB(context.deliveryMode);

    loggingService.info('Starting summative exam generation', {
      programTitle: context.programTitle,
      deliveryMode: context.deliveryMode,
      includeSectionB,
      totalPLOs: context.plos.length,
      totalModules: context.modules.length,
    });

    // Phase 1: Generate Overview + Section A
    loggingService.info('Phase 1: Generating overview and Section A');
    const { overview, sectionA } = await this.generateOverviewAndSectionA(context, includeSectionB);

    await this.delay(this.INTER_CALL_DELAY);

    // Phase 2: Generate Section B (conditional)
    let sectionB: SectionBScenario[] | undefined;
    if (includeSectionB) {
      loggingService.info('Phase 2: Generating Section B (scenario analysis)');
      sectionB = await this.generateSectionB(context);
      await this.delay(this.INTER_CALL_DELAY);
    } else {
      loggingService.info('Phase 2: Skipping Section B (self-study mode)');
    }

    // Phase 3: Generate Section C
    loggingService.info('Phase 3: Generating Section C (applied tasks)');
    const sectionC = await this.generateSectionC(context);

    await this.delay(this.INTER_CALL_DELAY);

    // Phase 4: Generate Marking Scheme
    loggingService.info('Phase 4: Generating marking scheme');
    const markingScheme = await this.generateMarkingScheme(sectionA, sectionB, sectionC, context);

    await this.delay(this.INTER_CALL_DELAY);

    // Phase 5: Generate Integrity and Accessibility
    loggingService.info('Phase 5: Generating integrity and accessibility sections');
    const { integrityAndSecurity, accessibilityProvisions } = await this.generateMetadata(context);

    // Calculate totals
    const sectionAMarks = sectionA.reduce((sum, q) => sum + q.marks, 0);
    const sectionBMarks = sectionB ? sectionB.reduce((sum, s) => sum + s.totalMarks, 0) : 0;
    const sectionCMarks = sectionC ? sectionC.reduce((sum, t) => sum + t.marks, 0) : 0;
    const totalMarks = sectionAMarks + sectionBMarks + sectionCMarks;

    // Validate PLO coverage
    const coveredPLOs = new Set<string>();
    sectionA.forEach((q) => q.linkedPLOs.forEach((p) => coveredPLOs.add(p)));
    sectionB?.forEach((s) =>
      s.questions.forEach((q) => q.linkedPLOs.forEach((p) => coveredPLOs.add(p)))
    );
    sectionC?.forEach((t) => t.linkedPLOs.forEach((p) => coveredPLOs.add(p)));
    const allPLOsCovered = context.plos.every((plo) => coveredPLOs.has(plo.id));

    const result: Step13SummativeExam = {
      overview: {
        ...overview,
        totalMarks,
      },
      sectionA,
      sectionB,
      sectionBIncluded: includeSectionB,
      sectionC,
      markingScheme,
      integrityAndSecurity,
      accessibilityProvisions,
      validation: {
        totalMarksCorrect: totalMarks > 0,
        allSectionsPresent:
          sectionA.length > 0 && (!includeSectionB || (sectionB && sectionB.length > 0)),
        allPLOsCovered,
        markingSchemeComplete: markingScheme.sectionA.length > 0,
      },
      summary: {
        totalQuestions:
          sectionA.length +
          (sectionB?.reduce((sum, s) => sum + s.questions.length, 0) || 0) +
          (sectionC?.length || 0),
        totalMarks,
        sectionAMarks,
        sectionBMarks,
        sectionCMarks,
        deliveryModeUsed: context.deliveryMode,
      },
      generatedAt: new Date(),
    };

    loggingService.info('Summative exam generation complete', {
      totalQuestions: result.summary.totalQuestions,
      totalMarks: result.summary.totalMarks,
      sectionBIncluded: includeSectionB,
      allPLOsCovered,
    });

    return result;
  }

  /**
   * Determine if Section B should be included based on delivery mode
   */
  private shouldIncludeSectionB(deliveryMode: string): boolean {
    const selfStudyModes = ['online_self_study'];
    return !selfStudyModes.includes(deliveryMode);
  }

  private buildExamContext(workflow: ICurriculumWorkflow): ExamContext {
    return {
      programTitle: workflow.step1?.programTitle || 'Program',
      programDescription: workflow.step1?.programDescription || '',
      academicLevel: workflow.step1?.academicLevel || 'certificate',
      deliveryMode: workflow.step1?.delivery?.mode || 'online',
      creditFramework: workflow.step1?.creditFramework || {},
      plos: (workflow.step3?.outcomes || []).map((o: any) => ({
        id: o.id,
        statement: o.statement,
        bloomLevel: o.bloomLevel,
      })),
      modules: (workflow.step4?.modules || []).map((m: any) => ({
        id: m.id,
        moduleCode: m.moduleCode,
        title: m.title,
        mlos: (m.mlos || []).map((mlo: any) => ({
          id: mlo.id,
          statement: mlo.statement,
          bloomLevel: mlo.bloomLevel,
          linkedPLOs: mlo.linkedPLOs || [],
        })),
      })),
      assessmentStrategy: workflow.step7?.userPreferences || {},
      caseStudies: workflow.step8?.caseStudies || [],
    };
  }

  private async generateOverviewAndSectionA(
    context: ExamContext,
    includeSectionB: boolean
  ): Promise<{ overview: ExamOverview; sectionA: SectionAQuestion[] }> {
    const plosList = context.plos
      .map((p) => `${p.id}: ${p.statement} [${p.bloomLevel}]`)
      .join('\n');

    const modulesList = context.modules
      .map((m) => `${m.moduleCode}: ${m.title} (MLOs: ${m.mlos.map((mlo) => mlo.id).join(', ')})`)
      .join('\n');

    const systemPrompt = `You are an academic assessment production engine. Generate the exam overview and Section A (Knowledge & Application Checks) for a formal summative exam.

DO NOT invent new learning outcomes. DO NOT change assessment weightings. DO NOT introduce new topics.
Prioritise APPLICATION and ANALYSIS over recall. Questions must be realistic and job-relevant.

Style: Formal, professional, regulator-ready. Student-facing exam language. UK academic conventions. No emojis.
Return ONLY valid JSON.`;

    const prompt = `Generate the EXAM OVERVIEW and SECTION A for this program's final summative exam.

**PROGRAM:** ${context.programTitle}
**LEVEL:** ${context.academicLevel}
**DELIVERY MODE:** ${context.deliveryMode}
${includeSectionB ? '**SECTIONS:** A (MCQs/Short Answer), B (Scenario Analysis), C (Applied Tasks)' : '**SECTIONS:** A (MCQs/Short Answer), C (Applied Tasks) — Section B excluded for self-study delivery'}

**PROGRAM LEARNING OUTCOMES (the exam must assess ALL of these):**
${plosList}

**MODULES:**
${modulesList}

**OUTPUT (JSON):**
{
  "overview": {
    "examTitle": "Final Summative Exam — ${context.programTitle}",
    "credentialName": "${context.programTitle}",
    "examPurpose": "Validate program-level competence across all PLOs",
    "totalWeighting": 100,
    "totalDuration": "e.g. 2 hours 30 minutes",
    "deliveryModes": ["${context.deliveryMode}"],
    "permittedMaterials": "e.g. Open book / Closed book",
    "totalMarks": 100,
    "sectionBreakdown": [
      {
        "section": "Section A: Knowledge & Application Checks",
        "marks": number,
        "questionCount": number,
        "timeAllocation": "e.g. 45 minutes",
        "plosAssessed": ["PLO IDs"]
      }
    ]
  },
  "sectionA": [
    {
      "questionId": "A1",
      "type": "mcq" | "short_answer",
      "questionText": "Full question text with scenario context",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correctAnswer": "The correct answer letter or text",
      "marks": number,
      "linkedMLOs": ["MLO IDs"],
      "linkedPLOs": ["PLO IDs"],
      "rationale": "Why this is the correct answer",
      "bloomLevel": "e.g. apply, analyse"
    }
  ]
}

Generate 15-25 Section A questions that collectively cover ALL PLOs. Use scenario-based MCQs where possible (not trivial recall). Include a mix of MCQ and short answer types.

Return ONLY valid JSON.`;

    const response = await openaiService.generateContent(prompt, systemPrompt, {
      responseFormat: 'json_object',
      maxTokens: this.MAX_TOKENS_SECTION_A,
      timeout: this.SECTION_TIMEOUT,
    });

    const parsed = JSON.parse(response);
    return {
      overview: parsed.overview || {},
      sectionA: parsed.sectionA || [],
    };
  }

  private async generateSectionB(context: ExamContext): Promise<SectionBScenario[]> {
    const systemPrompt = `You are an academic assessment production engine. Generate Section B (Scenario-Based Analysis) for a formal summative exam.

Questions must be scenario-based using realistic workplace contexts. Avoid trivial recall. Assess APPLICATION and ANALYSIS.

Style: Formal, professional. UK academic conventions. No emojis.
Return ONLY valid JSON.`;

    const caseStudySummaries = context.caseStudies
      .slice(0, 5)
      .map(
        (cs: any) =>
          `- ${cs.title}: ${cs.scenario?.substring(0, 200) || cs.industryContext || 'N/A'}...`
      )
      .join('\n');

    const prompt = `Generate Section B (Scenario-Based Analysis) for the summative exam.

**PROGRAM:** ${context.programTitle}
**LEVEL:** ${context.academicLevel}

**PLOs to assess:**
${context.plos.map((p) => `${p.id}: ${p.statement} [${p.bloomLevel}]`).join('\n')}

**EXISTING CASE STUDIES (use as inspiration for scenarios, do NOT duplicate verbatim):**
${caseStudySummaries || 'No case studies available'}

**OUTPUT (JSON):**
{
  "sectionB": [
    {
      "scenarioId": "B1",
      "scenarioText": "Full scenario description (200-400 words, realistic workplace context)",
      "workplaceContext": "Industry and organisational context",
      "questions": [
        {
          "questionId": "B1a",
          "questionText": "Analysis question based on the scenario",
          "marks": number,
          "modelAnswer": "Expected answer with key points",
          "linkedMLOs": ["MLO IDs"],
          "linkedPLOs": ["PLO IDs"]
        }
      ],
      "totalMarks": number
    }
  ]
}

Generate 2-4 scenarios with 2-3 questions each. Scenarios should be distinct and cover different PLOs.

Return ONLY valid JSON.`;

    const response = await openaiService.generateContent(prompt, systemPrompt, {
      responseFormat: 'json_object',
      maxTokens: this.MAX_TOKENS_SECTION_B,
      timeout: this.SECTION_TIMEOUT,
    });

    const parsed = JSON.parse(response);
    return parsed.sectionB || [];
  }

  private async generateSectionC(context: ExamContext): Promise<SectionCTask[]> {
    const systemPrompt = `You are an academic assessment production engine. Generate Section C (Applied Tasks or Simulations) for a formal summative exam.

Tasks must require practical application of knowledge. Align to stated Bloom levels.

Style: Formal, professional. UK academic conventions. No emojis.
Return ONLY valid JSON.`;

    const prompt = `Generate Section C (Applied Tasks) for the summative exam.

**PROGRAM:** ${context.programTitle}
**LEVEL:** ${context.academicLevel}

**PLOs:**
${context.plos.map((p) => `${p.id}: ${p.statement} [${p.bloomLevel}]`).join('\n')}

**OUTPUT (JSON):**
{
  "sectionC": [
    {
      "taskId": "C1",
      "taskDescription": "Applied task description",
      "instructions": ["Step 1...", "Step 2..."],
      "marks": number,
      "modelAnswer": "Expected approach and key elements",
      "assessmentCriteria": ["Criterion 1", "Criterion 2"],
      "linkedMLOs": ["MLO IDs"],
      "linkedPLOs": ["PLO IDs"]
    }
  ]
}

Generate 1-3 applied tasks that assess higher-order PLOs (evaluate, create).

Return ONLY valid JSON.`;

    const response = await openaiService.generateContent(prompt, systemPrompt, {
      responseFormat: 'json_object',
      maxTokens: this.MAX_TOKENS_SECTION_C,
      timeout: this.SECTION_TIMEOUT,
    });

    const parsed = JSON.parse(response);
    return parsed.sectionC || [];
  }

  private async generateMarkingScheme(
    sectionA: SectionAQuestion[],
    sectionB: SectionBScenario[] | undefined,
    sectionC: SectionCTask[] | undefined,
    context: ExamContext
  ): Promise<ExamMarkingScheme> {
    const systemPrompt = `You are an academic assessment production engine. Generate a comprehensive marking scheme with model answers and performance thresholds (Fail/Pass/Merit/Distinction) for each section of the exam.

Style: Formal, professional. UK academic conventions.
Return ONLY valid JSON.`;

    const sectionASummary = sectionA
      .map((q) => `${q.questionId}: ${q.questionText.substring(0, 100)}... (${q.marks} marks)`)
      .join('\n');

    const sectionBSummary = sectionB
      ? sectionB
          .map(
            (s) =>
              `${s.scenarioId}: ${s.scenarioText.substring(0, 100)}... (${s.totalMarks} marks, ${s.questions.length} questions)`
          )
          .join('\n')
      : 'N/A';

    const sectionCSummary = sectionC
      ? sectionC
          .map((t) => `${t.taskId}: ${t.taskDescription.substring(0, 100)}... (${t.marks} marks)`)
          .join('\n')
      : 'N/A';

    const prompt = `Generate the MARKING SCHEME for this exam.

**SECTION A QUESTIONS:**
${sectionASummary}

**SECTION B SCENARIOS:**
${sectionBSummary}

**SECTION C TASKS:**
${sectionCSummary}

**OUTPUT (JSON):**
{
  "sectionA": [
    {
      "questionId": "A1",
      "modelAnswer": "Full model answer",
      "markAllocation": "How marks are awarded",
      "performanceThresholds": {
        "fail": "Below expected standard descriptor",
        "pass": "Meets minimum standard descriptor",
        "merit": "Above expected standard descriptor",
        "distinction": "Exceptional performance descriptor"
      }
    }
  ],
  ${
    sectionB
      ? `"sectionB": [
    {
      "scenarioId": "B1",
      "markAllocation": "Overall mark distribution",
      "modelAnswers": [
        { "questionId": "B1a", "modelAnswer": "Full model answer", "marks": number }
      ],
      "performanceThresholds": {
        "fail": "...", "pass": "...", "merit": "...", "distinction": "..."
      }
    }
  ],`
      : ''
  }
  "sectionC": [
    {
      "taskId": "C1",
      "modelAnswer": "Expected approach and key elements",
      "markAllocation": "How marks are distributed",
      "performanceThresholds": {
        "fail": "...", "pass": "...", "merit": "...", "distinction": "..."
      }
    }
  ]
}

Return ONLY valid JSON.`;

    const response = await openaiService.generateContent(prompt, systemPrompt, {
      responseFormat: 'json_object',
      maxTokens: this.MAX_TOKENS_MARKING,
      timeout: this.SECTION_TIMEOUT,
    });

    const parsed = JSON.parse(response);
    return {
      sectionA: parsed.sectionA || [],
      sectionB: parsed.sectionB,
      sectionC: parsed.sectionC || [],
    };
  }

  private async generateMetadata(
    context: ExamContext
  ): Promise<{ integrityAndSecurity: string; accessibilityProvisions: string }> {
    const systemPrompt = `You are an academic assessment production engine. Generate exam integrity/security rules and accessibility provisions. UK academic conventions, formal tone. Return ONLY valid JSON.`;

    const prompt = `Generate integrity and accessibility sections for the summative exam.

**PROGRAM:** ${context.programTitle}
**DELIVERY MODE:** ${context.deliveryMode}

**OUTPUT (JSON):**
{
  "integrityAndSecurity": "Full text covering: academic integrity expectations, plagiarism and misconduct rules, identity verification guidance, randomisation or scenario rotation logic (if online)",
  "accessibilityProvisions": "Full text covering: time extensions, alternative formats, assistive technology allowances, no reduction of standards"
}

Return ONLY valid JSON.`;

    const response = await openaiService.generateContent(prompt, systemPrompt, {
      responseFormat: 'json_object',
      maxTokens: 4000,
      timeout: 60000,
    });

    const parsed = JSON.parse(response);
    return {
      integrityAndSecurity: parsed.integrityAndSecurity || '',
      accessibilityProvisions: parsed.accessibilityProvisions || '',
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const summativeExamService = new SummativeExamService();
