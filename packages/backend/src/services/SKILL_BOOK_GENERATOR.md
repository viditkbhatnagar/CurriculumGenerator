# Skill Book Generator Service

## Overview

The Skill Book Generator service automatically generates skill mappings from competency frameworks and links them to learning outcomes using semantic similarity. This service implements Requirements 4.1-4.5 from the curriculum generator specification.

## Features

### 1. Skill Mapping Generation (Task 8.1)
- Extracts skills from competency domains
- Uses LLM with structured JSON output to generate comprehensive skill mappings
- Creates practical activities with detailed specifications
- Generates measurable KPIs with numeric thresholds or completion criteria
- Validates all KPIs are measurable

### 2. Learning Outcome Linking (Task 8.2)
- Links skills to learning outcomes using semantic similarity
- Uses OpenAI embeddings for semantic matching
- Calculates cosine similarity between skill descriptions and learning outcomes
- Ensures each skill links to at least 2 learning outcomes
- Filters by similarity threshold (0.7) and ranks by relevance
- Validates all skills have required activity and outcome links

### 3. Database Storage
- Stores skill mappings with unique identifiers (UUIDs)
- Supports transactional operations
- Retrieves skill mappings by program ID

## Key Methods

### `generateSkillMappings(request)`
Generates skill mappings from competency domains and modules.

**Parameters:**
- `request.programId` - Program identifier
- `request.competencyDomains` - Array of competency domains with skills
- `request.modules` - Array of modules with units

**Returns:** `SkillMappingGenerationResult` with generated skill mappings

### `linkToLearningOutcomes(skillMappings, learningOutcomes)`
Links skills to learning outcomes using semantic similarity.

**Parameters:**
- `skillMappings` - Array of skill mappings to link
- `learningOutcomes` - Array of learning outcomes with IDs and text

**Returns:** Updated skill mappings with `linkedOutcomes` populated

**Algorithm:**
1. Generate embeddings for skill descriptions (name + activity descriptions)
2. Generate embeddings for learning outcome texts
3. Calculate cosine similarity between each skill and all outcomes
4. Select top 2-5 most similar outcomes (similarity > 0.7)
5. Ensure minimum of 2 outcomes per skill
6. Validate all skills meet requirements

### `storeSkillMappings(programId, skillMappings)`
Stores skill mappings in the database.

**Parameters:**
- `programId` - Program identifier
- `skillMappings` - Array of skill mappings to store

**Database Schema:**
```sql
skill_mappings (
  id UUID PRIMARY KEY,
  program_id UUID,
  skill_name VARCHAR(255),
  domain VARCHAR(100),
  activities JSONB,
  kpis JSONB,
  linked_outcomes UUID[],
  assessment_criteria JSONB
)
```

## Data Structures

### SkillMapping
```typescript
{
  skillId: string;              // Unique UUID
  skillName: string;            // e.g., "Data Analysis"
  domain: string;               // e.g., "Technical Skills"
  activities: PracticalActivity[];
  kpis: MeasurableKPI[];
  linkedOutcomes: string[];     // Learning outcome IDs
  assessmentCriteria: string[];
  workplaceApplications?: string[];
}
```

### PracticalActivity
```typescript
{
  name: string;
  description: string;
  unitLink: string;             // Module/unit reference
  durationHours: number;
  assessmentType: string;       // e.g., "Practical Project"
  resources: string[];
}
```

### MeasurableKPI
```typescript
{
  name: string;
  description: string;
  measurementCriteria: string;
  threshold?: number;           // Numeric threshold
  unit?: string;                // e.g., "projects", "percentage"
  completionCriteria?: string;  // Alternative to numeric threshold
}
```

## Requirements Coverage

### Requirement 4.1 ✅
Identifies skill labels from uploaded Competency Framework via `extractSkillsFromDomains()`.

### Requirement 4.2 ✅
Creates entries with skill name, domain, practical activities, linked units, measurable KPIs, assessment criteria, and workplace applications via `generateSkillMappingsWithLLM()`.

### Requirement 4.3 ✅
Links each skill to at least 1 activity and 2 learning outcomes via `linkToLearningOutcomes()` and `validateSkillOutcomeLinks()`.

### Requirement 4.4 ✅
Generates measurable KPIs with numeric thresholds or completion criteria, validated by `validateMeasurableKPIs()`.

### Requirement 4.5 ✅
Stores Skill Book entries in database with unique skill identifiers via `storeSkillMappings()`.

## Testing

Comprehensive test suite in `src/__tests__/skillBookGenerator.test.ts`:
- Tests semantic similarity matching
- Validates minimum outcome linking (2 per skill)
- Tests activity requirement validation
- Tests cosine similarity calculations
- Uses mocked embedding service for deterministic testing

## Usage Example

```typescript
import { skillBookGenerator } from './services/skillBookGenerator';

// 1. Generate skill mappings
const result = await skillBookGenerator.generateSkillMappings({
  programId: 'program-123',
  competencyDomains: [...],
  modules: [...]
});

// 2. Link to learning outcomes
const linkedSkills = await skillBookGenerator.linkToLearningOutcomes(
  result.skillMappings,
  learningOutcomes
);

// 3. Store in database
await skillBookGenerator.storeSkillMappings('program-123', linkedSkills);

// 4. Retrieve later
const skills = await skillBookGenerator.getSkillMappings('program-123');
```

See `src/examples/skillBookGenerator.example.ts` for complete examples.

## Dependencies

- **LLM Service**: For generating skill mappings with structured output
- **Embedding Service**: For generating embeddings and semantic similarity
- **Database**: PostgreSQL for storing skill mappings
- **OpenAI**: text-embedding-3-large model for embeddings

## Performance Considerations

- Embeddings are generated in batches of 100 to optimize API usage
- Parallel embedding generation for skills and outcomes
- Database operations use transactions for consistency
- Cosine similarity calculations are optimized for large datasets

## Error Handling

- Validates all KPIs are measurable before returning
- Ensures minimum activity and outcome requirements
- Provides detailed error messages with context
- Wraps all operations in try-catch blocks
- Logs errors with full context for debugging
