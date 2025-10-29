# Implementation Guide: 5-Stage AI-Integrated Curriculum Workflow

## Document Overview

This guide provides step-by-step implementation instructions for developers to build the new 5-stage AI-integrated curriculum workflow.

**Target Audience:** Backend developers, frontend developers, DevOps engineers

**Prerequisites:**

- Node.js 18+ and TypeScript knowledge
- MongoDB and Mongoose experience
- React/Next.js proficiency
- WebSocket/real-time communication experience
- AI API integration experience (OpenAI, Perplexity, Gemini)

---

## Table of Contents

1. [Implementation Phases](#implementation-phases)
2. [Phase 1: Database & Data Models](#phase-1-database--data-models)
3. [Phase 2: Backend Services](#phase-2-backend-services)
4. [Phase 3: AI Integration](#phase-3-ai-integration)
5. [Phase 4: Frontend Components](#phase-4-frontend-components)
6. [Phase 5: Testing & Deployment](#phase-5-testing--deployment)
7. [API Endpoints Reference](#api-endpoints-reference)
8. [Configuration](#configuration)
9. [Troubleshooting](#troubleshooting)

---

## Implementation Phases

### Timeline Overview

| Phase                               | Duration | Team      | Dependencies |
| ----------------------------------- | -------- | --------- | ------------ |
| **Phase 1:** Database & Data Models | Week 1   | Backend   | None         |
| **Phase 2:** Backend Services       | Week 2-3 | Backend   | Phase 1      |
| **Phase 3:** AI Integration         | Week 2-3 | Backend   | Phase 1      |
| **Phase 4:** Frontend Components    | Week 4-5 | Frontend  | Phase 2, 3   |
| **Phase 5:** Testing & Deployment   | Week 6   | Full Team | All phases   |

---

## Phase 1: Database & Data Models

### 1.1 Create New MongoDB Collections

**Location:** `packages/backend/src/models/`

#### Step 1: Create CoursePrompt Model

**File:** `packages/backend/src/models/CoursePrompt.ts`

```typescript
import mongoose, { Schema, Document } from 'mongoose';

export interface ICoursePrompt extends Document {
  promptTitle: string;
  domain: string;
  level: 'bachelor' | 'master' | 'certificate' | 'diploma';
  totalHours: number;
  ectsCredits: number;
  moduleCount: number;
  learningObjectives: string[];
  targetAudience: string;
  prerequisites: string[];
  curriculumRules: {
    agiCompliance: boolean;
    bloomTaxonomyLevels: string[];
    assessmentTypes: string[];
    sourceRecencyYears: number;
    citationFormat: string;
  };
  status: 'active' | 'inactive' | 'draft';
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CoursePromptSchema = new Schema<ICoursePrompt>(
  {
    promptTitle: { type: String, required: true },
    domain: { type: String, required: true, index: true },
    level: {
      type: String,
      enum: ['bachelor', 'master', 'certificate', 'diploma'],
      required: true,
      index: true,
    },
    totalHours: { type: Number, default: 120 },
    ectsCredits: { type: Number, default: 15 },
    moduleCount: { type: Number, default: 7 },
    learningObjectives: [{ type: String }],
    targetAudience: { type: String },
    prerequisites: [{ type: String }],
    curriculumRules: {
      agiCompliance: { type: Boolean, default: true },
      bloomTaxonomyLevels: [{ type: String }],
      assessmentTypes: [{ type: String }],
      sourceRecencyYears: { type: Number, default: 5 },
      citationFormat: { type: String, default: 'APA 7' },
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'draft'],
      default: 'active',
      index: true,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  {
    timestamps: true,
  }
);

// Indexes
CoursePromptSchema.index({ domain: 1, level: 1 });
CoursePromptSchema.index({ status: 1 });
CoursePromptSchema.index({ createdAt: -1 });

export const CoursePrompt = mongoose.model<ICoursePrompt>('CoursePrompt', CoursePromptSchema);
```

#### Step 2: Create CurriculumProject Model

**File:** `packages/backend/src/models/CurriculumProject.ts`

```typescript
import mongoose, { Schema, Document } from 'mongoose';

export interface ICurriculumProject extends Document {
  promptId: mongoose.Types.ObjectId;
  smeId: mongoose.Types.ObjectId;
  projectName: string;
  status: 'research' | 'cost_review' | 'generation' | 'final_review' | 'published';
  currentStage: number;
  stageProgress: {
    stage1?: Date;
    stage2?: Date;
    stage3?: Date;
    stage4?: Date;
    stage5?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const CurriculumProjectSchema = new Schema<ICurriculumProject>(
  {
    promptId: { type: Schema.Types.ObjectId, ref: 'CoursePrompt', required: true },
    smeId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    projectName: { type: String, required: true },
    status: {
      type: String,
      enum: ['research', 'cost_review', 'generation', 'final_review', 'published'],
      default: 'research',
      index: true,
    },
    currentStage: { type: Number, min: 1, max: 5, default: 1, index: true },
    stageProgress: {
      stage1: { type: Date },
      stage2: { type: Date },
      stage3: { type: Date },
      stage4: { type: Date },
      stage5: { type: Date },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
CurriculumProjectSchema.index({ smeId: 1, status: 1 });
CurriculumProjectSchema.index({ status: 1, currentStage: 1 });
CurriculumProjectSchema.index({ createdAt: -1 });

export const CurriculumProject = mongoose.model<ICurriculumProject>(
  'CurriculumProject',
  CurriculumProjectSchema
);
```

#### Step 3: Create PreliminaryCurriculumPackage Model

**File:** `packages/backend/src/models/PreliminaryCurriculumPackage.ts`

```typescript
import mongoose, { Schema, Document } from 'mongoose';

export interface IPreliminaryCurriculumPackage extends Document {
  projectId: mongoose.Types.ObjectId;
  programOverview: {
    description: string;
    valueProposition: string;
    marketRelevance: string;
  };
  competencyFramework: {
    skills: string[];
    knowledge: string[];
    competencies: string[];
  };
  learningOutcomes: Array<{
    outcome: string;
    assessmentCriteria: string[];
    bloomLevel: string;
    competencyType: 'knowledge' | 'skill' | 'competency';
  }>;
  courseFramework: {
    totalHours: number;
    modules: Array<{
      moduleCode: string;
      moduleTitle: string;
      hours: number;
      topics: string[];
    }>;
  };
  topicSources: Array<{
    topic: string;
    sources: Array<{
      citation: string;
      url: string;
      publicationDate: Date;
      credibilityScore: number;
    }>;
  }>;
  readingLists: {
    indicative: string[];
    additional: string[];
  };
  assessments: Array<{
    type: 'mcq' | 'case_study' | 'essay' | 'practical';
    description: string;
    rubric: string;
  }>;
  glossary: Array<{
    term: string;
    definition: string;
  }>;
  caseStudies: Array<{
    title: string;
    scenario: string;
    questions: string[];
  }>;
  deliveryTools: {
    teachingMethods: string[];
    digitalTools: string[];
    lmsIntegration: string;
  };
  references: string[];
  submissionMetadata: {
    submittedBy: mongoose.Types.ObjectId;
    submittedAt: Date;
    agiCompliant: boolean;
  };
  outcomeWritingGuide: string;
  chatHistory: Array<{
    role: 'ai' | 'sme';
    content: string;
    componentRef: string;
    timestamp: Date;
  }>;
  approvedAt?: Date;
  approvedBy?: mongoose.Types.ObjectId;
}

const PreliminaryCurriculumPackageSchema = new Schema<IPreliminaryCurriculumPackage>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'CurriculumProject',
      required: true,
      index: true,
    },
    programOverview: {
      description: String,
      valueProposition: String,
      marketRelevance: String,
    },
    competencyFramework: {
      skills: [String],
      knowledge: [String],
      competencies: [String],
    },
    learningOutcomes: [
      {
        outcome: String,
        assessmentCriteria: [String],
        bloomLevel: String,
        competencyType: {
          type: String,
          enum: ['knowledge', 'skill', 'competency'],
        },
      },
    ],
    courseFramework: {
      totalHours: Number,
      modules: [
        {
          moduleCode: String,
          moduleTitle: String,
          hours: Number,
          topics: [String],
        },
      ],
    },
    topicSources: [
      {
        topic: String,
        sources: [
          {
            citation: String,
            url: String,
            publicationDate: Date,
            credibilityScore: Number,
          },
        ],
      },
    ],
    readingLists: {
      indicative: [String],
      additional: [String],
    },
    assessments: [
      {
        type: {
          type: String,
          enum: ['mcq', 'case_study', 'essay', 'practical'],
        },
        description: String,
        rubric: String,
      },
    ],
    glossary: [
      {
        term: String,
        definition: String,
      },
    ],
    caseStudies: [
      {
        title: String,
        scenario: String,
        questions: [String],
      },
    ],
    deliveryTools: {
      teachingMethods: [String],
      digitalTools: [String],
      lmsIntegration: String,
    },
    references: [String],
    submissionMetadata: {
      submittedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      submittedAt: Date,
      agiCompliant: Boolean,
    },
    outcomeWritingGuide: String,
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
  }
);

// Indexes
PreliminaryCurriculumPackageSchema.index({ projectId: 1 });
PreliminaryCurriculumPackageSchema.index({ 'submissionMetadata.agiCompliant': 1 });
PreliminaryCurriculumPackageSchema.index({ approvedAt: -1 });

export const PreliminaryCurriculumPackage = mongoose.model<IPreliminaryCurriculumPackage>(
  'PreliminaryCurriculumPackage',
  PreliminaryCurriculumPackageSchema
);
```

#### Step 4-6: Create Remaining Models

Create similar models for:

- `ResourceCostEvaluation.ts`
- `FullCurriculumPackage.ts`
- `CurriculumReview.ts`

(Follow the same pattern as above, using the schemas from ARCHITECTURE.md and NEW_WORKFLOW_DOCUMENT.md)

### 1.2 Create Database Migrations

**File:** `packages/backend/migrations/mongodb/1761700000000_add-new-workflow-collections.js`

```javascript
module.exports = {
  async up(db) {
    // Create new collections with validation
    await db.createCollection('courseprompts', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['promptTitle', 'domain', 'level', 'createdBy'],
          properties: {
            promptTitle: { bsonType: 'string' },
            domain: { bsonType: 'string' },
            level: { enum: ['bachelor', 'master', 'certificate', 'diploma'] },
            status: { enum: ['active', 'inactive', 'draft'] },
          },
        },
      },
    });

    // Create indexes
    await db.collection('courseprompts').createIndex({ domain: 1, level: 1 });
    await db.collection('courseprompts').createIndex({ status: 1 });
    await db.collection('courseprompts').createIndex({ createdAt: -1 });

    // Repeat for other collections...

    console.log('New workflow collections created successfully');
  },

  async down(db) {
    // Drop collections if needed
    await db.collection('courseprompts').drop();
    await db.collection('curriculumprojects').drop();
    await db.collection('preliminarycurriculumpackages').drop();
    await db.collection('resourcecostevaluations').drop();
    await db.collection('fullcurriculumpackages').drop();
    await db.collection('curriculumreviews').drop();

    console.log('New workflow collections dropped');
  },
};
```

**Run Migration:**

```bash
cd packages/backend
npm run migrate:up
```

---

## Phase 2: Backend Services

### 2.1 Prompt Library Service

**Location:** `packages/backend/src/services/PromptLibraryService.ts`

```typescript
import { CoursePrompt, ICoursePrompt } from '../models/CoursePrompt';
import { CurriculumProject } from '../models/CurriculumProject';

export class PromptLibraryService {
  /**
   * Get all active prompts, optionally filtered by domain/level
   */
  async getPrompts(filters: {
    domain?: string;
    level?: string;
    status?: string;
  }): Promise<ICoursePrompt[]> {
    const query: any = {};

    if (filters.domain) query.domain = filters.domain;
    if (filters.level) query.level = filters.level;
    if (filters.status) query.status = filters.status;
    else query.status = 'active'; // Default to active

    return await CoursePrompt.find(query)
      .sort({ createdAt: -1 })
      .populate('createdBy', 'email profile')
      .lean();
  }

  /**
   * Get single prompt by ID
   */
  async getPromptById(promptId: string): Promise<ICoursePrompt | null> {
    return await CoursePrompt.findById(promptId).populate('createdBy', 'email profile').lean();
  }

  /**
   * Create new prompt (admin only)
   */
  async createPrompt(promptData: Partial<ICoursePrompt>, userId: string): Promise<ICoursePrompt> {
    const prompt = new CoursePrompt({
      ...promptData,
      createdBy: userId,
      status: 'draft',
    });

    return await prompt.save();
  }

  /**
   * Initialize curriculum project from prompt
   */
  async initializeProject(promptId: string, smeId: string): Promise<any> {
    const prompt = await CoursePrompt.findById(promptId);
    if (!prompt) {
      throw new Error('Prompt not found');
    }

    const project = new CurriculumProject({
      promptId: prompt._id,
      smeId,
      projectName: prompt.promptTitle,
      status: 'research',
      currentStage: 1,
      stageProgress: {
        stage1: new Date(),
      },
    });

    await project.save();

    return {
      projectId: project._id,
      projectName: project.projectName,
      currentStage: project.currentStage,
      status: project.status,
    };
  }

  /**
   * Get available domains (for filtering)
   */
  async getAvailableDomains(): Promise<string[]> {
    const domains = await CoursePrompt.distinct('domain', { status: 'active' });
    return domains;
  }
}

export const promptLibraryService = new PromptLibraryService();
```

### 2.2 AI Research Service

**Location:** `packages/backend/src/services/AIResearchService.ts`

```typescript
import { PreliminaryCurriculumPackage } from '../models/PreliminaryCurriculumPackage';
import { CurriculumProject } from '../models/CurriculumProject';
import { CoursePrompt } from '../models/CoursePrompt';
import { perplexityClient } from '../integrations/PerplexityClient';
import { openAIService } from './OpenAIService';
import { geminiClient } from '../integrations/GeminiClient';

export class AIResearchService {
  /**
   * Start AI research phase for preliminary curriculum package
   */
  async startResearch(projectId: string): Promise<void> {
    const project = await CurriculumProject.findById(projectId).populate('promptId');
    if (!project) throw new Error('Project not found');

    // Initialize preliminary package
    const prelimPackage = new PreliminaryCurriculumPackage({
      projectId: project._id,
      chatHistory: [],
    });

    await prelimPackage.save();

    // Generate each component (run in background)
    this.generateAllComponents(project, prelimPackage);
  }

  /**
   * Generate all 13 components of preliminary curriculum package
   */
  private async generateAllComponents(project: any, prelimPackage: any): Promise<void> {
    try {
      // Component 1: Program Overview
      await this.generateProgramOverview(project, prelimPackage);

      // Component 2: Competency Framework
      await this.generateCompetencyFramework(project, prelimPackage);

      // Component 3: Learning Outcomes
      await this.generateLearningOutcomes(project, prelimPackage);

      // ... Continue for all 13 components

      // Mark as ready for SME review
      project.status = 'research';
      await project.save();
    } catch (error) {
      console.error('Error generating components:', error);
      throw error;
    }
  }

  /**
   * Generate Program Overview component
   */
  private async generateProgramOverview(project: any, prelimPackage: any): Promise<void> {
    const prompt = project.promptId as any;

    // 1. Research with Perplexity
    const research = await perplexityClient.research({
      query: `Current trends and best practices in ${prompt.domain} education`,
      returnCitations: true,
    });

    // 2. Generate content with OpenAI
    const overview = await openAIService.generateContent({
      systemPrompt: 'You are an expert curriculum designer.',
      userPrompt: `Generate a program overview for a ${prompt.level} level course in ${prompt.domain}. 
                   Use the following research: ${research.content}`,
      temperature: 0.7,
    });

    // 3. Validate with Gemini
    const validation = await geminiClient.validateQuality({
      content: overview,
      criteria: 'AGI compliance, market relevance, clarity',
    });

    // 4. Store in preliminary package
    prelimPackage.programOverview = {
      description: overview,
      valueProposition: validation.valueProposition || '',
      marketRelevance: research.marketAnalysis || '',
    };

    // 5. Add to chat history
    prelimPackage.chatHistory.push({
      role: 'ai',
      content: `Program Overview generated:\n\n${overview}`,
      componentRef: 'programOverview',
      timestamp: new Date(),
    });

    await prelimPackage.save();
  }

  /**
   * Process SME feedback and update component
   */
  async processSMEFeedback(
    packageId: string,
    componentRef: string,
    feedback: string
  ): Promise<any> {
    const prelimPackage = await PreliminaryCurriculumPackage.findById(packageId);
    if (!prelimPackage) throw new Error('Package not found');

    // Add SME feedback to chat history
    prelimPackage.chatHistory.push({
      role: 'sme',
      content: feedback,
      componentRef,
      timestamp: new Date(),
    });

    // Apply refinement using AI
    const currentContent = (prelimPackage as any)[componentRef];
    const refined = await openAIService.refineContent({
      originalContent: JSON.stringify(currentContent),
      feedback,
      component: componentRef,
    });

    // Update component
    (prelimPackage as any)[componentRef] = refined;

    // Add AI response to chat
    prelimPackage.chatHistory.push({
      role: 'ai',
      content: `Updated ${componentRef}:\n\n${JSON.stringify(refined, null, 2)}`,
      componentRef,
      timestamp: new Date(),
    });

    await prelimPackage.save();

    return {
      updatedComponent: refined,
      chatHistory: prelimPackage.chatHistory.slice(-5), // Return last 5 messages
    };
  }

  /**
   * Submit preliminary package for approval
   */
  async submitForApproval(packageId: string, smeId: string): Promise<void> {
    const prelimPackage = await PreliminaryCurriculumPackage.findById(packageId);
    if (!prelimPackage) throw new Error('Package not found');

    prelimPackage.submissionMetadata = {
      submittedBy: smeId as any,
      submittedAt: new Date(),
      agiCompliant: true, // Would run AGI validation here
    };

    prelimPackage.approvedAt = new Date();
    prelimPackage.approvedBy = smeId as any;

    await prelimPackage.save();

    // Update project status
    const project = await CurriculumProject.findById(prelimPackage.projectId);
    if (project) {
      project.stageProgress.stage2 = new Date();
      project.currentStage = 3;
      project.status = 'cost_review';
      await project.save();
    }
  }
}

export const aiResearchService = new AIResearchService();
```

### 2.3 Resource Cost Service

**Location:** `packages/backend/src/services/ResourceCostService.ts`

```typescript
import { ResourceCostEvaluation } from '../models/ResourceCostEvaluation';
import { PreliminaryCurriculumPackage } from '../models/PreliminaryCurriculumPackage';
import { CurriculumProject } from '../models/CurriculumProject';
import { openAIService } from './OpenAIService';
import { emailService } from './EmailService';

export class ResourceCostService {
  /**
   * Scan preliminary package for paid resources
   */
  async scanForPaidResources(packageId: string): Promise<any> {
    const prelimPackage = await PreliminaryCurriculumPackage.findById(packageId);
    if (!prelimPackage) throw new Error('Package not found');

    // Extract resources from reading lists, digital tools, etc.
    const paidResources = await this.extractPaidResources(prelimPackage);

    if (paidResources.length === 0) {
      // No paid resources, proceed to next stage
      const project = await CurriculumProject.findById(prelimPackage.projectId);
      if (project) {
        project.currentStage = 4;
        project.status = 'generation';
        project.stageProgress.stage3 = new Date();
        await project.save();
      }
      return { hasPaidResources: false };
    }

    // Calculate costs
    const resourcesWithCosts = await this.calculateCosts(paidResources);

    // Create cost evaluation
    const costEvaluation = new ResourceCostEvaluation({
      projectId: prelimPackage.projectId,
      resources: resourcesWithCosts,
      totalEstimatedCost: resourcesWithCosts.reduce((sum, r) => sum + r.totalCost, 0),
      managementDecision: 'pending',
    });

    await costEvaluation.save();

    // Notify management
    await this.notifyManagement(costEvaluation);

    return {
      hasPaidResources: true,
      evaluationId: costEvaluation._id,
      totalCost: costEvaluation.totalEstimatedCost,
    };
  }

  /**
   * Extract paid resources from preliminary package
   */
  private async extractPaidResources(prelimPackage: any): Promise<any[]> {
    // Use AI to identify paid resources
    const resources = [];

    // Check reading lists
    for (const reading of prelimPackage.readingLists.indicative) {
      if (await this.isPaidResource(reading)) {
        resources.push({
          name: reading,
          type: 'textbook',
        });
      }
    }

    // Check digital tools
    for (const tool of prelimPackage.deliveryTools.digitalTools) {
      if (await this.isPaidResource(tool)) {
        resources.push({
          name: tool,
          type: 'software',
        });
      }
    }

    return resources;
  }

  /**
   * Check if resource is paid
   */
  private async isPaidResource(resourceName: string): Promise<boolean> {
    // Use AI to determine if resource requires payment
    const result = await openAIService.generateContent({
      systemPrompt:
        'You are a resource analyst. Determine if this educational resource typically requires payment.',
      userPrompt: `Is "${resourceName}" a paid resource? Respond with JSON: { "isPaid": boolean, "estimatedCost": number }`,
      temperature: 0.3,
      responseFormat: 'json',
    });

    const parsed = JSON.parse(result);
    return parsed.isPaid;
  }

  /**
   * Calculate costs for resources
   */
  private async calculateCosts(resources: any[]): Promise<any[]> {
    return Promise.all(
      resources.map(async (resource) => {
        const costInfo = await this.getCostInfo(resource.name);

        return {
          resourceName: resource.name,
          resourceType: resource.type,
          vendor: costInfo.vendor || 'Unknown',
          costPerStudent: costInfo.costPerStudent || 0,
          estimatedStudents: 100, // Default estimate
          totalCost: (costInfo.costPerStudent || 0) * 100,
          isRecurring: costInfo.isRecurring || false,
          recurringPeriod: costInfo.recurringPeriod,
          justification: `Required for ${resource.type} component`,
          alternatives: [],
        };
      })
    );
  }

  /**
   * Get cost information for a resource
   */
  private async getCostInfo(resourceName: string): Promise<any> {
    // Use AI to get cost information
    const result = await openAIService.generateContent({
      systemPrompt: 'You are a pricing analyst for educational resources.',
      userPrompt: `Provide pricing information for "${resourceName}". Respond with JSON.`,
      temperature: 0.2,
      responseFormat: 'json',
    });

    return JSON.parse(result);
  }

  /**
   * Notify management for approval
   */
  private async notifyManagement(costEvaluation: any): Promise<void> {
    // Send email to management
    await emailService.send({
      to: process.env.MANAGEMENT_EMAIL!,
      subject: 'Resource Cost Approval Required',
      template: 'resource-approval',
      data: {
        evaluationId: costEvaluation._id,
        totalCost: costEvaluation.totalEstimatedCost,
        resources: costEvaluation.resources,
      },
    });
  }

  /**
   * Process management decision
   */
  async processDecision(
    evaluationId: string,
    decision: 'approved' | 'rejected',
    decidedBy: string,
    notes?: string
  ): Promise<void> {
    const costEvaluation = await ResourceCostEvaluation.findById(evaluationId);
    if (!costEvaluation) throw new Error('Evaluation not found');

    costEvaluation.managementDecision = decision;
    costEvaluation.decidedBy = decidedBy as any;
    costEvaluation.decidedAt = new Date();
    costEvaluation.decisionNotes = notes || '';

    if (decision === 'approved') {
      costEvaluation.finalResources = costEvaluation.resources.map((r) => ({
        resourceName: r.resourceName,
        cost: r.totalCost,
        type: r.resourceType,
      }));

      await costEvaluation.save();

      // Proceed to next stage
      const project = await CurriculumProject.findById(costEvaluation.projectId);
      if (project) {
        project.currentStage = 4;
        project.status = 'generation';
        project.stageProgress.stage3 = new Date();
        await project.save();
      }
    } else {
      // Find alternatives
      await this.findAlternatives(costEvaluation);
    }
  }

  /**
   * Find open-source alternatives
   */
  private async findAlternatives(costEvaluation: any): Promise<void> {
    for (const resource of costEvaluation.resources) {
      const alternatives = await openAIService.generateContent({
        systemPrompt:
          'You are an educational resource specialist. Find high-quality open-source alternatives.',
        userPrompt: `Find 3 open-source alternatives to "${resource.resourceName}" for educational use.`,
        temperature: 0.5,
        responseFormat: 'json',
      });

      resource.alternatives = JSON.parse(alternatives);
    }

    await costEvaluation.save();

    // Notify SME to review alternatives
    // Implementation of SME notification...
  }
}

export const resourceCostService = new ResourceCostService();
```

### 2.4-2.7: Remaining Services

Create similar implementations for:

- `CurriculumGenerationService.ts` (v2 - generates from preliminary package)
- `RefinementService.ts` (processes SME refinement requests)
- `PublicationService.ts` (deploys to LMS)

---

## Phase 3: AI Integration

### 3.1 Perplexity AI Integration

**Location:** `packages/backend/src/integrations/PerplexityClient.ts`

```typescript
import axios from 'axios';

export class PerplexityClient {
  private apiKey: string;
  private baseURL: string = 'https://api.perplexity.ai';

  constructor() {
    this.apiKey = process.env.PERPLEXITY_API_KEY!;
    if (!this.apiKey) {
      throw new Error('PERPLEXITY_API_KEY not configured');
    }
  }

  /**
   * Perform deep research query
   */
  async research(params: {
    query: string;
    returnCitations?: boolean;
    returnImages?: boolean;
  }): Promise<any> {
    try {
      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: 'pplx-70b-online',
          messages: [
            {
              role: 'system',
              content:
                'You are an academic research assistant. Provide credible sources with proper citations.',
            },
            {
              role: 'user',
              content: params.query,
            },
          ],
          return_citations: params.returnCitations !== false,
          return_images: params.returnImages || false,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return {
        content: response.data.choices[0].message.content,
        citations: response.data.citations || [],
        marketAnalysis: this.extractMarketAnalysis(response.data.choices[0].message.content),
      };
    } catch (error: any) {
      console.error('Perplexity API error:', error.response?.data || error.message);
      throw new Error(`Perplexity research failed: ${error.message}`);
    }
  }

  /**
   * Extract market analysis from research content
   */
  private extractMarketAnalysis(content: string): string {
    // Logic to extract relevant market analysis sections
    // This could use regex, NLP, or additional AI processing
    return content;
  }
}

export const perplexityClient = new PerplexityClient();
```

### 3.2 Google Gemini Integration

**Location:** `packages/backend/src/integrations/GeminiClient.ts`

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';

export class GeminiClient {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY!;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
  }

  /**
   * Validate content quality
   */
  async validateQuality(params: { content: string; criteria: string }): Promise<any> {
    try {
      const prompt = `Evaluate the following content against these criteria: ${params.criteria}
      
Content:
${params.content}

Provide a JSON response with:
- qualityScore (0-100)
- strengths (array of strings)
- weaknesses (array of strings)
- recommendations (array of strings)
- valueProposition (string)`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Parse JSON response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return {
        qualityScore: 0,
        strengths: [],
        weaknesses: ['Unable to parse response'],
        recommendations: [],
        valueProposition: '',
      };
    } catch (error: any) {
      console.error('Gemini API error:', error);
      throw new Error(`Gemini validation failed: ${error.message}`);
    }
  }

  /**
   * Compare alternatives
   */
  async compareAlternatives(original: string, alternatives: any[]): Promise<any> {
    const prompt = `Compare these alternatives to the original resource:
    
Original: ${original}

Alternatives:
${alternatives.map((alt, i) => `${i + 1}. ${alt.name}`).join('\n')}

For each alternative, provide:
- functionalityMatch (0-100%)
- qualityAssessment (string)
- limitations (array of strings)
- recommendation (boolean)`;

    const result = await this.model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Parse and return structured comparison
    return this.parseComparison(text);
  }

  private parseComparison(text: string): any {
    // Implement parsing logic
    return {};
  }
}

export const geminiClient = new GeminiClient();
```

### 3.3 WebSocket Setup for Chat

**Location:** `packages/backend/src/websocket/ChatServer.ts`

```typescript
import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { verifyJWT } from '../middleware/auth';

export class ChatServer {
  private io: Server;

  constructor(httpServer: HttpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        credentials: true,
      },
    });

    this.setupMiddleware();
    this.setupHandlers();
  }

  private setupMiddleware() {
    this.io.use(async (socket: Socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        const user = await verifyJWT(token);
        (socket as any).user = user;
        next();
      } catch (error) {
        next(new Error('Authentication failed'));
      }
    });
  }

  private setupHandlers() {
    this.io.on('connection', (socket: Socket) => {
      console.log('Client connected:', socket.id);

      // Join project room
      socket.on('join_project', (projectId: string) => {
        socket.join(`project:${projectId}`);
        console.log(`User joined project ${projectId}`);
      });

      // Handle chat messages
      socket.on(
        'chat_message',
        async (data: {
          projectId: string;
          packageId: string;
          componentRef: string;
          message: string;
        }) => {
          // Process message and generate AI response
          // Broadcast to all users in the project room
          this.io.to(`project:${data.projectId}`).emit('chat_message', {
            role: 'sme',
            content: data.message,
            timestamp: new Date(),
          });

          // Generate AI response (async)
          this.handleAIResponse(data);
        }
      );

      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });
    });
  }

  private async handleAIResponse(data: any) {
    // Process with AI Research Service
    // Emit AI response when ready
    setTimeout(() => {
      this.io.to(`project:${data.projectId}`).emit('chat_message', {
        role: 'ai',
        content: 'AI response here...',
        timestamp: new Date(),
      });
    }, 2000);
  }

  public emitToProject(projectId: string, event: string, data: any) {
    this.io.to(`project:${projectId}`).emit(event, data);
  }
}

let chatServer: ChatServer;

export function initializeChatServer(httpServer: HttpServer): ChatServer {
  chatServer = new ChatServer(httpServer);
  return chatServer;
}

export function getChatServer(): ChatServer {
  if (!chatServer) {
    throw new Error('Chat server not initialized');
  }
  return chatServer;
}
```

---

## Phase 4: Frontend Components

### 4.1 Prompt Library Interface

**Location:** `packages/frontend/src/app/prompts/page.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Prompt {
  _id: string;
  promptTitle: string;
  domain: string;
  level: string;
  totalHours: number;
  ectsCredits: number;
  targetAudience: string;
}

export default function PromptLibraryPage() {
  const router = useRouter();
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    domain: '',
    level: ''
  });

  useEffect(() => {
    fetchPrompts();
  }, [filters]);

  const fetchPrompts = async () => {
    setLoading(true);
    const queryParams = new URLSearchParams(filters as any).toString();
    const response = await fetch(`/api/prompts?${queryParams}`);
    const data = await response.json();
    setPrompts(data.prompts);
    setLoading(false);
  };

  const handleSelectPrompt = async (promptId: string) => {
    const response = await fetch('/api/curriculum/initialize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ promptId })
    });

    const data = await response.json();
    router.push(`/curriculum/${data.projectId}/research`);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Course Prompt Library</h1>

      {/* Filters */}
      <div className="mb-6 flex gap-4">
        <select
          className="border rounded px-4 py-2"
          value={filters.domain}
          onChange={(e) => setFilters({ ...filters, domain: e.target.value })}
        >
          <option value="">All Domains</option>
          <option value="Business Intelligence">Business Intelligence</option>
          <option value="Data Analytics">Data Analytics</option>
          <option value="Marketing">Marketing</option>
        </select>

        <select
          className="border rounded px-4 py-2"
          value={filters.level}
          onChange={(e) => setFilters({ ...filters, level: e.target.value })}
        >
          <option value="">All Levels</option>
          <option value="bachelor">Bachelor's</option>
          <option value="master">Master's</option>
          <option value="certificate">Certificate</option>
        </select>
      </div>

      {/* Prompt Cards */}
      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {prompts.map((prompt) => (
            <div
              key={prompt._id}
              className="border rounded-lg p-6 hover:shadow-lg transition-shadow"
            >
              <h3 className="text-xl font-semibold mb-2">{prompt.promptTitle}</h3>
              <div className="text-sm text-gray-600 mb-4">
                <p>Domain: {prompt.domain}</p>
                <p>Level: {prompt.level}</p>
                <p>{prompt.totalHours} hours | {prompt.ectsCredits} ECTS</p>
              </div>
              <p className="text-gray-700 mb-4">{prompt.targetAudience}</p>
              <button
                onClick={() => handleSelectPrompt(prompt._id)}
                className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
              >
                Select Prompt
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### 4.2 Chat Interface Component

**Location:** `packages/frontend/src/components/ChatInterface.tsx`

```typescript
'use client';

import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface Message {
  role: 'ai' | 'sme';
  content: string;
  componentRef?: string;
  timestamp: Date;
}

interface ChatInterfaceProps {
  projectId: string;
  packageId: string;
  currentComponent: string;
}

export function ChatInterface({ projectId, packageId, currentComponent }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initialize socket connection
    const token = localStorage.getItem('token');
    const newSocket = io(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000', {
      auth: { token }
    });

    newSocket.on('connect', () => {
      console.log('Connected to chat server');
      newSocket.emit('join_project', projectId);
    });

    newSocket.on('chat_message', (message: Message) => {
      setMessages((prev) => [...prev, message]);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [projectId]);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim() || !socket) return;

    socket.emit('chat_message', {
      projectId,
      packageId,
      componentRef: currentComponent,
      message: input
    });

    setInput('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow">
      {/* Header */}
      <div className="px-6 py-4 border-b">
        <h3 className="text-lg font-semibold">AI Research Assistant</h3>
        <p className="text-sm text-gray-600">Current: {currentComponent}</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'ai' ? 'justify-start' : 'justify-end'}`}
          >
            <div
              className={`max-w-3/4 rounded-lg px-4 py-2 ${
                message.role === 'ai'
                  ? 'bg-gray-100 text-gray-900'
                  : 'bg-blue-600 text-white'
              }`}
            >
              <p className="text-sm font-semibold mb-1">
                {message.role === 'ai' ? '🤖 AI' : '👤 You'}
              </p>
              <p className="whitespace-pre-wrap">{message.content}</p>
              <p className="text-xs mt-2 opacity-70">
                {new Date(message.timestamp).toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-6 py-4 border-t">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your feedback or approval..."
            className="flex-1 border rounded-lg px-4 py-2 resize-none"
            rows={3}
          />
          <button
            onClick={sendMessage}
            className="bg-blue-600 text-white px-6 rounded-lg hover:bg-blue-700"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 4.3 Resource Approval Dashboard

(Similar component creation for resource approval interface)

---

## Phase 5: Testing & Deployment

### 5.1 Unit Tests

**Example Test:** `packages/backend/src/__tests__/services/PromptLibraryService.test.ts`

```typescript
import { PromptLibraryService } from '../../services/PromptLibraryService';
import { CoursePrompt } from '../../models/CoursePrompt';
import { connectTestDB, disconnectTestDB } from '../helpers/db';

describe('PromptLibraryService', () => {
  let service: PromptLibraryService;

  beforeAll(async () => {
    await connectTestDB();
    service = new PromptLibraryService();
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  beforeEach(async () => {
    await CoursePrompt.deleteMany({});
  });

  describe('getPrompts', () => {
    it('should return active prompts', async () => {
      // Create test prompts
      await CoursePrompt.create({
        promptTitle: 'Test Prompt',
        domain: 'Business Intelligence',
        level: 'bachelor',
        status: 'active',
        createdBy: '507f1f77bcf86cd799439011',
      });

      const prompts = await service.getPrompts({});
      expect(prompts).toHaveLength(1);
      expect(prompts[0].promptTitle).toBe('Test Prompt');
    });

    it('should filter by domain', async () => {
      await CoursePrompt.create([
        {
          promptTitle: 'BI Prompt',
          domain: 'Business Intelligence',
          level: 'bachelor',
          status: 'active',
          createdBy: '507f1f77bcf86cd799439011',
        },
        {
          promptTitle: 'Marketing Prompt',
          domain: 'Marketing',
          level: 'bachelor',
          status: 'active',
          createdBy: '507f1f77bcf86cd799439011',
        },
      ]);

      const prompts = await service.getPrompts({ domain: 'Business Intelligence' });
      expect(prompts).toHaveLength(1);
      expect(prompts[0].domain).toBe('Business Intelligence');
    });
  });
});
```

### 5.2 Integration Tests

### 5.3 E2E Tests with Playwright

### 5.4 Deployment Checklist

- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] WebSocket server deployed
- [ ] API keys for Perplexity, Gemini configured
- [ ] Frontend environment variables set
- [ ] Health checks passing
- [ ] Monitoring configured

---

## API Endpoints Reference

### Prompt Library Endpoints

```
GET    /api/prompts                    - Get all prompts
GET    /api/prompts/:id                - Get prompt by ID
POST   /api/prompts                    - Create new prompt (admin)
POST   /api/curriculum/initialize      - Initialize project from prompt
```

### AI Research Endpoints

```
POST   /api/research/start/:projectId               - Start AI research
POST   /api/research/feedback/:packageId            - Submit SME feedback
POST   /api/research/submit/:packageId              - Submit for approval
GET    /api/research/package/:packageId             - Get preliminary package
GET    /api/research/chat-history/:packageId        - Get chat history
```

### Resource Cost Endpoints

```
POST   /api/resources/scan/:packageId               - Scan for paid resources
POST   /api/resources/approve/:evaluationId         - Approve/reject resources
GET    /api/resources/evaluation/:evaluationId      - Get cost evaluation
POST   /api/resources/alternatives/:evaluationId    - Request alternatives
```

### Curriculum Generation Endpoints

```
POST   /api/curriculum/generate/:projectId          - Generate full curriculum
GET    /api/curriculum/status/:projectId            - Get generation status
GET    /api/curriculum/package/:projectId           - Get full curriculum package
```

### Review & Publication Endpoints

```
POST   /api/review/refine/:curriculumId             - Request refinements
POST   /api/review/approve/:curriculumId            - SME approval
POST   /api/review/publish/:curriculumId            - Publish to LMS
GET    /api/review/status/:curriculumId             - Get review status
```

---

## Configuration

### Environment Variables

**Backend (`packages/backend/.env`):**

```bash
# MongoDB
MONGODB_URI=mongodb+srv://...

# Redis
REDIS_URL=redis://...

# AI Services
OPENAI_API_KEY=your_openai_api_key_here
PERPLEXITY_API_KEY=your_perplexity_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here

# Auth
AUTH0_DOMAIN=...
AUTH0_AUDIENCE=...

# WebSocket
WS_PORT=4001

# Management
MANAGEMENT_EMAIL=admin@example.com

# Frontend URL
FRONTEND_URL=http://localhost:3000
```

**Frontend (`packages/frontend/.env.local`):**

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=http://localhost:4001
NEXT_PUBLIC_AUTH0_DOMAIN=...
NEXT_PUBLIC_AUTH0_CLIENT_ID=...
```

---

## Troubleshooting

### Common Issues

**1. WebSocket Connection Fails**

- Check CORS configuration
- Verify WS_PORT is not blocked by firewall
- Ensure authentication token is valid

**2. Perplexity API Errors**

- Verify API key is valid
- Check rate limits
- Ensure billing is active

**3. Database Connection Issues**

- Check MongoDB URI
- Verify network access
- Check connection pool settings

**4. AI Generation Timeouts**

- Increase timeout settings
- Check AI service availability
- Monitor API usage limits

---

## Next Steps

1. Complete all models (Step 4-6 in Phase 1)
2. Implement remaining services (Phase 2)
3. Test all AI integrations (Phase 3)
4. Build remaining frontend components (Phase 4)
5. Comprehensive testing (Phase 5)
6. Deploy to production

---

**Document Version:** 1.0  
**Last Updated:** October 29, 2025  
**Maintained By:** Development Team
