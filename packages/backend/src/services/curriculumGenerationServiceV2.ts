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

      // Create full curriculum package document
      const fullPackage = new FullCurriculumPackage({
        projectId: project._id,
        preliminaryPackageId: prelimPackage._id,
        modulePlans: [],
        caseStudies: [],
        simulations: [],
        assessmentBank: [],
        slideDecks: [],
        rubrics: [],
        sourcesCited: [],
        agiCompliance: {
          validated: false,
          complianceScore: 0,
          issues: [],
        },
      });

      await fullPackage.save();

      // Emit start event
      websocketService.emitToRoom(`project:${projectId}`, 'generation_started', {
        fullPackageId: fullPackage._id.toString(),
        status: 'Generating full curriculum package',
      });

      // Generate components in background
      this.generateFullPackage(project, prelimPackage, resourceEval, fullPackage);

      loggingService.info('Full curriculum generation started', {
        projectId,
        fullPackageId: fullPackage._id,
      });

      return fullPackage._id.toString();
    } catch (error) {
      loggingService.error('Error starting curriculum generation', { error, projectId });
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
      websocketService.emitToRoom(`project:${projectId}`, 'generation_complete', {
        fullPackageId: fullPackage._id.toString(),
        status: 'Ready for final SME review',
        agiComplianceScore: fullPackage.agiCompliance.complianceScore,
      });

      loggingService.info('Full curriculum package generated', {
        projectId,
        fullPackageId: fullPackage._id,
      });
    } catch (error) {
      loggingService.error('Error generating full package', { error, projectId });

      websocketService.emitToRoom(`project:${projectId}`, 'generation_error', {
        error: 'Failed to generate full curriculum package',
      });
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
    websocketService.emitToRoom(`project:${projectId}`, 'component_progress', {
      component: 'modulePlans',
      status: 'generating',
    });

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

      const response = await openaiService.generateContent({
        systemPrompt,
        userPrompt,
        temperature: 0.7,
        maxTokens: 3000,
      });

      const modulePlan = JSON.parse(response);

      modulePlans.push({
        moduleCode: module.moduleCode,
        moduleTitle: module.title,
        ...modulePlan,
      });
    }

    fullPackage.modulePlans = modulePlans;
    await fullPackage.save();

    websocketService.emitToRoom(`project:${projectId}`, 'component_progress', {
      component: 'modulePlans',
      status: 'complete',
      count: modulePlans.length,
    });
  }

  /**
   * Generate case studies (expand from preliminary package)
   */
  private async generateCaseStudies(
    projectId: string,
    prelimPackage: any,
    fullPackage: any
  ): Promise<void> {
    websocketService.emitToRoom(`project:${projectId}`, 'component_progress', {
      component: 'caseStudies',
      status: 'generating',
    });

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

      const response = await openaiService.generateContent({
        systemPrompt,
        userPrompt,
        temperature: 0.8,
        maxTokens: 4000,
      });

      const caseStudy = JSON.parse(response);
      caseStudy.id = `case_${Date.now()}_${fullCaseStudies.length + 1}`;

      fullCaseStudies.push(caseStudy);
    }

    fullPackage.caseStudies = fullCaseStudies;
    await fullPackage.save();

    websocketService.emitToRoom(`project:${projectId}`, 'component_progress', {
      component: 'caseStudies',
      status: 'complete',
      count: fullCaseStudies.length,
    });
  }

  /**
   * Generate simulations
   */
  private async generateSimulations(
    projectId: string,
    prelimPackage: any,
    fullPackage: any
  ): Promise<void> {
    websocketService.emitToRoom(`project:${projectId}`, 'component_progress', {
      component: 'simulations',
      status: 'generating',
    });

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

      const response = await openaiService.generateContent({
        systemPrompt,
        userPrompt,
        temperature: 0.8,
        maxTokens: 3000,
      });

      const simulation = JSON.parse(response);
      simulation.id = `sim_${Date.now()}_${simulations.length + 1}`;
      simulation.datasets = [`dataset_${simulation.id}.csv`]; // Placeholder

      simulations.push(simulation);
    }

    fullPackage.simulations = simulations;
    await fullPackage.save();

    websocketService.emitToRoom(`project:${projectId}`, 'component_progress', {
      component: 'simulations',
      status: 'complete',
      count: simulations.length,
    });
  }

  /**
   * Generate assessment bank (expand MCQs and add more question types)
   */
  private async generateAssessmentBank(
    projectId: string,
    prelimPackage: any,
    fullPackage: any
  ): Promise<void> {
    websocketService.emitToRoom(`project:${projectId}`, 'component_progress', {
      component: 'assessmentBank',
      status: 'generating',
    });

    const assessments = prelimPackage.assessments || [];
    const assessmentBank = [];

    for (const moduleAssessment of assessments) {
      // Add MCQs
      for (const mcq of moduleAssessment.mcqs || []) {
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

      // Generate additional short answer questions
      const shortAnswerQuestions = await this.generateShortAnswerQuestions(
        moduleAssessment.moduleCode,
        prelimPackage
      );
      assessmentBank.push(...shortAnswerQuestions);
    }

    fullPackage.assessmentBank = assessmentBank;
    await fullPackage.save();

    websocketService.emitToRoom(`project:${projectId}`, 'component_progress', {
      component: 'assessmentBank',
      status: 'complete',
      count: assessmentBank.length,
    });
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

    const response = await openaiService.generateContent({
      systemPrompt,
      userPrompt,
      temperature: 0.7,
      maxTokens: 2000,
    });

    const questions = JSON.parse(response);

    return (questions as any[]).map((q, i) => ({
      questionId: `sa_${Date.now()}_${i}`,
      type: 'short_answer',
      questionText: q.questionText,
      difficulty: q.difficulty,
      learningOutcomeRef: q.learningOutcomeRef,
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
    websocketService.emitToRoom(`project:${projectId}`, 'component_progress', {
      component: 'rubrics',
      status: 'generating',
    });

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

      const response = await openaiService.generateContent({
        systemPrompt,
        userPrompt,
        temperature: 0.7,
        maxTokens: 2500,
      });

      const rubric = JSON.parse(response);
      rubrics.push(rubric);
    }

    fullPackage.rubrics = rubrics;
    await fullPackage.save();

    websocketService.emitToRoom(`project:${projectId}`, 'component_progress', {
      component: 'rubrics',
      status: 'complete',
      count: rubrics.length,
    });
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
    websocketService.emitToRoom(`project:${projectId}`, 'component_progress', {
      component: 'slideDecks',
      status: 'generating',
    });

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

      const response = await openaiService.generateContent({
        systemPrompt,
        userPrompt,
        temperature: 0.7,
        maxTokens: 3000,
      });

      const slideContent = JSON.parse(response);

      // In production, you would use Puppeteer here to generate PDF
      // For now, just store metadata
      const slideDeck = {
        moduleCode: module.moduleCode,
        filePath: `/slides/${projectId}/${module.moduleCode}.pdf`, // Placeholder
        format: 'pdf',
        slideCount: slideContent.slides.length,
        sourcesCited: slideContent.sourcesCited || [],
        content: slideContent, // Store for potential PDF generation later
      };

      slideDecks.push(slideDeck);
    }

    fullPackage.slideDecks = slideDecks;
    await fullPackage.save();

    websocketService.emitToRoom(`project:${projectId}`, 'component_progress', {
      component: 'slideDecks',
      status: 'complete',
      count: slideDecks.length,
    });
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

    fullPackage.sourcesCited = sourcesCited;
    await fullPackage.save();
  }

  /**
   * Validate AGI compliance
   */
  private async validateAGICompliance(fullPackage: any): Promise<void> {
    const issues = [];
    let score = 100;

    // Check if all materials have sources
    if (
      fullPackage.caseStudies.some((cs: any) => !cs.sourcesCited || cs.sourcesCited.length === 0)
    ) {
      issues.push('Some case studies missing source citations');
      score -= 10;
    }

    if (
      fullPackage.simulations.some((sim: any) => !sim.sourcesCited || sim.sourcesCited.length === 0)
    ) {
      issues.push('Some simulations missing source citations');
      score -= 10;
    }

    if (
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

    fullPackage.agiCompliance = {
      validated: true,
      validatedAt: new Date(),
      complianceScore: Math.max(score, 0),
      issues,
    };

    await fullPackage.save();
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
