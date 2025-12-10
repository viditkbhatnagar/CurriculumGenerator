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

export class AssessmentGeneratorService {
  private readonly MODULE_TIMEOUT = 240000; // 4 minutes per module formative (increased for full questions)
  private readonly SUMMATIVE_TIMEOUT = 240000; // 4 minutes for summative
  private readonly SAMPLE_BATCH_TIMEOUT = 180000; // 3 minutes per sample type
  private readonly INTER_CALL_DELAY = 1000; // 1 second delay between API calls
  private readonly MAX_TOKENS_FORMATIVE = 32000; // Increased for complete question generation (10-12 questions per assessment)
  private readonly MAX_TOKENS_SUMMATIVE = 20000;
  private readonly MAX_TOKENS_SAMPLES = 16000;

  /**
   * Generate complete assessment package with chunked strategy
   */
  async generateAssessments(
    workflow: ICurriculumWorkflow,
    userPreferences: AssessmentUserPreferences,
    progressCallback?: (progress: AssessmentGenerationProgress) => void
  ): Promise<AssessmentGenerationResponse> {
    loggingService.info('Starting Assessment Generation', {
      workflowId: workflow._id,
      structure: userPreferences.assessmentStructure,
    });

    const request: AssessmentGenerationRequest = {
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
    };

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
      } catch (error) {
        loggingService.error(`Failed to generate formatives for module ${module.id}`, {
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue with next module instead of failing completely
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

Use UK English spelling throughout.`;

    const userPrompt = `Generate ${formativePerModule} formative assessment(s) for this module.

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
- Formative Types Requested: ${formativeTypes.filter((t) => t !== 'None').join(', ')}
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
      "assessmentType": "Short quizzes",
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
      "questions": [
        {
          "questionNumber": 1,
          "questionText": "What is the primary purpose of [concept] in [context]?",
          "questionType": "mcq",
          "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
          "correctAnswer": 1,
          "points": 1,
          "bloomLevel": "Remember",
          "difficulty": "Easy",
          "rationale": "Explanation of why this is correct and why others are wrong"
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
9. Rationales should explain WHY the correct answer is right
10. Difficulty should progress from Easy → Medium → Hard within the assessment`;

    try {
      const response = await openaiService.generateContent(userPrompt, systemPrompt, {
        maxTokens: this.MAX_TOKENS_FORMATIVE,
        timeout: this.MODULE_TIMEOUT,
      });

      const parsed = this.parseJSON(response, `formative-${module.id}`);
      return parsed.formativeAssessments || [];
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

Use UK English spelling throughout.`;

    const modules = request.modules || [];
    const plos = request.courseFramework.programLearningOutcomes || [];

    const userPrompt = `Generate a comprehensive summative assessment for this programme.

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
      "correctOptionIndex": 1,
      "rationale": "Explanation of correct answer",
      "alignedPLOs": ["PLO1", "PLO2"]
    }
  ]
}`,
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
      const response = await openaiService.generateContent(prompts.user, prompts.system, {
        maxTokens: this.MAX_TOKENS_SAMPLES,
        timeout: this.SAMPLE_BATCH_TIMEOUT,
      });

      const parsed = this.parseJSON(response, `samples-${type}`);
      return parsed.samples || [];
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
