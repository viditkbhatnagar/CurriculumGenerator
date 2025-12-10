# Step 7 Assessment Generator - Integration Guide

## ✅ Completed Backend Implementation

### 1. **New Assessment Generator Service**

**File**: `packages/backend/src/services/assessmentGeneratorService.ts`

- Chunked generation strategy (formative → summative → samples → LMS)
- Sequential processing per module (avoids OpenAI 502 errors)
- Conservative token limits (16-20K instead of 32-48K)
- 1-second delays between API calls
- Robust error handling with continue-on-error

### 2. **Updated API Route**

**File**: `packages/backend/src/routes/workflowRoutes.ts`

- POST `/api/v3/workflow/:id/step7` now accepts `userPreferences` instead of old `blueprint`
- 15-minute timeout (was 10 minutes)
- Validates weightages sum to 100%
- Returns comprehensive assessment summary

### 3. **Updated Database Model**

**File**: `packages/backend/src/models/CurriculumWorkflow.ts`

- `step7` now stores: `formativeAssessments`, `summativeAssessments`, `sampleQuestions`, `lmsPackages`
- Removed old MCQ-only structure

### 4. **Updated Workflow Service**

**File**: `packages/backend/src/services/workflowService.ts`

- `processStep7()` uses new assessment generator service
- Validates PLO coverage, weightages, mappings

### 5. **Type Definitions**

**File**: `packages/backend/src/types/assessmentGenerator.ts`

- Complete Assessment Generator Contract types

---

## 🎨 New Frontend Form Created

**File**: `packages/frontend/src/components/workflow/Step7FormNew.tsx`

### Features:

- **Basic Settings Tab**:
  - Assessment Structure (formative/summative/both)
  - Assessment Balance (knowledge/applied/scenario/blended)
  - Formative Settings (types, count per module)
  - Summative Format (MCQ/written/case/project/mixed/custom)
  - Weightages with live validation

- **Advanced Options Tab**:
  - Certification Styles (SHRM, PMI, ASCM, etc.)
  - Academic Types (essays, presentations, portfolios, etc.)
  - Higher-Order PLO Policy
  - Real-world scenario toggles

- **Results Display**:
  - Formative/Summative counts
  - Sample question breakdown (MCQ/SJT/Case/Essay/Practical)
  - LMS package formats
  - Validation report

---

## 🔧 Integration Steps

### Step 1: Update Frontend Types

Add to `packages/frontend/src/types/workflow.ts`:

```typescript
// Add after existing types
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

export interface Step7FormData extends AssessmentUserPreferences {}

// Update Step7 interface in CurriculumWorkflow
export interface Step7 {
  userPreferences: AssessmentUserPreferences;
  formativeAssessments: FormativeAssessment[];
  summativeAssessments: SummativeAssessment[];
  sampleQuestions: {
    mcq: MCQSample[];
    sjt: SJTSample[];
    caseQuestions: CaseSample[];
    essayPrompts: EssaySample[];
    practicalTasks: PracticalSample[];
  };
  lmsPackages: Record<string, any>;
  validation: {
    allFormativesMapped: boolean;
    allSummativesMapped: boolean;
    weightsSum100: boolean;
    sufficientSampleQuestions: boolean;
    plosCovered: boolean;
  };
  generatedAt: Date;
  validatedAt?: Date;
  approvedAt?: Date;
}

// Sample types
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
}

export interface SummativeAssessment {
  id: string;
  scope: 'course_level' | 'module_level';
  moduleId?: string;
  title: string;
  format: string;
  overview: string;
  alignmentTable: Array<{ ploId: string; componentIds: string[] }>;
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
```

### Step 2: Replace Step7Form

In your workflow component (likely `WorkflowView.tsx` or similar):

```typescript
// Replace
import Step7Form from '@/components/workflow/Step7Form';

// With
import Step7Form from '@/components/workflow/Step7FormNew';
```

Or rename the new file to replace the old one:

```bash
cd packages/frontend/src/components/workflow
mv Step7Form.tsx Step7Form.OLD.tsx
mv Step7FormNew.tsx Step7Form.tsx
```

### Step 3: Update Hook (if needed)

Check `packages/frontend/src/hooks/useWorkflow.ts` and ensure `useSubmitStep7` sends `userPreferences`:

```typescript
export function useSubmitStep7() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: AssessmentUserPreferences }) => {
      const response = await fetch(`${API_BASE_URL}/workflow/${id}/step7`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify(data), // Send userPreferences as-is
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to submit Step 7');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['workflow', variables.id] });
    },
  });
}
```

---

## 📊 Example API Request

```json
POST /api/v3/workflow/:id/step7

{
  "assessmentStructure": "both_formative_and_summative",
  "assessmentBalance": "blended_mix",
  "certificationStyles": ["SHRM", "PMI"],
  "academicTypes": ["Case-study reports", "Presentations"],
  "summativeFormat": "mixed_format",
  "formativeTypesPerUnit": ["Short quizzes", "MCQ knowledge checks", "Mini-case exercises"],
  "formativePerModule": 2,
  "weightages": {
    "formative": 30,
    "summative": 70
  },
  "higherOrderPloPolicy": "yes",
  "useRealWorldScenarios": true,
  "alignToWorkplacePerformance": true,
  "integratedRealWorldSummative": true
}
```

## 📊 Example API Response

```json
{
  "success": true,
  "data": {
    "step7": {
      "userPreferences": {
        /* as above */
      },
      "formativeAssessments": [
        {
          "id": "form-mod1-001",
          "moduleId": "mod1",
          "title": "Short Quiz: Core HR Concepts",
          "assessmentType": "Short quizzes",
          "description": "A 10-question quiz covering fundamental HR concepts",
          "instructions": "Complete this quiz after reviewing module materials...",
          "alignedPLOs": ["PLO1", "PLO2"],
          "alignedMLOs": ["M1-LO1", "M1-LO2"],
          "assessmentCriteria": [
            "Accurate recall of key terminology",
            "Correct application of concepts"
          ],
          "maxMarks": 10
        }
      ],
      "summativeAssessments": [
        {
          "id": "summ-course-001",
          "scope": "course_level",
          "title": "Final Comprehensive Assessment",
          "format": "mixed_format",
          "overview": "A comprehensive assessment integrating knowledge and skills...",
          "alignmentTable": [{ "ploId": "PLO1", "componentIds": ["comp-001", "comp-002"] }],
          "components": [
            {
              "id": "comp-001",
              "name": "Section A: Multiple Choice Examination",
              "componentType": "mcq_section",
              "weight": 40,
              "description": "60 MCQ questions testing knowledge integration"
            }
          ],
          "markingModel": {
            "type": "criteria_only",
            "criteria": [
              {
                "name": "Knowledge and Understanding",
                "description": "Demonstrates comprehensive understanding",
                "weight": 30
              }
            ]
          }
        }
      ],
      "sampleQuestions": {
        "mcq": [
          /* 30 MCQ samples */
        ],
        "sjt": [
          /* 10 SJT samples */
        ],
        "caseQuestions": [
          /* 5 case samples */
        ],
        "essayPrompts": [
          /* 5 essay samples */
        ],
        "practicalTasks": [
          /* 5 practical samples */
        ]
      },
      "lmsPackages": {
        "canvas": {
          /* LMS structure */
        },
        "moodle": {
          /* LMS structure */
        },
        "blackboard": {
          /* LMS structure */
        }
      },
      "validation": {
        "allFormativesMapped": true,
        "allSummativesMapped": true,
        "weightsSum100": true,
        "sufficientSampleQuestions": true,
        "plosCovered": true
      },
      "generatedAt": "2025-12-08T..."
    },
    "currentStep": 7,
    "status": "step7_complete",
    "summary": {
      "formativeCount": 12,
      "summativeCount": 1,
      "sampleQuestionsTotal": 55
    }
  },
  "message": "Step 7 complete. Comprehensive assessments generated."
}
```

---

## 🐛 Troubleshooting

### Issue: Timeouts still occurring

**Solution**:

- Check OpenAI API key quota/rate limits
- Verify Render instance has enough resources
- Check logs for which stage is timing out (`formative`, `summative`, `samples`, or `lms`)

### Issue: Zero-value data (e.g., bloomLevel=null)

**Solution**:

- Check OpenAI response in logs
- Verify JSON parsing in `assessmentGeneratorService.ts` `parseJSON()` method
- Ensure prompts are generating valid JSON

### Issue: Frontend shows old MCQ structure

**Solution**:

- Clear browser cache
- Rebuild frontend: `npm run build`
- Verify you're using `Step7FormNew.tsx`

---

## ✅ Testing Checklist

- [ ] Backend compiles without errors
- [ ] Frontend compiles without errors
- [ ] API route accepts userPreferences
- [ ] Step 7 generates formative assessments
- [ ] Step 7 generates summative assessments
- [ ] Step 7 generates sample questions (all 5 types)
- [ ] Step 7 generates LMS packages
- [ ] Validation reports correct PLO coverage
- [ ] Approval works when validation passes
- [ ] Frontend displays all assessment types
- [ ] Regenerate button works
- [ ] Can navigate away during generation and come back

---

## 📝 Next Steps

1. **Test with real curriculum data** - Run through Steps 1-7 with a real course
2. **Monitor generation times** - Track how long each stage takes
3. **Refine prompts** - Adjust if assessment quality isn't meeting expectations
4. **Add export functionality** - Add buttons to export assessments to Word/Excel/LMS formats
5. **Enhance display** - Add detailed views for each formative/summative assessment
