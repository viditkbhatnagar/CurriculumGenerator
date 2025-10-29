import mongoose, { Schema, Document } from 'mongoose';

/**
 * CoursePrompt Model
 * Stores course prompts in the internal library based on AGI SME Submission Template
 * Each prompt includes preset parameters and AGI compliance rules
 */

export interface ICoursePrompt extends Document {
  promptTitle: string;
  courseCode: string; // e.g., "CHRP", "CHRM"
  domain: string; // e.g., "Human Resource Management"
  level: 'bachelor' | 'master' | 'certificate' | 'diploma' | 'certification_prep';
  totalHours: number; // Default: 120
  ectsCredits: number; // Default: 15
  moduleCount: number; // Default: 6-8

  // AGI Template Structure (based on your email)
  agiTemplate: {
    programOverview: {
      aim: string;
      qualificationType: string;
      industryNeed: string[];
      targetAudience: string;
      entryRequirements: string;
      careerOutcomes: string[];
      benchmarking: string; // Comparison with 2-3 similar certifications
    };

    competencyFramework: {
      knowledgeDomains: Array<{
        domain: string; // e.g., "Talent Acquisition", "Performance Management"
        coreSkills: string[]; // 3-5 skills
        workplaceApplications: string[]; // 2-3 examples
        requiredSources: number; // Minimum 2-3 sources per domain
      }>;
    };

    learningOutcomes: {
      count: number; // 5-8 outcomes
      structure: string; // "Verb + Object + Context"
      bloomTaxonomy: string[]; // Approved verbs
      mappingRequired: boolean; // Map to competency domains and modules
    };

    courseFramework: {
      moduleStructure: string; // "6-8 modules, 120 hours total"
      moduleCodeFormat: string; // e.g., "HRM###"
      assessmentTypes: string[]; // MCQs, case studies, etc.
      hoursBreakdown: string; // Reading, activities, assessment time
    };

    sourceRequirements: {
      recencyYears: number; // Default: 5 years
      minimumPerTopic: number; // Default: 2-3
      academicRequired: boolean; // At least 1 academic source
      industryRequired: boolean; // At least 1 industry source
      citationFormat: string; // "APA 7th Edition"
      excludedSources: string[]; // Wikipedia, blogs, social media
    };

    assessmentRequirements: {
      mcqsPerModule: string; // "5-10 MCQs"
      caseStudiesPerModule: string; // "1-2 case questions"
      mcqStructure: string; // "Stem, 4 options, correct answer, rationale"
      caseStudyLength: string; // "150-300 words"
      mappingRequired: boolean; // Map to learning outcomes
    };

    deliverables: {
      excelTabs: string[]; // All required Excel sheet names
      wordGuideRequired: boolean; // Submission guide
      fileNamingConvention: string; // e.g., "CHRP_SMEName_Date"
    };
  };

  // Full AGI Prompt Template (based on your email)
  fullPromptTemplate: string; // Complete prompt text

  // Variants and progression
  variantOf?: mongoose.Types.ObjectId; // Reference to base prompt if this is a variant
  progressionLevel?: string; // e.g., "Foundation", "Advanced", "Expert"
  relatedCourses: mongoose.Types.ObjectId[]; // Related course prompts (e.g., CHRP → CHRM)

  // Metadata
  status: 'active' | 'inactive' | 'draft';
  createdBy: mongoose.Types.ObjectId;
  lastUsed?: Date;
  usageCount: number;

  createdAt: Date;
  updatedAt: Date;
}

const CoursePromptSchema = new Schema<ICoursePrompt>(
  {
    promptTitle: {
      type: String,
      required: true,
      trim: true,
    },

    courseCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },

    domain: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },

    level: {
      type: String,
      enum: ['bachelor', 'master', 'certificate', 'diploma', 'certification_prep'],
      required: true,
      index: true,
    },

    totalHours: {
      type: Number,
      default: 120,
      min: 0,
    },

    ectsCredits: {
      type: Number,
      default: 15,
      min: 0,
    },

    moduleCount: {
      type: Number,
      default: 7,
      min: 6,
      max: 8,
    },

    agiTemplate: {
      programOverview: {
        aim: String,
        qualificationType: String,
        industryNeed: [String],
        targetAudience: String,
        entryRequirements: String,
        careerOutcomes: [String],
        benchmarking: String,
      },

      competencyFramework: {
        knowledgeDomains: [
          {
            domain: String,
            coreSkills: [String],
            workplaceApplications: [String],
            requiredSources: { type: Number, default: 3 },
          },
        ],
      },

      learningOutcomes: {
        count: { type: Number, default: 6 },
        structure: { type: String, default: 'Verb + Object + Context' },
        bloomTaxonomy: [String],
        mappingRequired: { type: Boolean, default: true },
      },

      courseFramework: {
        moduleStructure: { type: String, default: '6-8 modules, 120 hours total' },
        moduleCodeFormat: String,
        assessmentTypes: [String],
        hoursBreakdown: String,
      },

      sourceRequirements: {
        recencyYears: { type: Number, default: 5 },
        minimumPerTopic: { type: Number, default: 3 },
        academicRequired: { type: Boolean, default: true },
        industryRequired: { type: Boolean, default: true },
        citationFormat: { type: String, default: 'APA 7th Edition' },
        excludedSources: [String],
      },

      assessmentRequirements: {
        mcqsPerModule: { type: String, default: '5-10 MCQs' },
        caseStudiesPerModule: { type: String, default: '1-2 case questions' },
        mcqStructure: String,
        caseStudyLength: { type: String, default: '150-300 words' },
        mappingRequired: { type: Boolean, default: true },
      },

      deliverables: {
        excelTabs: [String],
        wordGuideRequired: { type: Boolean, default: true },
        fileNamingConvention: String,
      },
    },

    fullPromptTemplate: {
      type: String,
      required: true,
    },

    variantOf: {
      type: Schema.Types.ObjectId,
      ref: 'CoursePrompt',
    },

    progressionLevel: String,

    relatedCourses: [
      {
        type: Schema.Types.ObjectId,
        ref: 'CoursePrompt',
      },
    ],

    status: {
      type: String,
      enum: ['active', 'inactive', 'draft'],
      default: 'active',
      index: true,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    lastUsed: Date,

    usageCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    collection: 'courseprompts',
  }
);

// Indexes for efficient queries
CoursePromptSchema.index({ domain: 1, level: 1 });
CoursePromptSchema.index({ status: 1, lastUsed: -1 });
CoursePromptSchema.index({ createdAt: -1 });
CoursePromptSchema.index({ usageCount: -1 });

// Pre-save hook to increment usage count
CoursePromptSchema.methods.incrementUsage = async function () {
  this.usageCount += 1;
  this.lastUsed = new Date();
  return this.save();
};

export const CoursePrompt = mongoose.model<ICoursePrompt>('CoursePrompt', CoursePromptSchema);
