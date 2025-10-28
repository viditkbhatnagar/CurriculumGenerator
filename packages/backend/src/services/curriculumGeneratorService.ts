/**
 * Curriculum Generator Service
 * Orchestrates the complete curriculum generation pipeline
 * Implements Requirements 5.1, 5.2, 5.3, 5.4
 */

import mongoose from 'mongoose';
import { Job } from 'bull';
import { ContentGenerationService } from './contentGenerationService';
import { skillBookGenerator } from './skillBookGenerator';
import { websocketService } from './websocketService';
import { jobQueueService } from './jobQueueService';
import { loggingService } from './loggingService';
import { monitoringService } from './monitoringService';
import { errorTrackingService } from './errorTrackingService';
import {
  GenerationJobData,
  Curriculum,
  ProgramSpecification,
  UnitSpecification,
  AssessmentPackage,
  GenerationStage,
  IntermediateResult,
} from '../types/curriculum';
import { ParsedProgramData } from '../types/excel';
import { SkillMapping } from '../types/skillBook';

class CurriculumGeneratorService {
  private contentGenerationService: ContentGenerationService;

  constructor() {
    this.contentGenerationService = new ContentGenerationService();
  }

  /**
   * Generate complete curriculum for a program
   * Orchestrates: validate → retrieve → generate → qa → benchmark
   * Requirement 5.4: Complete generation in under 5 minutes for 120-hour programs
   */
  async generateCurriculum(
    programId: string,
    parsedData: ParsedProgramData,
    job: Job<GenerationJobData>
  ): Promise<Curriculum> {
    const startTime = Date.now();
    const jobId = job.id?.toString() || 'unknown';
    
    loggingService.logCurriculumGeneration('started', programId, jobId);

    try {
      // Stage 1: Validate (5%)
      await this.updateProgress(job, 5, 'validate', 'Validating program data...');
      await this.validateProgramData(programId, parsedData);
      await this.storeIntermediateResult(job.id as string, 'validate', { validated: true });

      // Stage 2: Retrieve context (15%)
      await this.updateProgress(job, 15, 'retrieve', 'Retrieving knowledge base context...');
      const retrievedContext = await this.retrieveContext(parsedData);
      await this.storeIntermediateResult(job.id as string, 'retrieve', retrievedContext);

      // Stage 3: Generate Program Specification (30%)
      await this.updateProgress(job, 30, 'generate_program_spec', 'Generating program specification...');
      const programSpec = await this.generateProgramSpecification(programId, parsedData, retrievedContext);
      await this.storeIntermediateResult(job.id as string, 'generate_program_spec', programSpec);

      // Stage 4: Generate Unit Specifications (50%)
      await this.updateProgress(job, 50, 'generate_unit_specs', 'Generating unit specifications...');
      const unitSpecs = await this.generateUnitSpecifications(programId, parsedData, retrievedContext);
      await this.storeIntermediateResult(job.id as string, 'generate_unit_specs', unitSpecs);

      // Stage 5: Generate Assessment Package (65%)
      await this.updateProgress(job, 65, 'generate_assessments', 'Generating assessment package...');
      const assessmentPackage = await this.generateAssessmentPackage(programId, parsedData, retrievedContext);
      await this.storeIntermediateResult(job.id as string, 'generate_assessments', assessmentPackage);

      // Stage 6: Generate Skill Book (75%)
      await this.updateProgress(job, 75, 'generate_assessments', 'Generating skill mappings...');
      const skillBook = await this.generateSkillBook(programId, parsedData);
      await this.storeIntermediateResult(job.id as string, 'generate_assessments', skillBook);

      // Stage 7: Quality Assurance (85%)
      await this.updateProgress(job, 85, 'qa', 'Running quality assurance checks...');
      await this.runQualityAssurance(programId, { programSpec, unitSpecs, assessmentPackage, skillBook });

      // Stage 8: Benchmarking (95%)
      await this.updateProgress(job, 95, 'benchmark', 'Benchmarking against competitors...');
      await this.runBenchmarking(programId, { programSpec, unitSpecs });

      // Complete (100%)
      await this.updateProgress(job, 100, 'benchmark', 'Curriculum generation complete!');

      const curriculum: Curriculum = {
        programId,
        programSpec,
        unitSpecs,
        assessmentPackage,
        skillBook,
        generatedAt: new Date(),
      };

      // Store final curriculum
      await this.storeCurriculum(curriculum);

      const duration = Date.now() - startTime;
      
      // Log completion and record metrics
      loggingService.logCurriculumGeneration('completed', programId, jobId, {
        duration,
        durationSeconds: (duration / 1000).toFixed(2),
      });
      
      monitoringService.recordCurriculumGeneration(true, duration, programId);

      return curriculum;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Log failure and record metrics
      loggingService.logCurriculumGeneration('failed', programId, jobId, {
        duration,
        error: (error as Error).message,
      });
      
      monitoringService.recordCurriculumGeneration(false, duration, programId);
      
      errorTrackingService.captureCurriculumGenerationError(
        error as Error,
        programId,
        jobId,
        'generation'
      );
      
      throw error;
    }
  }

  /**
   * Update job progress and send WebSocket notification
   */
  private async updateProgress(
    job: Job,
    progress: number,
    stage: GenerationStage,
    message: string
  ): Promise<void> {
    await jobQueueService.updateJobProgress(job, progress, stage, message);
    
    websocketService.sendProgressUpdate({
      jobId: job.id as string,
      progress,
      stage,
      message,
      timestamp: new Date(),
    });
  }

  /**
   * Store intermediate results for resume capability
   * Requirement 5.4: Store intermediate results for resume capability
   */
  private async storeIntermediateResult(
    jobId: string,
    stage: GenerationStage,
    data: any
  ): Promise<void> {
    // Store in MongoDB using GenerationJob model
    const GenerationJob = mongoose.model('GenerationJob');
    await GenerationJob.findOneAndUpdate(
      { _id: jobId },
      { 
        $set: { 
          [`intermediateResults.${stage}`]: data,
          updatedAt: new Date()
        }
      },
      { upsert: true, new: true }
    );
  }

  /**
   * Validate program data
   */
  private async validateProgramData(
    programId: string,
    parsedData: ParsedProgramData
  ): Promise<void> {
    // Validate required fields
    if (!parsedData.programOverview) {
      throw new Error('Program overview is required');
    }

    if (!parsedData.modules || parsedData.modules.length === 0) {
      throw new Error('At least one module is required');
    }

    if (!parsedData.learningOutcomes || parsedData.learningOutcomes.length === 0) {
      throw new Error('Learning outcomes are required');
    }

    // Validate total hours
    const totalHours = parsedData.modules.reduce((sum, module) => sum + module.hours, 0);
    if (totalHours !== 120) {
      console.warn(`Total hours (${totalHours}) does not equal 120`);
    }

    console.log('Program data validation passed');
  }

  /**
   * Retrieve context from knowledge base
   */
  private async retrieveContext(parsedData: ParsedProgramData): Promise<any> {
    // Build search queries from program data
    const queries = [
      parsedData.programOverview.programName,
      parsedData.programOverview.industrySector,
      ...parsedData.modules.map(m => m.moduleTitle),
    ];

    const contexts: any[] = [];

    // Retrieve context for each query
    for (const query of queries) {
      try {
        const context = await this.contentGenerationService.generateContent({
          templateName: 'context_retrieval',
          templateParams: { query },
          retrievalQuery: query,
          retrievalOptions: {
            maxSources: 5,
            minSimilarity: 0.75,
          },
          useCache: true,
        });

        contexts.push({
          query,
          sources: context.sources,
          usedSources: context.usedSources,
        });
      } catch (error) {
        console.warn(`Failed to retrieve context for query "${query}":`, error);
      }
    }

    return { contexts, totalSources: contexts.reduce((sum, c) => sum + c.sources.length, 0) };
  }

  /**
   * Generate program specification document
   * Requirement 5.1: Generate Program Specification with all required sections
   */
  private async generateProgramSpecification(
    programId: string,
    parsedData: ParsedProgramData,
    retrievedContext: any
  ): Promise<ProgramSpecification> {
    console.log('Generating program specification...');

    // Generate each section of the program specification
    const [
      introduction,
      courseOverview,
      needsAnalysis,
      knowledgeSkillsCompetenciesMatrix,
      comparativeAnalysis,
      targetAudience,
      entryRequirements,
      careerOutcomes,
    ] = await Promise.all([
      this.generateSection('introduction', parsedData),
      this.generateSection('course_overview', parsedData),
      this.generateSection('needs_analysis', parsedData),
      this.generateSection('ksc_matrix', parsedData),
      this.generateSection('comparative_analysis', parsedData),
      this.generateSection('target_audience', parsedData),
      this.generateSection('entry_requirements', parsedData),
      this.generateSection('career_outcomes', parsedData),
    ]);

    return {
      programId,
      introduction,
      courseOverview,
      needsAnalysis,
      knowledgeSkillsCompetenciesMatrix,
      comparativeAnalysis,
      targetAudience,
      entryRequirements,
      careerOutcomes,
      generatedAt: new Date(),
    };
  }

  /**
   * Generate a section of the program specification
   */
  private async generateSection(
    sectionName: string,
    parsedData: ParsedProgramData
  ): Promise<string> {
    try {
      const result = await this.contentGenerationService.generateContent({
        templateName: `program_spec_${sectionName}`,
        templateParams: {
          programName: parsedData.programOverview.programName,
          qualificationLevel: parsedData.programOverview.qualificationLevel,
          industrySector: parsedData.programOverview.industrySector,
          modules: parsedData.modules,
          learningOutcomes: parsedData.learningOutcomes,
        },
        retrievalQuery: `${parsedData.programOverview.programName} ${sectionName}`,
        retrievalOptions: {
          maxSources: 5,
          minSimilarity: 0.7,
        },
        useCache: true,
      });

      return result.content;
    } catch (error) {
      console.error(`Failed to generate ${sectionName}:`, error);
      return `[Section ${sectionName} generation failed]`;
    }
  }

  /**
   * Generate unit specifications for each module
   * Requirement 5.2: Generate Unit Specification documents for each module
   * Can be parallelized for better performance
   */
  private async generateUnitSpecifications(
    programId: string,
    parsedData: ParsedProgramData,
    retrievedContext: any
  ): Promise<UnitSpecification[]> {
    console.log(`Generating unit specifications for ${parsedData.modules.length} modules...`);

    // Generate unit specs in parallel
    const unitSpecPromises = parsedData.modules.map(async (module) => {
      return this.generateUnitSpecification(programId, module, parsedData);
    });

    const unitSpecs = await Promise.all(unitSpecPromises);
    
    console.log(`Generated ${unitSpecs.length} unit specifications`);
    return unitSpecs;
  }

  /**
   * Generate a single unit specification
   */
  private async generateUnitSpecification(
    programId: string,
    module: any,
    parsedData: ParsedProgramData
  ): Promise<UnitSpecification> {
    // Get learning outcomes for this module
    const moduleLearningOutcomes = parsedData.learningOutcomes.filter(
      lo => lo.moduleCode === module.moduleCode
    );

    // Generate unit overview
    const unitOverviewResult = await this.contentGenerationService.generateContent({
      templateName: 'unit_overview',
      templateParams: {
        moduleCode: module.moduleCode,
        moduleTitle: module.moduleTitle,
        hours: module.hours,
        moduleAim: module.moduleAim,
      },
      retrievalQuery: `${module.moduleTitle} overview`,
      retrievalOptions: { maxSources: 3 },
      useCache: true,
    });

    // Generate indicative content
    const indicativeContentResult = await this.contentGenerationService.generateContent({
      templateName: 'indicative_content',
      templateParams: {
        moduleTitle: module.moduleTitle,
        learningOutcomes: moduleLearningOutcomes,
      },
      retrievalQuery: `${module.moduleTitle} content topics`,
      retrievalOptions: { maxSources: 5 },
      useCache: true,
    });

    return {
      unitId: module.id || `unit-${module.moduleCode}`,
      moduleCode: module.moduleCode,
      unitTitle: module.moduleTitle,
      unitOverview: unitOverviewResult.content,
      learningOutcomes: moduleLearningOutcomes.map(lo => ({
        outcomeText: lo.outcomeText,
        assessmentCriteria: lo.assessmentCriteria || [],
      })),
      indicativeContent: indicativeContentResult.content,
      teachingStrategies: this.generateTeachingStrategies(module),
      assessmentMethods: this.generateAssessmentMethods(module),
      readingList: this.generateReadingList(module, indicativeContentResult.sources),
      generatedAt: new Date(),
    };
  }

  /**
   * Generate teaching strategies for a module
   */
  private generateTeachingStrategies(module: any): string[] {
    return [
      'Interactive lectures with multimedia presentations',
      'Hands-on practical exercises and workshops',
      'Case study analysis and group discussions',
      'Self-directed learning with guided resources',
      'Peer collaboration and knowledge sharing',
    ];
  }

  /**
   * Generate assessment methods for a module
   */
  private generateAssessmentMethods(module: any): string[] {
    return [
      'Formative assessments throughout the module',
      'Practical projects demonstrating applied skills',
      'Written assignments and case study analysis',
      'Presentations and oral examinations',
      'Portfolio of work showcasing competencies',
    ];
  }

  /**
   * Generate reading list from sources
   */
  private generateReadingList(module: any, sources: any[]): Array<{
    title: string;
    citation: string;
    type: 'Required' | 'Recommended';
  }> {
    if (!sources || sources.length === 0) {
      return [];
    }

    return sources.slice(0, 10).map((source, index) => ({
      title: source.title || 'Untitled',
      citation: source.citation || '',
      type: index < 3 ? 'Required' : 'Recommended',
    }));
  }

  /**
   * Generate assessment package
   * Requirement 5.3: Create Assessment Package with MCQs, case studies, rubrics, and mappings
   */
  private async generateAssessmentPackage(
    programId: string,
    parsedData: ParsedProgramData,
    retrievedContext: any
  ): Promise<AssessmentPackage> {
    console.log('Generating assessment package...');

    // Generate MCQs for each module (5-10 per module)
    const mcqPromises = parsedData.modules.map(module =>
      this.generateMCQs(module, parsedData.learningOutcomes)
    );
    const mcqArrays = await Promise.all(mcqPromises);
    const mcqs = mcqArrays.flat();

    // Generate case studies
    const caseStudies = await this.generateCaseStudies(parsedData);

    // Generate rubrics
    const rubrics = this.generateRubrics();

    // Generate marking schemes
    const markingSchemes = this.generateMarkingSchemes(parsedData.modules);

    // Generate learning outcome mappings
    const learningOutcomeMappings = this.generateLearningOutcomeMappings(mcqs, caseStudies);

    return {
      programId,
      mcqs,
      caseStudies,
      rubrics,
      markingSchemes,
      learningOutcomeMappings,
      generatedAt: new Date(),
    };
  }

  /**
   * Generate MCQs for a module
   */
  private async generateMCQs(module: any, learningOutcomes: any[]): Promise<any[]> {
    const moduleLearningOutcomes = learningOutcomes.filter(
      lo => lo.moduleCode === module.moduleCode
    );

    if (moduleLearningOutcomes.length === 0) {
      return [];
    }

    try {
      const result = await this.contentGenerationService.generateStructuredContent<{
        questions: Array<{
          question: string;
          options: string[];
          correctAnswer: string;
          explanation: string;
          difficulty: 'Easy' | 'Medium' | 'Hard';
        }>;
      }>({
        templateName: 'mcq_generation',
        templateParams: {
          moduleTitle: module.moduleTitle,
          learningOutcomes: moduleLearningOutcomes,
          count: Math.min(8, moduleLearningOutcomes.length * 2),
        },
        retrievalQuery: `${module.moduleTitle} assessment questions`,
        retrievalOptions: { maxSources: 3 },
        useCache: true,
      });

      return result.data.questions.map(q => ({
        moduleCode: module.moduleCode,
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        difficulty: q.difficulty,
        learningOutcome: moduleLearningOutcomes[0]?.outcomeText || '',
      }));
    } catch (error) {
      console.error(`Failed to generate MCQs for module ${module.moduleCode}:`, error);
      return [];
    }
  }

  /**
   * Generate case studies
   */
  private async generateCaseStudies(parsedData: ParsedProgramData): Promise<any[]> {
    const caseStudies: any[] = [];

    // Generate 2-3 case studies for the program
    for (let i = 0; i < Math.min(3, parsedData.modules.length); i++) {
      const module = parsedData.modules[i];

      try {
        const result = await this.contentGenerationService.generateStructuredContent<{
          title: string;
          scenario: string;
          questions: string[];
          rubric: string;
        }>({
          templateName: 'case_study_generation',
          templateParams: {
            moduleTitle: module.moduleTitle,
            programName: parsedData.programOverview.programName,
          },
          retrievalQuery: `${module.moduleTitle} case study scenario`,
          retrievalOptions: { maxSources: 3 },
          useCache: true,
        });

        caseStudies.push({
          moduleCode: module.moduleCode,
          title: result.data.title,
          scenario: result.data.scenario,
          questions: result.data.questions,
          rubric: result.data.rubric,
          difficulty: 'Medium',
        });
      } catch (error) {
        console.error(`Failed to generate case study for module ${module.moduleCode}:`, error);
      }
    }

    return caseStudies;
  }

  /**
   * Generate assessment rubrics
   */
  private generateRubrics(): any[] {
    return [
      {
        assessmentType: 'Practical Project',
        criteria: [
          {
            criterion: 'Technical Implementation',
            excellent: 'Demonstrates exceptional technical skills with innovative solutions',
            good: 'Shows strong technical competence with effective implementation',
            satisfactory: 'Meets technical requirements with adequate implementation',
            needsImprovement: 'Technical implementation has significant gaps',
          },
          {
            criterion: 'Problem Solving',
            excellent: 'Exceptional analysis and creative problem-solving approach',
            good: 'Strong analytical skills with effective solutions',
            satisfactory: 'Adequate problem-solving with basic solutions',
            needsImprovement: 'Limited problem-solving ability demonstrated',
          },
          {
            criterion: 'Documentation',
            excellent: 'Comprehensive, clear, and professional documentation',
            good: 'Well-organized documentation with good clarity',
            satisfactory: 'Basic documentation covering essential elements',
            needsImprovement: 'Documentation is incomplete or unclear',
          },
        ],
      },
      {
        assessmentType: 'Case Study Analysis',
        criteria: [
          {
            criterion: 'Analysis Depth',
            excellent: 'Thorough analysis with insightful observations',
            good: 'Good analysis with relevant observations',
            satisfactory: 'Basic analysis covering main points',
            needsImprovement: 'Superficial analysis lacking depth',
          },
          {
            criterion: 'Application of Theory',
            excellent: 'Excellent integration of theoretical concepts',
            good: 'Good application of relevant theories',
            satisfactory: 'Basic application of key concepts',
            needsImprovement: 'Limited or incorrect application of theory',
          },
        ],
      },
    ];
  }

  /**
   * Generate marking schemes
   */
  private generateMarkingSchemes(modules: any[]): any[] {
    return modules.map(module => ({
      assessmentType: `${module.moduleCode} Assessment`,
      totalMarks: 100,
      breakdown: [
        {
          section: 'Knowledge Assessment (MCQs)',
          marks: 30,
          description: 'Multiple choice questions testing theoretical understanding',
        },
        {
          section: 'Practical Application',
          marks: 40,
          description: 'Hands-on project demonstrating applied skills',
        },
        {
          section: 'Case Study Analysis',
          marks: 20,
          description: 'Analysis and problem-solving in realistic scenarios',
        },
        {
          section: 'Professional Practice',
          marks: 10,
          description: 'Documentation, presentation, and professional standards',
        },
      ],
    }));
  }

  /**
   * Generate learning outcome mappings
   */
  private generateLearningOutcomeMappings(mcqs: any[], caseStudies: any[]): any[] {
    const mappings: any[] = [];

    // Map MCQs to learning outcomes
    mcqs.forEach((mcq, index) => {
      mappings.push({
        assessmentId: `mcq-${index}`,
        learningOutcomes: [mcq.learningOutcome],
      });
    });

    // Map case studies to learning outcomes
    caseStudies.forEach((cs, index) => {
      mappings.push({
        assessmentId: `case-study-${index}`,
        learningOutcomes: [`${cs.moduleCode} learning outcomes`],
      });
    });

    return mappings;
  }

  /**
   * Generate skill book
   */
  private async generateSkillBook(
    programId: string,
    parsedData: ParsedProgramData
  ): Promise<SkillMapping[]> {
    console.log('Generating skill book...');

    if (!parsedData.competencyDomains || parsedData.competencyDomains.length === 0) {
      console.warn('No competency domains found, skipping skill book generation');
      return [];
    }

    // Generate skill mappings
    const result = await skillBookGenerator.generateSkillMappings({
      programId,
      competencyDomains: parsedData.competencyDomains,
      modules: parsedData.modules,
    });

    // Link to learning outcomes
    const learningOutcomesWithIds = parsedData.learningOutcomes.map((lo, index) => ({
      id: lo.id || `lo-${index}`,
      outcomeText: lo.outcomeText,
      moduleId: lo.moduleCode,
    }));

    const skillMappingsWithLinks = await skillBookGenerator.linkToLearningOutcomes(
      result.skillMappings,
      learningOutcomesWithIds
    );

    // Store in database
    await skillBookGenerator.storeSkillMappings(programId, skillMappingsWithLinks);

    return skillMappingsWithLinks;
  }

  /**
   * Run quality assurance checks
   * Requirement 6.5: Generate QA report with compliance issues and recommendations
   */
  private async runQualityAssurance(
    programId: string,
    curriculum: Partial<Curriculum>
  ): Promise<void> {
    console.log('Running quality assurance checks...');
    
    // Import QA service dynamically to avoid circular dependencies
    const { qualityAssuranceService } = await import('./qualityAssuranceService');
    
    // Build complete curriculum object for validation
    const completeCurriculum: Curriculum = {
      programId,
      programSpec: curriculum.programSpec!,
      unitSpecs: curriculum.unitSpecs!,
      assessmentPackage: curriculum.assessmentPackage!,
      skillBook: curriculum.skillBook!,
      generatedAt: new Date(),
    };
    
    // Run validation and generate report
    const qaReport = await qualityAssuranceService.validateCurriculum(completeCurriculum);
    
    console.log(`QA checks completed: Score ${qaReport.overallScore}/100, ${qaReport.complianceIssues.length} issues found`);
  }

  /**
   * Run benchmarking against competitors
   * Requirement 7.1, 7.2, 7.3, 7.4, 7.5
   */
  private async runBenchmarking(
    programId: string,
    curriculum: { programSpec: ProgramSpecification; unitSpecs: UnitSpecification[] }
  ): Promise<void> {
    console.log('Running benchmarking analysis...');
    
    const { benchmarkingService } = await import('./benchmarkingService');
    
    try {
      const report = await benchmarkingService.compareCurriculum(
        programId,
        curriculum.programSpec,
        curriculum.unitSpecs
      );
      
      console.log(`Benchmarking completed: ${report.comparisons.length} comparisons, overall similarity: ${report.overallSimilarity}%`);
      console.log(`Identified ${report.gaps.length} gaps and ${report.strengths.length} strengths`);
      
      // Store benchmarking report in database (could be added to a benchmarking_reports table)
      // For now, just log the results
    } catch (error) {
      console.error('Benchmarking failed:', error);
      // Don't fail the entire generation if benchmarking fails
    }
  }

  /**
   * Store final curriculum in database using MongoDB
   */
  private async storeCurriculum(curriculum: Curriculum): Promise<void> {
    // Import models
    const Program = mongoose.model('Program');
    
    // Use MongoDB transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Store program specification in Program document
      await Program.findByIdAndUpdate(
        curriculum.programId,
        {
          $set: {
            programSpecification: {
              introduction: curriculum.programSpec.introduction,
              courseOverview: curriculum.programSpec.courseOverview,
              needsAnalysis: curriculum.programSpec.needsAnalysis,
              knowledgeSkillsCompetenciesMatrix: curriculum.programSpec.knowledgeSkillsCompetenciesMatrix,
              comparativeAnalysis: curriculum.programSpec.comparativeAnalysis,
              targetAudience: curriculum.programSpec.targetAudience,
              entryRequirements: curriculum.programSpec.entryRequirements,
              careerOutcomes: curriculum.programSpec.careerOutcomes,
              generatedAt: curriculum.programSpec.generatedAt,
            },
            status: 'completed',
            updatedAt: new Date(),
          },
        },
        { session, new: true }
      );

      // Store unit specifications - could be in Module documents or separate collection
      // For now, store in Module documents
      for (const unitSpec of curriculum.unitSpecs) {
        await mongoose.model('Module').findOneAndUpdate(
          { moduleCode: unitSpec.moduleCode, programId: curriculum.programId },
          {
            $set: {
              unitSpecification: {
                unitOverview: unitSpec.unitOverview,
                learningOutcomes: unitSpec.learningOutcomes,
                indicativeContent: unitSpec.indicativeContent,
                teachingStrategies: unitSpec.teachingStrategies,
                assessmentMethods: unitSpec.assessmentMethods,
                readingList: unitSpec.readingList,
                generatedAt: unitSpec.generatedAt,
              },
            },
          },
          { session, new: true }
        );
      }

      // Store assessment package in Program document
      await Program.findByIdAndUpdate(
        curriculum.programId,
        {
          $set: {
            assessmentPackage: {
              mcqs: curriculum.assessmentPackage.mcqs,
              caseStudies: curriculum.assessmentPackage.caseStudies,
              rubrics: curriculum.assessmentPackage.rubrics,
              markingSchemes: curriculum.assessmentPackage.markingSchemes,
              learningOutcomeMappings: curriculum.assessmentPackage.learningOutcomeMappings,
              generatedAt: curriculum.assessmentPackage.generatedAt,
            },
          },
        },
        { session, new: true }
      );

      await session.commitTransaction();
      console.log('Curriculum stored successfully in MongoDB');
    } catch (error) {
      await session.abortTransaction();
      console.error('Failed to store curriculum:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }
}

// Export singleton instance
export const curriculumGeneratorService = new CurriculumGeneratorService();
