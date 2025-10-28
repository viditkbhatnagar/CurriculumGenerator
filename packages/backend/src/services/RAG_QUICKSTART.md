# RAG Engine Quick Start Guide

## 🚀 Getting Started in 5 Minutes

### Prerequisites
- Node.js 18+
- PostgreSQL database
- Pinecone account
- OpenAI API key

### 1. Environment Setup

Create a `.env` file in `packages/backend/`:

```env
# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-api-key

# Pinecone Configuration
PINECONE_API_KEY=your-pinecone-api-key
PINECONE_INDEX_NAME=curriculum-knowledge-base

# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/curriculum_db

# Redis Configuration (optional, for caching)
REDIS_URL=redis://localhost:6379
```

### 2. Initialize Database

Run migrations to create required tables:

```bash
npm run migrate:up --prefix packages/backend
```

### 3. Start the Server

```bash
npm run dev --prefix packages/backend
```

The RAG engine API will be available at `http://localhost:4000/api/rag`

## 📝 Basic Usage Examples

### Example 1: Simple Semantic Search

```bash
curl -X POST http://localhost:4000/api/rag/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "machine learning fundamentals",
    "options": {
      "maxSources": 5,
      "minSimilarity": 0.75
    }
  }'
```

### Example 2: Multi-Query Search

```bash
curl -X POST http://localhost:4000/api/rag/multi-query-search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "neural networks",
    "options": {
      "maxSources": 8
    }
  }'
```

### Example 3: Hybrid Search

```bash
curl -X POST http://localhost:4000/api/rag/hybrid-search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "deep learning applications",
    "options": {
      "maxSources": 10,
      "minSimilarity": 0.70
    }
  }'
```

## 💻 Code Examples

### TypeScript/Node.js

```typescript
import { RAGEngine } from './services/ragEngine';
import { getPool } from './db';

// Initialize RAG engine
const ragEngine = new RAGEngine(getPool());

// Perform semantic search
async function searchExample() {
  const results = await ragEngine.semanticSearch(
    'explain supervised learning',
    {
      maxSources: 5,
      minSimilarity: 0.80,
      recencyWeight: 0.3
    }
  );

  console.log(`Found ${results.length} sources`);
  results.forEach(result => {
    console.log(`- ${result.source.title}`);
    console.log(`  Score: ${result.similarityScore.toFixed(2)}`);
  });
}

// Retrieve context for content generation
async function retrieveContextExample() {
  const contexts = await ragEngine.retrieveContext(
    'benefits of active learning',
    { maxSources: 5 }
  );

  // Use contexts with LLM for content generation
  const prompt = `Based on the following sources, explain active learning:\n\n`;
  contexts.forEach((ctx, i) => {
    prompt += `Source ${i + 1}: ${ctx.content}\n\n`;
  });

  // Pass prompt to LLM...
}

// Generate content with citations
async function generateWithCitationsExample() {
  const result = await ragEngine.generateContentWithAttribution(
    'project-based learning strategies',
    { maxSources: 6 }
  );

  console.log(result.content); // Content with APA citations
  console.log(`Used ${result.sources.length} sources`);
}

// Track source usage
async function trackSourcesExample() {
  await ragEngine.trackSourceUsage(
    'program_spec_12345',
    ['kb_001', 'kb_002', 'kb_003'],
    'program_specification'
  );

  console.log('Source usage tracked');
}
```

### Frontend/React Example

```typescript
// API client
async function searchKnowledgeBase(query: string) {
  const response = await fetch('http://localhost:4000/api/rag/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      query,
      options: {
        maxSources: 5,
        minSimilarity: 0.75
      }
    })
  });

  return await response.json();
}

// React component
function SearchComponent() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  const handleSearch = async () => {
    const data = await searchKnowledgeBase(query);
    setResults(data.results);
  };

  return (
    <div>
      <input 
        value={query} 
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search knowledge base..."
      />
      <button onClick={handleSearch}>Search</button>
      
      <div>
        {results.map((result, i) => (
          <div key={i}>
            <h3>{result.source.title}</h3>
            <p>Score: {result.similarityScore.toFixed(2)}</p>
            <p>{result.content.substring(0, 200)}...</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## 🔧 Configuration Options

### RetrievalOptions

```typescript
interface RetrievalOptions {
  // Maximum number of sources to retrieve (2-10)
  maxSources?: number;        // Default: 10
  
  // Minimum similarity threshold (0-1)
  minSimilarity?: number;     // Default: 0.75
  
  // Weight given to source recency (0-1)
  recencyWeight?: number;     // Default: 0.3
  
  // Filter by specific knowledge domains
  domains?: string[];         // Default: undefined (all domains)
}
```

### Usage Examples

```typescript
// High precision search
const preciseResults = await ragEngine.semanticSearch(query, {
  maxSources: 3,
  minSimilarity: 0.90,  // Very high threshold
  recencyWeight: 0.1     // Less emphasis on recency
});

// Recent sources only
const recentResults = await ragEngine.semanticSearch(query, {
  maxSources: 10,
  minSimilarity: 0.70,
  recencyWeight: 0.6     // High emphasis on recency
});

// Domain-specific search
const domainResults = await ragEngine.semanticSearch(query, {
  maxSources: 5,
  domains: ['machine-learning', 'artificial-intelligence']
});
```

## 🎯 Common Use Cases

### Use Case 1: Curriculum Content Generation

```typescript
async function generateCurriculumContent(topic: string) {
  // 1. Retrieve relevant context
  const contexts = await ragEngine.retrieveContext(topic, {
    maxSources: 8,
    minSimilarity: 0.80
  });

  // 2. Generate content with LLM (not shown)
  const generatedContent = await llmService.generate(contexts);

  // 3. Add citations
  const withCitations = await ragEngine.attributeSources(
    generatedContent,
    contexts
  );

  // 4. Track source usage
  await ragEngine.trackSourceUsage(
    contentId,
    contexts.map(c => c.sourceId),
    'curriculum_content'
  );

  return withCitations;
}
```

### Use Case 2: Quality Assurance

```typescript
async function validateContentSources(contentId: string) {
  // Get sources used for content
  const sources = await ragEngine.getContentSources(contentId);

  // Check source quality
  const issues = [];
  for (const { source } of sources) {
    // Check recency
    const age = new Date().getFullYear() - source.publicationDate.getFullYear();
    if (age > 5 && !source.isFoundational) {
      issues.push(`Source "${source.title}" is ${age} years old`);
    }

    // Check credibility
    if (source.credibilityScore < 70) {
      issues.push(`Source "${source.title}" has low credibility (${source.credibilityScore})`);
    }
  }

  return { valid: issues.length === 0, issues };
}
```

### Use Case 3: Student Tutor Bot

```typescript
async function answerStudentQuestion(question: string, courseId: string) {
  // Search for relevant course content
  const contexts = await ragEngine.retrieveContext(question, {
    maxSources: 3,
    minSimilarity: 0.85,
    domains: [courseId]
  });

  if (contexts.length === 0) {
    return "I don't have enough information to answer that question.";
  }

  // Generate response with LLM
  const response = await llmService.generateTutorResponse(question, contexts);

  // Include source references
  const references = contexts.map((ctx, i) => 
    `[${i + 1}] ${ctx.source.title}`
  ).join('\n');

  return `${response}\n\nReferences:\n${references}`;
}
```

## 🐛 Troubleshooting

### Issue: "No results found"

**Possible causes:**
- Similarity threshold too high
- No sources in knowledge base
- Query too specific

**Solutions:**
```typescript
// Lower similarity threshold
const results = await ragEngine.semanticSearch(query, {
  minSimilarity: 0.65  // Lower threshold
});

// Use multi-query for better coverage
const results = await ragEngine.multiQueryRetrieval(query);

// Try hybrid search
const results = await ragEngine.hybridSearch(query);
```

### Issue: "Search is slow"

**Possible causes:**
- Too many sources requested
- No caching enabled
- Database connection issues

**Solutions:**
```typescript
// Reduce maxSources
const results = await ragEngine.semanticSearch(query, {
  maxSources: 5  // Fewer sources = faster
});

// Enable Redis caching (in .env)
REDIS_URL=redis://localhost:6379

// Use connection pooling (already configured)
```

### Issue: "Citations not generating"

**Possible causes:**
- Missing source metadata
- Database connection issues

**Solutions:**
```typescript
// Check source metadata
const sources = await ragEngine.getContentSources(contentId);
console.log(sources);

// Manually generate citation
const citation = ragEngine.generateAPACitation(source, sourceUrl);
```

## 📚 Additional Resources

- **Full Documentation**: `packages/backend/src/services/RAG_ENGINE.md`
- **Architecture**: `packages/backend/src/services/RAG_ARCHITECTURE.md`
- **Examples**: `packages/backend/src/examples/ragEngine.example.ts`
- **API Reference**: See RAG_ENGINE.md for complete API documentation

## 🤝 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the full documentation
3. Check example code in `examples/ragEngine.example.ts`
4. Review requirements in `.kiro/specs/curriculum-generator-app/requirements.md`

## ✅ Next Steps

1. ✅ RAG engine is implemented and ready
2. 🔄 Integrate with LLM service (Task 7)
3. 🔄 Use in curriculum generator (Task 9)
4. 🔄 Add to tutor bot (Task 13)

Happy coding! 🚀
