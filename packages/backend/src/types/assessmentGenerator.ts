/**
 * Assessment Generator Contract Types
 * Based on the comprehensive assessment generation schema
 *
 * This implements a full assessment system with:
 * - Formative assessments (per module)
 * - Summative assessments (course/module level) with components
 * - Sample question banks (MCQ, SJT, case, essay, practical)
 * - LMS package structures
 */

import { BloomLevel } from './newWorkflow';

// ============================================================================
// USER PREFERENCES (INPUT)
// ============================================================================

export type AssessmentStructure =
  | 'formative_only'
  | 'summative_only'
  | 'both_formative_and_summative';

export type AssessmentBalance =
  | 'mostly_knowledge_based'
  | 'mostly_applied'
  | 'mostly_scenario_based'
  | 'blended_mix';

export type CertificationStyle =
  | 'SHRM'
  | 'PMI'
  | 'ASCM'
  | 'SCOR'
  | 'CIPS'
  | 'AHLEI'
  | 'CMA'
  | 'None';

export type AcademicType =
  | 'Essays'
  | 'Case-study reports'
  | 'Presentations'
  | 'Portfolios'
  | 'Research papers'
  | 'Short written responses'
  | 'None';

export type SummativeFormat =
  | 'mcq_exam'
  | 'written_assignment'
  | 'case_study_analysis'
  | 'project_capstone'
  | 'mixed_format'
  | 'user_defined';

export type FormativeType =
  | 'Short quizzes'
  | 'MCQ knowledge checks'
  | 'Scenario-based micro-tasks'
  | 'Worksheets / problem sets'
  | 'Short written reflections'
  | 'Mini-case exercises'
  | 'Discussion prompts'
  | 'Practice simulations'
  | 'Coding / technical tasks'
  | 'None';

export type AssessmentMappingStrategy = 'hybrid'; // Currently fixed to hybrid

export type HigherOrderPloPolicy = 'yes' | 'no' | 'partial';

export interface AssessmentWeightages {
  formative?: number;
  summative?: number;
  mcqComponents?: number;
  writtenComponents?: number;
  practicalComponents?: number;
  projectCapstone?: number;
}

export interface AssessmentUserPreferences {
  assessmentStructure: AssessmentStructure;
  assessmentBalance: AssessmentBalance;
  certificationStyles: CertificationStyle[];
  academicTypes: AcademicType[];
  summativeFormat: SummativeFormat;
  userDefinedSummativeDescription?: string;
  formativeTypesPerUnit: FormativeType[];
  formativePerModule: number;
  weightages: AssessmentWeightages;
  assessmentMappingStrategy: AssessmentMappingStrategy;
  higherOrderPloPolicy: HigherOrderPloPolicy;
  higherOrderPloRules?: string;
  useRealWorldScenarios: boolean;
  alignToWorkplacePerformance: boolean;
  integratedRealWorldSummative: boolean;
  generateSampleQuestions: boolean; // Always true
}

// ============================================================================
// FORMATIVE ASSESSMENTS (OUTPUT)
// ============================================================================

export interface FormativeAssessment {
  id: string;
  moduleId: string;
  title: string;
  assessmentType: string; // quiz, mini_case, reflection, worksheet, etc.
  description: string;
  instructions: string;
  alignedPLOs: string[];
  alignedMLOs: string[];
  assessmentCriteria: string[]; // High-level criteria (not full rubric)
  maxMarks?: number;
  questions?: Array<{
    // Actual questions for the assessment
    questionNumber: number;
    questionText: string;
    questionType: 'mcq' | 'short_answer' | 'scenario' | 'calculation' | 'essay';
    options?: string[]; // For MCQ
    correctAnswer?: string | number; // For MCQ (index) or short answer
    points: number;
    bloomLevel?: string;
    difficulty?: string;
    rationale?: string;
  }>;
}

// ============================================================================
// SUMMATIVE ASSESSMENTS (OUTPUT)
// ============================================================================

export type SummativeScope = 'course_level' | 'module_level';

export type ComponentType =
  | 'mcq_section'
  | 'sjt_section'
  | 'case_section'
  | 'essay_section'
  | 'project_section'
  | 'practical_section'
  | 'presentation_section'
  | 'portfolio_section'
  | 'other';

export interface AssessmentComponent {
  id: string;
  name: string;
  componentType: ComponentType;
  weight: number;
  description: string;
}

export interface PLOAlignment {
  ploId: string;
  componentIds: string[];
}

export type MarkingModelType = 'criteria_only' | 'full_rubric';

export interface AssessmentCriterion {
  name: string;
  description: string;
  weight?: number;
}

export interface RubricLevel {
  levelName: string;
  levelDescriptor: string;
  thresholdMarks?: number;
}

export interface MarkingModel {
  type: MarkingModelType;
  criteria: AssessmentCriterion[];
  rubricLevels?: RubricLevel[];
}

export interface SummativeAssessment {
  id: string;
  scope: SummativeScope;
  moduleId?: string; // Present if scope = module_level
  title: string;
  format: SummativeFormat;
  overview: string;
  alignmentTable: PLOAlignment[];
  components: AssessmentComponent[];
  markingModel: MarkingModel;
}

// ============================================================================
// SAMPLE QUESTIONS (OUTPUT)
// ============================================================================

export interface MCQOption {
  text: string;
  effectivenessRank?: number; // For SJT
  isPreferred?: boolean; // For SJT
}

export interface MCQSampleQuestion {
  stem: string;
  options: string[];
  correctOptionIndex: number;
  rationale?: string;
  alignedPLOs?: string[];
}

export interface SJTSampleQuestion {
  scenario: string;
  options: MCQOption[];
  guidance?: string;
  alignedPLOs?: string[];
}

export interface CaseSampleQuestion {
  caseText: string;
  prompts: string[];
  alignedPLOs?: string[];
}

export interface EssaySamplePrompt {
  promptText: string;
  expectedFocus?: string;
  alignedPLOs?: string[];
}

export interface PracticalSampleTask {
  taskDescription: string;
  evidenceRequired?: string;
  assessmentCriteria?: string[];
  alignedPLOs?: string[];
}

export interface SampleQuestions {
  mcq: MCQSampleQuestion[];
  sjt: SJTSampleQuestion[];
  caseQuestions: CaseSampleQuestion[];
  essayPrompts: EssaySamplePrompt[];
  practicalTasks: PracticalSampleTask[];
}

// ============================================================================
// LMS PACKAGES (OUTPUT)
// ============================================================================

export interface LMSPackages {
  canvas?: Record<string, any>; // Logical representation
  moodle?: Record<string, any>;
  blackboard?: Record<string, any>;
}

// ============================================================================
// ASSESSMENT GENERATION REQUEST
// ============================================================================

export interface AssessmentGenerationRequest {
  programFoundation: any; // From Step 1
  competencyFrameworks: any; // From Step 2
  courseFramework: any; // From Step 3/4
  modules: any[]; // From Step 4
  topicSources: any[]; // From Step 5
  readingLists: any[]; // From Step 6
  userPreferences: AssessmentUserPreferences;
}

// ============================================================================
// ASSESSMENT GENERATION RESPONSE
// ============================================================================

export interface AssessmentGenerationResponse {
  formativeAssessments: FormativeAssessment[];
  summativeAssessments: SummativeAssessment[];
  sampleQuestions: SampleQuestions;
  lmsPackages: LMSPackages;
}

// ============================================================================
// STEP 7 WITH NEW CONTRACT
// ============================================================================

export interface Step7AssessmentsNew extends AssessmentGenerationResponse {
  // User preferences that were used
  userPreferences: AssessmentUserPreferences;

  // Validation
  validation: {
    allFormativesMapped: boolean;
    allSummativesMapped: boolean;
    weightsSum100: boolean;
    sufficientSampleQuestions: boolean;
    plosCovered: boolean;
  };

  // Metadata
  generatedAt: Date;
  validatedAt?: Date;
  approvedAt?: Date;
  approvedBy?: string;
}

// ============================================================================
// GENERATION PROGRESS TRACKING
// ============================================================================

export interface AssessmentGenerationProgress {
  stage: 'formative' | 'summative' | 'samples' | 'lms' | 'complete' | 'error';
  currentModule?: string;
  currentType?: string;
  totalSteps: number;
  completedSteps: number;
  estimatedTimeRemaining?: number; // seconds
  error?: string;
}
