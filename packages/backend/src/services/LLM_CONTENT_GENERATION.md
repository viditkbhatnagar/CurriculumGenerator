# LLM Content Generation Service

## Overview

The LLM Content Generation Service integrates OpenAI GPT-4 with the RAG (Retrieval-Augmented Generation) engine to produce context-aware, source-attributed curriculum content. This service implements Requirements 5.1, 5.2, 5.4, and 3.5.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                Content Generation Service                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐ │
│  │   Prompt     │    │     RAG      │    │     LLM      │ │
│  │  Templates   │───▶│    Engine    │───▶│   Service    │ │
│  └──────────────┘    └──────────────┘    └──────────────┘ │
│         │                    │                    │         │
│         │                    │                    │         │
│         ▼                    ▼                    ▼         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Generated Content + Citations           │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Components

### 1. LLM Service (`llmService.ts`)

Core wrapper for OpenAI GPT-4 with enterprise-grade features:

#### Features

- **Error Handling**: Comprehensive error catching and logging
- **Retry Logic**: Exponential backoff for transient failures (3 retries)
- **Circuit Breaker**: Prevents cascading failures (5 failure threshold, 60s timeout)
- **Timeout Management**: 30-second default timeout for all requests
- **Streaming Support**: Real-time content generation for better UX

#### Methods

```typescript
// Standard content generation
async generateContent(
  prompt: string,
  systemPrompt?: string,
  options?: LLMOptions
): Promise<string>

// Streaming generation
async generateContentStream(
  prompt: string,
  systemPrompt: string | undefined,
  callback: StreamCallback,
  options?: LLMOptions
): Promise<void>

// Structured JSON output
async generateStructuredOutput<T>(
  prompt: string,
  systemPrompt: string,
  options?: LLMOptions
): Promise<T>
```

#### Circuit Breaker States

- **CLOSED**: Normal operation
- **OPEN**: Service unavailable (after 5 failures)
- **HALF_OPEN**: Testing recovery (after 60s timeout)

### 2. Prompt Templates (`promptTemplates.ts`)

Pre-configured templates for different content types:

#### Available Templates

1. **program_overview**: Complete program specification documents
2. **unit_content**: Detailed unit specifications with learning outcomes
3. **assessment**: MCQs, case studies, and rubrics
4. **skill_mapping**: Skill book entries with KPIs and activities
5. **quality_check**: QA feedback and compliance checking

#### Template Structure

```typescript
interface PromptTemplate {
  name: string;
  systemPrompt: string;
  buildUserPrompt: (params: any) => string;
}
```

#### Example Usage

```typescript
import { getTemplate } from './promptTemplates';

const template = getTemplate('program_overview');
const userPrompt = template.buildUserPrompt({
  programName: 'Data Analytics Certificate',
  qualificationLevel: 'Level 7',
  industryContext: 'Business Intelligence',
  targetAudience: 'Mid-career professionals',
  sources: [...],
});
```

### 3. Content Generation Service (`contentGenerationService.ts`)

High-level service integrating RAG and LLM:

#### Features

- **Context-Aware Generation**: Retrieves relevant sources before generation
- **Source Attribution**: Automatic APA 7th edition citations
- **Fact-Checking**: Validates generated content against sources
- **Caching**: Redis-based caching (24-hour TTL)
- **Fallback Strategies**: Multiple fallback options on failure
- **Streaming Support**: Real-time content delivery

#### Methods

```typescript
// Standard generation with caching
async generateContent(request: GenerationRequest): Promise<GenerationResult>

// Streaming generation
async generateContentStream(
  request: GenerationRequest,
  callback: StreamCallback
): Promise<GenerationResult>

// Structured JSON generation
async generateStructuredContent<T>(
  request: GenerationRequest
): Promise<{ data: T; sources: string[]; confidence: number }>

// Generation with fallback strategies
async generateWithFallback(request: GenerationRequest): Promise<GenerationResult>

// Fact-check content
async factCheck(
  generatedContent: string,
  contexts: Context[]
): Promise<FactCheckResult>
```

## Usage Examples

### Example 1: Generate Program Overview

```typescript
import { ContentGenerationService } from './services/contentGenerationService';
import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });
const contentGen = new ContentGenerationService(db);

const result = await contentGen.generateContent({
  templateName: 'program_overview',
  templateParams: {
    programName: 'Advanced Data Analytics',
    qualificationLevel: 'Level 7',
    industryContext: 'Business Intelligence',
    targetAudience: 'Mid-career professionals',
  },
  retrievalQuery: 'data analytics certification requirements trends',
  retrievalOptions: {
    maxSources: 8,
    minSimilarity: 0.75,
  },
  llmOptions: {
    temperature: 0.7,
    maxTokens: 2500,
  },
});

console.log(result.content);
console.log(`Confidence: ${result.confidence}`);
console.log(`Sources: ${result.usedSources.length}`);
```

### Example 2: Streaming Generation

```typescript
const result = await contentGen.generateContentStream(
  {
    templateName: 'unit_content',
    templateParams: {
      unitTitle: 'Data Visualization',
      unitCode: 'DA101',
      hours: 20,
      learningOutcomes: [...],
    },
    retrievalQuery: 'data visualization techniques tools',
  },
  (chunk) => {
    if (!chunk.done) {
      process.stdout.write(chunk.content);
    }
  }
);
```

### Example 3: Generate Skill Mappings (Structured)

```typescript
const result = await contentGen.generateStructuredContent({
  templateName: 'skill_mapping',
  templateParams: {
    competencyDomain: 'Data Analysis',
    skills: ['Statistical Analysis', 'Data Cleaning'],
    learningOutcomes: [...],
  },
  retrievalQuery: 'data analysis skills workplace applications',
});

console.log(result.data); // Structured JSON output
```

### Example 4: Fallback Strategy

```typescript
// Automatically handles failures with multiple fallback options
const result = await contentGen.generateWithFallback({
  templateName: 'unit_content',
  templateParams: {...},
  retrievalQuery: 'machine learning algorithms',
  useCache: true,
});

console.log(`Cached: ${result.cached}`);
```

## Fallback Strategies

The service implements a three-tier fallback system:

1. **Primary**: Standard generation with full context
2. **Fallback 1**: Use cached results if available
3. **Fallback 2**: Simplified prompt (lower tokens, lower temperature)
4. **Fallback 3**: Compile content directly from sources

## Fact-Checking

The service includes automatic fact-checking:

```typescript
const factCheck = await contentGen.factCheck(generatedContent, contexts);

console.log(`Accuracy: ${factCheck.overallScore}%`);
console.log(`Issues: ${factCheck.issues.length}`);

factCheck.issues.forEach(issue => {
  console.log(`[${issue.severity}] ${issue.claim}`);
  console.log(`  ${issue.issue}`);
});
```

### Fact-Check Algorithm

1. Extract claims from generated content
2. Check each claim against source material
3. Calculate similarity score (word overlap)
4. Flag unsupported claims (< 50% word match)
5. Generate overall accuracy score

## Caching

Content is cached in Redis with a 24-hour TTL:

- **Cache Key**: Hash of template name, query, and parameters
- **Cache Hit**: Returns cached result immediately
- **Cache Miss**: Generates new content and caches it
- **Cache Bypass**: Set `useCache: false` in request

## Error Handling

### Retryable Errors

- 429: Rate limit exceeded
- 500: Internal server error
- 502: Bad gateway
- 503: Service unavailable
- 504: Gateway timeout

### Non-Retryable Errors

- 400: Invalid request
- 401: Authentication failed
- 403: Forbidden
- 404: Not found

### Circuit Breaker

After 5 consecutive failures:
- Circuit opens (blocks requests)
- Waits 60 seconds
- Enters half-open state
- Requires 2 successes to close

## Performance Considerations

### Timeouts

- Default: 30 seconds
- Configurable per request
- Automatic abort on timeout

### Token Limits

- Default: 2000 tokens
- Program overview: 2500 tokens
- Unit content: 3000 tokens
- Assessments: 2000 tokens

### Temperature Settings

- Creative content: 0.7
- Structured content: 0.6
- Fact-based content: 0.5

## Monitoring

### Key Metrics

- Generation success rate
- Average response time
- Cache hit rate
- Circuit breaker state
- Fact-check accuracy scores
- Token usage and costs

### Logging

All operations are logged with:
- Request parameters
- Response metadata
- Error details
- Performance metrics

## Configuration

### Environment Variables

```bash
OPENAI_API_KEY=sk-...
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://...
```

### Service Configuration

```typescript
// In llmService.ts
private readonly defaultTimeout = 30000; // 30 seconds
private readonly maxRetries = 3;
private readonly retryDelay = 1000; // 1 second

// In contentGenerationService.ts
private readonly cacheTTL = 86400; // 24 hours
```

## Best Practices

1. **Always use caching** for repeated content generation
2. **Set appropriate timeouts** based on content complexity
3. **Monitor circuit breaker state** for service health
4. **Use streaming** for long-form content generation
5. **Implement fact-checking** for critical content
6. **Handle fallbacks gracefully** in production
7. **Log all generations** for audit and debugging

## Testing

See `examples/contentGeneration.example.ts` for comprehensive examples.

Run examples:
```bash
tsx src/examples/contentGeneration.example.ts
```

## Future Enhancements

- [ ] Support for multiple LLM providers (Claude, Gemini)
- [ ] Advanced fact-checking with NLP models
- [ ] A/B testing for prompt variations
- [ ] Cost optimization with model selection
- [ ] Batch generation for multiple units
- [ ] Real-time quality scoring during generation

## Related Documentation

- [RAG Engine](./RAG_ENGINE.md)
- [Prompt Engineering Guide](./PROMPT_ENGINEERING.md)
- [API Endpoints](../../API_ENDPOINTS.md)

