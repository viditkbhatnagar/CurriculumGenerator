# Quality Assurance Service

## Overview

The Quality Assurance Service provides automated validation of curriculum content against AGCQ standards. It performs comprehensive checks on learning outcomes, sources, citations, hours distribution, and overall structure.

## Features

### Automated Validation Checks

1. **Source Validation** (Requirement 6.1)
   - Validates publication dates (≤5 years or marked as foundational exceptions)
   - Checks source credibility and metadata
   - Identifies outdated or missing sources

2. **Learning Outcomes Validation** (Requirement 6.2)
   - Verifies use of Bloom's Taxonomy verbs
   - Checks Verb+Object+Context structure
   - Validates program has 5-8 learning outcomes
   - Validates modules have 6-8 units

3. **Hours Distribution Validation** (Requirement 6.3, 6.4)
   - Ensures total hours sum to 120
   - Checks for balanced distribution across modules
   - Identifies modules with excessive or insufficient hours

4. **Citation Validation** (Requirement 6.4)
   - Validates APA 7th edition format
   - Checks for missing citations
   - Provides formatting suggestions

5. **Structure Validation** (Requirement 6.3)
   - Validates module count
   - Checks assessment package completeness
   - Verifies skill book presence

### Quality Assurance Reports (Requirement 6.5)

The service generates comprehensive QA reports including:

- **Overall Quality Score** (0-100)
  - Calculated based on errors and warnings
  - Errors: -10 points each
  - Warnings: -5 points each

- **Compliance Issues**
  - Categorized by severity (error vs warning)
  - Specific location information
  - Actionable suggestions for correction

- **Recommendations**
  - Category-specific improvement suggestions
  - Prioritized by severity
  - Actionable next steps

- **Passed Checks**
  - Transparent list of all successful validations
  - Provides confidence in curriculum quality

## Usage

### Validate Curriculum

```typescript
import { qualityAssuranceService } from './services/qualityAssuranceService';

const curriculum: Curriculum = {
  programId: 'program-123',
  programSpec: { /* ... */ },
  unitSpecs: [ /* ... */ ],
  assessmentPackage: { /* ... */ },
  skillBook: [ /* ... */ ],
  generatedAt: new Date(),
};

const qaReport = await qualityAssuranceService.validateCurriculum(curriculum);

console.log(`Quality Score: ${qaReport.overallScore}/100`);
console.log(`Issues Found: ${qaReport.complianceIssues.length}`);
console.log(`Passed Checks: ${qaReport.passedChecks.length}`);
```

### Get QA Report

```typescript
const qaReport = await qualityAssuranceService.getQAReport('program-123');

if (qaReport) {
  console.log('QA Report:', qaReport);
}
```

### API Endpoint

```bash
GET /api/curriculum/:programId/qa-report
```

Response:
```json
{
  "data": {
    "programId": "program-123",
    "overallScore": 85,
    "complianceIssues": [
      {
        "category": "Learning Outcomes",
        "severity": "warning",
        "description": "Learning outcome is too short",
        "location": "Module BI101 LO 3",
        "suggestion": "Expand to include what students will do..."
      }
    ],
    "recommendations": [
      "Learning Outcomes: Review 2 warnings for quality improvement",
      "Address remaining warnings to achieve excellent quality rating"
    ],
    "passedChecks": [
      "Source Validation: source-123",
      "Learning Outcomes Count: Program Specification",
      "Hours Distribution: Program Structure - Module Count"
    ],
    "generatedAt": "2024-10-28T09:00:00.000Z"
  }
}
```

## Bloom's Taxonomy Verbs

The service validates learning outcomes against Bloom's Taxonomy verbs:

- **Remember**: define, identify, list, name, recall, recognize, state, describe
- **Understand**: classify, describe, discuss, explain, express, identify, indicate, locate, recognize, report, restate, review, select, translate
- **Apply**: apply, choose, demonstrate, dramatize, employ, illustrate, interpret, operate, practice, schedule, sketch, solve, use, write
- **Analyze**: analyze, appraise, calculate, categorize, compare, contrast, criticize, differentiate, discriminate, distinguish, examine, experiment, question, test
- **Evaluate**: appraise, argue, assess, attach, choose, compare, defend, estimate, evaluate, judge, predict, rate, select, support, value
- **Create**: assemble, construct, create, design, develop, formulate, generate, integrate, invent, make, plan, produce, propose, synthesize

## Quality Score Calculation

```
Quality Score = 100 - (errors × 10) - (warnings × 5)
Minimum Score = 0
Maximum Score = 100
```

### Score Interpretation

- **90-100**: Excellent - Meets all AGCQ standards
- **75-89**: Good - Minor improvements needed
- **60-74**: Satisfactory - Several issues to address
- **Below 60**: Needs Improvement - Significant revisions required

## Database Schema

### qa_reports Table

```sql
CREATE TABLE qa_reports (
  id UUID PRIMARY KEY,
  program_id UUID UNIQUE REFERENCES programs(id),
  overall_score INTEGER CHECK (overall_score >= 0 AND overall_score <= 100),
  compliance_issues JSONB,
  recommendations JSONB,
  passed_checks JSONB,
  generated_at TIMESTAMP,
  created_at TIMESTAMP
);
```

## Integration

The QA service is automatically integrated into the curriculum generation pipeline:

1. Curriculum generation completes
2. QA service validates the curriculum
3. QA report is generated and stored
4. Report is available via API

## Testing

Run tests:
```bash
npm test -- qualityAssurance.test.ts
```

The test suite covers:
- Learning outcomes validation
- Hours validation
- Citation validation
- Quality score calculation
- Bloom's Taxonomy verb recognition
- Recommendations generation

## Future Enhancements

- AI-powered content quality assessment
- Plagiarism detection
- Readability scoring
- Accessibility compliance checking
- Industry alignment validation
