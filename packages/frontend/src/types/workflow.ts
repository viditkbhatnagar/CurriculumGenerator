/**
 * 9-Step Curriculum Workflow Types
 * AI-Integrated Curriculum Generator v2.2
 */

// Workflow step identifiers
export type WorkflowStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

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
  | 'step10_pending'
  | 'step10_complete'
  | 'review_pending'
  | 'published';

// Credit system types
export type CreditSystem = 'uk' | 'ects' | 'us_semester' | 'non_credit';
export type AcademicLevel = 'certificate' | 'micro-credential' | 'diploma';
export type DeliveryMode =
  | 'online_self_study'
  | 'online_facilitated'
  | 'hybrid_blended'
  | 'in_person';
export type ExperienceLevel = 'beginner' | 'professional' | 'expert';

// Bloom's Taxonomy levels
export type BloomLevel = 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create';

// =============================================================================
// STEP 1: PROGRAM FOUNDATION
// =============================================================================

// Target Learner Profile (structured per workflow v2.2)
export interface TargetLearnerProfile {
  ageRange: string; // e.g., "25-45 years"
  educationalBackground: string; // min 10 characters
  industrySector: string; // min 5 characters
  experienceLevel: ExperienceLevel; // Beginner (0-2 yrs), Professional (3-7 yrs), Expert (8+ yrs)
}

// Job Role with description and tasks (per workflow v2.2)
export interface JobRole {
  title: string;
  description: string; // 100-1000 words
  tasks: string[]; // Workplace tasks
}

// Credit Framework with credit-awarding flag
export interface CreditFramework {
  isCreditAwarding: boolean; // Yes/No - determines which options are shown
  system?: CreditSystem; // Legacy: backend may send this
  creditSystem: CreditSystem;
  credits?: number; // Only for credit-awarding systems
  totalHours: number;
  contactPercent: number; // 30% for UK/ECTS, 33% for US, customizable
  contactHours: number;
  independentHours: number; // Independent study + assessment
  customContactPercent?: number; // Optional override
}

// International Credit Equivalencies
export interface CreditEquivalencies {
  ukCredits: number;
  ectsCredits: number;
  usSemesterCredits: number;
  totalHours: number;
}

// Delivery Structure (per workflow v2.2)
export interface DeliveryStructure {
  mode: DeliveryMode;
  description: string; // 1-3 sentences describing how program is delivered
  customContactPercent?: number; // Override default if specified
}

export interface Step1ProgramFoundation {
  // Program Identity
  programTitle: string; // 5-100 characters
  programDescription: string; // 50-500 words
  academicLevel: AcademicLevel;

  // Credit Framework
  creditFramework: CreditFramework;
  creditEquivalencies?: CreditEquivalencies;

  // Target Learner (structured)
  targetLearner: TargetLearnerProfile;

  // Delivery
  delivery: DeliveryStructure;

  // Labour Market Rationale
  programPurpose: string; // 50-300 words
  jobRoles: JobRole[]; // min 2 roles with descriptions and tasks

  // Generated Outputs (by AI)
  executiveSummary?: string; // 400-700 words
  programAims?: string[]; // 3-5 strategic intentions
  entryRequirements?: string;
  careerPathways?: string[];

  // Validation
  completenessScore: number;
  validatedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
}

// =============================================================================
// STEP 2: COMPETENCY & KNOWLEDGE FRAMEWORK (KSC)
// Knowledge, Skills, Competencies
// =============================================================================

// Importance levels per workflow v2.2
export type KSCImportance = 'essential' | 'desirable';

export interface KSCItem {
  id: string;
  type: 'knowledge' | 'skill' | 'competency';
  statement: string; // ≤50 words
  description: string;
  importance: KSCImportance;
  source?: string; // Which benchmark this came from
  jobTaskMapping?: string[]; // Links to job tasks from Step 1
}

// Benchmark program for Step 2 (moved from Step 1 per workflow v2.2)
export interface BenchmarkProgram {
  programName: string;
  institution: string;
  url?: string;
  accreditationStatus?: string;
  publicationYear?: number;
}

export interface Step2CompetencyKSC {
  // Input
  benchmarkPrograms: BenchmarkProgram[];
  industryFrameworks?: string[]; // SHRM, PMI, SFIA, CIPD, ASCM
  institutionalFrameworks?: string[]; // Graduate attributes, competency models

  // Generated KSC Items (per workflow v2.2 ratios)
  knowledgeItems: KSCItem[]; // 30-40% of total
  skillItems: KSCItem[]; // 40-50% of total
  competencyItems: KSCItem[]; // 10-30% of total (was attitudeItems)

  // Benchmarking Report
  benchmarkingReport?: {
    programsAnalyzed: BenchmarkProgram[];
    keyFindings: string[];
    coverageAnalysis: string;
  };

  // Validation
  totalItems: number; // 10-30 items
  essentialCount: number;
  validatedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
}

// Legacy alias for backward compatibility
export type KSAItem = KSCItem;
export type Step2CompetencyKSA = Step2CompetencyKSC;

// =============================================================================
// STEP 3: PROGRAM LEARNING OUTCOMES (PLOs)
// Per workflow v2.2: Transform competency framework into 4-8 precise,
// measurable PLOs using Bloom's taxonomy
// =============================================================================

// Outcome emphasis options per workflow v2.2
export type OutcomeEmphasis = 'technical' | 'professional' | 'strategic' | 'mixed';

export interface PLO {
  id: string;
  code: string; // e.g., PLO1, PLO2
  outcomeNumber: number;
  statement: string; // [Verb + Task + Context], ≤25 words
  bloomLevel: BloomLevel;
  verb: string; // The Bloom's verb used

  // Mappings
  linkedKSCs: string[]; // KSC item IDs from Step 2 (competency links)
  jobTaskMapping: string[]; // Connection to workplace requirements from Step 1

  // Assessment
  assessmentAlignment?: string; // How it will be measured
  assessable: boolean;
  measurable: boolean;
}

export interface Step3PLOs {
  // Input Selections (4 Decisions per workflow v2.2)
  bloomLevels: BloomLevel[]; // Must have ≥1 lower + ≥1 higher
  priorityCompetencies: string[]; // Selected Essential KSCs from Step 2
  outcomeEmphasis: OutcomeEmphasis;
  targetCount: number; // 4-8

  // Optional Advanced Controls
  contextConstraints?: string; // Industry context, tools, limits
  preferredVerbs?: string[]; // Bloom-appropriate verbs to favor
  avoidVerbs?: string[]; // Vague verbs like "know", "understand"
  stakeholderPriorities?: string; // Employer/client expectations
  exclusions?: string[]; // Things outcomes must not commit to

  // Generated PLOs
  outcomes: PLO[];

  // Coverage Report
  coverageReport?: {
    competenciesCovered: number;
    totalEssentialCompetencies: number;
    coveragePercent: number; // Must be ≥70%
    bloomDistribution: Record<BloomLevel, number>;
    jobTasksCovered: string[];
    validation: {
      hasLowerLevel: boolean; // At least 1 Understand/Apply
      hasHigherLevel: boolean; // At least 1 Analyze/Evaluate/Create
      noSingleLevelOver50: boolean;
      allUnique: boolean;
      allMeasurable: boolean;
    };
  };

  // Legacy compatibility
  bloomDistribution: Record<BloomLevel, number>;
  configuration: {
    targetCount: number;
    priorityCompetencies: string[];
    outcomeEmphasis: OutcomeEmphasis;
    preferredVerbs?: string[];
    avoidVerbs?: string[];
  };

  validatedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
}

// =============================================================================
// STEP 4: COURSE FRAMEWORK & MLOs
// Per workflow v2.2: Organize program into 6-8 modules with precise hours
// allocation and Module Learning Outcomes that build toward PLOs
// =============================================================================

// Module phase for progressive complexity
export type ModulePhase = 'early' | 'middle' | 'late';

export interface MLO {
  id: string;
  code: string; // e.g., M1-LO1, M2-LO2
  statement: string; // [Verb + Task + Context]
  bloomLevel: BloomLevel;
  verb: string;
  linkedPLOs: string[]; // Which PLOs this MLO builds toward
  linkedKSCs?: string[]; // Which competencies this addresses
  assessmentCriteria?: string[];
}

export interface Topic {
  id: string;
  title: string;
  description: string;
  hours: number;
  sequence: number;
  linkedMLOs?: string[];
}

// Contact activity for module (per workflow v2.2)
export interface ContactActivity {
  type: 'lecture' | 'workshop' | 'tutorial' | 'seminar' | 'lab' | 'discussion';
  title: string;
  hours: number;
}

// Independent study activity
export interface IndependentActivity {
  type: 'reading' | 'practice' | 'assessment' | 'research' | 'project';
  title: string;
  hours: number;
}

export interface Module {
  id: string;
  code: string; // e.g., M1, M2
  title: string;
  description: string;
  sequence: number;

  // Hours breakdown (per workflow v2.2)
  totalHours: number; // Portion of program total
  contactHours: number; // Based on Step 1 percentage (default 30%)
  selfStudyHours: number; // Independent study & assessment (remaining %)

  // Credits
  credits: number;

  // Prerequisites (per workflow v2.2)
  prerequisites: string[]; // Module IDs that must be completed first

  // Linkages
  linkedPLOs: string[];
  mlos: MLO[]; // 2-4 MLOs per module typically

  // Topics
  topics: Topic[];

  // Optional detailed breakdown
  contactActivities?: ContactActivity[];
  independentActivities?: IndependentActivity[];

  // Progressive complexity (enforced per workflow v2.2)
  phase: ModulePhase; // early (1-2), middle (3-5), late (6-8)
  bloomDistribution?: Record<BloomLevel, number>;
}

export interface Step4CourseFramework {
  // Configuration
  moduleCount: number; // 6-8 (default)
  contactHoursPercent: number; // From Step 1 (default 30%)
  deliveryMode?: string; // From Step 1

  // Generated modules
  modules: Module[];

  // Hours validation (CRITICAL per workflow v2.2)
  totalProgramHours: number; // Must match Step 1 exactly
  totalContactHours: number;
  totalIndependentHours: number;
  hoursIntegrity: boolean; // Σ module hours = program hours (exact)
  contactHoursIntegrity: boolean; // Contact hours sum correctly

  // PLO coverage
  ploMapping: Record<string, string[]>; // PLO ID -> MLO IDs
  ploCoveragePercent: number; // All PLOs should map to ≥1 MLO

  // Progressive complexity validation
  progressiveComplexity: {
    earlyModulesValid: boolean; // ≥60% at Understand/Apply
    middleModulesValid: boolean; // Balanced Apply/Analyze
    lateModulesValid: boolean; // ≥30% at Analyze/Evaluate/Create
  };

  // Validation summary
  validationReport?: {
    hoursMatch: boolean;
    contactHoursMatch: boolean;
    allPLOsCovered: boolean;
    progressionValid: boolean;
    noCircularDeps: boolean;
    minMLOsPerModule: boolean;
  };

  validatedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
}

// =============================================================================
// STEP 5: TOPIC-LEVEL SOURCES (AGI STANDARDS)
// =============================================================================
// STEP 5: TOPIC-LEVEL SOURCES (AGI ACADEMIC STANDARDS)
// Per workflow v2.2: Identify, validate, and tag high-quality academic and
// professional sources with APA 7th edition citations
// =============================================================================

// Source categories per AGI Standards (approved sources only)
export type SourceCategory =
  | 'peer_reviewed_journal' // Academic journal article
  | 'academic_textbook' // Published academic textbook
  | 'professional_body' // SHRM, PMI, ASCM, CIPD publications
  | 'open_access' // DOAJ, PubMed, arXiv
  | 'institutional'; // Requires admin approval

// Source type for display purposes
export type SourceType = 'academic' | 'applied' | 'industry';

// Source access status per workflow v2.2
export type SourceAccessStatus =
  | 'agi_library' // Available in AGI Library
  | 'knowledge_base' // Available in system knowledge base
  | 'open_access' // Freely available online
  | 'institutional_subscription' // Requires institutional access
  | 'requires_purchase' // Requires separate purchase
  | 'verified_accessible' // Legacy: AGI Library or open access
  | 'requires_approval' // Institutional subscription needed
  | 'rejected' // Paywalled without license
  | 'flagged_for_review'; // Potential access issue

// AGI Standards compliance badges
export interface AGIComplianceBadges {
  peerReviewed: boolean;
  academicText: boolean;
  professionalBody: boolean;
  recent: boolean; // <5 years
  seminal: boolean; // >5 years with justification
  verifiedAccess: boolean;
  apaValidated: boolean;
}

export interface Source {
  id: string;

  // Bibliographic Information (APA 7th)
  title: string;
  authors: string[];
  year: number;
  edition?: string;
  publisher: string;
  citation: string; // Full APA 7th citation
  doi?: string;
  url?: string;
  isbn?: string;

  // Classification
  category: SourceCategory;
  type: SourceType;
  accessStatus: SourceAccessStatus;

  // AGI Standards Compliance
  complianceBadges: AGIComplianceBadges;
  agiCompliant: boolean;
  complianceNotes?: string;

  // Seminal work handling (for >5 year sources)
  isSeminal?: boolean;
  seminalJustification?: string;
  pairedRecentSourceId?: string; // Required for seminal works

  // Mapping
  relevantTopics: string[];
  linkedMLOs: string[];
  moduleId: string;

  // Quality Indicators
  complexityLevel: 'introductory' | 'intermediate' | 'advanced';
  estimatedReadingHours?: number;
  qualityScore?: number;
  impactFactor?: number; // For journals
  authorCredentialsVerified?: boolean;
}

export interface ModuleSourceSummary {
  moduleId: string;
  moduleTitle: string;
  totalSources: number;
  peerReviewedCount: number;
  peerReviewedPercent: number; // Must be ≥50%
  recentCount: number; // <5 years
  seminalCount: number;
  academicCount: number;
  appliedCount: number;
  totalReadingHours: number;
  allocatedIndependentHours: number;
  allMLOsSupported: boolean;
  agiCompliant: boolean;
}

export interface Step5Sources {
  // Sources organized by module
  sources: Source[];
  sourcesByModule: Record<string, Source[]>;
  moduleSummaries: ModuleSourceSummary[];

  // Overall statistics
  totalSources: number;
  totalPeerReviewed: number;
  peerReviewedPercent: number;
  recentSourcesPercent: number;
  academicAppliedBalance: boolean;

  // Validation (AGI Standards)
  validationReport: {
    allSourcesApproved: boolean; // No prohibited sources
    recencyCompliance: boolean; // All ≤5 years OR justified seminal
    minimumSourcesPerTopic: boolean; // 2-3 per topic
    academicAppliedBalance: boolean; // Each topic has both
    peerReviewRatio: boolean; // ≥50%
    completeCitations: boolean; // All have required fields
    apaAccuracy: boolean; // ≥95% validated
    verifiedAccess: boolean; // All core sources accessible
    noPaywalled: boolean; // No unlicensed paywalled
    everyMLOSupported: boolean; // Each MLO has ≥1 source
    traceabilityComplete: boolean; // Validation log complete
  };

  agiCompliant: boolean;
  complianceIssues: string[];
  adminOverrideRequired?: boolean;
  adminOverrideApprovedBy?: string;
  adminOverrideJustification?: string;

  validatedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
}

// =============================================================================
// STEP 6: READING LISTS
// =============================================================================
// STEP 6: INDICATIVE & ADDITIONAL READING LISTS
// Per workflow v2.2: Transform AGI-validated sources into structured reading
// lists with Core (Indicative) and Supplementary (Additional) classifications
// =============================================================================

// Reading complexity level
export type ReadingComplexity = 'introductory' | 'intermediate' | 'advanced';

// Complexity multipliers for effort estimation (200 words/min base)
export const COMPLEXITY_MULTIPLIERS: Record<ReadingComplexity, number> = {
  introductory: 1.0,
  intermediate: 1.2,
  advanced: 1.5,
};

export interface ReadingItem {
  id: string;
  sourceId: string;
  moduleId: string;

  // Classification (per workflow v2.2)
  category: 'core' | 'supplementary'; // Core = 3-6 per module, Supplementary = 4-8

  // Source details (inherited from Step 5)
  title: string;
  authors: string[];
  year: number;
  citation: string;
  publisher?: string;
  doi?: string;
  url?: string;

  // Specific reading assignment (per workflow feedback)
  specificChapters?: string; // e.g., "Chapter 1: Modeling and Decision Analysis"
  pageRange?: string; // e.g., "pp. 17-24"
  sectionNames?: string[]; // e.g., ["Introduction to Financial Modeling", "Data Validation"]
  notes?: string;

  // Content type indicator
  contentType:
    | 'textbook_chapter'
    | 'journal_article'
    | 'online_article'
    | 'report'
    | 'case_study'
    | 'video'
    | 'other';

  // Reading type (academic vs applied)
  readingType: 'academic' | 'applied' | 'industry'; // For proper tagging

  // Effort estimation (per workflow v2.2)
  estimatedWordCount?: number;
  complexity: ReadingComplexity;
  estimatedReadingMinutes: number; // Calculated: wordCount / 200 × complexity multiplier

  // Study scheduling
  suggestedWeek?: string; // e.g., "Week 1-2" for self-paced
  scheduledDate?: string; // Specific date for cohort mode

  // MLO mapping (required for Core readings)
  linkedMLOs: string[];
  assessmentRelevance: 'high' | 'medium' | 'low';

  // AGI Standards (inherited from Step 5 source)
  agiCompliant: boolean;
  complianceBadges?: {
    peerReviewed: boolean;
    academicText: boolean;
    professionalBody: boolean;
    recent: boolean;
    seminal: boolean;
    verifiedAccess: boolean;
    apaValidated: boolean;
  };

  // Cross-module reference
  isReference?: boolean; // True if this is a reference to another module's reading
  originalModuleId?: string; // "See Module X, Reading Y"
}

export interface ModuleReadingSummary {
  moduleId: string;
  moduleTitle: string;
  coreCount: number; // Should be 3-6
  supplementaryCount: number; // Should be 4-8
  totalReadings: number;
  coreReadingMinutes: number;
  supplementaryReadingMinutes: number;
  totalReadingMinutes: number;
  independentStudyMinutes: number; // Allocated from module hours
  readingTimePercent: number; // Should be ≤100% of independent study
  allCoreMapToMLO: boolean;
  academicAppliedBalance: boolean;
  agiCompliant: boolean;
}

export interface Step6ReadingLists {
  // Readings organized
  readings: ReadingItem[];
  moduleReadings: Record<string, ReadingItem[]>;
  moduleSummaries: ModuleReadingSummary[];

  // Overall counts
  totalReadings: number;
  coreCount: number; // 3-6 per module
  supplementaryCount: number; // 4-8 per module

  // Time totals
  totalCoreMinutes: number;
  totalSupplementaryMinutes: number;
  totalReadingMinutes: number;

  // Validation (per workflow v2.2)
  validationReport: {
    coreCountValid: boolean; // 3-6 per module
    supplementaryCountValid: boolean; // 4-8 per module
    allCoreMapToMLO: boolean; // All Core readings map to ≥1 MLO
    allAGICompliant: boolean; // All sources AGI Standards compliant
    academicAppliedMix: boolean; // Mix of academic and applied
    readingTimeWithinBudget: boolean; // Total ≤ independent study hours
    allAccessible: boolean; // All sources accessible with verified links
  };

  isValid: boolean;
  validationIssues: string[];

  validatedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
}

// =============================================================================
// STEP 7: AUTO-GRADABLE ASSESSMENTS (MCQ-FIRST)
// Per workflow v2.2: Create comprehensive auto-gradable assessment materials
// with MCQ question banks, module quizzes, and final exam blueprint
// =============================================================================

export type QuestionDifficulty = 'easy' | 'medium' | 'hard';

export interface MCQOption {
  id: string;
  text: string;
  isCorrect: boolean;
  // Per workflow v2.2: Why distractor is plausible but incorrect
  explanation: string;
}

export interface MCQQuestion {
  id: string;
  // Clear stem focused on single concept
  stem: string;
  // 4 options (A, B, C, D) - one correct, 3 plausible distractors
  options: MCQOption[];
  correctOption: string; // Option ID

  // Comprehensive rationale (50-100 words per workflow v2.2)
  rationale: string;

  // Metadata tags per workflow v2.2
  linkedMLO: string;
  bloomLevel: BloomLevel;
  difficulty: QuestionDifficulty;
  topicId?: string;
  contentArea?: string;

  // Tracking
  isUsedInQuiz?: boolean;
  isUsedInFinal?: boolean;
}

export interface ClozeQuestion {
  id: string;
  text: string;
  blanks: {
    id: string;
    answer: string;
    alternatives?: string[]; // Accepted synonyms
  }[];
  // Case-insensitive matching
  caseInsensitive: boolean;
  bloomLevel: BloomLevel;
  linkedMLO: string;
  difficulty: QuestionDifficulty;
}

// Per-module assessment settings
export interface ModuleAssessmentSettings {
  moduleId: string;
  moduleTitle: string;
  // Required per workflow v2.2
  mlosCovered: string[]; // Which MLOs to assess
  bloomEmphasis: BloomLevel[]; // Pick 1-2 bands
  // Optional
  contextConstraints?: string;
  preferTerms?: string[];
  avoidTerms?: string[];
}

export interface Quiz {
  id: string;
  moduleId: string;
  moduleTitle: string;
  title: string;
  questions: MCQQuestion[];
  clozeQuestions?: ClozeQuestion[];
  questionCount: number;
  weight: number; // % of total grade
  passMark: number;
  timeLimit?: number; // minutes
  randomized: boolean;
  // Validation
  mlosCovered: string[];
  bloomDistribution: Record<BloomLevel, number>;
}

export interface FinalExam {
  id: string;
  title: string;
  questions: MCQQuestion[];
  clozeQuestions?: ClozeQuestion[];
  questionCount: number;
  weight: number; // % of total grade (typically 30-50%)
  passMark: number;
  timeLimit?: number; // minutes
  randomized: boolean;
  // Proportional representation per workflow v2.2
  moduleDistribution: Record<string, number>; // moduleId -> question count
  // No overlap with quizzes per workflow v2.2
  noQuizOverlap: boolean;
  // All PLOs assessed
  plosCovered: string[];
  bloomDistribution: Record<BloomLevel, number>;
}

export interface AssessmentBlueprint {
  // Weights (must sum to 100%)
  finalExamWeight: number;
  totalQuizWeight: number; // 100 - finalExamWeight
  perQuizWeight: number; // totalQuizWeight / moduleCount

  // Settings
  passMark: number;
  questionsPerQuiz: number;
  questionsForFinal: number;
  bankMultiplier: number; // Default 3×

  // Options
  randomize: boolean;
  enableCloze: boolean;
  clozeCountPerModule?: number;
  timeLimit?: number;
  openBook?: boolean;
  calculatorPermitted?: boolean;
}

// =============================================================================
// NEW: Assessment Generator Contract Types
// =============================================================================

export interface AssessmentUserPreferences {
  assessmentStructure: 'formative_only' | 'summative_only' | 'both_formative_and_summative';
  assessmentBalance:
    | 'mostly_knowledge_based'
    | 'mostly_applied'
    | 'mostly_scenario_based'
    | 'blended_mix';
  certificationStyles: string[];
  academicTypes: string[];
  summativeFormat:
    | 'mcq_exam'
    | 'written_assignment'
    | 'case_study_analysis'
    | 'project_capstone'
    | 'mixed_format'
    | 'user_defined';
  userDefinedSummativeDescription?: string;
  formativeTypesPerUnit: string[];
  formativePerModule: number;
  weightages: {
    formative?: number;
    summative?: number;
    mcqComponents?: number;
    writtenComponents?: number;
    practicalComponents?: number;
    projectCapstone?: number;
  };
  higherOrderPloPolicy: 'yes' | 'no' | 'partial';
  higherOrderPloRules?: string;
  useRealWorldScenarios: boolean;
  alignToWorkplacePerformance: boolean;
  integratedRealWorldSummative: boolean;
}

export interface FormativeAssessment {
  id: string;
  moduleId: string;
  title: string;
  assessmentType: string;
  description: string;
  instructions: string;
  alignedPLOs: string[];
  alignedMLOs: string[];
  assessmentCriteria: string[];
  maxMarks?: number;
  questions?: Array<{
    questionNumber: number;
    questionText: string;
    questionType: 'mcq' | 'short_answer' | 'scenario' | 'calculation' | 'essay';
    options?: string[];
    correctAnswer?: string | number;
    points: number;
    bloomLevel?: string;
    rationale?: string;
  }>;
}

export interface SummativeAssessment {
  id: string;
  scope: 'course_level' | 'module_level';
  moduleId?: string;
  title: string;
  format: string;
  overview: string;
  alignmentTable: Array<{
    ploId: string;
    componentIds: string[];
  }>;
  components: Array<{
    id: string;
    name: string;
    componentType: string;
    weight: number;
    description: string;
  }>;
  markingModel: {
    type: 'criteria_only' | 'full_rubric';
    criteria: Array<{
      name: string;
      description: string;
      weight?: number;
    }>;
    rubricLevels?: Array<{
      levelName: string;
      levelDescriptor: string;
      thresholdMarks?: number;
    }>;
  };
}

export interface MCQSample {
  stem: string;
  options: string[];
  correctOptionIndex: number;
  rationale?: string;
  alignedPLOs?: string[];
}

export interface SJTSample {
  scenario: string;
  options: Array<{
    text: string;
    effectivenessRank?: number;
    isPreferred?: boolean;
  }>;
  guidance?: string;
  alignedPLOs?: string[];
}

export interface CaseSample {
  caseText: string;
  prompts: string[];
  alignedPLOs?: string[];
}

export interface EssaySample {
  promptText: string;
  expectedFocus?: string;
  alignedPLOs?: string[];
}

export interface PracticalSample {
  taskDescription: string;
  evidenceRequired?: string;
  assessmentCriteria?: string[];
  alignedPLOs?: string[];
}

export interface Step7Assessments {
  // User Preferences that drove generation
  userPreferences: AssessmentUserPreferences;

  // Formative Assessments
  formativeAssessments: FormativeAssessment[];

  // Summative Assessments
  summativeAssessments: SummativeAssessment[];

  // Sample Questions Bank
  sampleQuestions: {
    mcq: MCQSample[];
    sjt: SJTSample[];
    caseQuestions: CaseSample[];
    essayPrompts: EssaySample[];
    practicalTasks: PracticalSample[];
  };

  // LMS Packages (logical structures)
  lmsPackages: {
    canvas?: Record<string, any>;
    moodle?: Record<string, any>;
    blackboard?: Record<string, any>;
  };

  // Validation
  validation: {
    allFormativesMapped: boolean;
    allSummativesMapped: boolean;
    weightsSum100: boolean;
    sufficientSampleQuestions: boolean;
    plosCovered: boolean;
  };

  // Metadata
  generatedAt: string;
  validatedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
}

// Form data type for Step 7
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Step7FormData extends AssessmentUserPreferences {}

// =============================================================================
// =============================================================================
// STEP 8: CASE STUDIES (PRACTICE, DISCUSSION, OR ASSESSMENT-READY)
// Per workflow v2.2: Generate realistic, industry-relevant scenarios with
// optional data assets and assessment hooks (NOT assessment questions)
// =============================================================================

// Three case types per workflow v2.2
export type CaseType = 'practice' | 'discussion' | 'assessment_ready';

export type CaseDifficulty = 'entry' | 'intermediate' | 'advanced';

// Case proposal (Stage 1)
export interface CaseProposal {
  id: string;
  moduleId: string;
  title: string;
  abstract: string; // 2-3 sentence summary
  mappingSummary: string;
  caseType: CaseType;
  difficulty: CaseDifficulty;
  isSelected: boolean;
}

// Data asset schema (optional)
export interface DataAssetSchema {
  name: string;
  description: string;
  columns: {
    name: string;
    type: 'string' | 'number' | 'date' | 'boolean';
    description: string;
    sampleValue: string;
  }[];
  sampleRow: Record<string, string | number | boolean>;
}

// Assessment hooks (for Assessment-Ready cases only)
export interface AssessmentHooks {
  // Key Facts: 10-15 atomic statements for future MCQ creation
  keyFacts: string[];
  // Common Misconceptions: 5-8 typical errors for distractor creation
  misconceptions: string[];
  // Decision Points: 3-5 judgment moments for scenario questions
  decisionPoints: string[];
  // Technical Terminology: Domain terms with definitions for glossary
  terminology: { term: string; definition: string }[];
}

// Tier mapping for case complexity (per Ivy League prompt library)
export type CaseTier = 1 | 2 | 3 | 4 | 5;

export interface CaseExhibit {
  id: string;
  title: string;
  description: string;
  type: 'table' | 'chart' | 'document' | 'screenshot' | 'calculation' | 'form';
}

export interface TeachingNote {
  synopsis: string; // 150-200 words
  learningObjectives: string[]; // Mapped to Bloom's levels
  assignmentQuestions: string[]; // 3-5 analysis questions
  sessionPlan: string; // Suggested timing for class use
  answerGuidance: string; // Key points for each question
}

export interface CaseStudy {
  id: string;
  moduleId: string;
  moduleTitle?: string;

  // Basic info
  title: string;
  caseType: CaseType;
  difficulty: CaseDifficulty;
  tier?: CaseTier; // 1=MBA, 2=Masters, 3=UG, 4=Cert/Diploma, 5=Corporate

  // Protagonist details (per Ivy League prompt library)
  protagonistName?: string;
  protagonistRole?: string;

  // Scenario content (word count varies by tier)
  scenario: string;
  wordCount: number;

  // Structured content
  organizationalContext: string;
  backgroundInformation: string;
  challengeDescription: string;
  dataPresentation?: string;

  // Exhibit list (per Ivy League prompt library)
  exhibitList?: CaseExhibit[];
  hasDataAssets: boolean;

  // Data assets (optional - for raw files)
  dataAssets?: DataAssetSchema[];

  // Mapping
  linkedModules: string[];
  linkedMLOs: string[];
  linkedTopics: string[];
  linkedKSCs?: string[];

  // Context
  industryContext: string;
  organizationType?: string;
  brandName: string; // Fictitious default
  isRealBrand: boolean;

  // Assessment hooks (Assessment-Ready cases only)
  assessmentHooks?: AssessmentHooks;
  hasHooks: boolean;

  // Teaching note (per Ivy League prompt library)
  teachingNote?: TeachingNote;

  // Usage guidance
  suggestedTiming?: string; // e.g., "After Module 5 core readings"
  estimatedDuration?: string; // e.g., "90 min individual + 30 min group"
  learningApplication?: string;
  prerequisiteKnowledge?: string;

  // For Practice cases
  suggestedApproach?: string;
  sampleSolution?: string;

  // For Discussion cases
  discussionPrompts?: string[];
  participationCriteria?: string;

  // Ethics compliance
  ethicsCompliant: boolean;
  noPII: boolean;
  anonymized: boolean;
}

export interface Step8CaseStudies {
  // Two-stage process per workflow v2.2
  stage: 'proposals' | 'development' | 'complete';

  // Stage 1: Proposals
  proposals: CaseProposal[];
  selectedProposals: string[]; // IDs of selected proposals

  // Stage 2: Full Development
  caseStudies: CaseStudy[];

  // Organization
  moduleCoverage: Record<string, CaseStudy[]>;
  casesByType: Record<CaseType, CaseStudy[]>;

  // Counts
  totalCases: number;
  practiceCount: number;
  discussionCount: number;
  assessmentReadyCount: number;

  // Validation per workflow v2.2
  validationReport: {
    allMappedToModule: boolean; // Each case maps to ≥1 module
    allMappedToMLO: boolean; // Each case maps to ≥1 MLO
    wordCountValid: boolean; // 400-800 words
    ethicsCompliant: boolean; // No PII, brands anonymized
    hooksComplete: boolean; // Assessment-Ready cases have hooks
    noAssessmentQuestions: boolean; // Hooks only, no MCQs
  };

  isValid: boolean;
  validationIssues: string[];

  validatedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
}

// =============================================================================
// STEP 9: GLOSSARY (AUTO-GENERATED)
// =============================================================================
// STEP 9: GLOSSARY (AUTO-GENERATED, NO SME INPUT)
// Per workflow v2.2: Automatically create comprehensive terminology reference
// by identifying and defining all key terms used throughout curriculum
// =============================================================================

// Term priority level per workflow v2.2
export type TermPriority = 'must_include' | 'should_include' | 'optional';

// Term source for harvesting
export type TermSource =
  | 'competency_framework' // Step 2
  | 'plos' // Step 3
  | 'mlos' // Step 4
  | 'assessment' // Step 7
  | 'reading_list' // Steps 5-6
  | 'case_study' // Step 8
  | 'program_description'; // Step 1

export interface GlossaryTerm {
  id: string;
  term: string;

  // Main Definition (20-40 words per workflow v2.2)
  definition: string;
  wordCount: number; // Should be 20-40

  // Optional elements per workflow v2.2
  exampleSentence?: string; // Demonstrates authentic usage (20 words)
  technicalNote?: string; // Additional detail for advanced learners

  // Cross-References per workflow v2.2
  relatedTerms?: string[]; // Related terms
  broaderTerms?: string[]; // More general concepts
  narrowerTerms?: string[]; // More specific concepts
  synonyms?: string[];

  // Acronym handling
  isAcronym: boolean;
  acronymExpansion?: string; // Full form if this is an acronym
  acronymForm?: string; // Acronym if this is a full term

  // Categorization
  category: string;
  priority: TermPriority;

  // Source tracking
  sources: TermSource[];
  sourceModules: string[];
  sourceOutcomes?: string[]; // PLO/MLO IDs where term appears
  usedInAssessment: boolean; // Must include if true

  // Accessibility per workflow v2.2
  readingLevel?: string; // Grade level
  pronunciationGuide?: string;
}

export interface ModuleTermList {
  moduleId: string;
  moduleTitle: string;
  terms: GlossaryTerm[];
  termCount: number;
}

export interface Step9Glossary {
  // Terms collection
  terms: GlossaryTerm[];
  totalTerms: number;

  // Organization
  categories: string[];
  termsByCategory: Record<string, GlossaryTerm[]>;

  // Module-Linked Keyword Lists (Deliverable Format 2)
  moduleTermLists: ModuleTermList[];

  // Acronyms
  acronyms: GlossaryTerm[];
  acronymCount: number;

  // Statistics
  assessmentTermsCount: number; // 100% must be included
  essentialCompetencyTermsCount: number;
  averageDefinitionLength: number; // Should be 20-40

  // Validation per workflow v2.2
  validationReport: {
    allAssessmentTermsIncluded: boolean; // 100% of assessment terms
    definitionLengthValid: boolean; // All 20-40 words
    noCircularDefinitions: boolean;
    allCrossReferencesValid: boolean;
    ukEnglishConsistent: boolean;
    allTermsMappedToModule: boolean; // Every term maps to ≥1 module
    noDuplicateEntries: boolean; // Canonical with synonyms
  };

  isValid: boolean;
  validationIssues: string[];

  // Export formats available per workflow v2.2
  exportFormats: {
    alphabeticalPDF: boolean;
    moduleLinkedPDF: boolean;
    lmsImport: boolean;
    spreadsheet: boolean;
    mobileWeb: boolean;
  };

  // Metadata
  generatedAt: string;
  programType?: 'certificate' | 'diploma'; // Affects typical size
  typicalSize?: string; // "30-50 terms" for certificate, "50-80" for diploma
}

// =============================================================================
// STEP 10: LESSON PLANS & PPT GENERATION
// =============================================================================

export interface LessonActivity {
  activityId: string;
  sequenceOrder: number;
  type:
    | 'mini_lecture'
    | 'discussion'
    | 'demonstration'
    | 'practice'
    | 'role_play'
    | 'case_analysis'
    | 'group_work'
    | 'assessment'
    | 'break';
  title: string;
  description: string;
  duration: number; // minutes
  teachingMethod: string;
  resources: string[];
  instructorActions: string[];
  studentActions: string[];
}

export interface FormativeCheck {
  checkId: string;
  type: 'mcq' | 'quick_poll' | 'discussion_question' | 'reflection';
  question: string;
  options?: string[];
  correctAnswer?: string;
  explanation?: string;
  linkedMLO: string;
  duration: number; // minutes
}

export interface ReadingAssignment {
  title: string;
  authors: string[];
  year: number;
  citation: string;
  estimatedMinutes: number;
}

export interface CaseStudyActivity {
  caseStudyId: string;
  caseTitle: string;
  activityType: 'practice' | 'discussion' | 'assessment_ready';
  duration: number;
  learningPurpose: string;
  linkedMLOs: string[];
  linkedPLOs: string[];
  instructorInstructions: string;
  studentOutputExpectations: string[];
  assessmentHooks: {
    keyFacts: string[];
    misconceptions: string[];
    decisionPoints: string[];
  };
  rolePlay?: {
    characterBriefs: any[];
    decisionPrompts: string[];
    debriefQuestions: string[];
  };
  isFirstAppearance: boolean;
  previousAppearanceRef?: string;
}

export interface LessonPlan {
  lessonId: string;
  lessonNumber: number;
  lessonTitle: string;
  duration: number; // minutes (60-180)

  // Learning alignment
  linkedMLOs: string[];
  linkedPLOs: string[];
  bloomLevel: string;

  // Objectives
  objectives: string[];

  // Activity sequence
  activities: LessonActivity[];

  // Materials
  materials: {
    pptDeckRef: string;
    caseFiles: string[];
    readingReferences: ReadingAssignment[];
  };

  // Instructor guidance
  instructorNotes: {
    pedagogicalGuidance: string;
    pacingSuggestions: string;
    adaptationOptions: string[];
    commonMisconceptions: string[];
    discussionPrompts: string[];
  };

  // Independent study
  independentStudy: {
    coreReadings: ReadingAssignment[];
    supplementaryReadings: ReadingAssignment[];
    estimatedEffort: number; // minutes
  };

  // Integrated case study (if applicable)
  caseStudyActivity?: CaseStudyActivity;

  // Formative checks
  formativeChecks: FormativeCheck[];
}

export interface PPTDeckReference {
  deckId: string;
  lessonId: string;
  slideCount: number;
  pptxPath?: string;
  pdfPath?: string;
  imagesPath?: string;
}

export interface ModuleLessonPlan {
  moduleId: string;
  moduleCode: string;
  moduleTitle: string;
  totalContactHours: number;
  totalLessons: number;
  lessons: LessonPlan[];
  pptDecks: PPTDeckReference[];
}

export interface Step10LessonPlans {
  moduleLessonPlans: ModuleLessonPlan[];

  validation: {
    allModulesHaveLessonPlans: boolean;
    allLessonDurationsValid: boolean;
    totalHoursMatch: boolean;
    allMLOsCovered: boolean;
    caseStudiesIntegrated: boolean;
    assessmentsIntegrated: boolean;
  };

  summary: {
    totalLessons: number;
    totalContactHours: number;
    averageLessonDuration: number;
    caseStudiesIncluded: number;
    formativeChecksIncluded: number;
  };

  generatedAt: Date;
  validatedAt?: Date;
  approvedAt?: Date;
  approvedBy?: string;
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
  step10?: Step10LessonPlans;

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
  // Program Identity
  programTitle: string;
  programDescription: string;
  academicLevel: AcademicLevel;

  // Credit Framework
  isCreditAwarding: boolean;
  creditSystem: CreditSystem;
  credits?: number; // Only if isCreditAwarding = true
  totalHours?: number; // Only if isCreditAwarding = false (non_credit)
  customContactPercent?: number; // Optional override (default 30% UK/ECTS, 33% US)

  // Target Learner Profile (structured)
  targetLearnerAgeRange: string;
  targetLearnerEducationalBackground: string;
  targetLearnerIndustrySector: string;
  targetLearnerExperienceLevel: ExperienceLevel;

  // Delivery
  deliveryMode: DeliveryMode;
  deliveryDescription: string; // 1-3 sentences

  // Labour Market
  programPurpose: string;
  jobRoles: JobRole[]; // Expanded with description and tasks
}

export interface Step2FormData {
  benchmarkPrograms?: BenchmarkProgram[];
  industryFrameworks?: string[];
  institutionalFrameworks?: string[];
  knowledgeBaseSources?: string[];
  uploadedFrameworks?: { id: string; name: string; fileName: string }[];
}

export interface Step3FormData {
  // 4 Required Decisions (per workflow v2.2)
  bloomLevels: BloomLevel[]; // Choose ≥2, must have lower + higher
  priorityCompetencies?: string[]; // Essential KSCs from Step 2
  outcomeEmphasis: OutcomeEmphasis; // technical | professional | strategic | mixed
  targetCount: number; // 4-8 (default 6)

  // Optional Advanced Controls
  contextConstraints?: string; // Industry context, tools, limits
  preferredVerbs?: string[]; // Bloom-appropriate verbs to favor
  avoidVerbs?: string[]; // Vague verbs like "know", "understand"
  stakeholderPriorities?: string; // Employer/client expectations
  exclusions?: string[]; // Things outcomes must not commit to
}

// Step 7 Form Data per workflow v2.2
// =============================================================================
// UI HELPER TYPES
// =============================================================================
export const STEP_NAMES: Record<WorkflowStep, string> = {
  1: 'Program Foundation',
  2: 'Competency Framework (KSC)',
  3: 'Program Learning Outcomes',
  4: 'Course Framework & MLOs',
  5: 'Topic-Level Sources',
  6: 'Reading Lists',
  7: 'Auto-Gradable Assessments',
  8: 'Case Studies',
  9: 'Glossary',
  10: 'Lesson Plans & PPT',
};

export const STEP_DESCRIPTIONS: Record<WorkflowStep, string> = {
  1: 'Define program basics: title, level, credits, and target audience',
  2: 'Generate Knowledge, Skills, and Competencies (KSC) framework',
  3: "Create measurable Program Learning Outcomes using Bloom's Taxonomy",
  4: 'Structure modules, topics, and Module Learning Outcomes',
  5: 'Assign AGI-compliant academic sources to topics',
  6: 'Create core and supplementary reading lists per module',
  7: 'Generate MCQ-first auto-gradable assessments and quizzes',
  8: 'Create engagement hooks and case study scenarios',
  9: 'Auto-generate glossary from all curriculum content',
  10: 'Generate detailed lesson plans and PowerPoint decks',
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
  10: '10-15 min',
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

// =============================================================================
// STEP 1 HELPER CONSTANTS (Workflow v2.2)
// =============================================================================

export const ACADEMIC_LEVELS: { value: AcademicLevel; label: string; description: string }[] = [
  {
    value: 'certificate',
    label: 'Certificate',
    description: 'Short-form credential (30-60 credits)',
  },
  {
    value: 'micro-credential',
    label: 'Micro-Credential',
    description: 'Focused skill (10-30 credits)',
  },
  { value: 'diploma', label: 'Diploma', description: 'Comprehensive program (60-120 credits)' },
];

export const CREDIT_SYSTEMS: {
  value: CreditSystem;
  label: string;
  hoursPerCredit: number;
  defaultContactPercent: number;
  description: string;
}[] = [
  {
    value: 'uk',
    label: 'UK Credits',
    hoursPerCredit: 10,
    defaultContactPercent: 30, // 30% default per workflow
    description: '1 UK credit = 10 hours total workload',
  },
  {
    value: 'ects',
    label: 'ECTS (Bologna Process)',
    hoursPerCredit: 25,
    defaultContactPercent: 30, // 30% default per workflow
    description: '1 ECTS = 25 hours total workload',
  },
  {
    value: 'us_semester',
    label: 'US Semester Credits',
    hoursPerCredit: 45,
    defaultContactPercent: 33, // 33% DEFINED ratio (not default)
    description: '1 US credit = 15 contact + 30 independent = 45 total hours',
  },
  {
    value: 'non_credit',
    label: 'Non-Credit (Direct Hours)',
    hoursPerCredit: 1,
    defaultContactPercent: 30,
    description: 'Direct hours entry (20-500 hours)',
  },
];

export const DELIVERY_MODES: {
  value: DeliveryMode;
  label: string;
  typicalContactPercent: string;
}[] = [
  { value: 'online_self_study', label: 'Online Self-Study', typicalContactPercent: '10-20%' },
  { value: 'online_facilitated', label: 'Online Facilitated', typicalContactPercent: '15-30%' },
  { value: 'hybrid_blended', label: 'Hybrid/Blended', typicalContactPercent: '20-40%' },
  { value: 'in_person', label: 'In-Person', typicalContactPercent: '30-50%' },
];

export const EXPERIENCE_LEVELS: { value: ExperienceLevel; label: string; years: string }[] = [
  { value: 'beginner', label: 'Beginner', years: '0-2 years' },
  { value: 'professional', label: 'Professional', years: '3-7 years' },
  { value: 'expert', label: 'Expert', years: '8+ years' },
];

// Credit Equivalencies Helper (per workflow v2.2 Appendix C)
export function calculateCreditEquivalencies(
  system: CreditSystem,
  credits: number,
  totalHours?: number
): CreditEquivalencies {
  let hours: number;

  if (system === 'non_credit') {
    hours = totalHours || 120;
  } else {
    const systemConfig = CREDIT_SYSTEMS.find((s) => s.value === system);
    hours = credits * (systemConfig?.hoursPerCredit || 10);
  }

  return {
    ukCredits: Math.round(hours / 10),
    ectsCredits: Math.round(hours / 25),
    usSemesterCredits: Math.round(hours / 45),
    totalHours: hours,
  };
}

// Contact Hours Calculator
export function calculateContactHours(
  totalHours: number,
  system: CreditSystem,
  customPercent?: number
): { contactHours: number; independentHours: number; contactPercent: number } {
  const systemConfig = CREDIT_SYSTEMS.find((s) => s.value === system);
  const contactPercent = customPercent || systemConfig?.defaultContactPercent || 30;

  const contactHours = Math.round(totalHours * (contactPercent / 100));
  const independentHours = totalHours - contactHours;

  return { contactHours, independentHours, contactPercent };
}
