import mongoose, { Schema, Document } from 'mongoose';

/**
 * FullCurriculumPackage Model
 * Stage 4: Stores complete generated curriculum with all materials
 */

export interface IFullCurriculumPackage extends Document {
  projectId: mongoose.Types.ObjectId;
  preliminaryPackageId: mongoose.Types.ObjectId;

  // Module Plans (detailed week-by-week)
  modulePlans: Array<{
    moduleCode: string;
    moduleTitle: string;
    weekByWeek: Array<{
      week: number;
      topics: string[];
      activities: string[];
      assessments: string[];
      readings: string[];
      estimatedHours: number;
    }>;
    assessmentSchedule: Array<{
      type: string;
      dueWeek: number;
      weight: number;
      description: string;
    }>;
  }>;

  // Case Studies (per module: 1-2 each)
  caseStudies: Array<{
    caseId: string;
    moduleCode: string;
    title: string;
    scenarioDescription: string; // 150-300 words
    discussionQuestions: string[];
    rubric: {
      criteria: string[];
      bands: Array<{
        band: string;
        marks: string;
        descriptor: string;
      }>;
    };
    linkedOutcomes: number[];
  }>;

  // Simulations (per module: 1-2 each)
  simulations: Array<{
    simulationId: string;
    moduleCode: string;
    title: string;
    instructions: string;
    scenarioSetup: string;
    requiredActions: string[];
    datasets?: string[]; // File references if needed
    evaluationCriteria: string[];
    expectedDuration: number; // minutes
  }>;

  // MCQ Exams (per module: 5-10 questions each)
  mcqExams: Array<{
    moduleCode: string;
    examTitle: string;
    questions: Array<{
      questionNumber: number;
      stem: string;
      options: {
        A: string;
        B: string;
        C: string;
        D: string;
      };
      correctAnswer: 'A' | 'B' | 'C' | 'D';
      rationale: string;
      linkedOutcome: number;
      bloomLevel: string;
    }>;
    passingScore: number;
    timeLimit?: number; // minutes
  }>;

  // Slide Decks (PPT per module)
  slideDecks: Array<{
    moduleCode: string;
    filePath: string; // Storage reference
    format: 'pdf' | 'pptx';
    slideCount: number;
    topics: string[];
  }>;

  // Source citations (full traceability)
  sourcesCited: Array<{
    materialId: string;
    materialType: string; // 'module_plan', 'case_study', etc.
    citations: string[]; // APA 7
  }>;

  // AGI Compliance validation
  agiCompliance: {
    validated: boolean;
    validatedAt: Date;
    complianceScore: number; // 0-100
    issues: string[];
  };

  // Generation metadata
  generatedAt: Date;
  generatedBy: string; // System identifier
}

const FullCurriculumPackageSchema = new Schema<IFullCurriculumPackage>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'CurriculumProject',
      required: true,
      unique: true,
      index: true,
    },

    preliminaryPackageId: {
      type: Schema.Types.ObjectId,
      ref: 'PreliminaryCurriculumPackage',
      required: true,
    },

    modulePlans: [
      {
        moduleCode: String,
        moduleTitle: String,
        weekByWeek: [
          {
            week: Number,
            topics: [String],
            activities: [String],
            assessments: [String],
            readings: [String],
            estimatedHours: Number,
          },
        ],
        assessmentSchedule: [
          {
            type: String,
            dueWeek: Number,
            weight: Number,
            description: String,
          },
        ],
      },
    ],

    caseStudies: [
      {
        caseId: String,
        moduleCode: String,
        title: String,
        scenarioDescription: String,
        discussionQuestions: [String],
        rubric: {
          criteria: [String],
          bands: [
            {
              band: String,
              marks: String,
              descriptor: String,
            },
          ],
        },
        linkedOutcomes: [Number],
      },
    ],

    simulations: [
      {
        simulationId: String,
        moduleCode: String,
        title: String,
        instructions: String,
        scenarioSetup: String,
        requiredActions: [String],
        datasets: [String],
        evaluationCriteria: [String],
        expectedDuration: Number,
      },
    ],

    mcqExams: [
      {
        moduleCode: String,
        examTitle: String,
        questions: [
          {
            questionNumber: Number,
            stem: String,
            options: {
              A: String,
              B: String,
              C: String,
              D: String,
            },
            correctAnswer: { type: String, enum: ['A', 'B', 'C', 'D'] },
            rationale: String,
            linkedOutcome: Number,
            bloomLevel: String,
          },
        ],
        passingScore: Number,
        timeLimit: Number,
      },
    ],

    slideDecks: [
      {
        moduleCode: String,
        filePath: String,
        format: { type: String, enum: ['pdf', 'pptx'] },
        slideCount: Number,
        topics: [String],
      },
    ],

    sourcesCited: [
      {
        materialId: String,
        materialType: String,
        citations: [String],
      },
    ],

    agiCompliance: {
      validated: Boolean,
      validatedAt: Date,
      complianceScore: Number,
      issues: [String],
    },

    generatedAt: { type: Date, default: Date.now },
    generatedBy: { type: String, default: 'AIResearchService' },
  },
  {
    timestamps: true,
    collection: 'fullcurriculumpackages',
  }
);

// Indexes (projectId has unique constraint in field definition)
FullCurriculumPackageSchema.index({ preliminaryPackageId: 1 });
FullCurriculumPackageSchema.index({ 'agiCompliance.validated': 1 });
FullCurriculumPackageSchema.index({ generatedAt: -1 });

export const FullCurriculumPackage = mongoose.model<IFullCurriculumPackage>(
  'FullCurriculumPackage',
  FullCurriculumPackageSchema
);
