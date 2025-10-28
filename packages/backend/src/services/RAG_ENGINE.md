# RAG Engine Documentation

## Overview

The RAG (Retrieval-Augmented Generation) Engine is a core component of the Curriculum Generator App that enables intelligent content retrieval and source attribution. It implements semantic search, multi-query retrieval, hybrid search, and automatic citation generation.

## Features

### 1. Semantic Search
- **Query Embedding**: Converts search queries into vector embeddings using OpenAI's text-embedding-3-large model
- **Similarity Threshold**: Configurable minimum similarity score (default: 0.75)
- **Recency Filtering**: Prioritizes sources published within 5 years
- **Credibility Ranking**: Ranks results by credibility score from source validation

### 2. Multi-Query Retrieval
- **Query Variations**: Automatically generates 3 variations of each query for comprehensive coverage
- **Deduplication**: Removes duplicate sources across query variations
- **Enhanced Coverage**: Captures more relevant sources than single-query search

### 3. Hybrid Search
- **Semantic + Keyword**: Combines vector similarity (70% weight) with keyword matching (30% weight)
- **PostgreSQL Full-Text Search**: Uses PostgreSQL's built-in text search capabilities
- **Balanced Results**: Provides both semantically similar and keyword-matched content

### 4. Re-Ranking
- **Cross-Encoder Logic**: Re-ranks results based on term frequency and relevance
- **Improved Precision**: Ensures the most relevant sources appear first
- **Configurable**: Can be extended with actual cross-encoder models

### 5. Source Attribution
- **APA 7th Edition**: Automatically generates properly formatted citations
- **Source Tracking**: Links generated content to source IDs in database
- **Citation Management**: Maintains references for all generated content

## API Endpoints

### POST /api/rag/search
Perform semantic search on the knowledge base.

**Request Body:**
```json
{
  "query": "machine learning fundamentals",
  "options": {
    "maxSources": 10,
    "minSimilarity": 0.75,
    "recencyWeight": 0.3,
    "domains": ["machine-learning", "ai"]
  }
}
```

**Response:**
```json
{
  "query": "machine learning fundamentals",
  "results": [
    {
      "content": "Machine learning is a subset of artificial intelligence...",
      "source": {
        "title": "Introduction to Machine Learning",
        "author": "John Doe",
        "publicationDate": "2023-01-15T00:00:00.000Z",
        "domain": "machine-learning",
        "credibilityScore": 85,
        "tags": ["ml", "ai", "fundamentals"]
      },
      "similarityScore": 0.89,
      "relevanceRank": 1,
      "sourceId": "kb_12345"
    }
  ],
  "count": 10
}
```

### POST /api/rag/multi-query-search
Perform multi-query retrieval with query variations.

**Request Body:**
```json
{
  "query": "data visualization techniques",
  "options": {
    "maxSources": 8,
    "minSimilarity": 0.70
  }
}
```

### POST /api/rag/hybrid-search
Perform hybrid search combining semantic and keyword search.

**Request Body:**
```json
{
  "query": "neural networks deep learning",
  "options": {
    "maxSources": 10,
    "minSimilarity": 0.75
  }
}
```

### POST /api/rag/retrieve-context
Retrieve context for content generation.

**Request Body:**
```json
{
  "query": "explain supervised learning",
  "options": {
    "maxSources": 5,
    "minSimilarity": 0.80
  }
}
```

**Response:**
```json
{
  "query": "explain supervised learning",
  "contexts": [
    {
      "content": "Supervised learning is a type of machine learning...",
      "source": { /* source metadata */ },
      "relevanceScore": 0.92,
      "sourceId": "kb_12345"
    }
  ],
  "count": 5
}
```

### POST /api/rag/generate-with-attribution
Generate content with source attribution and citations.

**Request Body:**
```json
{
  "query": "benefits of project-based learning",
  "options": {
    "maxSources": 6,
    "minSimilarity": 0.75
  }
}
```

**Response:**
```json
{
  "content": "Generated content...\n\n## References\n\n1. Author, A. (2023, January 15). Title. Domain. URL",
  "citations": [
    {
      "sourceId": "kb_12345",
      "citationText": "Author, A. (2023, January 15). Title. Domain. URL",
      "position": 1
    }
  ],
  "sources": [ /* array of source metadata */ ]
}
```

### POST /api/rag/track-source-usage
Track which sources were used for generated content.

**Request Body:**
```json
{
  "contentId": "program_spec_12345",
  "sourceIds": ["kb_001", "kb_002", "kb_003"],
  "contentType": "program_specification"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Source usage tracked successfully",
  "contentId": "program_spec_12345",
  "trackedSources": 3
}
```

### GET /api/rag/content-sources/:contentId
Get sources used for a specific piece of generated content.

**Response:**
```json
{
  "contentId": "program_spec_12345",
  "sources": [
    {
      "source": { /* source metadata */ },
      "sourceUrl": "https://example.com/source"
    }
  ],
  "count": 3
}
```

## Configuration Options

### RetrievalOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxSources` | number | 10 | Maximum number of sources to retrieve (2-10) |
| `minSimilarity` | number | 0.75 | Minimum similarity threshold (0-1) |
| `recencyWeight` | number | 0.3 | Weight given to source recency (0-1) |
| `domains` | string[] | undefined | Filter by specific knowledge domains |

## Requirements Mapping

### Requirement 3.1: Semantic Search
- ✅ Generates query embeddings using OpenAI
- ✅ Performs similarity search in Pinecone
- ✅ Configurable similarity threshold (default 0.75)

### Requirement 3.2: Recency Filtering
- ✅ Filters results by publication date
- ✅ Prioritizes sources within 5 years
- ✅ Supports foundational exceptions

### Requirement 3.3: Credibility Ranking
- ✅ Ranks sources by credibility score
- ✅ Prioritizes peer-reviewed journals
- ✅ Considers professional associations

### Requirement 3.4: Multi-Query and Hybrid Search
- ✅ Generates 3 query variations
- ✅ Combines results with deduplication
- ✅ Implements hybrid search (70% semantic, 30% keyword)
- ✅ Re-ranks using cross-encoder logic
- ✅ Limits results to 2-10 sources per topic

### Requirement 3.5: Source Attribution
- ✅ Tracks sources used for generated content
- ✅ Generates APA 7th edition citations
- ✅ Links content to source IDs in database

## Usage Examples

See `packages/backend/src/examples/ragEngine.example.ts` for comprehensive usage examples.

### Basic Usage

```typescript
import { RAGEngine } from './services/ragEngine';
import { getPool } from './db';

const ragEngine = new RAGEngine(getPool());

// Perform semantic search
const results = await ragEngine.semanticSearch('machine learning', {
  maxSources: 5,
  minSimilarity: 0.75,
});

// Retrieve context for generation
const contexts = await ragEngine.retrieveContext('explain neural networks', {
  maxSources: 5,
  minSimilarity: 0.80,
});

// Generate content with citations
const content = await ragEngine.generateContentWithAttribution(
  'benefits of active learning',
  { maxSources: 6 }
);
```

## Database Schema

### content_source_attribution Table

```sql
CREATE TABLE content_source_attribution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id VARCHAR(255) NOT NULL,
  content_type VARCHAR(100) NOT NULL,
  source_id UUID NOT NULL REFERENCES knowledge_base(id),
  created_at TIMESTAMP DEFAULT NOW()
);
```

This table tracks which sources were used for each piece of generated content, enabling full traceability and citation management.

## Performance Considerations

1. **Caching**: Query embeddings and search results are cached in Redis
2. **Batch Processing**: Multiple queries are processed in parallel
3. **Index Optimization**: Pinecone indexes are optimized for fast similarity search
4. **Connection Pooling**: PostgreSQL connections are pooled for efficiency

## Future Enhancements

1. **Cross-Encoder Model**: Integrate actual cross-encoder model for re-ranking
2. **Query Expansion**: Use LLM to generate more sophisticated query variations
3. **Relevance Feedback**: Learn from user interactions to improve ranking
4. **Multi-Modal Search**: Support image and video content retrieval
5. **Federated Search**: Search across multiple vector databases

## Error Handling

All RAG engine methods throw descriptive errors that can be caught and handled:

```typescript
try {
  const results = await ragEngine.semanticSearch(query);
} catch (error) {
  console.error('Search failed:', error.message);
  // Handle error appropriately
}
```

## Testing

Run tests for the RAG engine:

```bash
npm test -- ragEngine.test.ts
```

## Support

For issues or questions about the RAG engine, please refer to:
- Design document: `.kiro/specs/curriculum-generator-app/design.md`
- Requirements: `.kiro/specs/curriculum-generator-app/requirements.md`
- Examples: `packages/backend/src/examples/ragEngine.example.ts`
