/**
 * Curriculum Generation Types
 * Types for curriculum generation jobs, pipeline stages, and outputs
 * Implements Requirements 5.1, 5.2, 5.3, 5.4
 */

import { ParsedProgramData } from './excel';
import { SkillMapping } from './skillBook';

export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export type GenerationStage = 
  | 'validate'
  | 'retrieve'
  | 'generate_program_spec'
  | 'generate_unit_specs'
  | 'generate_assessments'
  | 'qa'
  | 'benchmark';

export interface GenerationJob {
  jobId: string;
  programId: string;
  status: JobStatus;
  progress: number; // 0-100
  currentStage?: GenerationStage;
  estimatedCompletion?: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export interface JobProgressUpdate {
  jobId: string;
  progress: number;
  stage: GenerationStage;
  message: string;
  timestamp: Date;
}

export interface ProgramSpecification {
  programId: string;
  introduction: string;
  courseOverview: string;
  needsAnalysis: string;
  knowledgeSkillsCompetenciesMatrix: string;
  comparativeAnalysis: string;
  targetAudience: string;
  entryRequirements: string;
  careerOutcomes: string;
  generatedAt: Date;
}

export interface UnitSpecification {
  unitId: string;
  moduleCode: string;
  unitTitle: string;
  unitOverview: string;
  learningOutcomes: Array<{
    outcomeText: string;
    assessmentCriteria: string[];
  }>;
  indicativeContent: string;
  teachingStrategies: string[];
  assessmentMethods: string[];
  readingList: Array<{
    title: string;
    citation: string;
    type: 'Required' | 'Recommended';
  }>;
  generatedAt: Date;
}

export interface AssessmentPackage {
  programId: string;
  mcqs: Array<{
    moduleCode: string;
    question: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
    difficulty: 'Easy' | 'Medium' | 'Hard';
    learningOutcome: string;
  }>;
  caseStudies: Array<{
    moduleCode: string;
    title: string;
    scenario: string;
    questions: string[];
    rubric: string;
    difficulty: 'Easy' | 'Medium' | 'Hard';
  }>;
  rubrics: Array<{
    assessmentType: string;
    criteria: Array<{
      criterion: string;
      excellent: string;
      good: string;
      satisfactory: string;
      needsImprovement: string;
    }>;
  }>;
  markingSchemes: Array<{
    assessmentType: string;
    totalMarks: number;
    breakdown: Array<{
      section: string;
      marks: number;
      description: string;
    }>;
  }>;
  learningOutcomeMappings: Array<{
    assessmentId: string;
    learningOutcomes: string[];
  }>;
  generatedAt: Date;
}

export interface Curriculum {
  programId: string;
  programSpec: ProgramSpecification;
  unitSpecs: UnitSpecification[];
  assessmentPackage: AssessmentPackage;
  skillBook: SkillMapping[];
  generatedAt: Date;
}

export interface GenerationJobData {
  programId: string;
  userId?: string;
  parsedData: ParsedProgramData;
}

export interface GenerationJobResult {
  jobId: string;
  programId: string;
  curriculum: Curriculum;
  completedAt: Date;
}

export interface IntermediateResult {
  jobId: string;
  stage: GenerationStage;
  data: any;
  timestamp: Date;
}
