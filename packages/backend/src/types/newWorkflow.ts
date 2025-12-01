/**
 * New 9-Step Curriculum Workflow Types
 * Based on AI-Integrated Curriculum Generator Workflow v2.2
 *
 * Steps:
 * 1. Program Foundation
 * 2. Competency & Knowledge Framework (KSA)
 * 3. Program Learning Outcomes (PLOs)
 * 4. Course Framework & Module Learning Outcomes
 * 5. Topic-Level Sources (AGI Standards)
 * 6. Reading Lists
 * 7. Auto-Gradable Assessments (MCQ-First)
 * 8. Case Studies
 * 9. Glossary (Auto-Generated)
 */

// ============================================================================
// COMMON TYPES
// ============================================================================

export type WorkflowStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type WorkflowStatus =
  | 'draft'
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

export type AcademicLevel = 'certificate' | 'micro-credential' | 'diploma';

export type CreditSystem = 'uk_credits' | 'ects' | 'us_semester' | 'non_credit';

export type DeliveryMode =
  | 'online_self_study'
  | 'online_facilitated'
  | 'hybrid_blended'
  | 'in_person';

export type ExperienceLevel = 'beginner' | 'professional' | 'expert';

export type BloomLevel = 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create';

export type KSAType = 'knowledge' | 'skill' | 'attitude';

export type ImportanceLevel = 'essential' | 'desirable';

export type SourceType = 'peer_reviewed' | 'academic_text' | 'professional_body' | 'open_access';

export type ReadingType = 'core' | 'supplementary';

export type CaseStudyType = 'practice' | 'discussion' | 'assessment_ready';

// ============================================================================
// STEP 1: PROGRAM FOUNDATION
// ============================================================================

export interface CreditFramework {
  system: CreditSystem;
  credits?: number; // For credit-awarding systems
  totalHours: number; // Calculated or entered directly
  contactHoursPercent: number; // Default 30% for UK/ECTS, 33% for US
  contactHours: number; // Calculated
  independentHours: number; // Calculated
}

export interface TargetLearnerProfile {
  ageRange: string;
  educationalBackground: string;
  industrySector: string;
  experienceLevel: ExperienceLevel;
}

export interface DeliveryStructure {
  mode: DeliveryMode;
  description: string;
  customContactHoursPercent?: number; // Override default if specified
}

export interface JobRole {
  title: string;
  description: string;
  tasks: string[];
}

export interface Step1ProgramFoundation {
  // Program Identity
  programTitle: string;
  programDescription: string;
  academicLevel: AcademicLevel;

  // Credit Framework
  creditFramework: CreditFramework;

  // Target Learner
  targetLearner: TargetLearnerProfile;

  // Delivery
  delivery: DeliveryStructure;

  // Labour Market
  programPurpose: string;
  jobRoles: JobRole[];

  // Generated Outputs
  executiveSummary?: string;
  programAims?: string[];
  entryRequirements?: string;
  careerPathways?: string[];

  // Validation
  completenessScore: number;
  validatedAt?: Date;
  approvedAt?: Date;
  approvedBy?: string;
}

// ============================================================================
// STEP 2: COMPETENCY & KNOWLEDGE FRAMEWORK (KSA)
// ============================================================================

export interface BenchmarkProgram {
  programName: string;
  institution: string;
  url?: string;
  accreditationStatus?: string;
  publicationYear?: number;
}

export interface CompetencySource {
  citation: string;
  type: SourceType;
  url?: string;
  publicationDate: Date;
}

export interface KSAItem {
  id: string;
  type: KSAType;
  statement: string; // ≤50 words
  description: string;
  importance: ImportanceLevel;
  source?: BenchmarkProgram;
  jobTaskMapping?: string[]; // Links to job tasks from Step 1
}

export interface Step2CompetencyKSA {
  // Input
  benchmarkPrograms: BenchmarkProgram[];
  industryFrameworks?: string[]; // SHRM, PMI, etc.
  institutionalFrameworks?: string[];

  // Generated KSA Items
  knowledgeItems: KSAItem[]; // 30-40% of total
  skillItems: KSAItem[]; // 40-50% of total
  attitudeItems: KSAItem[]; // 10-30% of total

  // Benchmarking Report
  benchmarkingReport?: {
    programsAnalyzed: BenchmarkProgram[];
    keyFindings: string[];
    coverageAnalysis: string;
  };

  // Validation
  totalItems: number;
  essentialCount: number;
  validatedAt?: Date;
  approvedAt?: Date;
  approvedBy?: string;
}

// ============================================================================
// STEP 3: PROGRAM LEARNING OUTCOMES (PLOs)
// ============================================================================

export interface PLO {
  id: string;
  outcomeNumber: number;
  statement: string; // [Verb + Task + Context], ≤25 words
  bloomLevel: BloomLevel;
  competencyLinks: string[]; // KSA item IDs from Step 2
  jobTaskMapping: string[]; // Links to job tasks from Step 1
  assessmentAlignment?: string; // How it will be measured
}

export interface Step3PLOs {
  // Input Selections
  bloomLevels: BloomLevel[]; // Must have ≥1 lower + ≥1 higher
  priorityCompetencies: string[]; // Selected from Step 2
  outcomeEmphasis: 'technical' | 'professional' | 'strategic' | 'mixed';
  targetCount: number; // 4-8

  // Optional Controls
  contextConstraints?: string;
  preferredVerbs?: string[];
  avoidVerbs?: string[];
  stakeholderPriorities?: string;
  exclusions?: string[];

  // Generated PLOs
  outcomes: PLO[];

  // Coverage Report
  coverageReport?: {
    competenciesCovered: number;
    coveragePercent: number;
    bloomDistribution: Record<BloomLevel, number>;
    jobTasksCovered: string[];
  };

  // Validation
  validatedAt?: Date;
  approvedAt?: Date;
  approvedBy?: string;
}

// ============================================================================
// STEP 4: COURSE FRAMEWORK & MODULE LEARNING OUTCOMES
// ============================================================================

export interface MLO {
  id: string;
  outcomeNumber: number;
  statement: string; // [Verb + Task + Context]
  bloomLevel: BloomLevel;
  linkedPLOs: string[]; // PLO IDs
  competencyLinks: string[]; // KSA item IDs
}

export interface Module {
  id: string;
  moduleCode: string;
  title: string;
  sequenceOrder: number;

  // Hours Distribution
  totalHours: number;
  contactHours: number;
  independentHours: number;

  // Classification
  isCore: boolean;
  prerequisites: string[]; // Module IDs

  // Learning Outcomes
  mlos: MLO[];

  // Indicative Activities
  contactActivities?: string[];
  independentActivities?: string[];
}

export interface Step4CourseFramework {
  // Module Structure
  modules: Module[];

  // Hours Validation
  totalProgramHours: number;
  totalContactHours: number;
  totalIndependentHours: number;

  // Mapping Table
  ploModuleMapping: {
    ploId: string;
    moduleIds: string[];
  }[];

  // Progressive Complexity Check
  progressiveComplexity: {
    earlyModulesLowerLevel: boolean; // ≥60% Understand/Apply
    laterModulesHigherLevel: boolean; // ≥30% Analyze/Evaluate/Create
  };

  // Validation
  hoursIntegrity: boolean; // Σ module hours = program hours
  validatedAt?: Date;
  approvedAt?: Date;
  approvedBy?: string;
}

// ============================================================================
// STEP 5: TOPIC-LEVEL SOURCES (AGI STANDARDS)
// ============================================================================

export interface AGISource {
  id: string;
  // Citation
  authors: string;
  year: number;
  title: string;
  publisher: string;
  doi?: string;
  url?: string;
  apaCitation: string; // Complete APA 7th format

  // Classification
  sourceType: SourceType;
  isRecent: boolean; // ≤5 years
  isSeminal: boolean; // >5 years with justification
  seminalJustification?: string;
  recentPairing?: string; // ID of recent source if seminal

  // Validation
  isVerified: boolean;
  isAccessible: boolean; // AGI Library or open access
  apaValidated: boolean;

  // Mapping
  topicId: string;
  moduleId: string;
  mloIds: string[];

  // Classification
  classification: 'academic' | 'applied';
}

export interface TopicSource {
  id: string;
  topic: string;
  moduleId: string;
  sources: AGISource[];
}

export interface Step5Sources {
  // Topic Sources
  topicSources: TopicSource[];

  // Validation Summary
  validationSummary: {
    totalSources: number;
    peerReviewedCount: number;
    peerReviewedPercent: number;
    recentCount: number;
    seminalCount: number;
    academicCount: number;
    appliedCount: number;
    allTopicsHaveMinSources: boolean;
    allMlosHaveSources: boolean;
    apaAccuracy: number; // ≥95% required
  };

  // AGI Compliance
  agiCompliant: boolean;
  complianceIssues: string[];
  adminOverrideRequired: boolean;
  adminOverrideJustification?: string;
  adminOverrideApprovedBy?: string;

  // Validation
  validatedAt?: Date;
  approvedAt?: Date;
  approvedBy?: string;
}

// ============================================================================
// STEP 6: READING LISTS
// ============================================================================

export interface ReadingItem {
  id: string;
  sourceId: string; // Reference to AGISource
  citation: string; // APA 7th
  type: ReadingType;

  // Effort Estimation
  estimatedMinutes: number;
  complexityLevel: 'introductory' | 'intermediate' | 'advanced';

  // Scheduling
  suggestedWeek?: string;

  // Mapping
  moduleId: string;
  mloIds: string[];
  assessmentRelevance: 'high' | 'medium' | 'low';
}

export interface ModuleReadingList {
  moduleId: string;
  coreReadings: ReadingItem[]; // 3-6 per module
  supplementaryReadings: ReadingItem[]; // 4-8 per module
  totalReadingTime: number; // Must fit within independent hours
}

export interface Step6ReadingLists {
  // Module Reading Lists
  moduleReadingLists: ModuleReadingList[];

  // Cross-Module References
  crossModuleRefs: {
    sourceId: string;
    firstModuleId: string;
    subsequentModuleIds: string[];
  }[];

  // Validation
  allModulesHaveCoreReadings: boolean;
  allCoreMapToMlos: boolean;
  readingTimeWithinBudget: boolean;

  validatedAt?: Date;
  approvedAt?: Date;
  approvedBy?: string;
}

// ============================================================================
// STEP 7: AUTO-GRADABLE ASSESSMENTS (MCQ-FIRST)
// ============================================================================

export interface MCQOption {
  label: 'A' | 'B' | 'C' | 'D';
  text: string;
  isCorrect: boolean;
}

export interface MCQ {
  id: string;
  moduleId: string;

  // Question
  stem: string;
  options: MCQOption[];

  // Rationale
  rationale: string; // 50-100 words
  correctExplanation: string;
  distractorExplanations: Record<string, string>;

  // Metadata
  mloId: string;
  bloomLevel: BloomLevel;
  difficulty: 'easy' | 'medium' | 'hard';
  topicArea: string;

  // Bank Info
  usedInQuiz: boolean;
  usedInFinal: boolean;
}

export interface ClozeItem {
  id: string;
  moduleId: string;
  sentence: string;
  blanks: {
    position: number;
    correctAnswer: string;
    acceptedSynonyms: string[];
  }[];
  mloId: string;
}

export interface AssessmentBlueprint {
  // Global Settings
  finalExamWeight: number; // % (typically 30-50)
  moduleQuizWeights: {
    moduleId: string;
    weight: number;
  }[];
  passMark: number; // % (typically 50-70)
  questionsPerQuiz: number; // typically 15-25
  questionsForFinal: number; // typically 50-80
  bankMultiplier: number; // default 3×
  randomize: boolean;

  // Optional
  enableCloze: boolean;
  clozeCountPerModule?: number;
  timeLimit?: number; // minutes
  openBook: boolean;
  calculatorPermitted: boolean;
}

export interface Step7Assessments {
  // Blueprint
  blueprint: AssessmentBlueprint;

  // Question Banks
  mcqBanks: {
    moduleId: string;
    questions: MCQ[];
  }[];

  // Final Exam Pool (separate from module quizzes)
  finalExamPool: MCQ[];

  // Optional Cloze Items
  clozeItems?: ClozeItem[];

  // Validation
  validation: {
    weightsSum100: boolean;
    allMlosCovered: boolean;
    bloomDistributionValid: boolean;
    allHaveRationales: boolean;
    allAutoGradable: boolean;
    noDuplicates: boolean;
    finalProportional: boolean;
  };

  validatedAt?: Date;
  approvedAt?: Date;
  approvedBy?: string;
}

// ============================================================================
// STEP 8: CASE STUDIES
// ============================================================================

export interface CaseStudyHook {
  keyFacts: string[]; // 10-15 atomic statements
  misconceptions: string[]; // 5-8 common errors
  decisionPoints: string[]; // 3-5 judgment moments
  terminology: {
    term: string;
    definition: string;
  }[];
}

export interface DataAsset {
  name: string;
  description: string;
  schema: {
    columns: string[];
    types: string[];
    sampleRow: string[];
  };
  filePath?: string;
}

export interface CaseStudy {
  id: string;
  type: CaseStudyType;

  // Content
  title: string;
  industryContext: string;
  organizationName: string; // Fictitious unless permitted
  scenario: string; // 400-800 words

  // Mapping
  moduleIds: string[];
  mloIds: string[];
  difficultyLevel: 'entry' | 'intermediate' | 'advanced';

  // Data Assets (optional)
  dataAssets?: DataAsset[];

  // Assessment Hooks (for assessment-ready type)
  hooks?: CaseStudyHook;

  // Ethics
  noPII: boolean;
  brandsAnonymized: boolean;
}

export interface Step8CaseStudies {
  // Case Studies
  caseStudies: CaseStudy[];

  // Validation
  validation: {
    allMapToModules: boolean;
    allMapToMlos: boolean;
    allWithinWordLimit: boolean;
    allEthicsCompliant: boolean;
    hooksProvidedForAssessmentReady: boolean;
  };

  validatedAt?: Date;
  approvedAt?: Date;
  approvedBy?: string;
}

// ============================================================================
// STEP 9: GLOSSARY (AUTO-GENERATED)
// ============================================================================

export interface GlossaryEntry {
  id: string;
  term: string;
  definition: string; // 20-40 words
  exampleSentence?: string; // ≤20 words
  technicalNote?: string;
  relatedTerms: string[]; // Term IDs
  broaderTerms: string[];
  narrowerTerms: string[];
  synonyms: string[];
  moduleIds: string[]; // Where term is used
  source: 'assessment' | 'competency' | 'outcome' | 'reading' | 'case_study' | 'description';
}

export interface Step9Glossary {
  // Entries
  entries: GlossaryEntry[];

  // Statistics
  totalTerms: number;
  assessmentTermsCount: number;
  competencyTermsCount: number;

  // Validation
  validation: {
    allAssessmentTermsIncluded: boolean;
    allDefinitionsWithinLimit: boolean;
    noCircularDefinitions: boolean;
    allCrossRefsValid: boolean;
    consistentSpelling: boolean;
    allMappedToModules: boolean;
  };

  // Auto-generated timestamp
  generatedAt: Date;
}

// ============================================================================
// WORKFLOW AGGREGATE
// ============================================================================

export interface CurriculumWorkflow {
  id: string;

  // Identity
  projectName: string;
  createdBy: string;

  // Current State
  currentStep: WorkflowStep;
  status: WorkflowStatus;

  // Step Data
  step1?: Step1ProgramFoundation;
  step2?: Step2CompetencyKSA;
  step3?: Step3PLOs;
  step4?: Step4CourseFramework;
  step5?: Step5Sources;
  step6?: Step6ReadingLists;
  step7?: Step7Assessments;
  step8?: Step8CaseStudies;
  step9?: Step9Glossary;

  // Step Progress
  stepProgress: {
    step: WorkflowStep;
    status: 'pending' | 'in_progress' | 'completed' | 'approved';
    startedAt?: Date;
    completedAt?: Date;
    approvedAt?: Date;
    approvedBy?: string;
    reviewTime?: number; // minutes
  }[];

  // Timeline
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;

  // Metrics
  totalTimeSpent?: number; // minutes
  estimatedCompletion?: Date;
}

// ============================================================================
// FINAL DELIVERABLES
// ============================================================================

export interface FinalDeliverables {
  workflowId: string;

  // Core Documentation
  programSpecification: string; // PDF/Word
  courseFrameworkDocument: string;
  moduleSyllabi: string[]; // 6-8 documents
  assessmentHandbook: string;
  readingListsCompilation: string;
  caseStudyLibrary: string;
  glossaryOfTerms: string;

  // Supporting Materials
  accreditationChecklist: string;
  implementationGuide: string;
  qualityAssuranceReport: string;

  // Technical Exports
  lmsImportFiles: string[]; // Moodle, Canvas, etc.
  dataFiles: string[]; // PDF, Word, Excel, CSV

  // Generation Info
  generatedAt: Date;
  generatedBy: string;
}
