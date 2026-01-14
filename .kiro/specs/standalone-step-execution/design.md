# Design Document: Standalone Step Execution

## Overview

This design describes a standalone step execution feature that allows users to execute individual curriculum generation steps (2-10) independently, without requiring a full workflow context. The feature consists of a new frontend page (`/standalone`), a new backend API endpoint, and integration with existing step generation logic and Word export services.

The architecture follows a stateless, session-based approach where:
- Frontend manages UI state and session storage
- Backend provides a single endpoint that routes to existing step generators
- No database persistence is required
- Existing prompts and AI generation logic are reused without modification

## Architecture

```mermaid
graph TB
    subgraph Frontend
        LP[Landing Page] --> |Link| SP[Standalone Page]
        SP --> SS[Step Selector]
        SP --> DI[Description Input]
        SP --> OD[Output Display]
        SP --> DB[Download Button]
        SS --> |Selection| DI
        DI --> |Generate| API
        OD --> |Export| WE[Word Export]
    end
    
    subgraph Backend
        API[/api/v3/standalone/step/:stepNumber] --> SR[Standalone Router]
        SR --> SG[Step Generator Factory]
        SG --> |Step 2| S2[KSC Generator]
        SG --> |Step 3| S3[PLO Generator]
        SG --> |Step 4| S4[Course Framework Generator]
        SG --> |Step 5| S5[Sources Generator]
        SG --> |Step 6| S6[Reading List Generator]
        SG --> |Step 7| S7[Assessment Generator]
        SG --> |Step 8| S8[Case Study Generator]
        SG --> |Step 9| S9[Glossary Generator]
        SG --> |Step 10| S10[Lesson Plan Generator]
        S2 & S3 & S4 & S5 & S6 & S7 & S8 & S9 & S10 --> OAI[OpenAI Service]
    end
    
    subgraph Storage
        SessionStorage[Browser Session Storage]
    end
    
    SP --> |Store Output| SessionStorage
    WE --> |Generate| DOCX[Word Document]
```

## Components and Interfaces

### Frontend Components

#### 1. StandalonePage (`/standalone`)

Main page component that orchestrates the standalone step execution flow.

```typescript
interface StandalonePageState {
  selectedStep: number | null;
  description: string;
  isGenerating: boolean;
  output: StepOutput | null;
  error: string | null;
}

interface StepOutput {
  stepNumber: number;
  stepName: string;
  content: any; // Step-specific content structure
  generatedAt: string;
}
```

#### 2. StepSelector Component

Displays available steps (2-10) in a grid layout.

```typescript
interface StepSelectorProps {
  selectedStep: number | null;
  onSelectStep: (stepNumber: number) => void;
}

const STANDALONE_STEPS = [
  { step: 2, name: 'Competency Framework (KSC)', time: '10-15 min', icon: '🎯', description: 'Generate Knowledge, Skills, and Competencies (KSC) framework' },
  { step: 3, name: 'Program Learning Outcomes', time: '15-20 min', icon: '⚡', description: "Create measurable Program Learning Outcomes using Bloom's Taxonomy" },
  { step: 4, name: 'Course Framework & MLOs', time: '25-30 min', icon: '📚', description: 'Structure modules, topics, and Module Learning Outcomes' },
  { step: 5, name: 'Topic-Level Sources', time: '10 min', icon: '📖', description: 'Assign AGI-compliant academic sources to topics' },
  { step: 6, name: 'Reading Lists', time: '8 min', icon: '📕', description: 'Create core and supplementary reading lists per module' },
  { step: 7, name: 'Auto-Gradable Assessments', time: '15-20 min', icon: '✅', description: 'Generate MCQ-first auto-gradable assessments and quizzes' },
  { step: 8, name: 'Case Studies', time: '10-15 min', icon: '🏢', description: 'Create engagement hooks and case study scenarios' },
  { step: 9, name: 'Glossary', time: '5 min', icon: '📖', description: 'Auto-generate glossary from all curriculum content' },
  { step: 10, name: 'Lesson Plans & PPT', time: '10-15 min', icon: '📝', description: 'Generate detailed lesson plans and PowerPoint decks' },
];
```

#### 3. DescriptionInput Component

Text area for user to provide context/requirements.

```typescript
interface DescriptionInputProps {
  stepNumber: number;
  stepDescription: string;
  value: string;
  onChange: (value: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  isValid: boolean;
}
```

#### 4. StepOutputDisplay Component

Renders the generated output based on step type.

```typescript
interface StepOutputDisplayProps {
  output: StepOutput;
  onDownload: () => void;
}
```

### Backend Components

#### 1. Standalone Router (`standaloneRoutes.ts`)

New Express router handling standalone step execution.

```typescript
// POST /api/v3/standalone/step/:stepNumber
interface StandaloneStepRequest {
  description: string;
}

interface StandaloneStepResponse {
  success: boolean;
  data?: {
    stepNumber: number;
    stepName: string;
    content: any;
    generatedAt: string;
  };
  error?: string;
}
```

#### 2. StandaloneService (`standaloneService.ts`)

Service that generates step content without workflow context.

```typescript
class StandaloneService {
  async generateStep(stepNumber: number, description: string): Promise<StepContent>;
  
  private generateStep2(description: string): Promise<KSCContent>;
  private generateStep3(description: string): Promise<PLOContent>;
  private generateStep4(description: string): Promise<CourseFrameworkContent>;
  private generateStep5(description: string): Promise<SourcesContent>;
  private generateStep6(description: string): Promise<ReadingListContent>;
  private generateStep7(description: string): Promise<AssessmentContent>;
  private generateStep8(description: string): Promise<CaseStudyContent>;
  private generateStep9(description: string): Promise<GlossaryContent>;
  private generateStep10(description: string): Promise<LessonPlanContent>;
}
```

## Data Models

### Step Content Types

Each step produces a specific content structure:

```typescript
// Step 2: KSC Framework
interface KSCContent {
  knowledgeItems: KSCItem[];
  skillItems: KSCItem[];
  competencyItems: KSCItem[];
  totalItems: number;
}

// Step 3: PLOs
interface PLOContent {
  outcomes: PLO[];
  bloomDistribution: Record<string, number>;
}

// Step 4: Course Framework
interface CourseFrameworkContent {
  modules: Module[];
  totalHours: number;
}

// Step 5: Sources
interface SourcesContent {
  sources: AcademicSource[];
  byModule: Record<string, AcademicSource[]>;
}

// Step 6: Reading Lists
interface ReadingListContent {
  coreReadings: Reading[];
  supplementaryReadings: Reading[];
  byModule: Record<string, Reading[]>;
}

// Step 7: Assessments
interface AssessmentContent {
  formativeAssessments: Assessment[];
  summativeAssessments: Assessment[];
}

// Step 8: Case Studies
interface CaseStudyContent {
  caseStudies: CaseStudy[];
}

// Step 9: Glossary
interface GlossaryContent {
  terms: GlossaryTerm[];
  totalTerms: number;
}

// Step 10: Lesson Plans
interface LessonPlanContent {
  lessonPlans: LessonPlan[];
}
```

### Session Storage Schema

```typescript
interface SessionStorageData {
  lastOutput: StepOutput | null;
  generationHistory: Array<{
    stepNumber: number;
    generatedAt: string;
  }>;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Step Metadata Display Consistency

*For any* step number in the range 2-10, when that step is displayed in the Step Selector, the displayed name, icon, and time estimate SHALL match the values defined in STANDALONE_STEPS configuration.

**Validates: Requirements 2.2, 3.5**

### Property 2: Description Input Validation

*For any* description string with length less than 10 characters, the System SHALL prevent generation and display the validation error message.

**Validates: Requirements 3.4, 10.2**

### Property 3: Standalone Execution Independence

*For any* valid step execution request (step 2-10 with description >= 10 characters), the backend SHALL process the request successfully without requiring workflow ID, previous step data, or authentication.

**Validates: Requirements 4.4, 9.3**

### Property 4: Step Output Structure Validation

*For any* step number N in range 2-10, when generation completes successfully, the output content structure SHALL conform to the expected schema for that step type (KSCContent for step 2, PLOContent for step 3, etc.).

**Validates: Requirements 5.2, 8.1-8.9**

### Property 5: Word Document Content Integrity

*For any* generated Word document, the document SHALL contain: (1) the step name as title, (2) the user's description as context section, and (3) the generated content formatted appropriately.

**Validates: Requirements 6.3, 6.4**

### Property 6: Session-Only Data Storage

*For any* standalone step execution, the System SHALL store output data only in browser session storage and SHALL NOT make any database write operations.

**Validates: Requirements 7.1, 7.2**

### Property 7: API Request Validation

*For any* API request to `/api/v3/standalone/step/:stepNumber`, if stepNumber is not in range 2-10, the System SHALL return HTTP 400 with appropriate error message.

**Validates: Requirements 9.5**

### Property 8: API Response Format

*For any* successful API request, the response SHALL be valid JSON containing `success: true`, `data.stepNumber`, `data.stepName`, `data.content`, and `data.generatedAt` fields.

**Validates: Requirements 9.2, 9.4**

## Error Handling

### Frontend Error Handling

| Error Type | User Message | Recovery Action |
|------------|--------------|-----------------|
| Empty description | "Please enter a description" | Focus input field |
| Short description (<10 chars) | "Please provide more details in your description." | Keep input enabled |
| Network timeout | "Request timed out. Please try again." | Enable retry button |
| API error | "Generation failed. Please try again." | Enable retry button |
| Invalid step | "Invalid step selected" | Reset to step selection |

### Backend Error Handling

| Error Type | HTTP Status | Response |
|------------|-------------|----------|
| Invalid step number | 400 | `{ success: false, error: "Step number must be between 2 and 10" }` |
| Missing description | 400 | `{ success: false, error: "Description is required" }` |
| Description too short | 400 | `{ success: false, error: "Description must be at least 10 characters" }` |
| OpenAI API failure | 500 | `{ success: false, error: "Generation failed. Please try again." }` |
| Timeout | 504 | `{ success: false, error: "Request timed out. Please try again." }` |

## Testing Strategy

### Unit Tests

Unit tests will verify specific examples and edge cases:

1. **StepSelector Component**
   - Renders all 9 steps (2-10)
   - Does not render Step 1
   - Highlights selected step
   - Calls onSelectStep with correct step number

2. **DescriptionInput Component**
   - Disables generate button when empty
   - Enables generate button when valid
   - Shows correct placeholder for each step
   - Displays step description

3. **StandaloneService**
   - Throws error for invalid step numbers
   - Throws error for short descriptions
   - Returns correct content structure for each step

4. **Word Export**
   - Generates valid .docx file
   - Includes step name as title
   - Includes description section

### Property-Based Tests

Property-based tests will use a testing library (e.g., fast-check for TypeScript) to verify universal properties:

1. **Property 1**: Step metadata consistency
   - Generate random step numbers 2-10
   - Verify displayed metadata matches configuration

2. **Property 2**: Description validation
   - Generate random strings of various lengths
   - Verify validation behavior based on length

3. **Property 3**: Standalone execution independence
   - Generate random valid requests
   - Verify no workflow context required

4. **Property 4**: Output structure validation
   - Generate random step executions
   - Verify output conforms to expected schema

5. **Property 7**: API request validation
   - Generate random step numbers (including invalid)
   - Verify correct HTTP status codes

### Integration Tests

1. **End-to-end flow**: Select step → Enter description → Generate → View output → Download
2. **Session persistence**: Generate → Refresh → Verify cleared
3. **Multiple executions**: Generate step 2 → Generate step 3 → Verify both work

### Test Configuration

- Property tests: Minimum 100 iterations per property
- Timeout: 30 seconds for generation tests
- Mock OpenAI responses for unit tests
- Use real OpenAI for integration tests (with rate limiting)
