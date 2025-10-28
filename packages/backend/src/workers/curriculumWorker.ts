/**
 * Simple MongoDB-based Curriculum Generation Worker
 * Polls for queued jobs and processes them
 */

import mongoose from 'mongoose';
import { GenerationJob } from '../models/GenerationJob';
import { Program } from '../models/Program';
import { Module } from '../models/Module';
import { LearningOutcome } from '../models/LearningOutcome';
import { loggingService } from '../services/loggingService';

interface CurriculumContent {
  programSpecification: any;
  modules: any[];
  assessments: any[];
  skillMappings: any[];
}

class CurriculumWorker {
  private isRunning = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private processingJobIds = new Set<string>();

  /**
   * Start the worker - polls for queued jobs every 5 seconds
   */
  start() {
    if (this.isRunning) {
      console.log('[Worker] Already running');
      return;
    }

    this.isRunning = true;
    console.log('[Worker] Starting curriculum generation worker...');

    // Poll for jobs every 5 seconds
    this.pollInterval = setInterval(() => {
      this.processQueuedJobs();
    }, 5000);

    // Also process immediately
    this.processQueuedJobs();
  }

  /**
   * Stop the worker
   */
  stop() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.isRunning = false;
    console.log('[Worker] Stopped');
  }

  /**
   * Find and process queued jobs
   */
  private async processQueuedJobs() {
    try {
      // Find queued jobs that aren't already being processed
      const queuedJobs = await GenerationJob.find({
        status: 'queued',
        _id: { $nin: Array.from(this.processingJobIds) }
      })
      .limit(5) // Process up to 5 jobs at a time
      .sort({ createdAt: 1 }); // Oldest first

      if (queuedJobs.length === 0) {
        return;
      }

      console.log(`[Worker] Found ${queuedJobs.length} queued job(s)`);

      // Process each job
      for (const job of queuedJobs) {
        // Don't await - process in parallel
        this.processJob(job._id.toString()).catch(err => {
          console.error(`[Worker] Error processing job ${job._id}:`, err);
        });
      }
    } catch (error) {
      console.error('[Worker] Error finding queued jobs:', error);
    }
  }

  /**
   * Process a single job
   */
  private async processJob(jobId: string) {
    // Mark as processing
    this.processingJobIds.add(jobId);

    try {
      const job = await GenerationJob.findById(jobId);
      if (!job) {
        console.error(`[Worker] Job ${jobId} not found`);
        return;
      }

      console.log(`[Worker] Processing job ${jobId} for program ${job.programId}`);

      // Update status to processing
      job.status = 'processing';
      job.progress = 0;
      await job.save();

      // Get the program
      const program = await Program.findById(job.programId);
      if (!program) {
        throw new Error('Program not found');
      }

      // Generate curriculum content
      const curriculum = await this.generateCurriculum(job, program);

      // Update job progress
      job.progress = 100;
      job.status = 'completed';
      job.completedAt = new Date();
      job.intermediateResults = curriculum;
      await job.save();

      console.log(`[Worker] Job ${jobId} completed successfully`);

    } catch (error: any) {
      console.error(`[Worker] Job ${jobId} failed:`, error);

      // Update job as failed
      try {
        await GenerationJob.findByIdAndUpdate(jobId, {
          status: 'failed',
          errorMessage: error.message || 'Unknown error',
          completedAt: new Date()
        });
      } catch (updateError) {
        console.error(`[Worker] Failed to update job ${jobId} status:`, updateError);
      }
    } finally {
      // Remove from processing set
      this.processingJobIds.delete(jobId);
    }
  }

  /**
   * Generate curriculum content using AI
   */
  private async generateCurriculum(job: any, program: any): Promise<CurriculumContent> {
    console.log(`[Worker] Generating curriculum for program: ${program.programName}`);

    // Simulate AI curriculum generation with realistic progress updates
    const stages = [
      { name: 'Analyzing program requirements', progress: 10 },
      { name: 'Generating program specification', progress: 25 },
      { name: 'Creating module structure', progress: 40 },
      { name: 'Generating learning outcomes', progress: 55 },
      { name: 'Creating assessments', progress: 70 },
      { name: 'Developing skill mappings', progress: 85 },
      { name: 'Finalizing curriculum', progress: 95 },
    ];

    const curriculum: CurriculumContent = {
      programSpecification: {},
      modules: [],
      assessments: [],
      skillMappings: []
    };

    for (const stage of stages) {
      console.log(`[Worker] ${stage.name}...`);
      
      // Update progress
      await GenerationJob.findByIdAndUpdate(job._id, {
        progress: stage.progress
      });

      // Simulate AI processing time
      await this.sleep(2000);
    }

    // Generate program specification
    curriculum.programSpecification = {
      programName: program.programName,
      qualificationLevel: program.qualificationLevel,
      qualificationType: program.qualificationType,
      totalCredits: program.totalCredits,
      industrySector: program.industrySector,
      overview: `Comprehensive ${program.qualificationLevel} in ${program.industrySector}`,
      aims: [
        `Develop practical skills in ${program.industrySector}`,
        'Build theoretical understanding of core concepts',
        'Prepare graduates for professional practice'
      ],
      careerOutcomes: [
        `${program.industrySector} Specialist`,
        `${program.industrySector} Consultant`,
        'Industry Professional'
      ],
      entryRequirements: [
        'Completion of previous qualification level or equivalent',
        'Relevant work experience (preferred)',
        'Basic literacy and numeracy skills'
      ]
    };

    // Generate 4-6 modules
    const numberOfModules = Math.floor(Math.random() * 3) + 4;
    
    for (let i = 0; i < numberOfModules; i++) {
      const moduleCode = `${program.industrySector.substring(0, 3).toUpperCase()}${(i + 1).toString().padStart(3, '0')}`;
      const credits = Math.floor(program.totalCredits / numberOfModules);

      const module = {
        moduleCode,
        moduleTitle: `${program.industrySector} Module ${i + 1}`,
        credits,
        level: program.qualificationLevel,
        moduleAim: `To develop knowledge and skills in key aspects of ${program.industrySector}`,
        learningOutcomes: this.generateLearningOutcomes(3 + Math.floor(Math.random() * 3)),
        assessments: this.generateAssessments(2 + Math.floor(Math.random() * 2)),
        teachingMethods: [
          'Lectures and seminars',
          'Practical workshops',
          'Group projects',
          'Independent study'
        ],
        indicativeContent: [
          'Core theoretical concepts',
          'Practical applications',
          'Industry best practices',
          'Contemporary issues and trends'
        ]
      };

      curriculum.modules.push(module);

      // Save module to database
      const moduleDoc = new Module({
        programId: program._id,
        moduleCode: module.moduleCode,
        moduleTitle: module.moduleTitle,
        hours: credits * 10,
        moduleAim: module.moduleAim,
        coreElective: 'core', // lowercase to match enum
        sequenceOrder: i + 1
      });
      await moduleDoc.save();

      // Save learning outcomes
      for (let j = 0; j < module.learningOutcomes.length; j++) {
        const outcome = module.learningOutcomes[j];
        
        // Determine knowledge/skill/competency based on Bloom level
        let ksc: 'knowledge' | 'skill' | 'competency';
        if (['Remember', 'Understand'].includes(outcome.bloomLevel)) {
          ksc = 'knowledge';
        } else if (['Apply', 'Analyze'].includes(outcome.bloomLevel)) {
          ksc = 'skill';
        } else {
          ksc = 'competency';
        }
        
        const lo = new LearningOutcome({
          moduleId: moduleDoc._id,
          outcomeText: outcome.description,
          bloomLevel: outcome.bloomLevel,
          knowledgeSkillCompetency: ksc,
          assessmentCriteria: outcome.assessmentMethods || []
        });
        await lo.save();
      }
    }

    // Generate assessments summary
    curriculum.assessments = curriculum.modules.flatMap((m: any) => 
      m.assessments.map((a: any) => ({
        ...a,
        moduleCode: m.moduleCode,
        moduleTitle: m.moduleTitle
      }))
    );

    // Generate skill mappings
    curriculum.skillMappings = this.generateSkillMappings(curriculum.modules);

    return curriculum;
  }

  /**
   * Generate learning outcomes for a module
   */
  private generateLearningOutcomes(count: number) {
    const bloomLevels = ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'];
    const verbs: Record<string, string[]> = {
      'Remember': ['identify', 'define', 'describe', 'list', 'name'],
      'Understand': ['explain', 'summarize', 'interpret', 'classify', 'compare'],
      'Apply': ['demonstrate', 'use', 'apply', 'implement', 'solve'],
      'Analyze': ['analyze', 'examine', 'investigate', 'differentiate', 'organize'],
      'Evaluate': ['evaluate', 'assess', 'critique', 'justify', 'recommend'],
      'Create': ['design', 'develop', 'create', 'formulate', 'construct']
    };

    return Array.from({ length: count }, (_, i) => {
      const level = bloomLevels[Math.min(i + 1, bloomLevels.length - 1)];
      const verbList = verbs[level];
      const verb = verbList[Math.floor(Math.random() * verbList.length)];
      
      return {
        description: `${verb.charAt(0).toUpperCase() + verb.slice(1)} key concepts and principles`,
        bloomLevel: level,
        assessmentMethods: ['Written examination', 'Practical assessment', 'Project work']
      };
    });
  }

  /**
   * Generate assessments for a module
   */
  private generateAssessments(count: number) {
    const types = [
      { type: 'Written Examination', weighting: 50 },
      { type: 'Coursework', weighting: 30 },
      { type: 'Practical Assessment', weighting: 20 },
      { type: 'Group Project', weighting: 25 },
      { type: 'Individual Presentation', weighting: 15 }
    ];

    return Array.from({ length: count }, (_, i) => {
      const assessment = types[i % types.length];
      return {
        assessmentType: assessment.type,
        weighting: assessment.weighting,
        learningOutcomesCovered: 'All module learning outcomes',
        submissionDeadline: `Week ${12 + i * 2}`,
        feedbackTimeline: 'Within 3 weeks of submission'
      };
    });
  }

  /**
   * Generate skill mappings
   */
  private generateSkillMappings(modules: any[]) {
    const skillCategories = {
      'Technical Skills': ['Software proficiency', 'Technical analysis', 'Problem-solving'],
      'Professional Skills': ['Communication', 'Teamwork', 'Project management'],
      'Cognitive Skills': ['Critical thinking', 'Research', 'Innovation']
    };

    const mappings: any[] = [];

    Object.entries(skillCategories).forEach(([category, skills]) => {
      skills.forEach(skill => {
        mappings.push({
          category,
          skill,
          modules: modules.slice(0, Math.floor(Math.random() * 3) + 2).map(m => m.moduleCode)
        });
      });
    });

    return mappings;
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const curriculumWorker = new CurriculumWorker();

