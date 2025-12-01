/**
 * 9-Step Curriculum Workflow Types
 * AI-Integrated Curriculum Generator v2.2
 */

// Workflow step identifiers
export type WorkflowStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

// Step statuses
export type StepStatus = 'pending' | 'in_progress' | 'completed' | 'approved' | 'revision_needed';

// Workflow overall status
export type WorkflowStatus =
  | 'step1_pending'
  | 'step1_complete'
  | 'step2_pending'
  | 'step2_complete'
  | 'step3_pending'
  | 'step3_complete'
  | 'step4_pending'
  | 'step4_complete'
  | 'step5_pending'
  | 'step5_complete'
  | 'step6_pending'
  | 'step6_complete'
  | 'step7_pending'
  | 'step7_complete'
  | 'step8_pending'
  | 'step8_complete'
  | 'step9_pending'
  | 'step9_complete'
  | 'review_pending'
  | 'published';

// Credit system types
export type CreditSystem = 'uk' | 'ects' | 'us_semester';
export type AcademicLevel = 'certificate' | 'micro-credential' | 'diploma';
export type DeliveryMode = 'online' | 'blended' | 'on-campus';

// Bloom's Taxonomy levels
export type BloomLevel = 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create';

// =============================================================================
// STEP 1: PROGRAM FOUNDATION
// =============================================================================
export interface CreditFramework {
  creditSystem: CreditSystem;
  totalCredits: number;
  totalHours: number;
  contactPercent: number;
  contactHours: number;
  selfStudyHours: number;
}

export interface Step1ProgramFoundation {
  programTitle: string;
  programDescription: string;
  academicLevel: AcademicLevel;
  creditFramework: CreditFramework;
  targetLearner: string;
  deliveryMode: DeliveryMode;
  deliveryDescription?: string;
  programPurpose: string;
  jobRoles: string[];
  completenessScore: number;
  approvedAt?: string;
  approvedBy?: string;
}

// =============================================================================
// STEP 2: COMPETENCY & KNOWLEDGE FRAMEWORK (KSA)
// =============================================================================
export interface KSAItem {
  id: string;
  statement: string;
  description: string;
  importance: 'critical' | 'important' | 'supplementary';
  source?: string;
  linkedPLOs?: string[];
}

export interface Step2CompetencyKSA {
  knowledgeItems: KSAItem[];
  skillItems: KSAItem[];
  attitudeItems: KSAItem[];
  benchmarkPrograms?: string[];
  industryFrameworks?: string[];
  institutionalFrameworks?: string[];
  totalItems: number;
  approvedAt?: string;
  approvedBy?: string;
}

// =============================================================================
// STEP 3: PROGRAM LEARNING OUTCOMES (PLOs)
// =============================================================================
export interface PLO {
  id: string;
  code: string;
  statement: string;
  bloomLevel: BloomLevel;
  verb: string;
  linkedKSAs: string[];
  assessable: boolean;
  measurable: boolean;
}

export interface Step3PLOs {
  outcomes: PLO[];
  bloomDistribution: Record<BloomLevel, number>;
  configuration: {
    targetCount: number;
    priorityCompetencies: string[];
    outcomeEmphasis: 'cognitive' | 'practical' | 'mixed';
    preferredVerbs?: string[];
    avoidVerbs?: string[];
  };
  approvedAt?: string;
  approvedBy?: string;
}

// =============================================================================
// STEP 4: COURSE FRAMEWORK & MLOs
// =============================================================================
export interface MLO {
  id: string;
  code: string;
  statement: string;
  bloomLevel: BloomLevel;
  verb: string;
  linkedPLOs: string[];
  assessmentCriteria?: string[];
}

export interface Topic {
  id: string;
  title: string;
  description: string;
  hours: number;
  sequence: number;
}

export interface Module {
  id: string;
  code: string;
  title: string;
  description: string;
  totalHours: number;
  contactHours: number;
  selfStudyHours: number;
  credits: number;
  sequence: number;
  linkedPLOs: string[];
  mlos: MLO[];
  topics: Topic[];
}

export interface Step4CourseFramework {
  modules: Module[];
  totalProgramHours: number;
  totalContactHours: number;
  hoursIntegrity: boolean;
  ploMapping: Record<string, string[]>;
  approvedAt?: string;
  approvedBy?: string;
}

// =============================================================================
// STEP 5: TOPIC-LEVEL SOURCES (AGI STANDARDS)
// =============================================================================
export type SourceType = 'primary' | 'secondary' | 'grey_literature';
export type SourceCategory =
  | 'textbook'
  | 'journal_article'
  | 'white_paper'
  | 'standard'
  | 'case_study'
  | 'video'
  | 'website';

export interface Source {
  id: string;
  title: string;
  authors: string[];
  year: number;
  type: SourceType;
  category: SourceCategory;
  url?: string;
  doi?: string;
  isbn?: string;
  citation: string;
  relevantTopics: string[];
  qualityScore?: number;
  agiCompliant: boolean;
  complianceNotes?: string;
}

export interface Step5Sources {
  sources: Source[];
  topicCoverage: Record<string, Source[]>;
  agiCompliant: boolean;
  complianceIssues: string[];
  adminOverrideApprovedBy?: string;
  approvedAt?: string;
  approvedBy?: string;
}

// =============================================================================
// STEP 6: READING LISTS
// =============================================================================
export interface ReadingItem {
  id: string;
  sourceId: string;
  moduleId: string;
  category: 'core' | 'supplementary';
  specificChapters?: string;
  notes?: string;
  importance: 'essential' | 'recommended' | 'optional';
}

export interface Step6ReadingLists {
  readings: ReadingItem[];
  moduleReadings: Record<string, ReadingItem[]>;
  coreCount: number;
  supplementaryCount: number;
  approvedAt?: string;
  approvedBy?: string;
}

// =============================================================================
// STEP 7: AUTO-GRADABLE ASSESSMENTS (MCQ-FIRST)
// =============================================================================
export interface MCQOption {
  id: string;
  text: string;
  isCorrect: boolean;
  explanation?: string;
}

export interface MCQQuestion {
  id: string;
  stem: string;
  options: MCQOption[];
  correctOption: string;
  explanation: string;
  bloomLevel: BloomLevel;
  linkedMLO: string;
  difficulty: 'easy' | 'medium' | 'hard';
  topicId?: string;
}

export interface ClozeQuestion {
  id: string;
  text: string;
  blanks: { id: string; answer: string; alternatives?: string[] }[];
  bloomLevel: BloomLevel;
  linkedMLO: string;
}

export interface Quiz {
  id: string;
  moduleId: string;
  title: string;
  questions: MCQQuestion[];
  passMark: number;
  timeLimit?: number;
  randomized: boolean;
}

export interface Step7Assessments {
  structure: {
    finalExamWeight: number;
    quizWeight: number;
    passMark: number;
  };
  quizzes: Quiz[];
  finalExam: {
    questions: MCQQuestion[];
    passMark: number;
    timeLimit?: number;
  };
  questionBank: MCQQuestion[];
  clozeQuestions?: ClozeQuestion[];
  validation: {
    allAutoGradable: boolean;
    mlosCovered: string[];
    missingMLOs: string[];
  };
  approvedAt?: string;
  approvedBy?: string;
}

// =============================================================================
// STEP 8: CASE STUDIES (HOOKS)
// =============================================================================
export interface CaseStudy {
  id: string;
  moduleId: string;
  title: string;
  scenario: string;
  hook: string;
  context: string;
  linkedTopics: string[];
  linkedMLOs: string[];
  industry?: string;
  complexity: 'introductory' | 'intermediate' | 'advanced';
}

export interface Step8CaseStudies {
  caseStudies: CaseStudy[];
  moduleCoverage: Record<string, CaseStudy[]>;
  totalCases: number;
  approvedAt?: string;
  approvedBy?: string;
}

// =============================================================================
// STEP 9: GLOSSARY (AUTO-GENERATED)
// =============================================================================
export interface GlossaryTerm {
  id: string;
  term: string;
  definition: string;
  category?: string;
  relatedTerms?: string[];
  sourceModules: string[];
}

export interface Step9Glossary {
  terms: GlossaryTerm[];
  categories: string[];
  totalTerms: number;
  generatedAt: string;
}

// =============================================================================
// WORKFLOW PROGRESS
// =============================================================================
export interface StepProgress {
  step: WorkflowStep;
  status: StepStatus;
  startedAt?: string;
  completedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  timeSpentMinutes?: number;
}

// =============================================================================
// MAIN WORKFLOW INTERFACE
// =============================================================================
export interface CurriculumWorkflow {
  _id: string;
  projectName: string;
  createdBy: string;
  currentStep: WorkflowStep;
  status: WorkflowStatus;
  stepProgress: StepProgress[];

  // Step data
  step1?: Step1ProgramFoundation;
  step2?: Step2CompetencyKSA;
  step3?: Step3PLOs;
  step4?: Step4CourseFramework;
  step5?: Step5Sources;
  step6?: Step6ReadingLists;
  step7?: Step7Assessments;
  step8?: Step8CaseStudies;
  step9?: Step9Glossary;

  // Metadata
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  publishedAt?: string;
  totalTimeSpentMinutes?: number;
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================
export interface WorkflowResponse<T = CurriculumWorkflow> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface WorkflowProgressResponse {
  success: boolean;
  data: {
    workflowId: string;
    projectName: string;
    currentStep: WorkflowStep;
    status: WorkflowStatus;
    completedSteps: number;
    totalSteps: number;
    progressPercent: number;
    stepProgress: StepProgress[];
    estimatedTimeRemaining: string;
  };
}

export interface WorkflowListResponse {
  success: boolean;
  data: CurriculumWorkflow[];
  count: number;
}

// =============================================================================
// STEP CONFIGURATION INTERFACES (for forms)
// =============================================================================
export interface Step1FormData {
  programTitle: string;
  programDescription: string;
  academicLevel: AcademicLevel;
  creditSystem: CreditSystem;
  credits: number;
  totalHours?: number;
  customContactPercent?: number;
  targetLearner: string;
  deliveryMode: DeliveryMode;
  deliveryDescription?: string;
  programPurpose: string;
  jobRoles: string[];
}

export interface Step2FormData {
  benchmarkPrograms?: string[];
  industryFrameworks?: string[];
  institutionalFrameworks?: string[];
}

export interface Step3FormData {
  bloomLevels: BloomLevel[];
  priorityCompetencies?: string[];
  outcomeEmphasis?: 'cognitive' | 'practical' | 'mixed';
  targetCount: number;
  contextConstraints?: string;
  preferredVerbs?: string[];
  avoidVerbs?: string[];
}

export interface Step7FormData {
  finalExamWeight?: number;
  passMark?: number;
  questionsPerQuiz?: number;
  questionsForFinal?: number;
  bankMultiplier?: number;
  randomize?: boolean;
  enableCloze?: boolean;
}

// =============================================================================
// UI HELPER TYPES
// =============================================================================
export const STEP_NAMES: Record<WorkflowStep, string> = {
  1: 'Program Foundation',
  2: 'Competency Framework (KSA)',
  3: 'Program Learning Outcomes',
  4: 'Course Framework & MLOs',
  5: 'Topic-Level Sources',
  6: 'Reading Lists',
  7: 'Auto-Gradable Assessments',
  8: 'Case Studies',
  9: 'Glossary',
};

export const STEP_DESCRIPTIONS: Record<WorkflowStep, string> = {
  1: 'Define program basics: title, level, credits, and target audience',
  2: 'Generate Knowledge, Skills, and Attitudes (KSA) framework',
  3: "Create measurable Program Learning Outcomes using Bloom's Taxonomy",
  4: 'Structure modules, topics, and Module Learning Outcomes',
  5: 'Assign AGI-compliant academic sources to topics',
  6: 'Create core and supplementary reading lists per module',
  7: 'Generate MCQ-first auto-gradable assessments and quizzes',
  8: 'Create engagement hooks and case study scenarios',
  9: 'Auto-generate glossary from all curriculum content',
};

export const ESTIMATED_TIMES: Record<WorkflowStep, string> = {
  1: '15-20 min',
  2: '10-15 min',
  3: '15-20 min',
  4: '25-30 min',
  5: '10 min',
  6: '8 min',
  7: '15-20 min',
  8: '10-15 min',
  9: '5 min (auto)',
};

export const BLOOM_LEVELS: BloomLevel[] = [
  'remember',
  'understand',
  'apply',
  'analyze',
  'evaluate',
  'create',
];

export const BLOOM_VERBS: Record<BloomLevel, string[]> = {
  remember: ['define', 'identify', 'list', 'name', 'recall', 'recognize', 'state'],
  understand: ['describe', 'explain', 'interpret', 'paraphrase', 'summarize', 'classify'],
  apply: ['apply', 'demonstrate', 'execute', 'implement', 'solve', 'use'],
  analyze: ['analyze', 'compare', 'contrast', 'differentiate', 'examine', 'organize'],
  evaluate: ['assess', 'critique', 'evaluate', 'judge', 'justify', 'recommend'],
  create: ['compose', 'construct', 'create', 'design', 'develop', 'formulate'],
};
