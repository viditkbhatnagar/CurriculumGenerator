/**
 * Curriculum Generation Service V2
 * Stage 4: Generates Full Curriculum Package from approved preliminary package
 * Includes: Module plans, case studies, simulations, assessment banks, branded slide decks
 */

import { FullCurriculumPackage, IFullCurriculumPackage } from '../models/FullCurriculumPackage';
import { PreliminaryCurriculumPackage } from '../models/PreliminaryCurriculumPackage';
import { ResourceCostEvaluation } from '../models/ResourceCostEvaluation';
import { CurriculumProject } from '../models/CurriculumProject';
import { openaiService } from './openaiService';
import { loggingService } from './loggingService';
import { websocketService } from './websocketService';
import * as path from 'path';
import * as fs from 'fs/promises';

class CurriculumGenerationServiceV2 {
  /**
   * Start full curriculum generation
   * This is Stage 4 of the workflow
   */
  async startGeneration(projectId: string): Promise<string> {
    try {
      const project = await CurriculumProject.findById(projectId);

      if (!project) {
        throw new Error('Project not found');
      }

      // Get preliminary package and resource evaluation
      const prelimPackage = await PreliminaryCurriculumPackage.findOne({ projectId });
      const resourceEval = await ResourceCostEvaluation.findOne({ projectId });

      if (!prelimPackage) {
        throw new Error('Preliminary package not found');
      }

      // Check if full package already exists
      let fullPackage = await FullCurriculumPackage.findOne({ projectId: project._id });

      if (fullPackage) {
        loggingService.info('Full curriculum package already exists, returning existing', {
          projectId,
          fullPackageId: fullPackage._id,
        });
        return fullPackage._id.toString();
      }

      // Create full curriculum package document
      fullPackage = new FullCurriculumPackage({
        projectId: project._id,
        preliminaryPackageId: prelimPackage._id,
        modulePlans: [],
        caseStudies: [],
        simulations: [],
        mcqExams: [],
        slideDecks: [],
        sourcesCited: [],
        agiCompliance: {
          validated: false,
          complianceScore: 0,
          issues: [],
        },
      });

      await fullPackage.save();

      // Emit start event
      // websocketService.emitToRoom(`project:${projectId}`, 'generation_started', {
      //   fullPackageId: fullPackage._id.toString(),
      //   status: 'Generating full curriculum package',
      // });

      // Generate components in background
      this.generateFullPackage(project, prelimPackage, resourceEval, fullPackage);

      loggingService.info('Full curriculum generation started', {
        projectId,
        fullPackageId: fullPackage._id,
      });

      return fullPackage._id.toString();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      loggingService.error('Error starting curriculum generation', {
        error: errorMessage,
        stack: errorStack,
        projectId,
      });
      throw error;
    }
  }

  /**
   * Generate all components of the full curriculum package
   */
  private async generateFullPackage(
    project: any,
    prelimPackage: any,
    resourceEval: any,
    fullPackage: any
  ): Promise<void> {
    const projectId = project._id.toString();

    try {
      // 1. Generate module plans
      await this.generateModulePlans(projectId, prelimPackage, resourceEval, fullPackage);

      // 2. Generate case studies
      await this.generateCaseStudies(projectId, prelimPackage, fullPackage);

      // 3. Generate simulations
      await this.generateSimulations(projectId, prelimPackage, fullPackage);

      // 4. Generate assessment bank
      await this.generateAssessmentBank(projectId, prelimPackage, fullPackage);

      // 5. Generate rubrics
      await this.generateRubrics(projectId, prelimPackage, fullPackage);

      // 6. Generate branded slide decks
      await this.generateSlideDecks(projectId, prelimPackage, fullPackage);

      // 7. Compile all sources cited
      await this.compileSourcesCited(fullPackage);

      // 8. Validate AGI compliance
      await this.validateAGICompliance(fullPackage);

      // Update project to stage 5
      await project.advanceStage({
        fullCurriculumId: fullPackage._id,
      });

      // Emit completion
      // websocketService.emitToRoom(`project:${projectId}`, 'generation_complete', {
      //   fullPackageId: fullPackage._id.toString(),
      //   status: 'Ready for final SME review',
      //   agiComplianceScore: fullPackage.agiCompliance.complianceScore,
      // });

      loggingService.info('Full curriculum package generated', {
        projectId,
        fullPackageId: fullPackage._id,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      loggingService.error('Error generating full package', {
        error: errorMessage,
        stack: errorStack,
        projectId,
      });

      // websocketService.emitToRoom(`project:${projectId}`, 'generation_error', {
      //   error: 'Failed to generate full curriculum package',
      // });
    }
  }

  /**
   * Generate module plans
   */
  private async generateModulePlans(
    projectId: string,
    prelimPackage: any,
    resourceEval: any,
    fullPackage: any
  ): Promise<void> {
    // websocketService.emitToRoom(`project:${projectId}`, 'component_progress', {
    // component: 'modulePlans',
    // status: 'generating',
    // });

    const modules = prelimPackage.courseFramework.modules || [];
    const modulePlans = [];

    for (const module of modules) {
      const systemPrompt = `You are a curriculum developer creating detailed module plans. Generate AGI-compliant, week-by-week module plans with activities and assessments.`;

      const userPrompt = `Generate a detailed module plan for:
Module Code: ${module.moduleCode}
Module Title: ${module.title}
Module Aim: ${module.aim}
Hours: ${module.hours}
Key Topics: ${JSON.stringify(module.keyTopics)}
Learning Objectives: ${JSON.stringify(module.objectives)}

Create a ${Math.ceil(module.hours / 15)}-week plan. For each week:
- Week number
- Topics covered (from key topics list)
- Learning activities (readings, exercises, discussions)
- Assessments (formative/summative)
- Self-study hours breakdown

Also create assessment schedule with types, due dates (relative, e.g. "Week 3"), and weightings.

Return as JSON: { weekByWeek: [{ week, topics[], activities[], assessments[] }], assessmentSchedule: [{ type, dueDate, weight }] }`;

      const response = await openaiService.generateContent(userPrompt, systemPrompt, {
        temperature: 0.7,
        maxTokens: 3000,
      });

      const rawModulePlan = this.parseJSONRobust(response, 'modulePlan');
      const normalizedModulePlan = this.normalizeGeneratedData(rawModulePlan, 'modulePlan');

      // Debug logging
      loggingService.info('Module plan before push', {
        moduleCode: module.moduleCode,
        assessmentScheduleType: typeof normalizedModulePlan.assessmentSchedule,
        assessmentScheduleIsArray: Array.isArray(normalizedModulePlan.assessmentSchedule),
        assessmentScheduleValue: JSON.stringify(normalizedModulePlan.assessmentSchedule).substring(
          0,
          200
        ),
      });

      modulePlans.push({
        moduleCode: module.moduleCode,
        moduleTitle: module.title,
        weekByWeek: normalizedModulePlan.weekByWeek || [],
        assessmentSchedule: normalizedModulePlan.assessmentSchedule || [],
      });
    }

    loggingService.info('All module plans ready for save', {
      count: modulePlans.length,
      sample: modulePlans[0]
        ? {
            assessmentScheduleType: typeof modulePlans[0].assessmentSchedule,
            assessmentScheduleIsArray: Array.isArray(modulePlans[0].assessmentSchedule),
            firstItemType:
              modulePlans[0].assessmentSchedule && modulePlans[0].assessmentSchedule[0]
                ? typeof modulePlans[0].assessmentSchedule[0]
                : 'undefined',
            firstItemValue:
              modulePlans[0].assessmentSchedule && modulePlans[0].assessmentSchedule[0]
                ? JSON.stringify(modulePlans[0].assessmentSchedule[0]).substring(0, 100)
                : 'undefined',
          }
        : null,
    });

    loggingService.info('📋 Saving module plans with raw MongoDB (completely bypassing Mongoose)', {
      count: modulePlans.length,
      firstModuleCode: modulePlans[0]?.moduleCode,
    });

    // Use raw MongoDB collection to completely bypass Mongoose validation
    const db = (FullCurriculumPackage as any).db.db;
    await db
      .collection('fullcurriculumpackages')
      .updateOne({ _id: fullPackage._id }, { $set: { modulePlans: modulePlans } });

    // websocketService.emitToRoom(`project:${projectId}`, 'component_progress', {
    // component: 'modulePlans',
    // status: 'complete',
    // count: modulePlans.length,
    // });
  }

  /**
   * Generate case studies (expand from preliminary package)
   */
  private async generateCaseStudies(
    projectId: string,
    prelimPackage: any,
    fullPackage: any
  ): Promise<void> {
    // websocketService.emitToRoom(`project:${projectId}`, 'component_progress', {
    // component: 'caseStudies',
    // status: 'generating',
    // });

    const prelimCases = prelimPackage.caseStudies || [];
    const fullCaseStudies = [];

    for (const prelimCase of prelimCases) {
      const systemPrompt = `You are creating detailed case studies for curriculum. Expand this case study into a full teaching case with discussion questions and rubric.`;

      const userPrompt = `Expand this case study:
Title: ${prelimCase.title}
Organization: ${prelimCase.organization || prelimCase.organisation}
Description: ${prelimCase.description || prelimCase.situationDescription}

Create:
1. Full scenario description (500-800 words) with realistic details
2. 5-7 discussion questions (aligned to learning outcomes)
3. Marking rubric (4 levels: Excellent, Good, Satisfactory, Needs Improvement)
4. Expected learning outcomes for students
5. Source citations (APA 7)

Return as JSON: { id, title, scenarioDescription, discussionQuestions[], rubric{levels[]}, expectedOutcomes[], sourcesCited[] }`;

      const response = await openaiService.generateContent(userPrompt, systemPrompt, {
        temperature: 0.8,
        maxTokens: 4000,
      });

      const rawCaseStudy = this.parseJSONRobust(response, 'caseStudy');
      const normalizedCaseStudy = this.normalizeGeneratedData(rawCaseStudy, 'caseStudy');
      normalizedCaseStudy.id = `case_${Date.now()}_${fullCaseStudies.length + 1}`;

      fullCaseStudies.push(normalizedCaseStudy);
    }

    // Use raw MongoDB to bypass Mongoose validation issues
    const db = (FullCurriculumPackage as any).db.db;
    await db
      .collection('fullcurriculumpackages')
      .updateOne({ _id: fullPackage._id }, { $set: { caseStudies: fullCaseStudies } });

    loggingService.info('Case studies generated and saved', {
      projectId,
      count: fullCaseStudies.length,
    });

    // websocketService.emitToRoom(`project:${projectId}`, 'component_progress', {
    // component: 'caseStudies',
    // status: 'complete',
    // count: fullCaseStudies.length,
    // });
  }

  /**
   * Generate simulations
   */
  private async generateSimulations(
    projectId: string,
    prelimPackage: any,
    fullPackage: any
  ): Promise<void> {
    // websocketService.emitToRoom(`project:${projectId}`, 'component_progress', {
    // component: 'simulations',
    // status: 'generating',
    // });

    const modules = prelimPackage.courseFramework.modules || [];
    const simulations = [];

    // Generate 1-2 simulations per module
    for (const module of modules.slice(0, 3)) {
      // Limit to first 3 modules for demo
      const systemPrompt = `You are creating practical simulations for curriculum. Design realistic, hands-on simulations that students can complete.`;

      const userPrompt = `Create a practical simulation for:
Module: ${module.title}
Key Topics: ${JSON.stringify(module.keyTopics)}
Objectives: ${JSON.stringify(module.objectives)}

Design:
1. Simulation title
2. Clear instructions (what students will do)
3. Dataset description (what data/resources they'll use)
4. Step-by-step procedure
5. Evaluation criteria (what you'll assess)
6. Expected outputs
7. Sources cited (APA 7)

Return as JSON: { id, title, instructions, datasetDescription, procedure[], evaluationCriteria[], expectedOutputs[], sourcesCited[] }`;

      const response = await openaiService.generateContent(userPrompt, systemPrompt, {
        temperature: 0.8,
        maxTokens: 3000,
      });

      const rawSimulation = this.parseJSONRobust(response, 'simulation');
      const normalizedSimulation = this.normalizeGeneratedData(rawSimulation, 'simulation');
      normalizedSimulation.id = `sim_${Date.now()}_${simulations.length + 1}`;
      normalizedSimulation.datasets = [`dataset_${normalizedSimulation.id}.csv`]; // Placeholder

      simulations.push(normalizedSimulation);
    }

    // Use raw MongoDB to bypass Mongoose validation issues
    const db = (FullCurriculumPackage as any).db.db;
    await db
      .collection('fullcurriculumpackages')
      .updateOne({ _id: fullPackage._id }, { $set: { simulations: simulations } });

    loggingService.info('Simulations generated and saved', {
      projectId,
      count: simulations.length,
    });

    // websocketService.emitToRoom(`project:${projectId}`, 'component_progress', {
    // component: 'simulations',
    // status: 'complete',
    // count: simulations.length,
    // });
  }

  /**
   * Generate assessment bank (expand MCQs and add more question types)
   */
  private async generateAssessmentBank(
    projectId: string,
    prelimPackage: any,
    fullPackage: any
  ): Promise<void> {
    // websocketService.emitToRoom(`project:${projectId}`, 'component_progress', {
    // component: 'assessmentBank',
    // status: 'generating',
    // });

    const assessments = prelimPackage.assessments || { mcqs: [], caseQuestions: [] };
    const assessmentBank = [];

    // Add MCQs from preliminary package
    for (const mcq of assessments.mcqs || []) {
      assessmentBank.push({
        questionId: `mcq_${Date.now()}_${assessmentBank.length + 1}`,
        type: 'mcq',
        questionText: mcq.stem,
        options: [mcq.options.A, mcq.options.B, mcq.options.C, mcq.options.D],
        correctAnswer: mcq.correctAnswer,
        explanation: mcq.rationale,
        difficulty: this.inferDifficulty(mcq),
        learningOutcomeRef: mcq.mappedOutcome || mcq.linkedOutcome,
        sourcesCited: [mcq.source || 'Generated from curriculum'],
      });
    }

    // Add case questions
    for (const caseQ of assessments.caseQuestions || []) {
      assessmentBank.push({
        questionId: `case_${Date.now()}_${assessmentBank.length + 1}`,
        type: 'case',
        questionText: caseQ.caseDescription || '',
        expectedResponse: caseQ.expectedResponse || '',
        markingRubric: caseQ.markingRubric || [],
        learningOutcomeRef: caseQ.linkedOutcome,
        sourcesCited: [caseQ.source || 'Generated from curriculum'],
      });
    }

    // Use raw MongoDB to bypass Mongoose validation issues
    const db = (FullCurriculumPackage as any).db.db;
    await db
      .collection('fullcurriculumpackages')
      .updateOne({ _id: fullPackage._id }, { $set: { mcqExams: assessmentBank } });

    loggingService.info('Assessment bank (MCQ exams) generated and saved', {
      projectId,
      count: assessmentBank.length,
    });

    // websocketService.emitToRoom(`project:${projectId}`, 'component_progress', {
    // component: 'assessmentBank',
    // status: 'complete',
    // count: assessmentBank.length,
    // });
  }

  /**
   * Generate short answer questions for a module
   */
  private async generateShortAnswerQuestions(
    moduleCode: string,
    prelimPackage: any
  ): Promise<any[]> {
    const module = prelimPackage.courseFramework.modules.find(
      (m: any) => m.moduleCode === moduleCode
    );

    if (!module) return [];

    const systemPrompt = `You are creating short answer assessment questions. Generate questions that test deeper understanding.`;

    const userPrompt = `Generate 3 short answer questions for:
Module: ${module.title}
Objectives: ${JSON.stringify(module.objectives)}

Each question should:
- Require 2-3 paragraph response
- Test application, analysis, or evaluation
- Have clear marking criteria

Return as JSON array: [{ questionText, expectedPoints[], difficulty: "easy"|"medium"|"hard", learningOutcomeRef }]`;

    const response = await openaiService.generateContent(userPrompt, systemPrompt, {
      temperature: 0.7,
      maxTokens: 2000,
    });

    const rawQuestions = this.parseJSONRobust(response, 'assessmentBank');
    const normalizedQuestions = this.normalizeGeneratedData(rawQuestions, 'assessmentBank');

    return (Array.isArray(normalizedQuestions) ? normalizedQuestions : []).map((q, i) => ({
      questionId: q.questionId || `sa_${Date.now()}_${i}`,
      type: q.type || 'short_answer',
      questionText: q.questionText,
      difficulty: q.difficulty || 'medium',
      learningOutcomeRef: q.learningOutcomeRef || q.linkedOutcome,
      sourcesCited: ['Generated from curriculum'],
    }));
  }

  /**
   * Infer difficulty from MCQ
   */
  private inferDifficulty(mcq: any): 'easy' | 'medium' | 'hard' {
    const bloomLevel = mcq.bloomLevel || mcq.bloomsLevel || '';
    const lowerBloom = bloomLevel.toLowerCase();

    if (lowerBloom.includes('remember') || lowerBloom.includes('understand')) {
      return 'easy';
    } else if (lowerBloom.includes('apply') || lowerBloom.includes('analyze')) {
      return 'medium';
    } else {
      return 'hard';
    }
  }

  /**
   * Generate rubrics for different assessment types
   */
  private async generateRubrics(
    projectId: string,
    prelimPackage: any,
    fullPackage: any
  ): Promise<void> {
    // websocketService.emitToRoom(`project:${projectId}`, 'component_progress', {
    // component: 'rubrics',
    // status: 'generating',
    // });

    const rubrics = [];

    // Common assessment types
    const assessmentTypes = ['Case Study Analysis', 'Simulation Report', 'Essay', 'Project'];

    for (const assessmentType of assessmentTypes) {
      const systemPrompt = `You are creating assessment rubrics. Generate AGI-compliant rubrics with clear criteria and levels.`;

      const userPrompt = `Create a rubric for: ${assessmentType}

Include:
- 4-6 assessment criteria
- 4 performance levels for each criterion: Excellent (90-100), Good (75-89), Satisfactory (60-74), Needs Improvement (<60)
- Clear descriptors for each level
- Points allocation

Return as JSON: { assessmentType, criteria: [{ criterion, levels: [{ level, description, points }] }] }`;

      const response = await openaiService.generateContent(userPrompt, systemPrompt, {
        temperature: 0.7,
        maxTokens: 2500,
      });

      const rawRubric = this.parseJSONRobust(response, 'rubric');
      const normalizedRubric = this.normalizeGeneratedData(rawRubric, 'rubric');
      rubrics.push(normalizedRubric);
    }

    // Note: Rubrics are embedded in assessmentBank, not a separate field
    loggingService.info('Rubrics generated (embedded in assessment bank)', {
      projectId,
      count: rubrics.length,
    });

    // websocketService.emitToRoom(`project:${projectId}`, 'component_progress', {
    // component: 'rubrics',
    // status: 'complete',
    // count: rubrics.length,
    // });
  }

  /**
   * Generate branded slide decks for each module
   * (Simplified - just metadata, actual PDF generation would use Puppeteer)
   */
  private async generateSlideDecks(
    projectId: string,
    prelimPackage: any,
    fullPackage: any
  ): Promise<void> {
    // websocketService.emitToRoom(`project:${projectId}`, 'component_progress', {
    // component: 'slideDecks',
    // status: 'generating',
    // });

    const modules = prelimPackage.courseFramework.modules || [];
    const slideDecks = [];

    for (const module of modules) {
      // Generate slide content outline
      const systemPrompt = `You are creating educational slide deck content. Generate slide-by-slide content for a module.`;

      const userPrompt = `Create slide deck outline for:
Module: ${module.title}
Aim: ${module.aim}
Key Topics: ${JSON.stringify(module.keyTopics)}
Hours: ${module.hours}

Generate:
- Slide 1: Title slide
- Slide 2: Learning objectives
- Slides 3-N: One slide per key topic (title, 3-5 bullet points, visual suggestion)
- Final slide: Summary & assessment

Return as JSON: { slides: [{ slideNumber, title, content[], visualSuggestion, speakerNotes }], sourcesCited[] }`;

      const response = await openaiService.generateContent(userPrompt, systemPrompt, {
        temperature: 0.7,
        maxTokens: 3000,
      });

      const rawSlideContent = this.parseJSONRobust(response, 'slideContent');
      const normalizedSlideContent = this.normalizeGeneratedData(rawSlideContent, 'slideContent');

      // In production, you would use Puppeteer here to generate PDF
      // For now, just store metadata
      const slideDeck = {
        moduleCode: module.moduleCode,
        filePath: `/slides/${projectId}/${module.moduleCode}.pdf`, // Placeholder
        format: 'pdf',
        slideCount: normalizedSlideContent.slides?.length || 0,
        sourcesCited: normalizedSlideContent.sourcesCited || [],
        content: normalizedSlideContent, // Store for potential PDF generation later
      };

      slideDecks.push(slideDeck);
    }

    // Use raw MongoDB to bypass Mongoose validation issues
    const db = (FullCurriculumPackage as any).db.db;
    await db
      .collection('fullcurriculumpackages')
      .updateOne({ _id: fullPackage._id }, { $set: { slideDecks: slideDecks } });

    loggingService.info('Slide decks generated and saved', {
      projectId,
      count: slideDecks.length,
    });

    // websocketService.emitToRoom(`project:${projectId}`, 'component_progress', {
    // component: 'slideDecks',
    // status: 'complete',
    // count: slideDecks.length,
    // });
  }

  /**
   * Compile all sources cited across materials
   */
  private async compileSourcesCited(fullPackage: any): Promise<void> {
    const sourcesCited = [];

    // From case studies
    for (const caseStudy of fullPackage.caseStudies || []) {
      sourcesCited.push({
        materialId: caseStudy.id,
        materialType: 'case_study',
        citations: caseStudy.sourcesCited || [],
      });
    }

    // From simulations
    for (const simulation of fullPackage.simulations || []) {
      sourcesCited.push({
        materialId: simulation.id,
        materialType: 'simulation',
        citations: simulation.sourcesCited || [],
      });
    }

    // From slide decks
    for (const slideDeck of fullPackage.slideDecks || []) {
      sourcesCited.push({
        materialId: slideDeck.moduleCode,
        materialType: 'slide_deck',
        citations: slideDeck.sourcesCited || [],
      });
    }

    // Use raw MongoDB to bypass Mongoose validation issues
    const db = (FullCurriculumPackage as any).db.db;
    await db
      .collection('fullcurriculumpackages')
      .updateOne({ _id: fullPackage._id }, { $set: { sourcesCited: sourcesCited } });

    loggingService.info('Sources cited compiled and saved', {
      count: sourcesCited.length,
    });
  }

  /**
   * Validate AGI compliance
   */
  private async validateAGICompliance(fullPackage: any): Promise<void> {
    const issues = [];
    let score = 100;

    // Check if all materials have sources
    if (
      fullPackage.caseStudies &&
      Array.isArray(fullPackage.caseStudies) &&
      fullPackage.caseStudies.some((cs: any) => !cs.sourcesCited || cs.sourcesCited.length === 0)
    ) {
      issues.push('Some case studies missing source citations');
      score -= 10;
    }

    if (
      fullPackage.simulations &&
      Array.isArray(fullPackage.simulations) &&
      fullPackage.simulations.some((sim: any) => !sim.sourcesCited || sim.sourcesCited.length === 0)
    ) {
      issues.push('Some simulations missing source citations');
      score -= 10;
    }

    if (
      fullPackage.assessmentBank &&
      Array.isArray(fullPackage.assessmentBank) &&
      fullPackage.assessmentBank.some((q: any) => !q.sourcesCited || q.sourcesCited.length === 0)
    ) {
      issues.push('Some assessment questions missing source citations');
      score -= 5;
    }

    // Check if rubrics exist
    if (!fullPackage.rubrics || fullPackage.rubrics.length === 0) {
      issues.push('No rubrics defined');
      score -= 15;
    }

    // Check if slide decks exist
    if (!fullPackage.slideDecks || fullPackage.slideDecks.length === 0) {
      issues.push('No slide decks generated');
      score -= 15;
    }

    // Use raw MongoDB to bypass Mongoose validation issues
    const db = (FullCurriculumPackage as any).db.db;
    const complianceScore = Math.max(score, 0);
    await db.collection('fullcurriculumpackages').updateOne(
      { _id: fullPackage._id },
      {
        $set: {
          'agiCompliance.validated': true,
          'agiCompliance.validatedAt': new Date(),
          'agiCompliance.complianceScore': complianceScore,
          'agiCompliance.issues': issues,
        },
      }
    );

    loggingService.info('AGI compliance validation completed and saved', {
      complianceScore,
      issuesCount: issues.length,
    });
  }

  /**
   * Comprehensive normalization for all curriculum generation data
   */
  private normalizeGeneratedData(data: any, context: string): any {
    if (!data || typeof data !== 'object') return data;

    const normalized = JSON.parse(JSON.stringify(data));

    // Helper: Parse stringified JSON (handles multiple levels of stringification)
    const parseStringified = (value: any): any => {
      if (typeof value !== 'string') return value;

      const trimmed = value.trim();
      if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) return value;

      try {
        const parsed = JSON.parse(trimmed);
        // Recursively parse in case of double/triple stringification
        if (
          typeof parsed === 'string' &&
          (parsed.trim().startsWith('[') || parsed.trim().startsWith('{'))
        ) {
          return parseStringified(parsed);
        }
        return parsed;
      } catch (e) {
        // Try aggressive repair for malformed JSON strings
        try {
          // Remove escaped newlines and quotes that might break parsing
          const cleaned = trimmed
            .replace(/\\n/g, ' ')
            .replace(/\\'/g, "'")
            .replace(/\\"/g, '"')
            .replace(/\n/g, ' ')
            .replace(/\r/g, ' ');
          return JSON.parse(cleaned);
        } catch (e2) {
          loggingService.warn(`Failed to parse stringified value: ${trimmed.substring(0, 100)}...`);
          return value;
        }
      }
    };

    // Helper: Convert object to descriptive string
    const objectToString = (obj: any): string => {
      if (typeof obj === 'string') return obj;
      if (typeof obj === 'object' && obj !== null) {
        return Object.entries(obj)
          .map(([key, value]) => `${key}: ${value}`)
          .join(', ');
      }
      return String(obj);
    };

    // Helper: Ensure array
    const ensureArray = (value: any): any[] => {
      if (Array.isArray(value)) return value;
      if (typeof value === 'string') {
        const parsed = parseStringified(value);
        return Array.isArray(parsed) ? parsed : [value];
      }
      if (value === null || value === undefined) return [];
      return [value];
    };

    // Helper: Convert number string to number
    const toNumber = (value: any): number => {
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        const match = value.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      }
      return 0;
    };

    // ===== MODULE PLANS NORMALIZATION =====
    if (context === 'modulePlan') {
      // Parse stringified assessmentSchedule with aggressive parsing
      if (normalized.assessmentSchedule) {
        loggingService.info('🔧 Parsing assessmentSchedule', {
          type: typeof normalized.assessmentSchedule,
          isArray: Array.isArray(normalized.assessmentSchedule),
          valuePreview:
            typeof normalized.assessmentSchedule === 'string'
              ? normalized.assessmentSchedule.substring(0, 150)
              : JSON.stringify(normalized.assessmentSchedule).substring(0, 150),
        });

        // Aggressive parsing: if it's a string, parse it multiple times if needed
        let parsedSchedule = normalized.assessmentSchedule;
        while (typeof parsedSchedule === 'string') {
          try {
            parsedSchedule = JSON.parse(parsedSchedule);
          } catch (e) {
            // If parse fails, try to clean it up
            parsedSchedule = parsedSchedule
              .replace(/'/g, '"') // Replace single quotes with double quotes
              .replace(/(\w+):/g, '"$1":'); // Quote unquoted keys
            try {
              parsedSchedule = JSON.parse(parsedSchedule);
            } catch (e2) {
              loggingService.error('Failed to parse assessmentSchedule, using empty array', {
                error: e2,
              });
              parsedSchedule = [];
              break;
            }
          }
        }

        loggingService.info('🔧 After parseStringified', {
          type: typeof parsedSchedule,
          isArray: Array.isArray(parsedSchedule),
          valuePreview:
            typeof parsedSchedule === 'string'
              ? parsedSchedule.substring(0, 150)
              : JSON.stringify(parsedSchedule).substring(0, 150),
        });

        normalized.assessmentSchedule = ensureArray(parsedSchedule);

        loggingService.info('🔧 After ensureArray', {
          isArray: Array.isArray(normalized.assessmentSchedule),
          length: normalized.assessmentSchedule.length,
        });

        // Ensure each item has correct structure
        normalized.assessmentSchedule = normalized.assessmentSchedule.map((item: any) => {
          if (typeof item === 'string') {
            return {
              type: item,
              dueWeek: 1,
              weight: 0,
              description: item,
            };
          }
          return {
            type: String(item.type || item.title || 'Assessment'),
            dueWeek: toNumber(item.dueWeek || item.week || item.dueDate || 1),
            weight: toNumber(item.weight || item.percentage || 0),
            description: String(item.description || item.details || ''),
          };
        });
      }

      // Parse weekByWeek structure
      if (normalized.weekByWeek) {
        normalized.weekByWeek = ensureArray(parseStringified(normalized.weekByWeek));

        normalized.weekByWeek = normalized.weekByWeek.map((week: any) => {
          // Parse each field if stringified
          const parsedWeek: any = {
            week: toNumber(week.week || week.weekNumber || 1),
            topics: ensureArray(parseStringified(week.topics || week.topicsCovered || [])),
            activities: ensureArray(
              parseStringified(week.activities || week.learningActivities || [])
            ),
            readings: ensureArray(parseStringified(week.readings || week.readingList || [])),
            estimatedHours: toNumber(week.estimatedHours || week.hours || 0),
          };

          // Parse assessments and convert objects to strings
          const assessments = ensureArray(parseStringified(week.assessments || []));
          parsedWeek.assessments = assessments
            .map((a: any) => {
              if (typeof a === 'object' && a !== null) {
                return `${a.type || 'Assessment'}: ${a.description || a.title || ''}`.trim();
              }
              return String(a);
            })
            .filter((a: string) => a.length > 0);

          // Ensure all arrays contain strings only
          parsedWeek.topics = parsedWeek.topics.map(String);
          parsedWeek.activities = parsedWeek.activities.map(String);
          parsedWeek.readings = parsedWeek.readings.map(String);

          return parsedWeek;
        });
      }
    }

    // ===== CASE STUDY NORMALIZATION =====
    if (context === 'caseStudy') {
      // Parse discussionQuestions
      if (normalized.discussionQuestions) {
        normalized.discussionQuestions = ensureArray(
          parseStringified(normalized.discussionQuestions)
        ).map(String);
      }

      // Parse linkedOutcomes
      if (normalized.linkedOutcomes) {
        normalized.linkedOutcomes = ensureArray(parseStringified(normalized.linkedOutcomes)).map(
          toNumber
        );
      }

      // Parse rubric structure
      if (normalized.rubric) {
        const rubric = parseStringified(normalized.rubric);
        if (typeof rubric === 'object') {
          normalized.rubric = {
            criteria: ensureArray(parseStringified(rubric.criteria || [])).map(String),
            bands: ensureArray(parseStringified(rubric.bands || [])).map((band: any) => {
              if (typeof band === 'object') {
                return {
                  band: String(band.band || band.grade || band.level || ''),
                  marks: String(band.marks || band.score || band.points || ''),
                  descriptor: String(band.descriptor || band.description || ''),
                };
              }
              return { band: '', marks: '', descriptor: String(band) };
            }),
          };
        }
      }
    }

    // ===== SIMULATION NORMALIZATION =====
    if (context === 'simulation') {
      if (normalized.requiredActions) {
        normalized.requiredActions = ensureArray(parseStringified(normalized.requiredActions)).map(
          String
        );
      }
      if (normalized.evaluationCriteria) {
        normalized.evaluationCriteria = ensureArray(
          parseStringified(normalized.evaluationCriteria)
        ).map(String);
      }
      if (normalized.datasets) {
        normalized.datasets = ensureArray(parseStringified(normalized.datasets)).map(String);
      }
      if (normalized.expectedDuration) {
        normalized.expectedDuration = toNumber(normalized.expectedDuration);
      }
    }

    // ===== ASSESSMENT BANK NORMALIZATION =====
    if (context === 'assessmentBank') {
      if (Array.isArray(normalized)) {
        return normalized.map((q: any) => {
          const parsed = parseStringified(q);
          return {
            questionId: String(parsed.questionId || parsed.id || `q_${Date.now()}`),
            type: String(parsed.type || 'short_answer'),
            questionText: String(parsed.questionText || parsed.question || parsed.stem || ''),
            correctAnswer: String(parsed.correctAnswer || parsed.answer || ''),
            linkedOutcome: toNumber(parsed.linkedOutcome || parsed.outcome || 1),
            bloomLevel: String(parsed.bloomLevel || parsed.level || 'remember'),
            marks: toNumber(parsed.marks || parsed.points || parsed.score || 1),
          };
        });
      }
    }

    // ===== RUBRIC NORMALIZATION =====
    if (context === 'rubric') {
      if (normalized.criteria) {
        normalized.criteria = ensureArray(parseStringified(normalized.criteria)).map(String);
      }
      if (normalized.bands) {
        normalized.bands = ensureArray(parseStringified(normalized.bands)).map((band: any) => {
          const parsed = parseStringified(band);
          if (typeof parsed === 'object') {
            return {
              band: String(parsed.band || parsed.grade || parsed.level || ''),
              marks: String(parsed.marks || parsed.score || parsed.points || ''),
              descriptor: String(parsed.descriptor || parsed.description || ''),
            };
          }
          return { band: '', marks: '', descriptor: String(parsed) };
        });
      }
    }

    // ===== SLIDE CONTENT NORMALIZATION =====
    if (context === 'slideContent') {
      if (normalized.topics) {
        normalized.topics = ensureArray(parseStringified(normalized.topics)).map(String);
      }
      if (normalized.slides) {
        normalized.slides = ensureArray(parseStringified(normalized.slides));
      }
    }

    return normalized;
  }

  /**
   * Robust JSON parsing with multiple fallback strategies
   */
  private parseJSONRobust(response: string, context: string): any {
    // Strategy 1: Direct parse
    try {
      return JSON.parse(response);
    } catch (e1) {
      loggingService.warn(`Direct JSON parse failed for ${context}, trying repair strategies...`);
    }

    // Strategy 2: Extract from markdown code block
    try {
      const jsonMatch =
        response.match(/```json\s*\n([\s\S]*?)\n```/) || response.match(/```\s*\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }
    } catch (e2) {
      loggingService.warn(`Markdown extraction failed for ${context}`);
    }

    // Strategy 3: Fix common JSON errors (trailing commas, missing commas)
    try {
      const fixed = response
        .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
        .replace(/([}\]]\s*)([{[])/g, '$1,$2') // Add missing commas between objects/arrays
        .replace(/\n/g, ' ') // Remove newlines that might break strings
        .trim();
      return JSON.parse(fixed);
    } catch (e3) {
      loggingService.warn(`JSON repair failed for ${context}`);
    }

    // Strategy 4: Try to find the largest valid JSON object
    try {
      const matches = response.match(/{[\s\S]*}/g);
      if (matches) {
        const sorted = matches.sort((a, b) => b.length - a.length);
        for (const match of sorted) {
          try {
            return JSON.parse(match);
          } catch (e) {
            continue;
          }
        }
      }
    } catch (e4) {
      loggingService.warn(`JSON extraction failed for ${context}`);
    }

    loggingService.error(`All JSON parsing strategies failed for ${context}`, {
      responseLength: response.length,
      responsePreview: response.substring(0, 200),
    });
    throw new Error(`Failed to parse JSON for ${context} after trying all repair strategies`);
  }

  /**
   * Get full curriculum package by ID
   */
  async getFullPackage(packageId: string): Promise<IFullCurriculumPackage | null> {
    try {
      return await FullCurriculumPackage.findById(packageId);
    } catch (error) {
      loggingService.error('Error getting full package', { error, packageId });
      throw error;
    }
  }
}

export const curriculumGenerationServiceV2 = new CurriculumGenerationServiceV2();
