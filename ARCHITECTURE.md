# Architecture Documentation

This document provides a comprehensive overview of the Curriculum Generator App architecture, data models, and system design.

## Table of Contents

1. [System Overview](#system-overview)
2. [Technology Stack](#technology-stack)
3. [Architecture Diagram](#architecture-diagram)
4. [Data Models](#data-models)
5. [Service Layer](#service-layer)
6. [API Design](#api-design)
7. [Vector Search Implementation](#vector-search-implementation)
8. [Authentication & Authorization](#authentication--authorization)
9. [File Storage](#file-storage)
10. [Caching Strategy](#caching-strategy)
11. [Job Queue System](#job-queue-system)
12. [Error Handling](#error-handling)
13. [Performance Optimization](#performance-optimization)

## System Overview

The Curriculum Generator App is a full-stack web application that automates curriculum creation using AI and Retrieval-Augmented Generation (RAG). The system has been redesigned with a **5-stage AI-integrated workflow** featuring prompt-based initiation, multi-AI research collaboration, resource cost evaluation, and comprehensive curriculum generation.

### Key Components

- **Frontend:** Next.js 14 with React and TypeScript
  - NEW: Prompt Library interface
  - NEW: Chat-based AI research collaboration UI
  - NEW: Resource approval dashboard
- **Backend API:** Node.js with Express and TypeScript
  - NEW: 7 additional services for new workflow
  - NEW: WebSocket support for real-time chat
- **Background Worker:** Node.js worker for async job processing
- **Database:** MongoDB Atlas with vector search capabilities
  - NEW: 6 additional collections for new workflow
- **Cache & Queue:** Redis for caching and Bull queue
- **AI Services:** Multi-AI integration
  - OpenAI GPT-4 and embeddings (existing)
  - NEW: Perplexity AI for web research
  - NEW: Google Gemini for validation
- **Deployment:** Render platform with managed services

## Technology Stack

### Frontend

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **State Management:**
  - React Query (server state)
  - Zustand (client state)
- **Authentication:** Auth0 React SDK

### Backend

- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Language:** TypeScript
- **Database ODM:** Mongoose
- **Validation:** Joi / Zod
- **Authentication:** Auth0 + JWT

### Database & Storage

- **Primary Database:** MongoDB Atlas (M10+)
- **Vector Search:** MongoDB Atlas Search
- **Cache:** Redis (Render Redis)
- **File Storage:** Render Persistent Disk

### AI & ML

- **LLM:** OpenAI GPT-4-turbo
- **Embeddings:** OpenAI text-embedding-3-large (1536 dimensions)
- **RAG Framework:** Custom implementation with LangChain concepts

### DevOps & Deployment

- **Platform:** Render
- **CI/CD:** GitHub Actions + Render auto-deploy
- **Monitoring:** Sentry for error tracking
- **Logging:** Render logs + structured logging

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Next.js Frontend (React + TypeScript)                   │  │
│  │  - Admin Dashboard                                        │  │
│  │  - SME Interface                                          │  │
│  │  - Student Portal                                         │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS/REST API
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API Gateway Layer                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Express.js API Server                                    │  │
│  │  - Authentication Middleware (Auth0 JWT)                  │  │
│  │  - Rate Limiting                                          │  │
│  │  - Request Validation                                     │  │
│  │  - Error Handling                                         │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Service Layer                               │
│  ┌──────────────┬──────────────┬──────────────┬─────────────┐  │
│  │   Upload     │  Knowledge   │  Curriculum  │   Quality   │  │
│  │   Service    │  Base Svc    │  Generator   │  Assurance  │  │
│  └──────────────┴──────────────┴──────────────┴─────────────┘  │
│  ┌──────────────┬──────────────┬──────────────┬─────────────┐  │
│  │  Benchmark   │  Skill Book  │  Tutor Bot   │ Simulation  │  │
│  │   Service    │  Generator   │   Service    │   Engine    │  │
│  └──────────────┴──────────────┴──────────────┴─────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      AI/ML Layer                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  OpenAI Service                                           │  │
│  │  - GPT-4-turbo (Content Generation)                       │  │
│  │  - text-embedding-3-large (Embeddings)                    │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  RAG Engine                                               │  │
│  │  - Vector Search                                          │  │
│  │  - Context Retrieval                                      │  │
│  │  - Source Attribution                                     │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Data Layer                                  │
│  ┌──────────────┬──────────────┬──────────────┬─────────────┐  │
│  │   MongoDB    │   MongoDB    │    Redis     │   Render    │  │
│  │   (Primary)  │   (Vector)   │   (Cache)    │    Disk     │  │
│  │              │    Search    │              │  (Files)    │  │
│  └──────────────┴──────────────┴──────────────┴─────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Background Worker                              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Bull Queue Worker                                        │  │
│  │  - Curriculum Generation Jobs                             │  │
│  │  - Document Processing Jobs                               │  │
│  │  - Embedding Generation Jobs                              │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Data Models

### MongoDB Collections

#### 1. Programs Collection

Stores high-level program information.

```typescript
{
  _id: ObjectId,
  programName: string,
  qualificationLevel: string,  // e.g., "Bachelor", "Master"
  qualificationType: string,   // e.g., "Degree", "Certificate"
  totalCredits: number,        // default: 120
  industrySector: string,      // e.g., "Business Intelligence"
  status: enum,                // 'draft' | 'submitted' | 'under_review' | 'approved' | 'published'
  createdBy: ObjectId,         // ref: User
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**

- `{ programName: 1 }`
- `{ status: 1 }`
- `{ createdBy: 1 }`
- `{ createdAt: -1 }`

#### 2. Modules Collection

Stores module/unit information for each program.

```typescript
{
  _id: ObjectId,
  programId: ObjectId,         // ref: Program
  moduleCode: string,          // e.g., "BI101"
  moduleTitle: string,
  hours: number,
  moduleAim: string,
  coreElective: enum,          // 'core' | 'elective'
  sequenceOrder: number,
  createdAt: Date
}
```

**Indexes:**

- `{ programId: 1, sequenceOrder: 1 }`
- `{ moduleCode: 1 }`

#### 3. Learning Outcomes Collection

Stores learning outcomes for each module.

```typescript
{
  _id: ObjectId,
  moduleId: ObjectId,          // ref: Module
  outcomeText: string,
  assessmentCriteria: string[],
  knowledgeSkillCompetency: enum,  // 'knowledge' | 'skill' | 'competency'
  bloomLevel: string,          // e.g., "Analyze", "Evaluate"
  createdAt: Date
}
```

**Indexes:**

- `{ moduleId: 1 }`
- `{ bloomLevel: 1 }`

#### 4. Knowledge Base Collection (with Embeddings)

Stores processed documents with vector embeddings for RAG.

```typescript
{
  _id: ObjectId,
  content: string,             // Chunked text content
  sourceUrl: string,
  sourceType: enum,            // 'pdf' | 'docx' | 'url' | 'manual'
  publicationDate: Date,
  domain: string,              // e.g., "business-intelligence"
  credibilityScore: number,    // 0-100
  metadata: {
    title: string,
    author: string,
    tags: string[],
    chunkIndex: number,
    totalChunks: number
  },
  embedding: number[],         // 1536 dimensions (OpenAI)
  createdAt: Date
}
```

**Indexes:**

- `{ domain: 1 }`
- `{ credibilityScore: -1 }`
- `{ publicationDate: -1 }`
- Vector search index on `embedding` field

#### 5. Assessments Collection

Stores assessment questions and rubrics.

```typescript
{
  _id: ObjectId,
  moduleId: ObjectId,          // ref: Module
  questionType: enum,          // 'mcq' | 'case_study' | 'essay' | 'practical'
  questionText: string,
  options: string[],           // for MCQs
  correctAnswer: string,
  explanation: string,
  difficulty: enum,            // 'easy' | 'medium' | 'hard'
  learningOutcomeId: ObjectId, // ref: LearningOutcome
  createdAt: Date
}
```

**Indexes:**

- `{ moduleId: 1 }`
- `{ difficulty: 1 }`

#### 6. Skill Mappings Collection

Maps competencies to practical activities and KPIs.

```typescript
{
  _id: ObjectId,
  programId: ObjectId,         // ref: Program
  skillName: string,
  domain: string,
  activities: [{
    name: string,
    description: string,
    unitLink: string,
    durationHours: number,
    assessmentType: string,
    resources: string[]
  }],
  kpis: [{
    name: string,
    metric: string,
    threshold: mixed             // number or string
  }],
  linkedOutcomes: ObjectId[],  // refs: LearningOutcome
  assessmentCriteria: string[],
  createdAt: Date
}
```

**Indexes:**

- `{ programId: 1 }`
- `{ domain: 1 }`

#### 7. Generation Jobs Collection

Tracks async curriculum generation jobs.

```typescript
{
  _id: ObjectId,
  programId: ObjectId,         // ref: Program
  status: enum,                // 'queued' | 'processing' | 'completed' | 'failed'
  progress: number,            // 0-100
  startedAt: Date,
  completedAt: Date,
  errorMessage: string,
  intermediateResults: mixed,  // Store partial results
  createdAt: Date
}
```

**Indexes:**

- `{ programId: 1 }`
- `{ status: 1 }`
- `{ createdAt: -1 }`

#### 8. Users Collection

Stores user accounts and roles.

```typescript
{
  _id: ObjectId,
  email: string,               // unique
  role: enum,                  // 'administrator' | 'sme' | 'student'
  authProviderId: string,      // Auth0 user ID
  profile: {
    firstName: string,
    lastName: string,
    organization: string
  },
  lastLogin: Date,
  createdAt: Date
}
```

**Indexes:**

- `{ email: 1 }` (unique)
- `{ authProviderId: 1 }` (unique)
- `{ role: 1 }`

#### 9. Audit Logs Collection

Tracks all system actions for compliance.

```typescript
{
  _id: ObjectId,
  userId: ObjectId,            // ref: User
  action: string,              // e.g., "program_created", "curriculum_generated"
  resourceType: string,        // e.g., "program", "module"
  resourceId: ObjectId,
  details: mixed,              // Additional context
  ipAddress: string,
  userAgent: string,
  createdAt: Date
}
```

**Indexes:**

- `{ userId: 1, createdAt: -1 }`
- `{ action: 1 }`
- `{ createdAt: 1 }` with TTL (90 days)

#### 10. File Uploads Collection

Tracks uploaded files and their storage locations.

```typescript
{
  _id: ObjectId,
  programId: ObjectId,         // ref: Program (optional)
  filename: string,
  originalName: string,
  mimeType: string,
  size: number,
  storagePath: string,
  storageType: enum,           // 'render_disk' | 'cloudinary' | 'local'
  uploadedBy: ObjectId,        // ref: User
  createdAt: Date
}
```

**Indexes:**

- `{ programId: 1 }`
- `{ uploadedBy: 1 }`
- `{ createdAt: 1 }` with TTL (7 days for temp files)

---

## NEW Collections for 5-Stage Workflow

### 11. Course Prompt Collection (NEW)

Stores course prompts in the internal library with preset parameters.

```typescript
{
  _id: ObjectId,
  promptTitle: string,
  domain: string,              // e.g., "Business Intelligence", "Data Analytics"
  level: string,               // 'bachelor' | 'master' | 'certificate' | 'diploma'
  totalHours: number,          // default: 120
  ectsCredits: number,         // default: 15
  moduleCount: number,         // default: 6-8
  learningObjectives: string[],
  targetAudience: string,
  prerequisites: string[],
  curriculumRules: {
    agiCompliance: boolean,
    bloomTaxonomyLevels: string[],
    assessmentTypes: string[],
    sourceRecencyYears: number,    // e.g., 5 years
    citationFormat: string          // 'APA 7'
  },
  status: enum,                // 'active' | 'inactive' | 'draft'
  createdBy: ObjectId,         // ref: User
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**

- `{ domain: 1, level: 1 }`
- `{ status: 1 }`
- `{ createdAt: -1 }`

---

### 12. Curriculum Project Collection (NEW)

Tracks curriculum development projects from initiation to publication.

```typescript
{
  _id: ObjectId,
  promptId: ObjectId,          // ref: CoursePrompt
  smeId: ObjectId,             // ref: User
  projectName: string,
  status: enum,                // 'research' | 'cost_review' | 'generation' | 'final_review' | 'published'
  currentStage: number,        // 1-5
  stageProgress: {
    stage1: Date,              // Timestamp when stage completed
    stage2: Date,
    stage3: Date,
    stage4: Date,
    stage5: Date
  },
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**

- `{ smeId: 1, status: 1 }`
- `{ status: 1, currentStage: 1 }`
- `{ createdAt: -1 }`

---

### 13. Preliminary Curriculum Package Collection (NEW)

Stores the 13-component AGI-compliant preliminary package generated during Stage 2.

```typescript
{
  _id: ObjectId,
  projectId: ObjectId,         // ref: CurriculumProject

  // AGI Components
  programOverview: {
    description: string,
    valueProposition: string,
    marketRelevance: string
  },

  competencyFramework: {
    skills: string[],
    knowledge: string[],
    competencies: string[]
  },

  learningOutcomes: [{
    outcome: string,
    assessmentCriteria: string[],
    bloomLevel: string,
    competencyType: enum        // 'knowledge' | 'skill' | 'competency'
  }],

  courseFramework: {
    totalHours: number,
    modules: [{
      moduleCode: string,
      moduleTitle: string,
      hours: number,
      topics: string[]
    }]
  },

  topicSources: [{
    topic: string,
    sources: [{
      citation: string,         // APA 7
      url: string,
      publicationDate: Date,
      credibilityScore: number
    }]
  }],

  readingLists: {
    indicative: string[],       // Required readings
    additional: string[]        // Supplementary materials
  },

  assessments: [{
    type: enum,                 // 'mcq' | 'case_study' | 'essay' | 'practical'
    description: string,
    rubric: string
  }],

  glossary: [{
    term: string,
    definition: string
  }],

  caseStudies: [{
    title: string,
    scenario: string,
    questions: string[]
  }],

  deliveryTools: {
    teachingMethods: string[],
    digitalTools: string[],
    lmsIntegration: string
  },

  references: string[],         // Complete bibliography

  submissionMetadata: {
    submittedBy: ObjectId,      // ref: User
    submittedAt: Date,
    agiCompliant: boolean
  },

  outcomeWritingGuide: string,

  // SME Interaction
  chatHistory: [{
    role: enum,                 // 'ai' | 'sme'
    content: string,
    componentRef: string,       // Which component being discussed
    timestamp: Date
  }],

  approvedAt: Date,
  approvedBy: ObjectId          // ref: User
}
```

**Indexes:**

- `{ projectId: 1 }`
- `{ 'submissionMetadata.agiCompliant': 1 }`
- `{ approvedAt: -1 }`

---

### 14. Resource Cost Evaluation Collection (NEW)

Tracks paid resources, cost calculations, approvals, and alternatives.

```typescript
{
  _id: ObjectId,
  projectId: ObjectId,          // ref: CurriculumProject

  resources: [{
    resourceName: string,
    resourceType: enum,         // 'textbook' | 'software' | 'database' | 'tool' | 'license'
    vendor: string,
    costPerStudent: number,
    estimatedStudents: number,
    totalCost: number,
    isRecurring: boolean,
    recurringPeriod: enum,      // 'monthly' | 'annually'
    justification: string,
    alternatives: [{
      name: string,
      cost: number,
      quality: string,          // Quality assessment (e.g., "85% functionality")
      limitations: string
    }]
  }],

  totalEstimatedCost: number,

  managementDecision: enum,     // 'pending' | 'approved' | 'rejected'
  decidedBy: ObjectId,          // ref: User (management)
  decidedAt: Date,
  decisionNotes: string,

  finalResources: [{            // After substitutions if rejected
    resourceName: string,
    cost: number,
    type: string
  }],

  instructionalPlanChanged: boolean,
  revisedPackageId: ObjectId,   // ref: PreliminaryCurriculumPackage (if revised)

  createdAt: Date
}
```

**Indexes:**

- `{ projectId: 1 }`
- `{ managementDecision: 1 }`
- `{ createdAt: -1 }`

---

### 15. Full Curriculum Package Collection (NEW)

Stores the complete generated curriculum including all teaching materials.

```typescript
{
  _id: ObjectId,
  projectId: ObjectId,          // ref: CurriculumProject
  preliminaryPackageId: ObjectId, // ref: PreliminaryCurriculumPackage

  modulePlans: [{
    moduleCode: string,
    moduleTitle: string,
    weekByWeek: [{
      week: number,
      topics: string[],
      activities: string[],
      assessments: string[]
    }],
    assessmentSchedule: [{
      type: string,
      dueDate: string,
      weight: number
    }]
  }],

  caseStudies: [{
    id: string,
    title: string,
    scenarioDescription: string,
    discussionQuestions: string[],
    rubric: object
  }],

  simulations: [{
    id: string,
    title: string,
    instructions: string,
    datasets: string[],          // File references
    evaluationCriteria: string[]
  }],

  assessmentBank: [{
    questionId: string,
    type: enum,                  // 'mcq' | 'short_answer' | 'essay'
    questionText: string,
    options: string[],           // for MCQs
    correctAnswer: string,
    explanation: string,
    difficulty: enum,            // 'easy' | 'medium' | 'hard'
    learningOutcomeRef: string
  }],

  slideDecks: [{
    moduleCode: string,
    filePath: string,            // Storage reference
    format: enum,                // 'pptx' | 'pdf' | 'canva'
    slideCount: number
  }],

  rubrics: [{
    assessmentType: string,
    criteria: [{
      criterion: string,
      levels: [{
        level: string,
        description: string,
        points: number
      }]
    }]
  }],

  sourcesCited: [{
    materialId: string,
    citations: string[]
  }],

  agiCompliance: {
    validated: boolean,
    validatedAt: Date,
    complianceScore: number,
    issues: string[]
  },

  generatedAt: Date,
  generatedBy: string            // System/AI identifier
}
```

**Indexes:**

- `{ projectId: 1 }`
- `{ 'agiCompliance.validated': 1 }`
- `{ generatedAt: -1 }`

---

### 16. Curriculum Review Collection (NEW)

Tracks SME review, refinements, approvals, and publication.

```typescript
{
  _id: ObjectId,
  projectId: ObjectId,          // ref: CurriculumProject
  fullCurriculumId: ObjectId,   // ref: FullCurriculumPackage

  reviewedBy: ObjectId,         // ref: User (SME)
  reviewStatus: enum,           // 'in_review' | 'refinements_requested' | 'approved'

  refinements: [{
    materialType: string,       // 'module_plan' | 'case_study' | 'assessment'
    materialId: string,
    requestedChange: string,
    appliedAt: Date,
    appliedBy: string           // AI system identifier
  }],

  approvalSignature: {
    userId: ObjectId,
    timestamp: Date,
    ipAddress: string
  },

  publicationApproval: {
    adminId: ObjectId,
    approvedAt: Date
  },

  publishedAt: Date,
  publishedToLMS: boolean,
  lmsId: string,
  lmsCourseUrl: string,

  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**

- `{ projectId: 1 }`
- `{ reviewStatus: 1 }`
- `{ publishedAt: -1 }`

---

### Data Relationships

```
Program (1) ──────< (N) Modules
                      │
                      └──< (N) LearningOutcomes
                      │
                      └──< (N) Assessments

Program (1) ──────< (N) SkillMappings
                      │
                      └──< (N) LearningOutcomes (refs)

Program (1) ──────< (N) GenerationJobs

Program (1) ──────< (N) FileUploads

User (1) ──────< (N) Programs (created)
User (1) ──────< (N) AuditLogs
User (1) ──────< (N) FileUploads
```

## Service Layer

### Core Services

#### 1. Upload Service

**Responsibility:** Handle Excel file uploads and parsing

**Key Methods:**

- `validateExcelStructure(file)` - Validate file format
- `parseExcelData(file)` - Extract data from sheets
- `storeProgramData(data)` - Save to database

#### 2. Knowledge Base Service

**Responsibility:** Manage document ingestion and storage

**Key Methods:**

- `ingestDocument(source)` - Process and store documents
- `generateEmbeddings(text)` - Create vector embeddings
- `validateSource(source)` - Check source credibility

#### 3. Vector Search Service

**Responsibility:** Perform semantic search on knowledge base

**Key Methods:**

- `search(query, options)` - Single query search
- `multiQuerySearch(queries, options)` - Multiple query search
- `hybridSearch(query, keywords)` - Combine semantic + keyword

#### 4. RAG Engine

**Responsibility:** Orchestrate retrieval and generation

**Key Methods:**

- `retrieveContext(query)` - Get relevant documents
- `generateWithContext(prompt, context)` - Generate content
- `attributeSources(content)` - Add citations

#### 5. Curriculum Generator Service

**Responsibility:** Orchestrate full curriculum generation

**Key Methods:**

- `generateCurriculum(programId)` - Start generation job
- `generateProgramSpec(data)` - Create program document
- `generateUnitSpecs(modules)` - Create unit documents
- `generateAssessments(outcomes)` - Create assessments

#### 6. Quality Assurance Service

**Responsibility:** Validate curriculum against standards

**Key Methods:**

- `validateCurriculum(curriculum)` - Run all checks
- `checkSources(sources)` - Validate source quality
- `validateLearningOutcomes(outcomes)` - Check Bloom's taxonomy
- `validateHours(modules)` - Check hour distribution

#### 7. Benchmarking Service

**Responsibility:** Compare against competitor programs

**Key Methods:**

- `compareCurriculum(programId)` - Run comparison
- `calculateSimilarity(program1, program2)` - Compute scores
- `identifyGaps(generated, benchmark)` - Find missing topics

#### 8. OpenAI Service

**Responsibility:** Interface with OpenAI API

**Key Methods:**

- `generateEmbedding(text)` - Create embedding
- `generateEmbeddingsBatch(texts)` - Batch embeddings
- `generateContent(prompt, options)` - Generate text
- `generateStructuredContent(prompt, schema)` - Generate JSON

#### 9. File Storage Service

**Responsibility:** Manage file uploads and storage

**Key Methods:**

- `saveFile(file, userId, programId)` - Store file
- `getFile(fileId)` - Retrieve file
- `deleteFile(fileId)` - Remove file
- `cleanupOldFiles()` - Remove expired files

## Vector Search Implementation

### MongoDB Atlas Vector Search

The system uses MongoDB Atlas Search with kNN vector search capabilities.

#### Index Configuration

```javascript
{
  "mappings": {
    "dynamic": false,
    "fields": {
      "embedding": {
        "type": "knnVector",
        "dimensions": 1536,
        "similarity": "cosine"
      },
      "domain": { "type": "string" },
      "credibilityScore": { "type": "number" },
      "publicationDate": { "type": "date" }
    }
  }
}
```

#### Search Query

```typescript
const pipeline = [
  {
    $vectorSearch: {
      index: 'knowledge_base_vector_index',
      path: 'embedding',
      queryVector: queryEmbedding, // 1536-dim array
      numCandidates: 100,
      limit: 10,
    },
  },
  {
    $addFields: {
      similarityScore: { $meta: 'vectorSearchScore' },
    },
  },
  {
    $match: {
      similarityScore: { $gte: 0.75 },
      domain: 'business-intelligence',
      publicationDate: { $gte: fiveYearsAgo },
    },
  },
  {
    $sort: { credibilityScore: -1, similarityScore: -1 },
  },
];
```

### Embedding Generation

```typescript
// Generate embedding for query
const embedding = await openai.embeddings.create({
  model: 'text-embedding-3-large',
  input: queryText,
  dimensions: 1536,
});

// Store in MongoDB
await KnowledgeBase.create({
  content: chunkText,
  embedding: embedding.data[0].embedding,
  // ... other fields
});
```

### Multi-Query Retrieval

```typescript
// Generate query variations
const queries = [
  originalQuery,
  `What are the key concepts of ${originalQuery}?`,
  `Explain ${originalQuery} in detail`,
];

// Search with each query
const allResults = await Promise.all(queries.map((q) => vectorSearch.search(q)));

// Deduplicate and merge
const uniqueResults = deduplicateByContent(allResults.flat());
```

## Authentication & Authorization

### Auth0 Integration

```typescript
// JWT verification middleware
const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  try {
    const decoded = await auth0.verifyToken(token);
    req.user = await User.findOne({ authProviderId: decoded.sub });
    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized' });
  }
};
```

### Role-Based Access Control

```typescript
const requireRole = (roles: string[]) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
};

// Usage
router.post('/programs', verifyToken, requireRole(['administrator', 'sme']), createProgram);
```

## File Storage

### Render Persistent Disk

```typescript
// Save file to persistent disk
const filepath = path.join('/app/uploads', filename);
await fs.writeFile(filepath, fileBuffer);

// Create database record
await FileUpload.create({
  filename,
  storagePath: filepath,
  storageType: 'render_disk',
  // ... other fields
});
```

### File Cleanup

```typescript
// Cron job to clean up old files
cron.schedule('0 2 * * *', async () => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const oldFiles = await FileUpload.find({
    createdAt: { $lt: sevenDaysAgo },
    programId: { $exists: false },
  });

  for (const file of oldFiles) {
    await fs.unlink(file.storagePath);
    await file.remove();
  }
});
```

## Caching Strategy

### Redis Cache Layers

```typescript
// API response cache (5 minutes)
const cacheMiddleware = async (req, res, next) => {
  const key = `api:${req.path}:${JSON.stringify(req.query)}`;
  const cached = await redis.get(key);

  if (cached) {
    return res.json(JSON.parse(cached));
  }

  res.sendResponse = res.json;
  res.json = (data) => {
    redis.setex(key, 300, JSON.stringify(data));
    res.sendResponse(data);
  };

  next();
};

// Knowledge base query cache (1 hour)
const cachedSearch = async (query) => {
  const key = `kb:search:${query}`;
  const cached = await redis.get(key);

  if (cached) return JSON.parse(cached);

  const results = await vectorSearch.search(query);
  await redis.setex(key, 3600, JSON.stringify(results));

  return results;
};
```

## Job Queue System

### Bull Queue Configuration

```typescript
import Bull from 'bull';

const curriculumQueue = new Bull('curriculum-generation', {
  redis: config.redis.url,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
});

// Add job
await curriculumQueue.add(
  'generate',
  {
    programId: program._id,
  },
  {
    priority: 1,
    timeout: 300000, // 5 minutes
  }
);

// Process job
curriculumQueue.process('generate', async (job) => {
  const { programId } = job.data;

  // Update progress
  await job.progress(10);

  // Generate curriculum
  const curriculum = await curriculumGenerator.generate(programId);

  await job.progress(100);
  return curriculum;
});
```

## Error Handling

### Centralized Error Handler

```typescript
class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true
  ) {
    super(message);
  }
}

// Error handling middleware
app.use((err, req, res, next) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        message: err.message,
        code: err.statusCode,
      },
    });
  }

  // Log unexpected errors
  console.error('Unexpected error:', err);
  Sentry.captureException(err);

  res.status(500).json({
    error: {
      message: 'Internal server error',
      code: 500,
    },
  });
});
```

## Performance Optimization

### Database Query Optimization

```typescript
// Use projection to limit fields
const programs = await Program.find().select('programName status createdAt').lean(); // Return plain objects

// Use pagination
const page = 1;
const limit = 20;
const programs = await Program.find()
  .skip((page - 1) * limit)
  .limit(limit);

// Use aggregation for complex queries
const stats = await Program.aggregate([
  { $match: { status: 'published' } },
  {
    $group: {
      _id: '$industrySector',
      count: { $sum: 1 },
      avgCredits: { $avg: '$totalCredits' },
    },
  },
]);
```

### Connection Pooling

```typescript
mongoose.connect(config.database.uri, {
  maxPoolSize: 20,
  minPoolSize: 5,
  socketTimeoutMS: 45000,
  serverSelectionTimeoutMS: 5000,
});
```

### Batch Processing

```typescript
// Batch embedding generation
const texts = documents.map((d) => d.content);
const embeddings = await openai.generateEmbeddingsBatch(texts);

// Bulk insert
await KnowledgeBase.insertMany(
  documents.map((doc, i) => ({
    ...doc,
    embedding: embeddings[i],
  }))
);
```

This architecture provides a scalable, maintainable foundation for the Curriculum Generator App with clear separation of concerns and optimized performance.
