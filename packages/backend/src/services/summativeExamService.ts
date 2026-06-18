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
  targetMarket: string;
}

export class SummativeExamService {
  private readonly SECTION_TIMEOUT = 600000; // 10 minutes per section — GPT-5.2 high thinking needs more time
  private readonly MAX_TOKENS_SECTION_A = 16000;
  private readonly MAX_TOKENS_SECTION_B = 12000;
  private readonly MAX_TOKENS_SECTION_C = 10000;
  private readonly INTER_CALL_DELAY = 1500;

  /**
   * Safely parse JSON from LLM response, handling truncated or malformed output
   */
  private safeParseJSON(response: string, phase: string): any {
    try {
      return JSON.parse(response);
    } catch (firstError) {
      loggingService.warn(`Phase ${phase}: JSON parse failed, attempting repair`, {
        responseLength: response.length,
        firstChars: response.substring(0, 100),
        lastChars: response.substring(response.length - 100),
      });

      // Try to repair truncated JSON by closing open brackets/braces
      let repaired = response.trim();

      // Remove trailing incomplete string values (cut mid-sentence)
      repaired = repaired.replace(/,\s*"[^"]*":\s*"[^"]*$/g, '');
      repaired = repaired.replace(/,\s*"[^"]*$/g, '');

      // Count open/close brackets
      const openBraces = (repaired.match(/{/g) || []).length;
      const closeBraces = (repaired.match(/}/g) || []).length;
      const openBrackets = (repaired.match(/\[/g) || []).length;
      const closeBrackets = (repaired.match(/]/g) || []).length;

      // Close any open arrays then objects
      for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += ']';
      for (let i = 0; i < openBraces - closeBraces; i++) repaired += '}';

      try {
        const parsed = JSON.parse(repaired);
        loggingService.info(`Phase ${phase}: JSON repair succeeded`);
        return parsed;
      } catch (secondError) {
        loggingService.error(`Phase ${phase}: JSON repair also failed`, {
          responseLength: response.length,
          error: secondError instanceof Error ? secondError.message : String(secondError),
        });
        throw new Error(
          `Phase ${phase} returned invalid JSON (${response.length} chars). ` +
            `This usually means the response was truncated due to token limits. ` +
            `Original error: ${firstError instanceof Error ? firstError.message : String(firstError)}`
        );
      }
    }
  }

  /**
   * Generate the complete summative exam package
   * @param onProgress - optional callback to report phase progress (0-100)
   */
  async generateSummativeExam(
    workflow: ICurriculumWorkflow,
    onProgress?: (pct: number) => void
  ): Promise<Step13SummativeExam> {
    const context = this.buildExamContext(workflow);
    const includeSectionB = this.shouldIncludeSectionB(context.deliveryMode);
    const report = (pct: number) => onProgress?.(pct);

    loggingService.info('Starting summative exam generation', {
      programTitle: context.programTitle,
      deliveryMode: context.deliveryMode,
      includeSectionB,
      totalPLOs: context.plos.length,
      totalModules: context.modules.length,
    });

    // Phase 1: Generate Overview + Section A
    report(10);
    loggingService.info('Phase 1: Generating overview and Section A');
    const { overview, sectionA } = await this.generateOverviewAndSectionA(context, includeSectionB);

    await this.delay(this.INTER_CALL_DELAY);

    // Phase 2: Generate Section B (conditional)
    report(30);
    let sectionB: SectionBScenario[] | undefined;
    if (includeSectionB) {
      loggingService.info('Phase 2: Generating Section B (scenario analysis)');
      sectionB = await this.generateSectionB(context);
      await this.delay(this.INTER_CALL_DELAY);
    } else {
      loggingService.info('Phase 2: Skipping Section B (self-study mode)');
    }

    // Phase 3: Generate Section C
    report(50);
    loggingService.info('Phase 3: Generating Section C (applied tasks)');
    const sectionC = await this.generateSectionC(context);

    await this.delay(this.INTER_CALL_DELAY);

    // Phase 4: Build the marking scheme deterministically from the questions so
    // every model answer matches its own question (no separate, drift-prone call).
    report(70);
    loggingService.info('Phase 4: Building marking scheme from generated questions');
    const markingScheme = this.generateMarkingScheme(sectionA, sectionB, sectionC);

    // Phase 5: Generate Integrity and Accessibility
    report(85);
    loggingService.info('Phase 5: Generating integrity and accessibility sections');
    const { integrityAndSecurity, accessibilityProvisions } = await this.generateMetadata(context);

    // Strip leaked reasoning artifacts ("Wait:", "Hmm,", "As an AI…") from the
    // learner/marker-facing text so they never appear in the exam or rationale.
    sectionA.forEach((q) => {
      if (q.rationale) q.rationale = this.cleanText(q.rationale);
      if (typeof q.correctAnswer === 'string') q.correctAnswer = this.cleanText(q.correctAnswer);
    });
    sectionB?.forEach((s) =>
      s.questions.forEach((q) => {
        if (q.modelAnswer) q.modelAnswer = this.cleanText(q.modelAnswer);
      })
    );
    sectionC?.forEach((t) => {
      if (t.modelAnswer) t.modelAnswer = this.cleanText(t.modelAnswer);
    });

    // Calculate totals
    const sectionAMarks = sectionA.reduce((sum, q) => sum + q.marks, 0);
    const sectionBMarks = sectionB ? sectionB.reduce((sum, s) => sum + s.totalMarks, 0) : 0;
    const sectionCMarks = sectionC ? sectionC.reduce((sum, t) => sum + t.marks, 0) : 0;
    const totalMarks = sectionAMarks + sectionBMarks + sectionCMarks;

    // Rebuild the section breakdown from the ACTUAL generated sections so the
    // overview's marks and counts always match the questions in the file. The
    // model-written breakdown drifted — e.g. a 100-mark breakdown under a
    // 240-mark total, "Section B: 2 questions" when 4 scenarios were generated,
    // or "Section C: 2 tasks" when 3 exist.
    const aiBreakdown: any[] = Array.isArray((overview as any).sectionBreakdown)
      ? (overview as any).sectionBreakdown
      : [];
    const timeFor = (letter: string): string =>
      aiBreakdown.find(
        (b) => /Section\s*([A-C])/i.exec(b?.section || '')?.[1]?.toUpperCase() === letter
      )?.timeAllocation || '';
    const uniq = (ids: string[]): string[] => Array.from(new Set(ids.filter(Boolean)));
    const sectionBreakdown: any[] = [
      {
        section: 'Section A: Knowledge & Application Checks',
        marks: sectionAMarks,
        questionCount: sectionA.length,
        timeAllocation: timeFor('A'),
        plosAssessed: uniq(sectionA.flatMap((q) => q.linkedPLOs || [])),
      },
    ];
    if (includeSectionB && sectionB && sectionB.length) {
      sectionBreakdown.push({
        section: 'Section B: Scenario-Based Analysis',
        marks: sectionBMarks,
        questionCount: sectionB.length, // scenarios
        timeAllocation: timeFor('B'),
        plosAssessed: uniq(sectionB.flatMap((s) => s.questions.flatMap((q) => q.linkedPLOs || []))),
      });
    }
    if (sectionC && sectionC.length) {
      sectionBreakdown.push({
        section: 'Section C: Applied Tasks',
        marks: sectionCMarks,
        questionCount: sectionC.length, // tasks
        timeAllocation: timeFor('C'),
        plosAssessed: uniq(sectionC.flatMap((t) => t.linkedPLOs || [])),
      });
    }

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
        sectionBreakdown,
      } as any,
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
      // Reuse the target market the SME already set for Step 7 assessments so the
      // exam localises (currency, law, brands, spelling) without re-asking.
      targetMarket: (workflow.step7?.userPreferences as any)?.targetMarket || '',
    };
  }

  /**
   * Locale/market style directive for the prompts. Defaults to the previous UK
   * convention when no target market is set; otherwise localises examples,
   * currency, brand names, legal/regulatory references and spelling.
   */
  private localeStyle(context: ExamContext): string {
    const m = context.targetMarket?.trim();
    if (!m) return 'UK academic conventions.';
    return (
      `Localise everything to the ${m} context: examples, organisation/brand names, currency and ` +
      `legal/regulatory references must suit ${m} — use INR and ${m} consumer-protection / ` +
      `data-protection law (e.g. Consumer Protection Act, DPDP Act) rather than UK £, GDPR or the ` +
      `Consumer Rights Act unless ${m} is the UK. Use ${m} English spelling.`
    );
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

Style: Formal, professional, regulator-ready. Student-facing exam language. No emojis. ${this.localeStyle(context)}
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

    const parsed = this.safeParseJSON(response, 'Overview+SectionA');
    return {
      overview: parsed.overview || {},
      sectionA: parsed.sectionA || [],
    };
  }

  private async generateSectionB(context: ExamContext): Promise<SectionBScenario[]> {
    const systemPrompt = `You are an academic assessment production engine. Generate Section B (Scenario-Based Analysis) for a formal summative exam.

Questions must be scenario-based using realistic workplace contexts. Avoid trivial recall. Assess APPLICATION and ANALYSIS.

Style: Formal, professional. No emojis. ${this.localeStyle(context)}
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

    const parsed = this.safeParseJSON(response, 'SectionB');
    return parsed.sectionB || [];
  }

  private async generateSectionC(context: ExamContext): Promise<SectionCTask[]> {
    const systemPrompt = `You are an academic assessment production engine. Generate Section C (Applied Tasks or Simulations) for a formal summative exam.

Tasks must require practical application of knowledge. Align to stated Bloom levels.

Style: Formal, professional. No emojis. ${this.localeStyle(context)}
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

    const parsed = this.safeParseJSON(response, 'SectionC');
    return parsed.sectionC || [];
  }

  /**
   * Build the marking scheme directly from the generated questions so each model
   * answer always belongs to its own question. Previously a separate LLM call
   * worked from an 80-char, first-15-only summary, which drifted (e.g. a marking
   * answer about "faulty goods" attached to a question about a normal return) and
   * left later questions with no scheme at all. Each model answer is now derived
   * from the question's own correctAnswer/rationale (Section A) or modelAnswer
   * (Sections B/C); only the generic performance thresholds are templated.
   */
  private generateMarkingScheme(
    sectionA: SectionAQuestion[],
    sectionB: SectionBScenario[] | undefined,
    sectionC: SectionCTask[] | undefined
  ): ExamMarkingScheme {
    const thresholds = (kind: string) => ({
      fail: `Below the minimum standard for ${kind}: key points missing or incorrect.`,
      pass: `Meets the minimum standard for ${kind}: the essential points are covered adequately.`,
      merit: `Above the expected standard for ${kind}: accurate, well-applied and clearly reasoned.`,
      distinction: `Exceptional ${kind}: comprehensive, precise and insightful throughout.`,
    });

    const sectionAScheme = sectionA.map((q) => ({
      questionId: q.questionId,
      modelAnswer:
        q.type === 'mcq'
          ? `Correct answer: ${this.cleanText(String(q.correctAnswer ?? ''))}.` +
            (q.rationale ? ` ${this.cleanText(q.rationale)}` : '')
          : this.cleanText(String(q.correctAnswer ?? q.rationale ?? '')),
      markAllocation:
        `${q.marks} mark${q.marks === 1 ? '' : 's'} — ` +
        (q.type === 'mcq'
          ? 'awarded in full for the correct option, zero otherwise.'
          : 'awarded for coverage of the key points in the model answer.'),
      performanceThresholds: thresholds('this question'),
    }));

    const sectionBScheme = sectionB
      ? sectionB.map((s) => ({
          scenarioId: s.scenarioId,
          markAllocation: `${s.totalMarks} marks across ${s.questions.length} question${s.questions.length === 1 ? '' : 's'}.`,
          modelAnswers: s.questions.map((q) => ({
            questionId: q.questionId,
            modelAnswer: this.cleanText(q.modelAnswer || ''),
            marks: q.marks,
          })),
          performanceThresholds: thresholds('scenario analysis'),
        }))
      : undefined;

    const sectionCScheme = (sectionC || []).map((t) => ({
      taskId: t.taskId,
      modelAnswer: this.cleanText(t.modelAnswer || ''),
      markAllocation: `${t.marks} marks — awarded against the stated assessment criteria.`,
      performanceThresholds: thresholds('applied task'),
    }));

    return { sectionA: sectionAScheme, sectionB: sectionBScheme, sectionC: sectionCScheme };
  }

  /**
   * Strip leaked chain-of-thought / meta artifacts that sometimes survive in
   * model answers and rationales — e.g. a stray "Wait:" interjection, "Hmm,",
   * "Actually,", "Let me reconsider —", or "As an AI …".
   */
  private cleanText(s: string): string {
    if (!s) return '';
    let t = String(s).trim();
    t = t.replace(
      /(^|\s)(wait|hmm+|actually|hold on|on second thought|let me (?:re)?(?:think|consider|reconsider)[^.,:;—-]*)\s*[:,—-]+\s*/gi,
      '$1'
    );
    t = t.replace(/(^|\s)as an ai[^.]*\.\s*/gi, '$1');
    return t.replace(/\s{2,}/g, ' ').trim();
  }

  private async generateMetadata(
    context: ExamContext
  ): Promise<{ integrityAndSecurity: string; accessibilityProvisions: string }> {
    const systemPrompt = `You are an academic assessment production engine. Generate exam integrity/security rules and accessibility provisions. Formal tone. ${this.localeStyle(context)} Return ONLY valid JSON.`;

    const prompt = `Generate integrity and accessibility sections for the summative exam.

**PROGRAM:** ${context.programTitle}
**DELIVERY MODE:** ${context.deliveryMode}

**OUTPUT (JSON):**
{
  "integrityAndSecurity": "Full text covering: academic integrity expectations, plagiarism and misconduct rules, identity verification guidance, randomisation or scenario rotation logic (if online)",
  "accessibilityProvisions": "Full text covering: time extensions, alternative formats, assistive technology allowances, no reduction of standards"
}

Return ONLY valid JSON.`;

    // Integrity/accessibility is the least critical section, yet a failure here
    // must never discard a fully generated exam. Give GPT-5 ample room (its
    // reasoning tokens count toward the completion budget — 4000 was too low and
    // left zero for output), and fall back to sensible boilerplate on any error.
    try {
      const response = await openaiService.generateContent(prompt, systemPrompt, {
        responseFormat: 'json_object',
        maxTokens: 12000,
        timeout: this.SECTION_TIMEOUT,
      });
      const parsed = this.safeParseJSON(response, 'Metadata');
      return {
        integrityAndSecurity: parsed.integrityAndSecurity || this.defaultIntegrityText(),
        accessibilityProvisions: parsed.accessibilityProvisions || this.defaultAccessibilityText(),
      };
    } catch (error) {
      loggingService.warn(
        'Metadata generation failed — using default integrity/accessibility text',
        {
          error: error instanceof Error ? error.message : String(error),
        }
      );
      return {
        integrityAndSecurity: this.defaultIntegrityText(),
        accessibilityProvisions: this.defaultAccessibilityText(),
      };
    }
  }

  private defaultIntegrityText(): string {
    return (
      'Academic integrity: all work submitted must be the learner’s own. Plagiarism, ' +
      'collusion, impersonation and the use of unauthorised materials or tools are treated as ' +
      'academic misconduct and may result in a fail grade and further disciplinary action. ' +
      'Learner identity is verified at the start of the assessment (photo ID and enrolment ' +
      'details). For online delivery, question and scenario order is randomised between learners ' +
      'and sittings to reduce sharing of answers; submissions are checked for similarity. Any ' +
      'suspected breach is recorded and reviewed before a final mark is confirmed.'
    );
  }

  private defaultAccessibilityText(): string {
    return (
      'Reasonable adjustments are available without lowering the assessment standard. These ' +
      'include additional time (typically 25%), rest breaks, alternative formats (large print, ' +
      'screen-reader-compatible files), use of assistive technology, and a separate or quieter ' +
      'room where required. Learners should request adjustments in advance so arrangements can be ' +
      'confirmed before the assessment. The marking criteria and learning outcomes assessed remain ' +
      'the same for all learners.'
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const summativeExamService = new SummativeExamService();
