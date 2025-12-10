/**
 * CurriculumWorkflow Model
 * Implements the 9-Step AI-Integrated Curriculum Generator Workflow v2.2
 *
 * Steps:
 * 1. Program Foundation (15-20 min)
 * 2. Competency & Knowledge Framework - KSA (10-15 min)
 * 3. Program Learning Outcomes - PLOs (15-20 min)
 * 4. Course Framework & MLOs (25-30 min)
 * 5. Topic-Level Sources - AGI Standards (10 min)
 * 6. Reading Lists (8 min)
 * 7. Auto-Gradable Assessments - MCQ-First (15-20 min)
 * 8. Case Studies (10-15 min)
 * 9. Glossary - Auto-Generated (5 min)
 *
 * Total: 2-3 hours of SME time
 */

import mongoose, { Schema, Document } from 'mongoose';

// ============================================================================
// INTERFACES
// ============================================================================

export interface ICurriculumWorkflow extends Document {
  // Identity
  projectName: string;
  createdBy: mongoose.Types.ObjectId;

  // Current State
  currentStep: number; // 1-9
  status: string;

  // Step 1: Program Foundation
  step1?: {
    programTitle: string;
    programDescription: string;
    academicLevel: 'certificate' | 'micro-credential' | 'diploma';

    creditFramework: {
      system: 'uk_credits' | 'ects' | 'us_semester' | 'non_credit';
      credits?: number;
      totalHours: number;
      contactHoursPercent: number;
      contactHours: number;
      independentHours: number;
    };

    // Can be string (simple) or object (complex)
    targetLearner:
      | string
      | {
          ageRange: string;
          educationalBackground: string;
          industrySector: string;
          experienceLevel: 'beginner' | 'professional' | 'expert';
        };

    delivery: {
      mode:
        | 'online_self_study'
        | 'online_facilitated'
        | 'hybrid_blended'
        | 'in_person'
        | 'online'
        | 'blended'
        | 'on-campus';
      description: string;
      customContactHoursPercent?: number;
    };

    programPurpose: string;
    // Can be string array (simple) or object array (complex)
    jobRoles:
      | string[]
      | Array<{
          title: string;
          description: string;
          tasks: string[];
        }>;

    // Generated
    executiveSummary?: string;
    programAims?: string[];
    entryRequirements?: string;
    careerPathways?: string[];

    completenessScore: number;
    validatedAt?: Date;
    approvedAt?: Date;
    approvedBy?: mongoose.Types.ObjectId;
  };

  // Step 2: Competency & Knowledge Framework (KSA)
  step2?: {
    benchmarkPrograms: Array<{
      programName: string;
      institution: string;
      url?: string;
      accreditationStatus?: string;
      publicationYear?: number;
    }>;
    industryFrameworks?: string[];
    institutionalFrameworks?: string[];

    knowledgeItems: Array<{
      id: string;
      statement: string;
      description: string;
      importance: 'essential' | 'desirable';
      sourceProgram?: string;
      jobTaskMapping?: string[];
    }>;

    skillItems: Array<{
      id: string;
      statement: string;
      description: string;
      importance: 'essential' | 'desirable';
      sourceProgram?: string;
      jobTaskMapping?: string[];
    }>;

    attitudeItems: Array<{
      id: string;
      statement: string;
      description: string;
      importance: 'essential' | 'desirable';
      sourceProgram?: string;
      jobTaskMapping?: string[];
    }>;

    benchmarkingReport?: {
      programsAnalyzed: string[];
      keyFindings: string[];
      coverageAnalysis: string;
    };

    totalItems: number;
    essentialCount: number;
    validatedAt?: Date;
    approvedAt?: Date;
    approvedBy?: mongoose.Types.ObjectId;
  };

  // Step 3: Program Learning Outcomes (PLOs)
  step3?: {
    bloomLevels: string[];
    priorityCompetencies: string[];
    outcomeEmphasis: 'technical' | 'professional' | 'strategic' | 'mixed';
    targetCount: number;

    contextConstraints?: string;
    preferredVerbs?: string[];
    avoidVerbs?: string[];
    stakeholderPriorities?: string;
    exclusions?: string[];

    outcomes: Array<{
      id: string;
      outcomeNumber: number;
      statement: string;
      bloomLevel: string;
      competencyLinks: string[];
      jobTaskMapping: string[];
      assessmentAlignment?: string;
    }>;

    coverageReport?: {
      competenciesCovered: number;
      coveragePercent: number;
      bloomDistribution: Record<string, number>;
      jobTasksCovered: string[];
    };

    validatedAt?: Date;
    approvedAt?: Date;
    approvedBy?: mongoose.Types.ObjectId;
  };

  // Step 4: Course Framework & Module Learning Outcomes
  step4?: {
    modules: Array<{
      id: string;
      moduleCode: string;
      title: string;
      sequenceOrder: number;
      totalHours: number;
      contactHours: number;
      independentHours: number;
      isCore: boolean;
      prerequisites: string[];

      mlos: Array<{
        id: string;
        outcomeNumber: number;
        statement: string;
        bloomLevel: string;
        linkedPLOs: string[];
        competencyLinks: string[];
      }>;

      contactActivities?: string[];
      independentActivities?: string[];
    }>;

    totalProgramHours: number;
    totalContactHours: number;
    totalIndependentHours: number;

    ploModuleMapping: Array<{
      ploId: string;
      moduleIds: string[];
    }>;

    progressiveComplexity: {
      earlyModulesLowerLevel: boolean;
      laterModulesHigherLevel: boolean;
    };

    hoursIntegrity: boolean;
    validatedAt?: Date;
    approvedAt?: Date;
    approvedBy?: mongoose.Types.ObjectId;
  };

  // Step 5: Topic-Level Sources (AGI Standards)
  step5?: {
    topicSources: Array<{
      id: string;
      topic: string;
      moduleId: string;
      sources: Array<{
        id: string;
        authors: string;
        year: number;
        title: string;
        publisher: string;
        doi?: string;
        url?: string;
        apaCitation: string;
        sourceType: 'peer_reviewed' | 'academic_text' | 'professional_body' | 'open_access';
        isRecent: boolean;
        isSeminal: boolean;
        seminalJustification?: string;
        recentPairing?: string;
        isVerified: boolean;
        isAccessible: boolean;
        apaValidated: boolean;
        mloIds: string[];
        classification: 'academic' | 'applied';
      }>;
    }>;

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
      apaAccuracy: number;
    };

    agiCompliant: boolean;
    complianceIssues: string[];
    adminOverrideRequired: boolean;
    adminOverrideJustification?: string;
    adminOverrideApprovedBy?: mongoose.Types.ObjectId;

    validatedAt?: Date;
    approvedAt?: Date;
    approvedBy?: mongoose.Types.ObjectId;
  };

  // Step 6: Reading Lists
  step6?: {
    moduleReadingLists: Array<{
      moduleId: string;
      coreReadings: Array<{
        id: string;
        sourceId: string;
        citation: string;
        estimatedMinutes: number;
        complexityLevel: 'introductory' | 'intermediate' | 'advanced';
        suggestedWeek?: string;
        mloIds: string[];
        assessmentRelevance: 'high' | 'medium' | 'low';
      }>;
      supplementaryReadings: Array<{
        id: string;
        sourceId: string;
        citation: string;
        estimatedMinutes: number;
        complexityLevel: 'introductory' | 'intermediate' | 'advanced';
        suggestedWeek?: string;
        mloIds: string[];
        assessmentRelevance: 'high' | 'medium' | 'low';
      }>;
      totalReadingTime: number;
    }>;

    crossModuleRefs: Array<{
      sourceId: string;
      firstModuleId: string;
      subsequentModuleIds: string[];
    }>;

    allModulesHaveCoreReadings: boolean;
    allCoreMapToMlos: boolean;
    readingTimeWithinBudget: boolean;

    validatedAt?: Date;
    approvedAt?: Date;
    approvedBy?: mongoose.Types.ObjectId;
  };

  // Step 7: Comprehensive Assessment Generation (Assessment Generator Contract)
  step7?: {
    // User Preferences that drove generation
    userPreferences: {
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
      assessmentMappingStrategy: 'hybrid';
      higherOrderPloPolicy: 'yes' | 'no' | 'partial';
      higherOrderPloRules?: string;
      useRealWorldScenarios: boolean;
      alignToWorkplacePerformance: boolean;
      integratedRealWorldSummative: boolean;
      generateSampleQuestions: boolean;
    };

    // Formative Assessments
    formativeAssessments: Array<{
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
    }>;

    // Summative Assessments
    summativeAssessments: Array<{
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
    }>;

    // Sample Questions Bank
    sampleQuestions: {
      mcq: Array<{
        stem: string;
        options: string[];
        correctOptionIndex: number;
        rationale?: string;
        alignedPLOs?: string[];
      }>;
      sjt: Array<{
        scenario: string;
        options: Array<{
          text: string;
          effectivenessRank?: number;
          isPreferred?: boolean;
        }>;
        guidance?: string;
        alignedPLOs?: string[];
      }>;
      caseQuestions: Array<{
        caseText: string;
        prompts: string[];
        alignedPLOs?: string[];
      }>;
      essayPrompts: Array<{
        promptText: string;
        expectedFocus?: string;
        alignedPLOs?: string[];
      }>;
      practicalTasks: Array<{
        taskDescription: string;
        evidenceRequired?: string;
        assessmentCriteria?: string[];
        alignedPLOs?: string[];
      }>;
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
    generatedAt: Date;
    validatedAt?: Date;
    approvedAt?: Date;
    approvedBy?: mongoose.Types.ObjectId;
  };

  // Step 8: Case Studies
  step8?: {
    caseStudies: Array<{
      id: string;
      type: 'practice' | 'discussion' | 'assessment_ready';
      title: string;
      industryContext: string;
      organizationName: string;
      scenario: string;
      moduleIds: string[];
      mloIds: string[];
      difficultyLevel: 'entry' | 'intermediate' | 'advanced';

      dataAssets?: Array<{
        name: string;
        description: string;
        schema: {
          columns: string[];
          types: string[];
          sampleRow: string[];
        };
        filePath?: string;
      }>;

      hooks?: {
        keyFacts: string[];
        misconceptions: string[];
        decisionPoints: string[];
        terminology: Array<{
          term: string;
          definition: string;
        }>;
      };

      noPII: boolean;
      brandsAnonymized: boolean;
    }>;

    validation: {
      allMapToModules: boolean;
      allMapToMlos: boolean;
      allWithinWordLimit: boolean;
      allEthicsCompliant: boolean;
      hooksProvidedForAssessmentReady: boolean;
    };

    validatedAt?: Date;
    approvedAt?: Date;
    approvedBy?: mongoose.Types.ObjectId;
  };

  // Step 9: Glossary (Auto-Generated)
  step9?: {
    entries: Array<{
      id: string;
      term: string;
      definition: string;
      exampleSentence?: string;
      technicalNote?: string;
      relatedTerms: string[];
      broaderTerms: string[];
      narrowerTerms: string[];
      synonyms: string[];
      moduleIds: string[];
      source: 'assessment' | 'competency' | 'outcome' | 'reading' | 'case_study' | 'description';
    }>;

    totalTerms: number;
    assessmentTermsCount: number;
    competencyTermsCount: number;

    validation: {
      allAssessmentTermsIncluded: boolean;
      allDefinitionsWithinLimit: boolean;
      noCircularDefinitions: boolean;
      allCrossRefsValid: boolean;
      consistentSpelling: boolean;
      allMappedToModules: boolean;
    };

    generatedAt: Date;
  };

  // Step Progress Tracking
  stepProgress: Array<{
    step: number;
    status: 'pending' | 'in_progress' | 'completed' | 'approved';
    startedAt?: Date;
    completedAt?: Date;
    approvedAt?: Date;
    approvedBy?: mongoose.Types.ObjectId;
    reviewTimeMinutes?: number;
  }>;

  // Timeline
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;

  // Metrics
  totalTimeSpentMinutes?: number;
  estimatedCompletionDate?: Date;

  // Methods
  advanceStep(): Promise<void>;
  approveCurrentStep(userId: string): Promise<void>;
  calculateProgress(): number;
}

// ============================================================================
// SCHEMA
// ============================================================================

const CurriculumWorkflowSchema = new Schema<ICurriculumWorkflow>(
  {
    projectName: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 200,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    currentStep: {
      type: Number,
      min: 1,
      max: 9,
      default: 1,
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: [
        'draft',
        'step1_pending',
        'step1_complete',
        'step2_pending',
        'step2_complete',
        'step3_pending',
        'step3_complete',
        'step4_pending',
        'step4_complete',
        'step5_pending',
        'step5_complete',
        'step6_pending',
        'step6_complete',
        'step7_pending',
        'step7_complete',
        'step8_pending',
        'step8_complete',
        'step9_pending',
        'step9_complete',
        'review_pending',
        'published',
      ],
      default: 'draft',
      required: true,
      index: true,
    },

    // Step 1: Program Foundation
    step1: {
      type: Schema.Types.Mixed,
      default: undefined,
    },

    // Step 2: Competency & Knowledge Framework (KSA)
    step2: {
      type: Schema.Types.Mixed,
      default: undefined,
    },

    // Step 3: Program Learning Outcomes (PLOs)
    step3: {
      type: Schema.Types.Mixed,
      default: undefined,
    },

    // Step 4: Course Framework & Module Learning Outcomes
    step4: {
      type: Schema.Types.Mixed,
      default: undefined,
    },

    // Step 5: Topic-Level Sources (AGI Standards)
    step5: {
      type: Schema.Types.Mixed,
      default: undefined,
    },

    // Step 6: Reading Lists
    step6: {
      type: Schema.Types.Mixed,
      default: undefined,
    },

    // Step 7: Auto-Gradable Assessments (MCQ-First)
    step7: {
      type: Schema.Types.Mixed,
      default: undefined,
    },

    // Step 8: Case Studies
    step8: {
      type: Schema.Types.Mixed,
      default: undefined,
    },

    // Step 9: Glossary (Auto-Generated)
    step9: {
      type: Schema.Types.Mixed,
      default: undefined,
    },

    // Step Progress
    stepProgress: [
      {
        step: { type: Number, required: true },
        status: {
          type: String,
          enum: ['pending', 'in_progress', 'completed', 'approved'],
          default: 'pending',
        },
        startedAt: Date,
        completedAt: Date,
        approvedAt: Date,
        approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        reviewTimeMinutes: Number,
      },
    ],

    completedAt: Date,
    totalTimeSpentMinutes: Number,
    estimatedCompletionDate: Date,
  },
  {
    timestamps: true,
    collection: 'curriculumworkflows',
  }
);

// ============================================================================
// INDEXES
// ============================================================================

CurriculumWorkflowSchema.index({ createdBy: 1, status: 1 });
CurriculumWorkflowSchema.index({ status: 1, currentStep: 1 });
CurriculumWorkflowSchema.index({ createdAt: -1 });
CurriculumWorkflowSchema.index({ 'step1.programTitle': 'text', projectName: 'text' });

// ============================================================================
// METHODS
// ============================================================================

// Initialize step progress when creating new workflow
CurriculumWorkflowSchema.pre('save', function (next) {
  if (this.isNew && (!this.stepProgress || this.stepProgress.length === 0)) {
    this.stepProgress = [
      { step: 1, status: 'pending' },
      { step: 2, status: 'pending' },
      { step: 3, status: 'pending' },
      { step: 4, status: 'pending' },
      { step: 5, status: 'pending' },
      { step: 6, status: 'pending' },
      { step: 7, status: 'pending' },
      { step: 8, status: 'pending' },
      { step: 9, status: 'pending' },
    ];
  }
  next();
});

// Advance to next step
CurriculumWorkflowSchema.methods.advanceStep = async function (): Promise<void> {
  if (this.currentStep >= 9) {
    throw new Error('Already at final step');
  }

  // Mark current step as completed
  const currentProgress = this.stepProgress.find((p: any) => p.step === this.currentStep);
  if (currentProgress) {
    currentProgress.status = 'completed';
    currentProgress.completedAt = new Date();
  }

  // Move to next step
  this.currentStep += 1;
  this.status = `step${this.currentStep}_pending`;

  // Mark next step as in progress
  const nextProgress = this.stepProgress.find((p: any) => p.step === this.currentStep);
  if (nextProgress) {
    nextProgress.status = 'in_progress';
    nextProgress.startedAt = new Date();
  }

  await this.save();
};

// Approve current step
CurriculumWorkflowSchema.methods.approveCurrentStep = async function (
  userId: string
): Promise<void> {
  const currentProgress = this.stepProgress.find((p: any) => p.step === this.currentStep);
  if (currentProgress) {
    currentProgress.status = 'approved';
    currentProgress.approvedAt = new Date();
    currentProgress.approvedBy = userId;
  }

  // Update step data with approval
  const stepKey = `step${this.currentStep}` as keyof ICurriculumWorkflow;
  if (this[stepKey]) {
    (this[stepKey] as any).approvedAt = new Date();
    (this[stepKey] as any).approvedBy = userId;
  }

  this.status = `step${this.currentStep}_complete`;

  await this.save();
};

// Calculate overall progress
CurriculumWorkflowSchema.methods.calculateProgress = function (): number {
  const completedSteps = this.stepProgress.filter(
    (p: any) => p.status === 'completed' || p.status === 'approved'
  ).length;
  return Math.round((completedSteps / 9) * 100);
};

// Virtual for duration
CurriculumWorkflowSchema.virtual('duration').get(function () {
  if (this.completedAt && this.createdAt) {
    return Math.round((this.completedAt.getTime() - this.createdAt.getTime()) / 60000);
  }
  return null;
});

// ============================================================================
// EXPORT
// ============================================================================

export const CurriculumWorkflow = mongoose.model<ICurriculumWorkflow>(
  'CurriculumWorkflow',
  CurriculumWorkflowSchema
);
