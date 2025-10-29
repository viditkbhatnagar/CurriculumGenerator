import mongoose, { Schema, Document } from 'mongoose';

/**
 * PreliminaryCurriculumPackage Model
 * Stores the complete AGI SME Submission output from Stage 2
 * Based on the 14 Excel tabs structure from your AGI template
 */

export interface IPreliminaryCurriculumPackage extends Document {
  projectId: mongoose.Types.ObjectId;

  // Tab 1: Program Overview
  programOverview: {
    programTitle: string;
    aim: string; // 2-3 sentences
    qualificationType: string; // e.g., "Certification Preparation"
    industryNeed: string[]; // 3-4 bullet points with evidence
    targetAudience: string;
    entryRequirements: string;
    duration: string; // e.g., "120 hours self-study"
    careerOutcomes: string[]; // 3-6 job roles/levels
    benchmarking: Array<{
      certName: string;
      issuer: string;
      level: string;
      keyDifferences: string;
    }>;
    ectsJustification: string;
  };

  // Tab 2: Competency & Knowledge Framework
  competencyFramework: {
    knowledgeDomains: Array<{
      domain: string; // e.g., "Talent Acquisition"
      coreSkills: string[]; // 3-5 skills
      workplaceApplications: string[]; // 2-3 examples
      sources: Array<{
        citation: string; // APA 7
        type: 'academic' | 'industry';
        url: string;
        publicationDate: Date;
      }>;
    }>;
  };

  // Tab 3: Learning Outcomes, Assessment Criteria & Competencies
  learningOutcomes: Array<{
    outcomeNumber: number;
    outcome: string; // Verb + Object + Context
    assessmentCriteria: string[]; // 2-4 criteria (active verbs)
    type: 'knowledge' | 'skill' | 'competency';
    bloomLevel: string;
    mappedDomains: string[]; // From Competency Framework
    mappedModules: string[]; // Module codes
  }>;

  // Tab 4: Course Framework
  courseFramework: {
    modules: Array<{
      moduleCode: string; // e.g., "HRM101"
      title: string;
      aim: string; // 1 sentence
      hours: number;
      classification: 'core' | 'elective';
      objectives: string[]; // 3-6, aligned to Learning Outcomes
      keyTopics: string[]; // Bulleted list
      indicativeContent: string[]; // Lesson topics/readings
      assessmentTypes: string[]; // e.g., "formative quizzes", "case analysis"
      assessmentPolicy: {
        weightings: string;
        passThreshold: string;
        reassessmentRules: string;
      };
      selfStudyGuidance: {
        readingHours: number;
        practiceHours: number;
        assessmentHours: number;
      };
    }>;
    mappingTable: Array<{
      moduleCode: string;
      learningOutcomes: number[]; // Outcome numbers
      competencyDomains: string[];
    }>;
  };

  // Tab 5: Topic-Level Sources
  topicSources: Array<{
    topic: string;
    moduleCode: string;
    sources: Array<{
      citation: string; // Full APA 7
      type: 'academic' | 'industry';
      url: string;
      doi?: string;
      linkAccessible: boolean;
      verificationDate: Date;
      explanation: string; // 1 sentence linking to topic and LO
      linkedOutcome?: number;
    }>;
  }>;

  // Tab 6: Indicative & Additional Reading List
  readingList: {
    indicative: Array<{
      citation: string; // APA 7
      type: 'book' | 'guide' | 'report' | 'website';
      synopsis: string; // 1-2 sentences
      estimatedReadingTime: string; // e.g., "2 hours"
      url?: string;
    }>;
    additional: Array<{
      citation: string;
      type: 'book' | 'guide' | 'report' | 'website';
      synopsis: string;
      estimatedReadingTime: string;
      url?: string;
    }>;
  };

  // Tab 7: Assessments & Mapping
  assessments: {
    mcqs: Array<{
      moduleCode: string;
      questionNumber: number;
      stem: string;
      options: {
        A: string;
        B: string;
        C: string;
        D: string;
      };
      correctAnswer: 'A' | 'B' | 'C' | 'D';
      rationale: string; // 1-2 sentences with source
      linkedOutcome: number;
      linkedCriterion: string;
      bloomLevel: string; // application, analysis, evaluation
    }>;
    caseQuestions: Array<{
      moduleCode: string;
      caseNumber: number;
      prompt: string; // 150-300 words
      expectedResponse: string;
      markingRubric: Array<{
        band: string; // e.g., "Excellent", "Good"
        marks: string; // e.g., "15-20"
        descriptor: string;
      }>;
      linkedOutcomes: number[];
      linkedCriteria: string[];
      basedOn?: {
        organisation: string; // Named or anonymised
        year: number;
        source: string;
      };
    }>;
  };

  // Tab 8: Glossary and Key Terms
  glossary: Array<{
    term: string;
    definition: string; // ≤30 words
    citation: string; // APA 7
  }>;

  // Tab 9: Case Studies
  caseStudies: Array<{
    caseNumber: number;
    title: string;
    organisation: string; // Named or anonymised
    description: string; // 150-300 words
    learningTakeaways: string[]; // 2-3 points
    citation: string; // APA 7
    url?: string;
    year: number;
    moduleCode: string;
  }>;

  // Tab 10: Delivery & Digital Tools
  deliveryTools: {
    deliveryMode: string; // e.g., "self-study"
    interactiveElements: string[]; // simulations, quizzes, peer review
    lmsFeatures: string[]; // SCORM/xAPI, progress tracking, etc.
    digitalTools: string[]; // HRIS sandbox, analytics tools
    technicalRequirements: string[]; // Minimum specs
  };

  // Tab 11: References
  references: string[]; // Complete bibliography (APA 7)

  // Tab 12: Review & Metadata (Submission Metadata)
  submissionMetadata: {
    authorName: string;
    professionalCredentials: string;
    organisation?: string;
    submissionDate: Date;
    conflictOfInterest: string;
    reviewerNotes?: string;
    qaChecklist: {
      allTopicsHaveSources: boolean;
      totalHours120: boolean;
      modules6to8: boolean;
      outcomesMeasurable: boolean;
      assessmentsMapped: boolean;
      glossaryComplete: boolean;
      fileNamingCorrect: boolean;
    };
    qaVerificationSummary: string;
    submittedBy: mongoose.Types.ObjectId; // ref: User
    agiCompliant: boolean;
  };

  // Tab 13: Outcome Writing Guide (optional)
  outcomeWritingGuide?: {
    templates: string[];
    exampleOutcomes: string[];
    approvedVerbs: string[];
  };

  // Tab 14: Comparative Benchmarking (optional)
  comparativeBenchmarking?: Array<{
    competitorCert: string;
    issuer: string;
    level: string;
    comparisonNotes: string;
  }>;

  // Chat History (SME interaction during Stage 2)
  chatHistory: Array<{
    role: 'ai' | 'sme';
    content: string;
    componentRef: string; // Which tab/section being discussed
    timestamp: Date;
  }>;

  // Approval tracking
  approvedAt?: Date;
  approvedBy?: mongoose.Types.ObjectId; // ref: User

  createdAt: Date;
  updatedAt: Date;
}

const PreliminaryCurriculumPackageSchema = new Schema<IPreliminaryCurriculumPackage>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'CurriculumProject',
      required: true,
      unique: true,
    },

    // All the AGI template fields
    programOverview: {
      programTitle: String,
      aim: String,
      qualificationType: String,
      industryNeed: [String],
      targetAudience: String,
      entryRequirements: String,
      duration: String,
      careerOutcomes: [String],
      benchmarking: [
        {
          certName: String,
          issuer: String,
          level: String,
          keyDifferences: String,
        },
      ],
      ectsJustification: String,
    },

    competencyFramework: {
      knowledgeDomains: [
        {
          domain: String,
          coreSkills: [String],
          workplaceApplications: [String],
          sources: [
            {
              citation: String,
              type: { type: String, enum: ['academic', 'industry'] },
              url: String,
              publicationDate: Date,
            },
          ],
        },
      ],
    },

    learningOutcomes: [
      {
        outcomeNumber: Number,
        outcome: String,
        assessmentCriteria: [String],
        type: { type: String, enum: ['knowledge', 'skill', 'competency'] },
        bloomLevel: String,
        mappedDomains: [String],
        mappedModules: [String],
      },
    ],

    courseFramework: {
      modules: [
        {
          moduleCode: String,
          title: String,
          aim: String,
          hours: Number,
          classification: { type: String, enum: ['core', 'elective'] },
          objectives: [String],
          keyTopics: [String],
          indicativeContent: [String],
          assessmentTypes: [String],
          assessmentPolicy: {
            weightings: String,
            passThreshold: String,
            reassessmentRules: String,
          },
          selfStudyGuidance: {
            readingHours: Number,
            practiceHours: Number,
            assessmentHours: Number,
          },
        },
      ],
      mappingTable: [
        {
          moduleCode: String,
          learningOutcomes: [Number],
          competencyDomains: [String],
        },
      ],
    },

    topicSources: [
      {
        topic: String,
        moduleCode: String,
        sources: [
          {
            citation: String,
            type: { type: String, enum: ['academic', 'industry'] },
            url: String,
            doi: String,
            linkAccessible: Boolean,
            verificationDate: Date,
            explanation: String,
            linkedOutcome: Number,
          },
        ],
      },
    ],

    readingList: {
      indicative: [
        {
          citation: String,
          type: { type: String, enum: ['book', 'guide', 'report', 'website'] },
          synopsis: String,
          estimatedReadingTime: String,
          url: String,
        },
      ],
      additional: [
        {
          citation: String,
          type: { type: String, enum: ['book', 'guide', 'report', 'website'] },
          synopsis: String,
          estimatedReadingTime: String,
          url: String,
        },
      ],
    },

    assessments: {
      mcqs: [
        {
          moduleCode: String,
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
          linkedCriterion: String,
          bloomLevel: String,
        },
      ],
      caseQuestions: [
        {
          moduleCode: String,
          caseNumber: Number,
          prompt: String,
          expectedResponse: String,
          markingRubric: [
            {
              band: String,
              marks: String,
              descriptor: String,
            },
          ],
          linkedOutcomes: [Number],
          linkedCriteria: [String],
          basedOn: {
            organisation: String,
            year: Number,
            source: String,
          },
        },
      ],
    },

    glossary: [
      {
        term: String,
        definition: String,
        citation: String,
      },
    ],

    caseStudies: [
      {
        caseNumber: Number,
        title: String,
        organisation: String,
        description: String,
        learningTakeaways: [String],
        citation: String,
        url: String,
        year: Number,
        moduleCode: String,
      },
    ],

    deliveryTools: {
      deliveryMode: String,
      interactiveElements: [String],
      lmsFeatures: [String],
      digitalTools: [String],
      technicalRequirements: [String],
    },

    references: [String],

    submissionMetadata: {
      authorName: String,
      professionalCredentials: String,
      organisation: String,
      submissionDate: Date,
      conflictOfInterest: String,
      reviewerNotes: String,
      qaChecklist: {
        allTopicsHaveSources: Boolean,
        totalHours120: Boolean,
        modules6to8: Boolean,
        outcomesMeasurable: Boolean,
        assessmentsMapped: Boolean,
        glossaryComplete: Boolean,
        fileNamingCorrect: Boolean,
      },
      qaVerificationSummary: String,
      submittedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      agiCompliant: Boolean,
    },

    outcomeWritingGuide: {
      templates: [String],
      exampleOutcomes: [String],
      approvedVerbs: [String],
    },

    comparativeBenchmarking: [
      {
        competitorCert: String,
        issuer: String,
        level: String,
        comparisonNotes: String,
      },
    ],

    chatHistory: [
      {
        role: { type: String, enum: ['ai', 'sme'] },
        content: String,
        componentRef: String,
        timestamp: { type: Date, default: Date.now },
      },
    ],

    approvedAt: Date,
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    collection: 'preliminarycurriculumpackages',
  }
);

// Indexes
// projectId has unique constraint in field definition
PreliminaryCurriculumPackageSchema.index({ 'submissionMetadata.agiCompliant': 1 });
PreliminaryCurriculumPackageSchema.index({ approvedAt: -1 });
PreliminaryCurriculumPackageSchema.index({ createdAt: -1 });

export const PreliminaryCurriculumPackage = mongoose.model<IPreliminaryCurriculumPackage>(
  'PreliminaryCurriculumPackage',
  PreliminaryCurriculumPackageSchema
);
